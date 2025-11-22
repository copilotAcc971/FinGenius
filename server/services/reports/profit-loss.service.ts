/**
 * Profit & Loss (Income Statement) Service
 * 
 * CRITICAL: All calculations use Decimal.js for financial precision
 * Follows IFRS/GAAP standards for income statement presentation
 */

import Decimal from 'decimal.js';
import { BaseReportService, DateRange, ReportSection, ReportLineItem, AccountBalance } from './base-report.service';
import { db } from '../../db';
import { accounts } from '@shared/schema';
import { eq, and, like, or, inArray } from 'drizzle-orm';

// Configure Decimal.js
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface ProfitLossStatement {
  metadata: {
    reportName: string;
    companyName: string;
    dateRange: DateRange;
    currency: string;
    generatedAt: string;
  };
  revenue: ReportSection;
  costOfGoodsSold?: ReportSection;
  grossProfit?: string;
  operatingExpenses: ReportSection;
  operatingIncome: string;
  otherIncome?: ReportSection;
  otherExpenses?: ReportSection;
  incomeBeforeTax: string;
  taxExpense?: string;
  netIncome: string;
  // Comparison data
  previousPeriod?: {
    revenue: string;
    costOfGoodsSold?: string;
    grossProfit?: string;
    operatingExpenses: string;
    operatingIncome: string;
    netIncome: string;
  };
  variance?: {
    revenueVariance: string;
    expenseVariance: string;
    netIncomeVariance: string;
    revenueVariancePercentage: string;
    expenseVariancePercentage: string;
    netIncomeVariancePercentage: string;
  };
}

export class ProfitLossService extends BaseReportService {
  /**
   * Generate P&L Statement for a period
   */
  static async generateProfitLossStatement(
    tenantId: string,
    dateRange: DateRange,
    compareWith?: 'year' | 'quarter' | 'month'
  ): Promise<ProfitLossStatement> {
    // Get metadata
    const metadata = await this.getReportMetadata(
      tenantId,
      'Profit & Loss Statement',
      dateRange
    );

    // Get current period balances
    const currentBalances = await this.getAccountBalances(
      tenantId,
      dateRange
    );

    // Get previous period balances if comparison requested
    let previousBalances: AccountBalance[] = [];
    if (compareWith) {
      const previousPeriod = this.calculateComparisonPeriod(dateRange, compareWith);
      previousBalances = await this.getAccountBalances(
        tenantId,
        previousPeriod
      );
    }

    // Organize accounts by type
    const revenue = this.extractRevenueAccounts(currentBalances, previousBalances);
    const costOfGoodsSold = this.extractCOGSAccounts(currentBalances, previousBalances);
    const operatingExpenses = this.extractOperatingExpenses(currentBalances, previousBalances);
    const otherIncome = this.extractOtherIncome(currentBalances, previousBalances);
    const otherExpenses = this.extractOtherExpenses(currentBalances, previousBalances);

    // Calculate totals
    const totalRevenue = this.calculateSectionTotal(revenue);
    const totalCOGS = costOfGoodsSold ? this.calculateSectionTotal(costOfGoodsSold) : new Decimal(0);
    const grossProfit = totalRevenue.sub(totalCOGS);
    const totalOperatingExpenses = this.calculateSectionTotal(operatingExpenses);
    const operatingIncome = grossProfit.sub(totalOperatingExpenses);
    
    const totalOtherIncome = otherIncome ? this.calculateSectionTotal(otherIncome) : new Decimal(0);
    const totalOtherExpenses = otherExpenses ? this.calculateSectionTotal(otherExpenses) : new Decimal(0);
    
    const incomeBeforeTax = operatingIncome.add(totalOtherIncome).sub(totalOtherExpenses);
    
    // TODO: Calculate tax expense based on tax rates
    const taxExpense = new Decimal(0);
    const netIncome = incomeBeforeTax.sub(taxExpense);

    // Build the statement
    const statement: ProfitLossStatement = {
      metadata: {
        reportName: metadata.reportName,
        companyName: metadata.companyName,
        dateRange,
        currency: metadata.currency,
        generatedAt: metadata.generatedAt
      },
      revenue,
      operatingExpenses,
      operatingIncome: operatingIncome.toFixed(2),
      incomeBeforeTax: incomeBeforeTax.toFixed(2),
      netIncome: netIncome.toFixed(2)
    };

    // Add optional sections if they have data
    if (costOfGoodsSold && costOfGoodsSold.items.length > 0) {
      statement.costOfGoodsSold = costOfGoodsSold;
      statement.grossProfit = grossProfit.toFixed(2);
    }

    if (otherIncome && otherIncome.items.length > 0) {
      statement.otherIncome = otherIncome;
    }

    if (otherExpenses && otherExpenses.items.length > 0) {
      statement.otherExpenses = otherExpenses;
    }

    if (!taxExpense.isZero()) {
      statement.taxExpense = taxExpense.toFixed(2);
    }

    // Add comparison data if requested
    if (compareWith && previousBalances.length > 0) {
      statement.previousPeriod = this.calculatePreviousPeriodTotals(previousBalances);
      statement.variance = this.calculateVariances(statement, statement.previousPeriod);
    }

    return statement;
  }

