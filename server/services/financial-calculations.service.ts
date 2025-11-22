/**
 * Financial Calculations Service
 * 
 * CRITICAL: All financial calculations MUST be done server-side using this service.
 * NEVER trust client-supplied totals, tax amounts, or currency conversions.
 * 
 * This service ensures financial integrity by:
 * 1. Using Decimal.js for all calculations to prevent floating-point errors
 * 2. Validating all amounts against server-side calculations
 * 3. Fetching exchange rates from trusted sources only
 * 4. Applying proper rounding rules per currency
 */

import Decimal from 'decimal.js';
import TaxCalculator from './tax-calculator';
import CurrencyConverter from './currency-converter';
import { getLatestRate } from './fx-rates';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { taxes } from '@shared/schema';

// Configure Decimal.js for financial calculations
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface LineItemForCalculation {
  quantity: number | string;
  unitPrice: number | string;
  rate?: number | string; // Some use 'rate' instead of unitPrice
  taxRate?: number | string;
  discount?: number | string;
  discountType?: 'percentage' | 'fixed';
}

export interface CalculatedTotals {
  subtotal: string;
  taxAmount: string;
  totalDiscount: string;
  total: string;
  currency: string;
  exchangeRate?: string;
  baseCurrencyTotal?: string;
}

export interface ValidationResult {
  isValid: boolean;
  calculatedTotals: CalculatedTotals;
  clientTotals?: {
    subtotal?: string;
    taxAmount?: string;
    total?: string;
  };
  discrepancies?: {
    subtotal?: string;
    taxAmount?: string;
    total?: string;
  };
  message?: string;
}

export class FinancialCalculationsService {
  /**
   * Calculate invoice total from line items
   * NEVER trust client-supplied totals
   */
  static async calculateInvoiceTotal(
    lineItems: LineItemForCalculation[],
    taxId: string | null,
    discount: number | string = 0,
    discountType: 'percentage' | 'fixed' = 'fixed',
    currency: string = 'USD',
    tenantId: string
  ): Promise<CalculatedTotals> {
    // Calculate subtotal from line items
    let subtotal = new Decimal(0);
    
    for (const item of lineItems) {
      const quantity = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice || item.rate || 0);
      const lineTotal = quantity.mul(unitPrice);
      
      // Apply line-level discount if present
      if (item.discount) {
        const discountAmount = item.discountType === 'percentage'
          ? lineTotal.mul(new Decimal(item.discount).div(100))
          : new Decimal(item.discount);
        subtotal = subtotal.add(lineTotal.sub(discountAmount));
      } else {
        subtotal = subtotal.add(lineTotal);
      }
    }

    // Apply invoice-level discount
    let totalDiscount = new Decimal(0);
    if (discount) {
      totalDiscount = discountType === 'percentage'
        ? subtotal.mul(new Decimal(discount).div(100))
        : new Decimal(discount);
    }
    
    const afterDiscount = subtotal.sub(totalDiscount);

    // Calculate tax amount
    let taxAmount = new Decimal(0);
    let taxRate = 0;
    
    if (taxId) {
      // Fetch tax rate from database - NEVER trust client
      const [tax] = await db
        .select()
        .from(taxes)
        .where(eq(taxes.id, taxId))
        .limit(1);
      
      if (tax && tax.rate) {
        taxRate = parseFloat(tax.rate);
        taxAmount = afterDiscount.mul(taxRate).div(100);
      }
    }

    // Calculate total
    const total = afterDiscount.add(taxAmount);

    // Get proper decimal places for currency
    const precision = CurrencyConverter.getPrecision(currency);

