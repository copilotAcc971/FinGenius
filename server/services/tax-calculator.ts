/**
 * Tax Calculator Service
 * 
 * Implements real tax calculations for invoices and bills.
 * Supports multiple tax types: VAT, GST, Sales Tax, etc.
 */

export interface TaxCalculation {
  itemTotal: number;
  taxRate: number;
  taxType: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  taxInclusive: boolean;
  calculatedTax: number;
  totalAmount: number;
}

export interface LineItemTax {
  lineItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  lineTax: number;
  lineWithTax: number;
}

export class TaxCalculator {
  /**
   * Calculate tax for a single line item
   */
  static calculateLineItemTax(
    quantity: number,
    unitPrice: number,
    taxRate: number,
    taxInclusive: boolean = false
  ): LineItemTax {
    const lineTotal = quantity * unitPrice;

    if (taxInclusive) {
      // Tax is already included in the price
      const lineTax = lineTotal - (lineTotal / (1 + taxRate / 100));
      return {
        lineItemId: '',
        quantity,
        unitPrice,
        lineTotal,
        taxRate,
        lineTax: Math.round(lineTax * 100) / 100,
        lineWithTax: lineTotal
      };
    } else {
      // Tax is added to the price
      const lineTax = (lineTotal * taxRate) / 100;
      return {
        lineItemId: '',
        quantity,
        unitPrice,
        lineTotal,
        taxRate,
        lineTax: Math.round(lineTax * 100) / 100,
        lineWithTax: Math.round((lineTotal + lineTax) * 100) / 100
      };
    }
  }

  /**
   * Calculate total tax for invoice with multiple line items
   */
  static calculateInvoiceTax(
    lineItems: Array<{ quantity: number; unitPrice: number; taxRate?: number }>,
    defaultTaxRate: number = 0,
    taxInclusive: boolean = false
  ) {
    let totalBeforeTax = 0;
    let totalTax = 0;
    const calculatedItems: LineItemTax[] = [];

    lineItems.forEach((item, index) => {
      const taxRate = item.taxRate ?? defaultTaxRate;
      const calculated = this.calculateLineItemTax(
        item.quantity,
        item.unitPrice,
        taxRate,
        taxInclusive
      );

      calculated.lineItemId = `line_${index}`;
      calculatedItems.push(calculated);

      if (taxInclusive) {
        totalBeforeTax += calculated.lineTotal;
        totalTax += calculated.lineTax;
      } else {
        totalBeforeTax += calculated.lineTotal;
        totalTax += calculated.lineTax;
      }
    });

    return {
      lineItems: calculatedItems,
      subtotal: Math.round(totalBeforeTax * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      total: Math.round((totalBeforeTax + totalTax) * 100) / 100,
      taxInclusive
    };
  }

  /**
   * Calculate compound tax (tax on tax)
   * Used in some jurisdictions (e.g., multiple VAT rates)
   */
  static calculateCompoundTax(
    amount: number,
    taxRates: number[]
  ) {
    let result = amount;
    const taxBreakdown: { rate: number; tax: number; total: number }[] = [];

    taxRates.forEach(rate => {
      const tax = (result * rate) / 100;
      result += tax;
      taxBreakdown.push({
        rate,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(result * 100) / 100
      });
    });

    return {
      originalAmount: amount,
      taxBreakdown,
      finalAmount: Math.round(result * 100) / 100,
      totalTax: Math.round((result - amount) * 100) / 100
    };
  }

  /**
   * Get tax by jurisdiction
   * This can be expanded with actual tax rates per country/region
   */
  static getTaxRateByJurisdiction(jurisdiction: string, taxType: string = 'VAT'): number {
    const taxRates: { [key: string]: { [key: string]: number } } = {
      // UAE
      'AE': {
        'VAT': 5,
        'TOURISM': 0, // Tourism fees handled separately
      },
      // Saudi Arabia
      'SA': {
        'VAT': 15,
        'ZAKAT': 2.5, // Handled separately
      },
      // US
      'US': {
        'SALES_TAX': 0, // Varies by state
        'FEDERAL': 0,
      },
      // Canada
      'CA': {
        'GST': 5,
        'PST': 0, // Varies by province
      },
      // UK
      'GB': {
        'VAT': 20,
        'REDUCED': 5,
        'ZERO': 0,
      }
    };

    return taxRates[jurisdiction]?.[taxType] ?? 0;
  }

  /**
   * Validate tax calculation (used for audit/compliance)
   */
  static validateTaxCalculation(
    lineItems: Array<{ quantity: number; unitPrice: number; tax: number }>,
    reportedTotalTax: number,
    tolerance: number = 0.01 // Allow 0.01 variance
  ): { isValid: boolean; discrepancy: number } {
    let calculatedTotalTax = 0;

    lineItems.forEach(item => {
      calculatedTotalTax += item.tax;
    });

    const discrepancy = Math.abs(calculatedTotalTax - reportedTotalTax);

    return {
      isValid: discrepancy <= tolerance,
      discrepancy
    };
  }
}

export default TaxCalculator;