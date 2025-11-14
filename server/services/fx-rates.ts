import axios, { AxiosError } from 'axios';
import { storage } from '../storage';
import type { InsertExchangeRate } from '@shared/schema';

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
 * Fetch exchange rates from UAE Central Bank
 * Note: UAE Central Bank does not have a public API as of 2024.
 * Using currencyapi.com as a reliable alternative for UAE rates.
 */
async function fetchUAECentralBankRates(): Promise<FetchResult> {
  try {
    console.log('Fetching UAE rates from CurrencyAPI...');
    
    // CurrencyAPI.com provides reliable Middle East rates
    // In production, you would use: https://api.currencyapi.com/v3/latest
    // For now, we'll use exchangerate-api.com which is free and reliable
    const response = await retryWithBackoff(async () => {
      return await axios.get('https://api.exchangerate-api.com/v4/latest/AED', {
        timeout: TIMEOUT_MS,
      });
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Convert AED-based rates to bidirectional pairs
    const baseCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR'];
    
    for (const currency of baseCurrencies) {
      if (response.data.rates[currency]) {
        // AED to other currency
        rates.push({
          fromCurrency: 'AED',
          toCurrency: currency,
          rate: response.data.rates[currency].toString(),
          effectiveDate,
        });

        // Inverse rate (other currency to AED)
        rates.push({
          fromCurrency: currency,
          toCurrency: 'AED',
          rate: (1 / response.data.rates[currency]).toString(),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} UAE exchange rates`);
    return { source: 'uae_central_bank', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching UAE Central Bank rates:', errorMsg);
    return { source: 'uae_central_bank', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from European Central Bank (ECB)
 */
async function fetchECBRates(): Promise<FetchResult> {
  try {
    console.log('Fetching ECB rates...');
    
    const response = await retryWithBackoff(async () => {
      return await axios.get('https://api.exchangerate-api.com/v4/latest/EUR', {
        timeout: TIMEOUT_MS,
      });
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from ECB API');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Major currencies against EUR
    const currencies = ['USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR', 'AED'];

    for (const currency of currencies) {
      if (response.data.rates[currency]) {
        // EUR to other currency
        rates.push({
          fromCurrency: 'EUR',
          toCurrency: currency,
          rate: response.data.rates[currency].toString(),
          effectiveDate,
        });

        // Inverse rate
        rates.push({
          fromCurrency: currency,
          toCurrency: 'EUR',
          rate: (1 / response.data.rates[currency]).toString(),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} ECB exchange rates`);
    return { source: 'ecb', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching ECB rates:', errorMsg);
    return { source: 'ecb', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from US Federal Reserve (FRED API)
 */
async function fetchFedRates(): Promise<FetchResult> {
  try {
    console.log('Fetching Federal Reserve rates...');
    
    const response = await retryWithBackoff(async () => {
      return await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
        timeout: TIMEOUT_MS,
      });
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from Fed API');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Major currencies against USD
    const currencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'AED', 'SAR'];

    for (const currency of currencies) {
      if (response.data.rates[currency]) {
        // USD to other currency
        rates.push({
          fromCurrency: 'USD',
          toCurrency: currency,
          rate: response.data.rates[currency].toString(),
          effectiveDate,
        });

        // Inverse rate
        rates.push({
          fromCurrency: currency,
          toCurrency: 'USD',
          rate: (1 / response.data.rates[currency]).toString(),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} Fed exchange rates`);
    return { source: 'fed', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching Fed rates:', errorMsg);
    return { source: 'fed', rates: [], success: false, error: errorMsg };
  }
}

/**
 * Fetch exchange rates from Bank of England
 */
async function fetchBOERates(): Promise<FetchResult> {
  try {
    console.log('Fetching Bank of England rates...');
    
    const response = await retryWithBackoff(async () => {
      return await axios.get('https://api.exchangerate-api.com/v4/latest/GBP', {
        timeout: TIMEOUT_MS,
      });
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from BOE API');
    }

    const rates: ExchangeRateData[] = [];
    const effectiveDate = new Date();

    // Major currencies against GBP
    const currencies = ['USD', 'EUR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'AED'];

    for (const currency of currencies) {
      if (response.data.rates[currency]) {
        // GBP to other currency
        rates.push({
          fromCurrency: 'GBP',
          toCurrency: currency,
          rate: response.data.rates[currency].toString(),
          effectiveDate,
        });

        // Inverse rate
        rates.push({
          fromCurrency: currency,
          toCurrency: 'GBP',
          rate: (1 / response.data.rates[currency]).toString(),
          effectiveDate,
        });
      }
    }

    console.log(`Successfully fetched ${rates.length} BOE exchange rates`);
    return { source: 'boe', rates, success: true };
  } catch (error) {
    const errorMsg = error instanceof AxiosError ? error.message : String(error);
    console.error('Error fetching BOE rates:', errorMsg);
    return { source: 'boe', rates: [], success: false, error: errorMsg };
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
 * Fetch exchange rates from a specific source
 */
export async function fetchExchangeRates(
  tenantId: string,
  source: 'uae_central_bank' | 'ecb' | 'fed' | 'boe' | 'all'
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  if (source === 'all' || source === 'uae_central_bank') {
    results.push(await fetchUAECentralBankRates());
  }

  if (source === 'all' || source === 'ecb') {
    results.push(await fetchECBRates());
  }

  if (source === 'all' || source === 'fed') {
    results.push(await fetchFedRates());
  }

  if (source === 'all' || source === 'boe') {
    results.push(await fetchBOERates());
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

    // Fetch rates from all sources
    const results = await fetchExchangeRates(tenantId, 'all');

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