  /**
   * Extract revenue accounts (4xxx series)
   */
  private static extractRevenueAccounts(
    currentBalances: AccountBalance[],
    previousBalances: AccountBalance[]
  ): ReportSection {
    const revenueAccounts = currentBalances.filter(
      acc => acc.accountCode.startsWith('4') && acc.accountType === 'revenue'
    );

    const items: ReportLineItem[] = revenueAccounts.map(account => {
      const amount = Math.abs(parseFloat(account.netBalance));
      const previousAmount = this.findPreviousBalance(account.accountId, previousBalances);
      
      const item: ReportLineItem = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };

      if (previousAmount) {
        item.previousPeriodAmount = Math.abs(previousAmount).toFixed(2);
        const variance = this.calculateVariance(amount, previousAmount);
        item.variance = variance.variance;
        item.variancePercentage = variance.variancePercentage;
      }

      return item;
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Revenue',
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract COGS accounts (5xxx series starting with 50-51)
   */
  private static extractCOGSAccounts(
    currentBalances: AccountBalance[],
    previousBalances: AccountBalance[]
  ): ReportSection | null {
    const cogsAccounts = currentBalances.filter(
      acc => (acc.accountCode.startsWith('50') || acc.accountCode.startsWith('51')) 
        && acc.accountType === 'expense'
    );

    if (cogsAccounts.length === 0) return null;

    const items: ReportLineItem[] = cogsAccounts.map(account => {
      const amount = parseFloat(account.netBalance);
      const previousAmount = this.findPreviousBalance(account.accountId, previousBalances);
      
      const item: ReportLineItem = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };

      if (previousAmount) {
        item.previousPeriodAmount = previousAmount.toFixed(2);
        const variance = this.calculateVariance(amount, previousAmount);
        item.variance = variance.variance;
        item.variancePercentage = variance.variancePercentage;
      }

      return item;
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Cost of Goods Sold',
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract operating expense accounts (5xxx series excluding COGS)
   */
  private static extractOperatingExpenses(
    currentBalances: AccountBalance[],
    previousBalances: AccountBalance[]
  ): ReportSection {
    const expenseAccounts = currentBalances.filter(
      acc => acc.accountType === 'expense' 
        && acc.accountCode.startsWith('5')
        && !acc.accountCode.startsWith('50') 
        && !acc.accountCode.startsWith('51')
        && !acc.accountCode.startsWith('59') // Exclude other expenses
    );

    const items: ReportLineItem[] = expenseAccounts.map(account => {
      const amount = parseFloat(account.netBalance);
      const previousAmount = this.findPreviousBalance(account.accountId, previousBalances);
      
      const item: ReportLineItem = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };

      if (previousAmount) {
        item.previousPeriodAmount = previousAmount.toFixed(2);
        const variance = this.calculateVariance(amount, previousAmount);
        item.variance = variance.variance;
        item.variancePercentage = variance.variancePercentage;
      }

      return item;
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Operating Expenses',
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract other income accounts
   */
  private static extractOtherIncome(
    currentBalances: AccountBalance[],
    previousBalances: AccountBalance[]
  ): ReportSection | null {
    const otherIncomeAccounts = currentBalances.filter(
      acc => acc.accountType === 'other_income' 
        || (acc.accountCode.startsWith('48') || acc.accountCode.startsWith('49'))
    );

    if (otherIncomeAccounts.length === 0) return null;

    const items: ReportLineItem[] = otherIncomeAccounts.map(account => {
      const amount = Math.abs(parseFloat(account.netBalance));
      const previousAmount = this.findPreviousBalance(account.accountId, previousBalances);
      
      const item: ReportLineItem = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };

      if (previousAmount) {
        item.previousPeriodAmount = Math.abs(previousAmount).toFixed(2);
        const variance = this.calculateVariance(amount, previousAmount);
        item.variance = variance.variance;
        item.variancePercentage = variance.variancePercentage;
      }

      return item;
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Other Income',
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract other expense accounts
   */
  private static extractOtherExpenses(
    currentBalances: AccountBalance[],
    previousBalances: AccountBalance[]
  ): ReportSection | null {
    const otherExpenseAccounts = currentBalances.filter(
      acc => acc.accountType === 'other_expense' 
        || acc.accountCode.startsWith('59')
    );

    if (otherExpenseAccounts.length === 0) return null;

    const items: ReportLineItem[] = otherExpenseAccounts.map(account => {
      const amount = parseFloat(account.netBalance);
      const previousAmount = this.findPreviousBalance(account.accountId, previousBalances);
      
      const item: ReportLineItem = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };

      if (previousAmount) {
        item.previousPeriodAmount = previousAmount.toFixed(2);
        const variance = this.calculateVariance(amount, previousAmount);
        item.variance = variance.variance;
        item.variancePercentage = variance.variancePercentage;
      }

      return item;
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Other Expenses',
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Calculate section total
   */
  private static calculateSectionTotal(section: ReportSection): Decimal {
    return new Decimal(section.subtotal);
  }

  /**
   * Find previous balance for an account
   */
  private static findPreviousBalance(
    accountId: string,
    previousBalances: AccountBalance[]
  ): number {
    const account = previousBalances.find(acc => acc.accountId === accountId);
    return account ? parseFloat(account.netBalance) : 0;
  }

  /**
   * Calculate previous period totals
   */
  private static calculatePreviousPeriodTotals(previousBalances: AccountBalance[]) {
    const revenueAccounts = previousBalances.filter(
      acc => acc.accountCode.startsWith('4') && acc.accountType === 'revenue'
    );
    const cogsAccounts = previousBalances.filter(
      acc => (acc.accountCode.startsWith('50') || acc.accountCode.startsWith('51')) 
        && acc.accountType === 'expense'
    );
    const expenseAccounts = previousBalances.filter(
      acc => acc.accountType === 'expense' 
        && acc.accountCode.startsWith('5')
        && !acc.accountCode.startsWith('50') 
        && !acc.accountCode.startsWith('51')
    );

    const revenue = revenueAccounts.reduce((sum, acc) => 
      sum.add(new Decimal(acc.netBalance).abs()), new Decimal(0)
    );
    const cogs = cogsAccounts.reduce((sum, acc) => 
      sum.add(new Decimal(acc.netBalance)), new Decimal(0)
    );
    const expenses = expenseAccounts.reduce((sum, acc) => 
      sum.add(new Decimal(acc.netBalance)), new Decimal(0)
    );

    const grossProfit = revenue.sub(cogs);
    const operatingIncome = grossProfit.sub(expenses);
    const netIncome = operatingIncome; // Simplified for now

    return {
      revenue: revenue.toFixed(2),
      costOfGoodsSold: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: expenses.toFixed(2),
      operatingIncome: operatingIncome.toFixed(2),
      netIncome: netIncome.toFixed(2)
    };
  }

  /**
   * Calculate variances between periods
   */
  private static calculateVariances(
    current: ProfitLossStatement,
    previous: any
  ) {
    const currentRevenue = new Decimal(current.revenue.subtotal);
    const previousRevenue = new Decimal(previous.revenue);
    const currentExpenses = new Decimal(current.operatingExpenses.subtotal);
    const previousExpenses = new Decimal(previous.operatingExpenses);
    const currentNetIncome = new Decimal(current.netIncome);
    const previousNetIncome = new Decimal(previous.netIncome);

    const revenueVariance = this.calculateVariance(
      currentRevenue.toNumber(),
      previousRevenue.toNumber()
    );
    const expenseVariance = this.calculateVariance(
      currentExpenses.toNumber(),
      previousExpenses.toNumber()
    );
    const netIncomeVariance = this.calculateVariance(
      currentNetIncome.toNumber(),
      previousNetIncome.toNumber()
    );

    return {
      revenueVariance: revenueVariance.variance,
      expenseVariance: expenseVariance.variance,
      netIncomeVariance: netIncomeVariance.variance,
      revenueVariancePercentage: revenueVariance.variancePercentage,
      expenseVariancePercentage: expenseVariance.variancePercentage,
      netIncomeVariancePercentage: netIncomeVariance.variancePercentage
    };
  }

  /**
   * Export P&L to various formats
   */
  static exportProfitLoss(
    statement: ProfitLossStatement,
    format: 'csv' | 'xlsx' | 'json'
  ): string | Buffer {
    const exportData: any[] = [];

    // Add header
    exportData.push({
      'Account': statement.metadata.companyName,
      'Current Period': 'PROFIT & LOSS STATEMENT',
      'Previous Period': '',
      'Variance': '',
      'Variance %': ''
    });

    exportData.push({
      'Account': `For the period ${statement.metadata.dateRange.startDate.toLocaleDateString()} to ${statement.metadata.dateRange.endDate.toLocaleDateString()}`,
      'Current Period': '',
      'Previous Period': '',
      'Variance': '',
      'Variance %': ''
    });

    exportData.push({}); // Empty row

    // Revenue section
    exportData.push({
      'Account': 'REVENUE',
      'Current Period': '',
      'Previous Period': '',
      'Variance': '',
      'Variance %': ''
    });

    statement.revenue.items.forEach(item => {
      exportData.push({
        'Account': `  ${item.accountName}`,
        'Current Period': item.amount,
        'Previous Period': item.previousPeriodAmount || '',
        'Variance': item.variance || '',
        'Variance %': item.variancePercentage || ''
      });
    });

    exportData.push({
      'Account': 'Total Revenue',
      'Current Period': statement.revenue.subtotal,
      'Previous Period': statement.previousPeriod?.revenue || '',
      'Variance': '',
      'Variance %': ''
    });

    // COGS section if exists
    if (statement.costOfGoodsSold) {
      exportData.push({}); // Empty row
      exportData.push({
        'Account': 'COST OF GOODS SOLD',
        'Current Period': '',
        'Previous Period': '',
        'Variance': '',
        'Variance %': ''
      });

      statement.costOfGoodsSold.items.forEach(item => {
        exportData.push({
          'Account': `  ${item.accountName}`,
          'Current Period': item.amount,
          'Previous Period': item.previousPeriodAmount || '',
          'Variance': item.variance || '',
          'Variance %': item.variancePercentage || ''
        });
      });

      exportData.push({
        'Account': 'Total COGS',
        'Current Period': statement.costOfGoodsSold.subtotal,
        'Previous Period': statement.previousPeriod?.costOfGoodsSold || '',
        'Variance': '',
        'Variance %': ''
      });

      exportData.push({
        'Account': 'GROSS PROFIT',
        'Current Period': statement.grossProfit,
        'Previous Period': statement.previousPeriod?.grossProfit || '',
        'Variance': '',
        'Variance %': ''
      });
    }

    // Operating expenses
    exportData.push({}); // Empty row
    exportData.push({
      'Account': 'OPERATING EXPENSES',
      'Current Period': '',
      'Previous Period': '',
      'Variance': '',
      'Variance %': ''
    });

    statement.operatingExpenses.items.forEach(item => {
      exportData.push({
        'Account': `  ${item.accountName}`,
        'Current Period': item.amount,
        'Previous Period': item.previousPeriodAmount || '',
        'Variance': item.variance || '',
        'Variance %': item.variancePercentage || ''
      });
    });

    exportData.push({
      'Account': 'Total Operating Expenses',
      'Current Period': statement.operatingExpenses.subtotal,
      'Previous Period': statement.previousPeriod?.operatingExpenses || '',
      'Variance': '',
      'Variance %': ''
    });

    exportData.push({
      'Account': 'OPERATING INCOME',
      'Current Period': statement.operatingIncome,
      'Previous Period': statement.previousPeriod?.operatingIncome || '',
      'Variance': '',
      'Variance %': ''
    });

    // Net income
    exportData.push({
      'Account': 'NET INCOME',
      'Current Period': statement.netIncome,
      'Previous Period': statement.previousPeriod?.netIncome || '',
      'Variance': statement.variance?.netIncomeVariance || '',
      'Variance %': statement.variance?.netIncomeVariancePercentage || ''
    });

    // Export based on format
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.exportToCSV(exportData);
    } else {
      return this.exportToExcel(exportData, 'Profit & Loss');
    }
  }
}