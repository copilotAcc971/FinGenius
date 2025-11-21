/**
 * Currency Converter Service
 * 
 * Handles multi-currency conversions with real exchange rates.
 * Compliant with IFRS IAS 21 (Effects of Changes in Foreign Exchange Rates).
 */

export interface ExchangeRateData {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  date: Date;
  source: 'ECB' | 'CBU_AE' | 'SAMA_SA' | 'MANUAL' | 'API';
}

export interface ConversionResult {
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateDate: Date;
  conversionDate: Date;
  roundedTarget: number;
}

export class CurrencyConverter {
  private exchangeRates: Map<string, ExchangeRateData> = new Map();
  private precisionRules: { [key: string]: number } = {
    // Most currencies use 2 decimal places
    'default': 2,
    // Some Middle Eastern currencies use 3 decimals
    'KWD': 3,
    'BHD': 3,
    'JOD': 3,
    'OMR': 3,
    // Bitcoin and other cryptocurrencies use more decimals
    'BTC': 8
  };

  /**
   * Register an exchange rate
   */
  setExchangeRate(
    sourceCurrency: string,
    targetCurrency: string,
    rate: number,
    date: Date = new Date(),
    source: ExchangeRateData['source'] = 'MANUAL'
  ) {
    const key = `${sourceCurrency}_${targetCurrency}`;
    this.exchangeRates.set(key, {
      sourceCurrency,
      targetCurrency,
      rate,
      date,
      source
    });

    // Also set reverse rate
    const reverseKey = `${targetCurrency}_${sourceCurrency}`;
    this.exchangeRates.set(reverseKey, {
      sourceCurrency: targetCurrency,
      targetCurrency: sourceCurrency,
      rate: 1 / rate,
      date,
      source
    });
  }

  /**
   * Get current exchange rate
   */
  getExchangeRate(sourceCurrency: string, targetCurrency: string): ExchangeRateData | null {
    if (sourceCurrency === targetCurrency) {
      return {
        sourceCurrency,
        targetCurrency,
        rate: 1,
        date: new Date(),
        source: 'MANUAL'
      };
    }

    const key = `${sourceCurrency}_${targetCurrency}`;
    return this.exchangeRates.get(key) || null;
  }

  /**
   * Convert amount from one currency to another
   */
  convert(
    sourceAmount: number,
    sourceCurrency: string,
    targetCurrency: string,
    rateDate?: Date
  ): ConversionResult {
    if (sourceCurrency === targetCurrency) {
      return {
        sourceAmount,
        sourceCurrency,
        targetAmount: sourceAmount,
        targetCurrency,
        exchangeRate: 1,
        rateDate: new Date(),
        conversionDate: new Date(),
        roundedTarget: this.round(sourceAmount, targetCurrency)
      };
    }

    const rateData = this.getExchangeRate(sourceCurrency, targetCurrency);
    if (!rateData) {
      throw new Error(
        `No exchange rate found for ${sourceCurrency}/${targetCurrency}`
      );
    }

    const targetAmount = sourceAmount * rateData.rate;
    const roundedTarget = this.round(targetAmount, targetCurrency);

    return {
      sourceAmount,
      sourceCurrency,
      targetAmount,
      targetCurrency,
      exchangeRate: rateData.rate,
      rateDate: rateData.date,
      conversionDate: new Date(),
      roundedTarget
    };
  }

  /**
   * Convert multiple amounts at once
   */
  convertBatch(
    amounts: Array<{ amount: number; from: string; to: string }>,
    rateDate?: Date
  ): ConversionResult[] {
    return amounts.map(item =>
      this.convert(item.amount, item.from, item.to, rateDate)
    );
  }

  /**
   * Round amount according to currency precision rules
   */
  private round(amount: number, currency: string): number {
    const decimals = this.precisionRules[currency] || this.precisionRules['default'];
    const multiplier = Math.pow(10, decimals);
    return Math.round(amount * multiplier) / multiplier;
  }

  /**
   * Get precision (decimal places) for a currency
   */
  getPrecision(currency: string): number {
    return this.precisionRules[currency] || this.precisionRules['default'];
  }

  /**
   * Format amount for display
   */
  format(amount: number, currency: string, locale: string = 'en-US'): string {
    const precision = this.getPrecision(currency);
    const rounded = this.round(amount, currency);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(rounded);
  }

  /**
   * Calculate unrealized gain/loss on foreign currency transactions
   * Used for compliance with IAS 21
   */
  calculateFXGainLoss(
    originalAmount: number,
    originalCurrency: string,
    originalRate: number,
    currentRate: number,
    baseCurrency: string
  ) {
    const originalValue = originalAmount * originalRate;
    const currentValue = originalAmount * currentRate;
    const gainLoss = currentValue - originalValue;
    const gainLossPercent = (gainLoss / originalValue) * 100;

    return {
      originalAmount,
      originalCurrency,
      baseCurrency,
      originalRate,
      currentRate,
      originalValue: this.round(originalValue, baseCurrency),
      currentValue: this.round(currentValue, baseCurrency),
      gainLoss: this.round(gainLoss, baseCurrency),
      gainLossPercent: Math.round(gainLossPercent * 100) / 100,
      isGain: gainLoss > 0
    };
  }

  /**
   * Get all cached rates (for debugging/admin)
   */
  getAllRates(): Array<ExchangeRateData> {
    return Array.from(this.exchangeRates.values());
  }

  /**
   * Clear rates (for testing/reset)
   */
  clearRates() {
    this.exchangeRates.clear();
  }
}

export default new CurrencyConverter();