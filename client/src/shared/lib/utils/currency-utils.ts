import { Currency } from "@shared/schema";

/**
 * Format currency amount with proper symbol, separators, and decimals
 * ALWAYS shows ISO code for multi-currency clarity
 * @param amount - The numeric amount to format
 * @param currencyCode - The ISO currency code (e.g., "USD", "EUR")
 * @param currencies - Array of currency objects
 * @returns Formatted currency string (e.g., "$ USD 1,234.56" or "USD 1,234.56")
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  currencies: Currency[]
): string {
  const currency = currencies.find(c => c.code === currencyCode);
  const symbol = currency?.symbol || '';
  const decimals = currency?.decimalPlaces ?? 2;
  
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  // ALWAYS show code for clarity
  // With symbol: "$ USD 1,234.56"
  // Without symbol: "USD 1,234.56"
  if (symbol && symbol !== currencyCode) {
    return `${symbol} ${currencyCode} ${formatted}`;
  } else {
    return `${currencyCode} ${formatted}`;
  }
}

/**
 * Get currency symbol for display
 * @param currencyCode - The ISO currency code
 * @param currencies - Array of currency objects
 * @param fallback - Fallback value if currency not found
 * @returns Currency symbol or code
 */
export function getCurrencySymbol(
  currencyCode: string,
  currencies: Currency[],
  fallback: string = '$'
): string {
  const currency = currencies.find(c => c.code === currencyCode);
  return currency?.symbol || currencyCode || fallback;
}
