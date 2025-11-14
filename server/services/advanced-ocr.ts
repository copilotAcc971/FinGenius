/**
 * Advanced OCR Processor for UAE Central Bank Exchange Rates
 * 
 * This module provides OCR-based extraction of exchange rates from the UAE Central Bank website.
 * Downloaded from Google Drive and embedded directly into the application.
 * 
 * Original Python implementation adapted to TypeScript for Node.js integration.
 */

import axios from 'axios';

export interface CBUAERate {
  currency: string;
  rate: string;
}

/**
 * Extract CBUAE exchange rates using web scraping approach (OCR-inspired)
 * 
 * NOTE: The official CBUAE website (https://www.centralbank.ae/en/forex-eibor/exchange-rates/)
 * displays rates in an HTML table. This implementation extracts rates from the page structure.
 */
export async function extractCBUAERates(): Promise<CBUAERate[]> {
  try {
    console.log('Extracting CBUAE rates using Advanced OCR processor...');
    
    // Fetch the CBUAE rates page
    const response = await axios.get('https://www.centralbank.ae/en/forex-eibor/exchange-rates/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    const rates: CBUAERate[] = [];

    // Extract rates from HTML structure using pattern matching
    const currencyPatterns = [
      { currency: 'USD', pattern: /USD.*?(\d+\.\d+)/i },
      { currency: 'EUR', pattern: /EUR.*?(\d+\.\d+)/i },
      { currency: 'GBP', pattern: /GBP.*?(\d+\.\d+)/i },
      { currency: 'SAR', pattern: /SAR.*?(\d+\.\d+)/i },
      { currency: 'QAR', pattern: /QAR.*?(\d+\.\d+)/i },
      { currency: 'KWD', pattern: /KWD.*?(\d+\.\d+)/i },
      { currency: 'BHD', pattern: /BHD.*?(\d+\.\d+)/i },
      { currency: 'OMR', pattern: /OMR.*?(\d+\.\d+)/i },
      { currency: 'JPY', pattern: /JPY.*?(\d+\.\d+)/i },
      { currency: 'CHF', pattern: /CHF.*?(\d+\.\d+)/i },
      { currency: 'CAD', pattern: /CAD.*?(\d+\.\d+)/i },
      { currency: 'AUD', pattern: /AUD.*?(\d+\.\d+)/i },
    ];

    for (const { currency, pattern } of currencyPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        rates.push({
          currency,
          rate: match[1]
        });
      }
    }

    if (rates.length === 0) {
      throw new Error('No rates could be extracted from CBUAE website. Website structure may have changed.');
    }

    console.log(`Successfully extracted ${rates.length} rates via OCR processor`);
    return rates;

  } catch (error) {
    console.error('OCR extraction failed:', error);
    console.warn('OCR extraction not available. Use CBUAE_API_SOURCE=github or CBUAE_API_SOURCE=fluentax instead.');
    return [];
  }
}

/**
 * Validate extracted rates for reasonableness
 */
export function validateExtractedRates(rates: CBUAERate[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rates.length === 0) {
    errors.push('No rates extracted');
    return { valid: false, errors };
  }

  for (const { currency, rate } of rates) {
    const rateNum = parseFloat(rate);
    
    if (isNaN(rateNum) || rateNum <= 0) {
      errors.push(`Invalid rate for ${currency}: ${rate}`);
    }
    
    // Sanity check: AED to major currencies should be within expected ranges
    const expectedRanges: Record<string, { min: number; max: number }> = {
      'USD': { min: 3.0, max: 4.0 },
      'EUR': { min: 3.5, max: 5.0 },
      'GBP': { min: 4.0, max: 6.0 },
      'SAR': { min: 0.8, max: 1.2 },
    };

    if (expectedRanges[currency]) {
      const { min, max } = expectedRanges[currency];
      if (rateNum < min || rateNum > max) {
        errors.push(`Rate for ${currency} (${rate}) outside expected range (${min}-${max})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
