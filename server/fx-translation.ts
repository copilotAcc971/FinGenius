import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { exchangeRates, currencies } from "@shared/schema";

export interface TranslationConfig {
  standard: "full-ifrs" | "ifrs-sme";
  incomeExpenseMethod: "transaction-date" | "average-rate";
  baseCurrency: string;
}

/**
 * Get closing (spot) rate for a specific date
 */
export async function getClosingRate(
  fromCurrency: string,
  toCurrency: string,
  asOfDate: Date
): Promise<number> {
  if (fromCurrency === toCurrency) return 1.0;

  // Try to get rate for exact date
  const rate = await db.query.exchangeRates.findFirst({
    where: and(
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
      eq(exchangeRates.fromCurrencyCode, fromCurrency),
      eq(exchangeRates.toCurrencyCode, toCurrency),
      lte(exchangeRates.effectiveDate, asOfDate)
    ),
    orderBy: (rates, { desc }) => [desc(rates.effectiveDate)],
  });

  return fallbackRate ? parseFloat(fallbackRate.rate) : 1.0;
}

/**
 * Get average rate for a period (for P&L translation)
 */
export async function getAverageRate(
  fromCurrency: string,
  toCurrency: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (fromCurrency === toCurrency) return 1.0;

  const rates = await db.query.exchangeRates.findMany({
    where: and(
      eq(exchangeRates.fromCurrencyCode, fromCurrency),
      eq(exchangeRates.toCurrencyCode, toCurrency),
      gte(exchangeRates.effectiveDate, startDate),
      lte(exchangeRates.effectiveDate, endDate)
    ),
  });

  if (rates.length === 0) {
    // Fallback to closing rate
    return getClosingRate(fromCurrency, toCurrency, endDate);
  }

  const sum = rates.reduce((acc, rate) => acc + parseFloat(rate.rate), 0);
  return sum / rates.length;
}

/**
 * Translate amount using appropriate method
 */
export async function translateAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date: Date,
  method: "closing" | "average" | "historical",
  periodStart?: Date
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;

  let rate: number;

  switch (method) {
    case "closing":
      rate = await getClosingRate(fromCurrency, toCurrency, date);
      break;
    case "average":
      if (!periodStart) throw new Error("Period start date required for average rate");
      rate = await getAverageRate(fromCurrency, toCurrency, periodStart, date);
      break;
    case "historical":
      rate = await getClosingRate(fromCurrency, toCurrency, date);
      break;
    default:
      rate = 1.0;
  }

  return amount * rate;
}

/**
 * Translate financial statement line items
 */
export interface LineItem {
  amount: number;
  currency: string;
  date: Date;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
}

export async function translateLineItems(
  items: LineItem[],
  config: TranslationConfig,
  reportDate: Date,
  periodStart?: Date
): Promise<{ translatedAmount: number; exchangeDifference: number }[]> {
  const results = [];

  for (const item of items) {
    let method: "closing" | "average" | "historical";

    // Determine translation method based on account type and config
    if (item.accountType === "asset" || item.accountType === "liability") {
      // Monetary items: closing rate
      method = "closing";
    } else if (item.accountType === "equity") {
      // Equity: historical rate
      method = "historical";
    } else {
      // Revenue/Expense: based on configuration
      method = config.incomeExpenseMethod === "average-rate" ? "average" : "historical";
    }

    const translatedAmount = await translateAmount(
      item.amount,
      item.currency,
      config.baseCurrency,
      item.date,
      method,
      periodStart
    );

    // Exchange difference (simplified - for realized differences)
    const exchangeDifference = translatedAmount - item.amount;

    results.push({ translatedAmount, exchangeDifference });
  }

  return results;
}
