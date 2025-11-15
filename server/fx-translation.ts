import { eq, and, lte, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { exchangeRates } from "@shared/schema";
import { isIFRSCompliant } from './ifrs-utils';

export interface TranslationConfig {
  standard: "full-ifrs" | "ifrs-sme";
  incomeExpenseMethod: "transaction-date" | "average-rate";
  baseCurrency: string;
}

/**
 * Get closing (spot) rate for a specific date
 * SECURITY: Now includes tenant scoping to prevent cross-tenant data leakage
 * IFRS COMPLIANCE: Returns null on missing rates instead of silent 1.0 fallback
 */
export async function getClosingRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  asOfDate: Date
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1.0;

  // Try to get rate for exact date
  const rate = await db.query.exchangeRates.findFirst({
    where: and(
      eq(exchangeRates.tenantId, tenantId), // SECURITY FIX: Tenant scoping
      eq(exchangeRates.fromCurrencyCode, fromCurrency),
      eq(exchangeRates.toCurrencyCode, toCurrency),
      sql`DATE(${exchangeRates.effectiveDate}) = DATE(${asOfDate.toISOString()})`
    ),
    orderBy: (rates, { desc }) => [desc(rates.effectiveDate)],
  });

  if (rate) return parseFloat(rate.rate);

  // Fallback: get most recent rate before or on the date
  const fallbackRate = await db.query.exchangeRates.findFirst({
    where: and(
      eq(exchangeRates.tenantId, tenantId), // SECURITY FIX: Tenant scoping
      eq(exchangeRates.fromCurrencyCode, fromCurrency),
      eq(exchangeRates.toCurrencyCode, toCurrency),
      lte(exchangeRates.effectiveDate, asOfDate)
    ),
    orderBy: (rates, { desc }) => [desc(rates.effectiveDate)],
  });

  // IFRS FIX: Return null instead of 1.0 for proper error handling
  return fallbackRate ? parseFloat(fallbackRate.rate) : null;
}

/**
 * Get average rate for a period (for P&L translation)
 * IFRS COMPLIANCE: Averages rates ONLY within the reporting period per IAS 21
 * SECURITY: Includes tenant scoping to prevent cross-tenant data leakage
 */
export async function getAverageRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  periodStart: Date,  // Start of reporting period
  periodEnd: Date     // End of reporting period
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1.0;

  // Get rates ONLY within the reporting period (IAS 21 compliant)
  const rates = await db.query.exchangeRates.findMany({
    where: and(
      eq(exchangeRates.tenantId, tenantId),
      eq(exchangeRates.fromCurrencyCode, fromCurrency),
      eq(exchangeRates.toCurrencyCode, toCurrency),
      gte(exchangeRates.effectiveDate, periodStart),  // Only rates from period start
      lte(exchangeRates.effectiveDate, periodEnd)     // Only rates up to period end
    ),
  });

  if (rates.length === 0) {
    // Fallback to closing rate if no period rates available
    return await getClosingRate(tenantId, fromCurrency, toCurrency, periodEnd);
  }

  const sum = rates.reduce((acc, rate) => acc + parseFloat(rate.rate), 0);
  return sum / rates.length;
}

/**
 * Get historical rate for a specific transaction date
 * IFRS COMPLIANCE FIX: New function for equity items per IAS 21
 * Previously equity items incorrectly used getClosingRate
 * SECURITY: Includes tenant scoping to prevent cross-tenant data leakage
 */
export async function getHistoricalRate(
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  transactionDate: Date
): Promise<number | null> {
  // For historical rates, use the EXACT date or nearest prior
  return getClosingRate(tenantId, fromCurrency, toCurrency, transactionDate);
}

/**
 * Translate amount using appropriate method
 * IFRS COMPLIANCE: Returns error information instead of silent failures
 * SECURITY: Includes tenant scoping
 * DUAL-MODE: In non-IFRS mode, returns the amount unchanged (assumes base currency)
 */
