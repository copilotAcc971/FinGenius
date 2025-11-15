import axios, { AxiosError } from 'axios';
import { storage } from '../storage';
import type { InsertExchangeRate } from '@shared/schema';
import * as xml2js from 'xml2js';
import { PythonOCRService } from './python-ocr-wrapper';

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SPIKE_THRESHOLD = 0.05; // 5% change threshold

interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: Date;
}

interface FetchResult {
  source: string;
  rates: ExchangeRateData[];
  success: boolean;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = RETRY_DELAY_MS * Math.pow(2, i);
      console.log(`Retry attempt ${i + 1}/${retries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Validate exchange rate value
 */
function validateRate(rate: number, previousRate?: number): { valid: boolean; reason?: string } {
  if (rate <= 0) {
    return { valid: false, reason: 'Rate must be greater than 0' };
  }

  if (previousRate) {
    const changePercent = Math.abs((rate - previousRate) / previousRate);
    if (changePercent > SPIKE_THRESHOLD) {
      return { 
        valid: false, 
        reason: `Spike detected: ${(changePercent * 100).toFixed(2)}% change from previous rate` 
      };
    }
  }

  return { valid: true };
}

/**
 * UAE CENTRAL BANK (CBUAE) FX RATES INTEGRATION
 * 
 * CRITICAL LIMITATION: The Central Bank of UAE does NOT provide an official public API.
 * 
 * Official Data Source: https://www.centralbank.ae/en/forex-eibor/exchange-rates/
 * - Update Frequency: Daily at 6 PM UAE time (Monday-Friday)
 * - Coverage: 70+ currencies vs AED (USD, EUR, GBP, SAR, QAR, KWD, BHD, OMR, JPY, CHF, CAD, AUD, etc.)
 * - Data Provider: Thomson Reuters rates converted to AED by CBUAE
 * - Format: HTML table only (no API, no structured data endpoint)
 * 
 * CURRENT IMPLEMENTATION:
 * Uses community-maintained GitHub mirror (https://github.com/paulbares/centralbank-ae-fx-rates)
 * - Daily scraping of official CBUAE website
 * - Provides structured JSON format
 * - Most reliable free public source available
 * - Has fallback to aggregator if mirror fails
 * 
 * PRODUCTION RECOMMENDATIONS:
 * For production environments requiring contractual SLAs and guaranteed uptime, consider:
 * 
 * 1. **Fluentax Exchange Rates API** (Recommended for Production)
 *    - URL: https://www.fluentax.com/products/exchange-rates-api/banks/AECB
 *    - Official CBUAE data via paid commercial API
 *    - Daily updates at 18:05 Asia/Dubai timezone
 *    - Supported service with SLA guarantees
 * 
 * 2. **Thomson Reuters/Refinitiv** (Enterprise)
 *    - Direct access to the source data provider used by CBUAE
 *    - Real-time rates with enterprise-grade reliability
 *    - Requires enterprise license agreement
 * 
 * 3. **Direct CBUAE Licensing**
 *    - Contact CBUAE directly for official data licensing agreement
 *    - May provide sanctioned API access for licensed partners
 * 
 * 4. **UAE Government Data Portal** (Bayanat.ae)
 *    - Official UAE open data portal: https://bayanat.ae
 *    - May provide structured access to CBUAE data
 * 
 * CONFIGURATION:
 * Provider options:
 * - 'github' (default): Use GitHub mirror
 * - 'fluentax': Use Fluentax commercial API (requires FLUENTAX_API_KEY env var)
 * - 'api': Use official API (when available)
 * - 'manual': Skip automated fetching, rely on manual rate entry
 * 
 * Note: OCR extraction directly scrapes the CBUAE website and may be fragile.
 * Recommended for development/testing. Use 'github' or 'fluentax' for production.
 */
async function fetchUAECentralBankRates(provider: string = 'github'): Promise<FetchResult> {
  switch (provider) {
    case 'github':
      return fetchUAEFromGitHub();
    case 'fluentax':
      return fetchUAEFromFluentax();
    case 'api':
      // Note: CBUAE doesn't have an official API yet. Falls back to GitHub
      console.warn('CBUAE official API not available. Using GitHub mirror.');
      return fetchUAEFromGitHub();
    case 'manual':
      console.log('CBUAE rates: manual mode enabled, skipping automated fetch');
      return { source: 'uae_central_bank', rates: [], success: true };
    default:
      console.warn(`Unknown provider: ${provider}, using GitHub mirror`);
      return fetchUAEFromGitHub();
  }
}

/**
 * Fetch UAE Central Bank rates from GitHub mirror
 * Uses community-maintained repository that mirrors official CBUAE daily rates
 * Source: https://github.com/paulbares/centralbank-ae-fx-rates
 */
async function fetchUAEFromGitHub(): Promise<FetchResult> {
  try {
    console.log('Fetching UAE Central Bank rates from GitHub mirror...');
    
    // Use current date to fetch today's rates
    const now = new Date();
    const year = now.getFullYear();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Try today's rates first
    const url = `https://raw.githubusercontent.com/paulbares/centralbank-ae-fx-rates/main/rates/${year}/${dateStr}.json`;
    
    let response;
    try {
      response = await retryWithBackoff(async () => {
        return await axios.get(url, {
          timeout: TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; accounting-app/1.0)'
          }
        });
      });
    } catch (error) {
      // If today's rates not available yet, try yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayYear = yesterday.getFullYear();
      const fallbackUrl = `https://raw.githubusercontent.com/paulbares/centralbank-ae-fx-rates/main/rates/${yesterdayYear}/${yesterdayStr}.json`;
      
      console.log('Today\'s rates not available, trying yesterday...');
      response = await retryWithBackoff(async () => {
        return await axios.get(fallbackUrl, {
          timeout: TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; accounting-app/1.0)'
          }
        });
      });
    }

    if (!response.data) {
      throw new Error('Invalid response from UAE Central Bank GitHub mirror');
    }

    // Response is a JSON object with currency codes as keys and rates as values
    // Example: { "USD": 3.6725, "EUR": 3.9123, ... }
    const ratesData = response.data;
    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Convert AED-based rates to bidirectional pairs
    const targetCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JPY', 'CHF', 'CAD', 'AUD'];
    
    for (const currency of targetCurrencies) {
      if (ratesData[currency]) {
        const rateValue = parseFloat(ratesData[currency]);
        
        // AED to other currency
        rates.push({
          fromCurrency: 'AED',
          toCurrency: currency,
          rate: rateValue.toString(),
          effectiveDate,
        });

        // Inverse rate (other currency to AED)
        rates.push({
          fromCurrency: currency,
          toCurrency: 'AED',
          rate: (1 / rateValue).toFixed(10),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} UAE Central Bank exchange rates from GitHub mirror`);
    return { source: 'uae_central_bank', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching UAE Central Bank rates from GitHub mirror:', errorMsg);
    return { source: 'uae_central_bank', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch UAE Central Bank rates from Fluentax commercial API
 * Placeholder for future implementation when customer subscribes
 * API Documentation: https://www.fluentax.com/products/exchange-rates-api/banks/AECB
 */
async function fetchUAEFromFluentax(): Promise<FetchResult> {
  const apiKey = process.env.FLUENTAX_API_KEY;
  
  if (!apiKey) {
    const errorMsg = 'FLUENTAX_API_KEY environment variable not configured';
    console.error(errorMsg);
    return { source: 'uae_central_bank_fluentax', rates: [], success: false, error: errorMsg };
  }
  
  // TODO: Implement Fluentax API integration when customer subscribes
  // Expected implementation:
  // 1. Make authenticated request to Fluentax API endpoint
  // 2. Parse response data (check API docs for exact format)
  // 3. Convert to ExchangeRateData[] format
  // 4. Return FetchResult with rates
  
  const errorMsg = 'Fluentax integration not yet implemented - contact support to enable this feature';
  console.warn(errorMsg);
  return { source: 'uae_central_bank_fluentax', rates: [], success: false, error: errorMsg };
}

/**
 * Fetch UAE Central Bank rates using Python Advanced OCR processor
 * Uses the Python OCR processor downloaded from Google Drive
 * This provides direct extraction from the CBUAE website as an alternative to the GitHub mirror
 */
async function fetchUAEFromOCR(): Promise<FetchResult> {
  try {
    console.log('Extracting CBUAE rates using Python Advanced OCR...');
    
    const ocrService = new PythonOCRService();
    
    // Check if Python and OCR script are available
    const pythonAvailable = await ocrService.checkPythonAvailable();
    if (!pythonAvailable) {
      throw new Error('Python3 not available - install Python to use OCR');
    }
    
    const scriptExists = await ocrService.checkOCRScriptExists();
    if (!scriptExists) {
      throw new Error('OCR script not found - run download-ocr.ts to download from Google Drive');
    }
    
    // Execute Python OCR
    const ocrRates = await ocrService.extractCBUAERates();
    
    if (!ocrRates || ocrRates.length === 0) {
      throw new Error('No rates extracted by Python OCR processor');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();
    effectiveDate.setHours(18, 0, 0, 0); // CBUAE updates at 6 PM UAE time

    // Convert OCR rates to ExchangeRateData format
    // Python outputs "1 {currency} = X AED" (e.g., "1 USD = 3.6725 AED")
    for (const { currency, rate } of ocrRates) {
      const rateValue = parseFloat(rate);
      
      if (isNaN(rateValue) || rateValue <= 0) {
        console.warn(`Invalid rate from OCR for ${currency}: ${rate}`);
        continue;
      }

      // CORRECT LOGIC:
      // Python gives us: 1 USD = 3.6725 AED (foreign→AED)
      // So:
      // - USD→AED = 3.6725 (use rate as-is)
      // - AED→USD = 1/3.6725 = 0.272 (use reciprocal)
      
      // Foreign → AED (use rate as-is from Python)
      rates.push({
        fromCurrency: currency,
        toCurrency: 'AED',
        rate: rate,
        effectiveDate,
      });

      // AED → Foreign (use reciprocal)
      rates.push({
        fromCurrency: 'AED',
        toCurrency: currency,
        rate: (1 / rateValue).toFixed(10),
        effectiveDate,
      });
    }

    if (rates.length === 0) {
      throw new Error('No valid rates after Python OCR processing');
    }

    console.log(`✓ Python OCR extracted ${rates.length} UAE Central Bank exchange rates`);
    return { source: 'uae_central_bank_ocr', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error extracting UAE Central Bank rates via Python OCR:', errorMsg);
    return { source: 'uae_central_bank_ocr', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from European Central Bank (ECB) - OFFICIAL XML API
 * Uses: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 */
async function fetchECBRates(): Promise<FetchResult> {
  try {
    console.log('Fetching ECB rates from official XML endpoint...');
    
    const response = await retryWithBackoff(async () => {
      return await axios.get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; accounting-app/1.0)'
        }
      });
    });

    if (!response.data) {
      throw new Error('Invalid response from ECB XML API');
    }

    // Parse XML using xml2js
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);

    // ECB XML structure:
    // <gesmes:Envelope>
    //   <Cube>
    //     <Cube time="2024-01-15">
    //       <Cube currency="USD" rate="1.0123"/>
    //       ...
    //     </Cube>
    //   </Cube>
    // </gesmes:Envelope>

    const cubes = result['gesmes:Envelope'].Cube[0].Cube[0].Cube;
    const effectiveDateStr = result['gesmes:Envelope'].Cube[0].Cube[0].$.time;
    const effectiveDate = new Date(effectiveDateStr);

    const rates: ExchangeRateData[] = [];

    // ECB rates are EUR to other currencies
    for (const cube of cubes) {
      const currency = cube.$.currency;
      const rate = cube.$.rate;

      // EUR to other currency
      rates.push({
        fromCurrency: 'EUR',
        toCurrency: currency,
        rate: rate,
        effectiveDate,
      });

      // Inverse rate (other currency to EUR)
      rates.push({
        fromCurrency: currency,
        toCurrency: 'EUR',
        rate: (1 / parseFloat(rate)).toFixed(10),
        effectiveDate,
      });
    }

    console.log(`Successfully fetched ${rates.length} ECB exchange rates from official source`);
    return { source: 'ecb', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching official ECB rates:', errorMsg);
    return { source: 'ecb', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from US Federal Reserve - OFFICIAL SOURCE
 * Uses FRED (Federal Reserve Economic Data) CSV download
 * Note: FRED API requires API key. Using direct CSV download as alternative.
 */
async function fetchFedRates(): Promise<FetchResult> {
  try {
    console.log('Fetching Federal Reserve rates from official FRED source...');
    
    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();
    
    // FRED series IDs for major currency pairs
    // These are official H.10 Foreign Exchange Rates
    const seriesIds = [
      { id: 'DEXUSEU', from: 'USD', to: 'EUR' },     // US Dollars to Euro
      { id: 'DEXUSUK', from: 'USD', to: 'GBP' },     // US Dollars to British Pound
      { id: 'DEXJPUS', from: 'JPY', to: 'USD' },     // Japanese Yen to US Dollar
      { id: 'DEXCAUS', from: 'CAD', to: 'USD' },     // Canadian Dollar to US Dollar
      { id: 'DEXSZUS', from: 'CHF', to: 'USD' },     // Swiss Franc to US Dollar
      { id: 'DEXUSAL', from: 'USD', to: 'AUD' },     // US Dollar to Australian Dollar
    ];

    // Fetch each series
    for (const series of seriesIds) {
      try {
        const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series.id}`;
        const response = await axios.get(url, {
          timeout: TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; accounting-app/1.0)'
          }
        });

        // Parse CSV (last line has the most recent rate)
        const lines = response.data.trim().split('\n');
        if (lines.length < 2) continue;
        
        const lastLine = lines[lines.length - 1];
        const [dateStr, rateStr] = lastLine.split(',');
        
        if (rateStr && rateStr !== '.') {
          const rate = parseFloat(rateStr);
          
          // Store rate as defined by FRED
          rates.push({
            fromCurrency: series.from,
            toCurrency: series.to,
            rate: rate.toString(),
            effectiveDate: new Date(dateStr),
          });

          // Store inverse rate
          rates.push({
            fromCurrency: series.to,
            toCurrency: series.from,
            rate: (1 / rate).toFixed(10),
            effectiveDate: new Date(dateStr),
          });
        }
      } catch (seriesError) {
        console.warn(`Failed to fetch FRED series ${series.id}:`, seriesError);
        // Continue with other series
      }
    }

    if (rates.length === 0) {
      throw new Error('No Federal Reserve rates could be fetched');
    }

    console.log(`Successfully fetched ${rates.length} Federal Reserve exchange rates from official source`);
    return { source: 'fed', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching official Federal Reserve rates:', errorMsg);
    return { source: 'fed', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from Bank of England - OFFICIAL API
 * Uses BoE Statistical Database CSV API
 */
async function fetchBOERates(): Promise<FetchResult> {
  try {
    console.log('Fetching Bank of England rates from official API...');
    
    const rates: ExchangeRateData[] = [];
    
    // BoE series codes for spot exchange rates
    const seriesCodes = [
      { code: 'XUDLUSS', currency: 'USD' },  // US Dollar spot
      { code: 'XUDLERS', currency: 'EUR' },  // Euro spot
      { code: 'XUDLJYS', currency: 'JPY' },  // Japanese Yen spot
    ];

    // Get current date range (last 7 days to ensure we get recent data)
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const params = {
      SeriesCodes: seriesCodes.map(s => s.code).join(','),
      CSVF: 'TT',
      UsingCodes: 'Y',
      VPD: 'Y',
      DAT: 'RNG',
      FD: weekAgo.getDate().toString(),
      FM: weekAgo.toLocaleString('en-US', { month: 'short' }),
      FY: weekAgo.getFullYear().toString(),
      TD: now.getDate().toString(),
      TM: now.toLocaleString('en-US', { month: 'short' }),
      TY: now.getFullYear().toString(),
    };

    const url = 'https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp';
    const response = await retryWithBackoff(async () => {
      return await axios.get(url, {
        params,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; accounting-app/1.0)'
        }
      });
    });

    if (!response.data) {
      throw new Error('Invalid response from Bank of England API');
    }

    // Parse CSV response
    const lines = response.data.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('No data in Bank of England response');
    }

    // Get the last line (most recent data)
    const lastLine = lines[lines.length - 1];
    const values = lastLine.split(',');

    // First column is date, rest are rates for each series
    const effectiveDate = new Date(values[0]);

    // Process each series
    for (let i = 0; i < seriesCodes.length; i++) {
      const rateStr = values[i + 1];
      if (rateStr && rateStr !== '' && !isNaN(parseFloat(rateStr))) {
        const rate = parseFloat(rateStr);
        const currency = seriesCodes[i].currency;

        // BoE rates are in foreign currency per GBP
        // USD per GBP = 1.25 means 1 GBP = 1.25 USD
        rates.push({
          fromCurrency: 'GBP',
          toCurrency: currency,
          rate: rate.toString(),
          effectiveDate,
        });

        // Inverse rate
        rates.push({
          fromCurrency: currency,
          toCurrency: 'GBP',
          rate: (1 / rate).toFixed(10),
          effectiveDate,
        });
      }
    }

    if (rates.length === 0) {
      throw new Error('No valid rates found in Bank of England response');
    }

    console.log(`Successfully fetched ${rates.length} Bank of England exchange rates from official source`);
    return { source: 'boe', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching official Bank of England rates:', errorMsg);
    return { source: 'boe', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from Saudi Arabian Monetary Authority (SAMA)
 * STUB: To be implemented when official SAMA API access is available
 * 
 * Official Source: https://www.sama.gov.sa/en-US/EconomicReports/Pages/ExchangeRate.aspx
 * Note: SAMA does not currently provide a public API. Implementation may require:
 * - Web scraping (fragile, not recommended for production)
 * - Third-party aggregator with SAMA data
 * - Official licensing agreement with SAMA
 */
async function fetchSAMARates(provider: string = 'api'): Promise<FetchResult> {
  const errorMsg = 'SAMA integration not yet implemented. Contact support to enable SAMA rates.';
  console.warn(errorMsg);
  
  // TODO: Implement SAMA rate fetching when official API becomes available
  // Expected coverage: Major currencies vs SAR (USD, EUR, GBP, AED, KWD, etc.)
  
  return { 
    source: 'sama', 
    rates: [], 
    success: false, 
    error: errorMsg 
  };
}

/**
 * Fallback aggregator using exchangerate-api.com
 * Only used when official Central Bank APIs fail
 */
async function fetchFromAggregator(baseCurrency: string, sourceName: string): Promise<FetchResult> {
  try {
    console.log(`Fetching rates from fallback aggregator (${baseCurrency})...`);
    
    const response = await retryWithBackoff(async () => {
      return await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`, {
        timeout: TIMEOUT_MS,
      });
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from fallback aggregator');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Convert base currency rates to bidirectional pairs
    const targetCurrencies = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'CHF', 'CAD', 'AUD', 'INR', 'CNY'];
    
    for (const currency of targetCurrencies) {
      if (currency === baseCurrency) continue;
      
      if (response.data.rates[currency]) {
        // Base to other currency
        rates.push({
          fromCurrency: baseCurrency,
          toCurrency: currency,
          rate: response.data.rates[currency].toString(),
          effectiveDate,
        });

        // Inverse rate
        rates.push({
          fromCurrency: currency,
          toCurrency: baseCurrency,
          rate: (1 / response.data.rates[currency]).toString(),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} rates from fallback aggregator`);
    return { source: sourceName, rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching from fallback aggregator:', errorMsg);
    return { source: sourceName, rates: [], success: false, error: errorMsg };
  }
}

/**
 * Calculate cross rate using triangulation
 * Example: EUR→AED = (EUR→USD) × (USD→AED)
 */
export async function calculateCrossRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  throughCurrency: string = 'USD'
): Promise<number | null> {
  try {
    // Get rate from fromCurrency to throughCurrency
    const rate1 = await storage.getLatestExchangeRate(tenantId, fromCurrency, throughCurrency);
    
    // Get rate from throughCurrency to toCurrency
    const rate2 = await storage.getLatestExchangeRate(tenantId, throughCurrency, toCurrency);

    if (!rate1 || !rate2) {
      return null;
    }

    // Calculate cross rate
    const crossRate = parseFloat(rate1.rate) * parseFloat(rate2.rate);
    return crossRate;
  } catch (error) {
    console.error('Error calculating cross rate:', error);
    return null;
  }
}

/**
 * Get latest exchange rate with cross-rate fallback
 */
export async function getLatestRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  try {
    // If same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Try direct rate first
    const directRate = await storage.getLatestExchangeRate(tenantId, fromCurrency, toCurrency);
    if (directRate) {
      return parseFloat(directRate.rate);
    }

    // Try cross rate through USD
    const crossRateUSD = await calculateCrossRate(tenantId, fromCurrency, toCurrency, 'USD');
    if (crossRateUSD) {
      return crossRateUSD;
    }

    // Try cross rate through EUR
    const crossRateEUR = await calculateCrossRate(tenantId, fromCurrency, toCurrency, 'EUR');
    if (crossRateEUR) {
      return crossRateEUR;
    }

    console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
    return null;
  } catch (error) {
    console.error('Error getting latest rate:', error);
    return null;
  }
}

/**
 * Get historical exchange rate at a specific date
 */
export async function getHistoricalRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<number | null> {
  try {
    // If same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const rates = await storage.getExchangeRateHistory(
      tenantId,
      fromCurrency,
      toCurrency,
      date,
      date
    );

    if (rates.length > 0) {
      return parseFloat(rates[0].rate);
    }

    // If no exact rate found, get the most recent rate before this date
    const allRates = await storage.getExchangeRates(tenantId, {
      fromCurrency,
      toCurrency,
    });

    const ratesBefore = allRates
      .filter(r => new Date(r.effectiveDate) <= date)
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    if (ratesBefore.length > 0) {
      return parseFloat(ratesBefore[0].rate);
    }

    console.warn(`No historical rate found for ${fromCurrency} to ${toCurrency} on ${date}`);
    return null;
  } catch (error) {
    console.error('Error getting historical rate:', error);
    return null;
  }
}

/**
 * Fetch exchange rates from a specific central bank source
 */
async function fetchFromCentralBank(
  rateSource: string,
  provider: string = 'api'
): Promise<FetchResult> {
  switch (rateSource) {
    case 'cbuae':
      return fetchUAECentralBankRates(provider);
    case 'ecb':
      return fetchECBRates();
    case 'fed':
      return fetchFedRates();
    case 'boe':
      return fetchBOERates();
    case 'sama':
      return fetchSAMARates(provider);
    case 'manual':
      console.log('Manual rate source selected, skipping automated fetch');
      return { source: 'manual', rates: [], success: true };
    default:
      console.warn(`Unknown rate source: ${rateSource}`);
      return { source: rateSource, rates: [], success: false, error: 'Unknown rate source' };
  }
}

/**
 * Fetch exchange rates from a specific source with fallback
 */
export async function fetchExchangeRates(
  tenantId: string,
  source: 'uae_central_bank' | 'ecb' | 'fed' | 'boe' | 'sama' | 'all'
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  // Define mapping of sources to their base currencies for fallback
  const sourceFallbackMap: Record<string, string> = {
    uae_central_bank: 'AED',
    cbuae: 'AED',
    ecb: 'EUR',
    fed: 'USD',
    boe: 'GBP',
    sama: 'SAR',
  };

  // Fetch UAE Central Bank rates
  if (source === 'all' || source === 'uae_central_bank') {
    const result = await fetchUAECentralBankRates();
    if (!result.success) {
      console.warn('Official UAE Central Bank fetch failed, trying fallback aggregator...');
      const fallback = await fetchFromAggregator('AED', 'uae_central_bank_fallback');
      results.push(fallback);
    } else {
      results.push(result);
    }
  }

  // Fetch ECB rates
  if (source === 'all' || source === 'ecb') {
    const result = await fetchECBRates();
    if (!result.success) {
      console.warn('Official ECB fetch failed, trying fallback aggregator...');
      const fallback = await fetchFromAggregator('EUR', 'ecb_fallback');
      results.push(fallback);
    } else {
      results.push(result);
    }
  }

  // Fetch Fed rates
  if (source === 'all' || source === 'fed') {
    const result = await fetchFedRates();
    if (!result.success) {
      console.warn('Official Federal Reserve fetch failed, trying fallback aggregator...');
      const fallback = await fetchFromAggregator('USD', 'fed_fallback');
      results.push(fallback);
    } else {
      results.push(result);
    }
  }

  // Fetch BoE rates
  if (source === 'all' || source === 'boe') {
    const result = await fetchBOERates();
    if (!result.success) {
      console.warn('Official Bank of England fetch failed, trying fallback aggregator...');
      const fallback = await fetchFromAggregator('GBP', 'boe_fallback');
      results.push(fallback);
    } else {
      results.push(result);
    }
  }

  // Fetch SAMA rates
  if (source === 'all' || source === 'sama') {
    const result = await fetchSAMARates();
    if (!result.success) {
      console.warn('SAMA fetch failed, trying fallback aggregator...');
      const fallback = await fetchFromAggregator('SAR', 'sama_fallback');
      results.push(fallback);
    } else {
      results.push(result);
    }
  }

  // Store successful rates
  for (const result of results) {
    if (result.success) {
      for (const rateData of result.rates) {
        try {
          // Get previous rate for validation
          const previousRate = await storage.getLatestExchangeRate(
            tenantId,
            rateData.fromCurrency,
            rateData.toCurrency
          );

          const rate = parseFloat(rateData.rate);
          const validation = validateRate(
            rate,
            previousRate ? parseFloat(previousRate.rate) : undefined
          );

          if (!validation.valid) {
            console.warn(
              `Rate validation failed for ${rateData.fromCurrency}→${rateData.toCurrency}: ${validation.reason}`
            );
            continue;
          }

          // Store the rate
          await storage.createExchangeRate(tenantId, {
            tenantId,
            fromCurrencyCode: rateData.fromCurrency,
            toCurrencyCode: rateData.toCurrency,
            rate: rateData.rate,
            effectiveDate: rateData.effectiveDate,
            source: result.source,
          });
        } catch (error) {
          console.error(
            `Error storing rate ${rateData.fromCurrency}→${rateData.toCurrency}:`,
            error
          );
        }
      }
    }
  }

  return results;
}

/**
 * Update exchange rates for all active currencies for a tenant
 * Uses the tenant's FX configuration to determine which sources to use
 */
export async function updateExchangeRatesForTenant(tenantId: string): Promise<void> {
  try {
    console.log(`Updating exchange rates for tenant ${tenantId}...`);

    const currencies = await storage.getCurrencies(tenantId);
    const activeCurrencies = currencies.filter(c => c.isActive);

    if (activeCurrencies.length === 0) {
      console.log(`No active currencies for tenant ${tenantId}`);
      return;
    }

    console.log(`Found ${activeCurrencies.length} active currencies for tenant ${tenantId}`);

    // Get FX configuration for this tenant
    const fxConfig = await storage.getFXConfig(tenantId);
    
    if (!fxConfig) {
      console.warn(`No FX config found for tenant ${tenantId}, using defaults`);
    }

    const primarySource = fxConfig?.primaryRateSource || 'cbuae';
    const primaryProvider = fxConfig?.primarySourceProvider || 'github';
    const fallbackSource = fxConfig?.fallbackRateSource;

    console.log(`Using primary source: ${primarySource} (provider: ${primaryProvider})`);
    if (fallbackSource) {
      console.log(`Fallback source configured: ${fallbackSource}`);
    }

    const results: FetchResult[] = [];

    // Fetch from primary source
    const primaryResult = await fetchFromCentralBank(primarySource, primaryProvider);
    results.push(primaryResult);

    // If primary failed and fallback is configured, try fallback
    if (!primaryResult.success && fallbackSource) {
      console.log(`Primary source failed, attempting fallback: ${fallbackSource}`);
      const fallbackResult = await fetchFromCentralBank(fallbackSource, 'api');
      results.push(fallbackResult);
    }

    const successfulSources = results.filter(r => r.success);
    const failedSources = results.filter(r => !r.success);

    console.log(`Successfully updated rates from ${successfulSources.length} sources`);
    
    if (failedSources.length > 0) {
      console.warn(`Failed to update rates from ${failedSources.length} sources:`);
      failedSources.forEach(r => console.warn(`  - ${r.source}: ${r.error}`));
    }

    // Check for stale rates (>24 hours old)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const currency of activeCurrencies) {
      if (currency.code === currency.code) continue; // Skip same currency
      
      const latestRate = await storage.getLatestExchangeRate(
        tenantId,
        currency.code,
        'USD' // Check against USD as base
      );

      if (!latestRate) {
        console.warn(`No rate found for ${currency.code}→USD`);
      } else if (new Date(latestRate.effectiveDate) < oneDayAgo) {
        console.warn(
          `Stale rate detected for ${currency.code}→USD (last updated: ${latestRate.effectiveDate})`
        );
      }
    }

    console.log(`Completed exchange rate update for tenant ${tenantId}`);
  } catch (error) {
    console.error(`Error updating exchange rates for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Create manual exchange rate entry
 */
export async function createManualExchangeRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  rate: string,
  effectiveDate: Date,
  createdBy: string
): Promise<void> {
  try {
    // Validate rate
    const rateNum = parseFloat(rate);
    const validation = validateRate(rateNum);

    if (!validation.valid) {
      throw new Error(`Invalid rate: ${validation.reason}`);
    }

    // Store the rate
    await storage.createExchangeRate(tenantId, {
      tenantId,
      fromCurrencyCode: fromCurrency,
      toCurrencyCode: toCurrency,
      rate,
      effectiveDate,
      source: 'manual',
      createdBy,
    });

    // Also store the inverse rate
    const inverseRate = (1 / rateNum).toString();
    await storage.createExchangeRate(tenantId, {
      tenantId,
      fromCurrencyCode: toCurrency,
      toCurrencyCode: fromCurrency,
      rate: inverseRate,
      effectiveDate,
      source: 'manual',
      createdBy,
    });

    console.log(`Manual exchange rate created: ${fromCurrency}→${toCurrency} = ${rate}`);
  } catch (error) {
    console.error('Error creating manual exchange rate:', error);
    throw error;
  }
}