    return {
      subtotal: subtotal.toFixed(precision),
      taxAmount: taxAmount.toFixed(precision),
      totalDiscount: totalDiscount.toFixed(precision),
      total: total.toFixed(precision),
      currency
    };
  }

  /**
   * Calculate bill total from line items
   * NEVER trust client-supplied totals
   */
  static async calculateBillTotal(
    lineItems: LineItemForCalculation[],
    taxId: string | null,
    discount: number | string = 0,
    discountType: 'percentage' | 'fixed' = 'fixed',
    currency: string = 'USD',
    tenantId: string
  ): Promise<CalculatedTotals> {
    // Bills use the same calculation logic as invoices
    return this.calculateInvoiceTotal(
      lineItems,
      taxId,
      discount,
      discountType,
      currency,
      tenantId
    );
  }

  /**
   * Validate that journal entry debits equal credits
   * CRITICAL for double-entry bookkeeping integrity
   */
  static validateJournalEntryBalance(
    legs: Array<{
      accountId: string;
      debit?: string | number | null;
      credit?: string | number | null;
      currency?: string;
    }>
  ): { isBalanced: boolean; totalDebits: string; totalCredits: string; difference: string } {
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const leg of legs) {
      if (leg.debit) {
        totalDebits = totalDebits.add(new Decimal(leg.debit));
      }
      if (leg.credit) {
        totalCredits = totalCredits.add(new Decimal(leg.credit));
      }
    }

    const difference = totalDebits.sub(totalCredits).abs();
    
    // Allow for tiny rounding differences (0.01)
    const isBalanced = difference.lte(0.01);

    return {
      isBalanced,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      difference: difference.toFixed(2)
    };
  }

  /**
   * Convert amount using ONLY server-side exchange rates
   * NEVER trust client-supplied exchange rates
   */
  static async convertCurrency(
    amount: number | string,
    fromCurrency: string,
    toCurrency: string,
    tenantId: string,
    date?: Date
  ): Promise<{
    originalAmount: string;
    convertedAmount: string;
    exchangeRate: string;
    fromCurrency: string;
    toCurrency: string;
  }> {
    if (fromCurrency === toCurrency) {
      const amountDecimal = new Decimal(amount);
      return {
        originalAmount: amountDecimal.toFixed(2),
        convertedAmount: amountDecimal.toFixed(2),
        exchangeRate: '1.00',
        fromCurrency,
        toCurrency
      };
    }

    // Fetch rate from database - NEVER trust client rates
    const rateData = await getLatestRate(fromCurrency, toCurrency, tenantId);
    
    if (!rateData || !rateData.rate) {
      throw new Error(`No exchange rate found for ${fromCurrency}/${toCurrency}. Please update exchange rates.`);
    }

    const amountDecimal = new Decimal(amount);
    const rate = new Decimal(rateData.rate);
    const convertedAmount = amountDecimal.mul(rate);

    const toPrecision = CurrencyConverter.getPrecision(toCurrency);
    const fromPrecision = CurrencyConverter.getPrecision(fromCurrency);

    return {
      originalAmount: amountDecimal.toFixed(fromPrecision),
      convertedAmount: convertedAmount.toFixed(toPrecision),
      exchangeRate: rate.toFixed(6),
      fromCurrency,
      toCurrency
    };
  }

  /**
   * Validate client-supplied totals against server calculations
   * Returns validation result with discrepancies
   */
  static async validateClientTotals(
    clientData: {
      lineItems: LineItemForCalculation[];
      subtotal?: string | number;
      taxAmount?: string | number;
      total?: string | number;
      taxId?: string | null;
      discount?: number | string;
      discountType?: 'percentage' | 'fixed';
      currency?: string;
    },
    tenantId: string
  ): Promise<ValidationResult> {
    // Calculate server-side totals
    const calculatedTotals = await this.calculateInvoiceTotal(
      clientData.lineItems,
      clientData.taxId || null,
      clientData.discount || 0,
      clientData.discountType || 'fixed',
      clientData.currency || 'USD',
      tenantId
    );

    // Compare with client totals
    const clientTotals = {
      subtotal: clientData.subtotal?.toString(),
      taxAmount: clientData.taxAmount?.toString(),
      total: clientData.total?.toString()
    };

    const discrepancies: any = {};
    let hasDiscrepancy = false;

    // Check subtotal
    if (clientTotals.subtotal) {
      const clientSubtotal = new Decimal(clientTotals.subtotal);
      const calcSubtotal = new Decimal(calculatedTotals.subtotal);
      if (!clientSubtotal.eq(calcSubtotal)) {
        discrepancies.subtotal = calcSubtotal.sub(clientSubtotal).toFixed(2);
        hasDiscrepancy = true;
      }
    }

    // Check tax amount
    if (clientTotals.taxAmount) {
      const clientTax = new Decimal(clientTotals.taxAmount);
      const calcTax = new Decimal(calculatedTotals.taxAmount);
      if (!clientTax.eq(calcTax)) {
        discrepancies.taxAmount = calcTax.sub(clientTax).toFixed(2);
        hasDiscrepancy = true;
      }
    }

    // Check total
    if (clientTotals.total) {
      const clientTotal = new Decimal(clientTotals.total);
      const calcTotal = new Decimal(calculatedTotals.total);
      if (!clientTotal.eq(calcTotal)) {
        discrepancies.total = calcTotal.sub(clientTotal).toFixed(2);
        hasDiscrepancy = true;
      }
    }

    return {
      isValid: !hasDiscrepancy,
      calculatedTotals,
      clientTotals,
      discrepancies: hasDiscrepancy ? discrepancies : undefined,
      message: hasDiscrepancy
        ? 'Client totals do not match server calculations. Using server-calculated values.'
        : 'Totals validated successfully.'
    };
  }

  /**
   * Calculate payment allocation for partial payments
   */
  static calculatePaymentAllocation(
    paymentAmount: number | string,
    invoices: Array<{
      id: string;
      total: number | string;
      paid: number | string;
      currency: string;
    }>
  ): Array<{
    invoiceId: string;
    allocatedAmount: string;
    remainingBalance: string;
  }> {
    let remainingPayment = new Decimal(paymentAmount);
    const allocations = [];

    for (const invoice of invoices) {
      if (remainingPayment.lte(0)) break;

      const invoiceTotal = new Decimal(invoice.total);
      const invoicePaid = new Decimal(invoice.paid || 0);
      const invoiceBalance = invoiceTotal.sub(invoicePaid);

      if (invoiceBalance.gt(0)) {
        const allocation = Decimal.min(remainingPayment, invoiceBalance);
        allocations.push({
          invoiceId: invoice.id,
          allocatedAmount: allocation.toFixed(2),
          remainingBalance: invoiceBalance.sub(allocation).toFixed(2)
        });
        remainingPayment = remainingPayment.sub(allocation);
      }
    }

    return allocations;
  }

  /**
   * Validate financial precision for a given currency
   */
  static validateFinancialPrecision(
    amount: number | string,
    currency: string
  ): { isValid: boolean; correctedAmount: string } {
    const precision = CurrencyConverter.getPrecision(currency);
    const amountDecimal = new Decimal(amount);
    const correctedAmount = amountDecimal.toFixed(precision);
    
    // Check if the amount had more decimal places than allowed
    const originalStr = amount.toString();
    const decimalIndex = originalStr.indexOf('.');
    const originalDecimals = decimalIndex >= 0 ? originalStr.length - decimalIndex - 1 : 0;
    
    return {
      isValid: originalDecimals <= precision,
      correctedAmount
    };
  }

  /**
   * Calculate expense reimbursement with tax
   */
  static async calculateExpenseReimbursement(
    expenses: Array<{
      amount: number | string;
      taxRate?: number;
      currency?: string;
    }>,
    baseCurrency: string = 'USD',
    tenantId: string
  ): Promise<{
    totalAmount: string;
    totalTax: string;
    totalReimbursement: string;
    currency: string;
  }> {
    let totalAmount = new Decimal(0);
    let totalTax = new Decimal(0);

    for (const expense of expenses) {
      const amount = new Decimal(expense.amount);
      
      // Convert to base currency if different
      if (expense.currency && expense.currency !== baseCurrency) {
        const converted = await this.convertCurrency(
          amount.toString(),
          expense.currency,
          baseCurrency,
          tenantId
        );
        totalAmount = totalAmount.add(new Decimal(converted.convertedAmount));
        
        if (expense.taxRate) {
          const tax = new Decimal(converted.convertedAmount)
            .mul(expense.taxRate)
            .div(100);
          totalTax = totalTax.add(tax);
        }
      } else {
        totalAmount = totalAmount.add(amount);
        
        if (expense.taxRate) {
          const tax = amount.mul(expense.taxRate).div(100);
          totalTax = totalTax.add(tax);
        }
      }
    }

    const totalReimbursement = totalAmount.add(totalTax);
    const precision = CurrencyConverter.getPrecision(baseCurrency);

    return {
      totalAmount: totalAmount.toFixed(precision),
      totalTax: totalTax.toFixed(precision),
      totalReimbursement: totalReimbursement.toFixed(precision),
      currency: baseCurrency
    };
  }
}

export default FinancialCalculationsService;