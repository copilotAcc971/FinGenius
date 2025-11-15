import { db } from './db';
import { exchangeRates } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface VolatilityResult {
  averageRate: number;
  minRate: number;
  maxRate: number;
  standardDeviation: number;
  percentageFluctuation: number;
  coefficientOfVariation: number;
  isVolatile: boolean;
  volatilityLevel: 'low' | 'moderate' | 'high' | 'extreme';
  recommendAverageRate: boolean;
  warningMessage: string | null;
  blockAverageRate: boolean;
}

export async function assessRateVolatility(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  periodStart: Date,
  periodEnd: Date,
  moderateThreshold: number = 5,
  highThreshold: number = 10,
  extremeThreshold: number = 15
): Promise<VolatilityResult> {
  
  const rates = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.tenantId, tenantId),
        eq(exchangeRates.fromCurrencyCode, fromCurrency),
        eq(exchangeRates.toCurrencyCode, toCurrency),
        gte(exchangeRates.effectiveDate, periodStart),
        lte(exchangeRates.effectiveDate, periodEnd)
      )
    );

  if (rates.length === 0) {
    return {
      averageRate: 0,
      minRate: 0,
      maxRate: 0,
      standardDeviation: 0,
      percentageFluctuation: 0,
      coefficientOfVariation: 0,
      isVolatile: false,
      volatilityLevel: 'low',
      recommendAverageRate: false,
      warningMessage: 'No exchange rates found for this period',
      blockAverageRate: true
    };
  }

  const rateValues = rates.map(r => parseFloat(r.rate));
  const sum = rateValues.reduce((a, b) => a + b, 0);
  const averageRate = sum / rateValues.length;
  const minRate = Math.min(...rateValues);
  const maxRate = Math.max(...rateValues);
  
  const squaredDiffs = rateValues.map(v => Math.pow(v - averageRate, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / rateValues.length;
  const standardDeviation = Math.sqrt(variance);
  
  const percentageFluctuation = ((maxRate - minRate) / averageRate) * 100;
  
  const coefficientOfVariation = (standardDeviation / averageRate) * 100;
  
  let volatilityLevel: 'low' | 'moderate' | 'high' | 'extreme';
  let warningMessage: string | null = null;
  let recommendAverageRate: boolean;
  let blockAverageRate: boolean;
  
  if (percentageFluctuation >= extremeThreshold) {
    volatilityLevel = 'extreme';
    recommendAverageRate = false;
    blockAverageRate = true;
    warningMessage = `CRITICAL: Exchange rate fluctuated ${percentageFluctuation.toFixed(2)}% during this period (extreme volatility). IAS 21 requires transaction-date rates. Average rate cannot be used.`;
  } else if (percentageFluctuation >= highThreshold) {
    volatilityLevel = 'high';
    recommendAverageRate = false;
    blockAverageRate = false;
    warningMessage = `WARNING: Exchange rate fluctuated ${percentageFluctuation.toFixed(2)}% during this period (high volatility). Average rate may not provide reliable approximation per IAS 21. Strongly recommend transaction-date rates.`;
  } else if (percentageFluctuation >= moderateThreshold) {
    volatilityLevel = 'moderate';
    recommendAverageRate = false;
    blockAverageRate = false;
    warningMessage = `NOTICE: Exchange rate fluctuated ${percentageFluctuation.toFixed(2)}% during this period (moderate volatility). Consider using transaction-date rates for better accuracy per IAS 21 guidance.`;
  } else {
    volatilityLevel = 'low';
    recommendAverageRate = true;
    blockAverageRate = false;
    warningMessage = null;
  }
  
  return {
    averageRate,
    minRate,
    maxRate,
    standardDeviation,
    percentageFluctuation,
    coefficientOfVariation,
    isVolatile: percentageFluctuation >= moderateThreshold,
    volatilityLevel,
    recommendAverageRate,
    warningMessage,
    blockAverageRate
  };
}

export function formatVolatilitySummary(result: VolatilityResult): string {
  return `Volatility: ${result.volatilityLevel.toUpperCase()} | Fluctuation: ${result.percentageFluctuation.toFixed(2)}% | Range: ${result.minRate.toFixed(4)} - ${result.maxRate.toFixed(4)} | Avg: ${result.averageRate.toFixed(4)}`;
}