export async function translateAmount(
  tenantId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date: Date,
  method: "closing" | "average" | "historical",
  periodStart?: Date
): Promise<{ translatedAmount: number; rate: number | null; error?: string }> {
  // CRITICAL: Check IFRS compliance first
  const ifrsCompliant = await isIFRSCompliant(tenantId);
  
  if (!ifrsCompliant) {
    // NON-IFRS MODE: No translation, assume base currency
    return {
      translatedAmount: amount,
      rate: null
    };
  }
  
  // IFRS MODE: Full IAS 21 translation logic
  if (fromCurrency === toCurrency) {
    return { translatedAmount: amount, rate: 1.0 };
  }

  let rate: number | null;

  switch (method) {
    case "closing":
      rate = await getClosingRate(tenantId, fromCurrency, toCurrency, date);
      break;
    case "average":
      if (!periodStart) {
        return { 
          translatedAmount: amount, 
          rate: null, 
          error: "Period start date required for average rate method" 
        };
      }
      rate = await getAverageRate(tenantId, fromCurrency, toCurrency, periodStart, date);
      break;
    case "historical":
      rate = await getHistoricalRate(tenantId, fromCurrency, toCurrency, date);
      break;
    default:
      return { translatedAmount: amount, rate: null, error: "Invalid translation method" };
  }

  if (rate === null) {
    return { 
      translatedAmount: amount, 
      rate: null, 
      error: `No exchange rate found for ${fromCurrency} to ${toCurrency}`
    };
  }

  return { translatedAmount: amount * rate, rate };
}

/**
 * Translate financial statement line items
 * IFRS COMPLIANCE: Translates amounts using appropriate methods per IAS 21
 * SECURITY: Includes tenant scoping to prevent cross-tenant data leakage
 * 
 * NOTE: Exchange difference calculation requires historical balance tracking
 * infrastructure that is not yet implemented. Per IAS 21 compliance, it's better
 * to not disclose incomplete data than to show misleading zeros.
 * 
 * A full exchange difference implementation would require:
 * - Tracking opening balances in base currency
 * - Recording all transactions at transaction date rates
 * - Comparing closing balances at current rates vs opening + movements
 * - Separate tracking of realized vs unrealized differences
 */
export interface LineItem {
  amount: number;
  currency: string;
  date: Date;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
}

export async function translateLineItems(
  tenantId: string,
  items: LineItem[],
  config: TranslationConfig,
  reportDate: Date,
  periodStart?: Date
): Promise<{ 
  translatedAmount: number; 
  originalCurrency: string;
  translationApplied: boolean;
}[]> {
  const results = [];

  for (const item of items) {
    // Only translate if currency differs from base
    if (item.currency === config.baseCurrency) {
      results.push({ 
        translatedAmount: item.amount, 
        originalCurrency: item.currency,
        translationApplied: false
      });
      continue;
    }

    let method: "closing" | "average" | "historical";

    // Determine translation method based on account type and config
    if (item.accountType === "asset" || item.accountType === "liability") {
      // Monetary items: closing rate
      method = "closing";
    } else if (item.accountType === "equity") {
      // Equity items: historical rate
      method = "historical";
    } else {
      // Revenue/Expense: based on configuration
      method = config.incomeExpenseMethod === "average-rate" ? "average" : "historical";
    }

    // For revenue/expense with average-rate method, use reportDate (period end)
    // Per IAS 21: average rate should be for the FULL reporting period
    const translationDate = (method === "average") ? reportDate : item.date;

    const result = await translateAmount(
      tenantId,
      item.amount,
      item.currency,
      config.baseCurrency,
      translationDate,
      method,
      periodStart
    );

    if (result.error) {
      console.error(`[FX Translation] ${result.error}`);
      results.push({ 
        translatedAmount: item.amount, 
        originalCurrency: item.currency,
        translationApplied: false
      });
      continue;
    }

    results.push({ 
      translatedAmount: result.translatedAmount, 
      originalCurrency: item.currency,
      translationApplied: true
    });
  }

  return results;
}
