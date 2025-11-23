/**
 * Balance Sheet Service
 * 
 * CRITICAL: Must validate that Assets = Liabilities + Equity
 * All calculations use Decimal.js for financial precision
 * Point-in-time snapshot report
 */

import Decimal from 'decimal.js';
import { BaseReportService, ReportSection, ReportLineItem, AccountBalance } from './base-report.service';
import { db } from '../../db';
import { journalEntries, journalEntryLegs, accounts } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { queryOptimizer } from '../../utils/query-optimizer';

// Configure Decimal.js
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface BalanceSheetReport {
  metadata: {
    reportName: string;
    companyName: string;
    asOfDate: Date;
    currency: string;
    generatedAt: string;
  };
  assets: {
    current: ReportSection;
    nonCurrent: ReportSection;
    totalAssets: string;
  };
  liabilities: {
    current: ReportSection;
    nonCurrent: ReportSection;
    totalLiabilities: string;
  };
  equity: {
    items: ReportSection;
    retainedEarnings: string;
    totalEquity: string;
  };
  validation: {
    isBalanced: boolean;
    totalAssets: string;
    totalLiabilitiesAndEquity: string;
    difference: string;
  };
}

export class BalanceSheetService extends BaseReportService {
  /**
   * Generate Balance Sheet as of a specific date
   */
  static async generateBalanceSheet(
    tenantId: string,
    asOfDate: Date
  ): Promise<BalanceSheetReport> {
    // Get metadata
    const metadata = await this.getReportMetadata(
      tenantId,
      'Balance Sheet',
      undefined,
      asOfDate
    );

    // Get all account balances as of the date
    const balances = await this.getAccountBalances(
      tenantId,
      undefined,
      asOfDate
    );

    // Organize accounts by classification
    const currentAssets = this.extractCurrentAssets(balances);
    const nonCurrentAssets = this.extractNonCurrentAssets(balances);
    const currentLiabilities = this.extractCurrentLiabilities(balances);
    const nonCurrentLiabilities = this.extractNonCurrentLiabilities(balances);
    const equityAccounts = this.extractEquityAccounts(balances);

    // Calculate retained earnings
    const retainedEarnings = await this.calculateRetainedEarnings(tenantId, asOfDate);

    // Calculate totals
    const totalCurrentAssets = this.calculateSectionTotal(currentAssets);
    const totalNonCurrentAssets = this.calculateSectionTotal(nonCurrentAssets);
    const totalAssets = totalCurrentAssets.add(totalNonCurrentAssets);

    const totalCurrentLiabilities = this.calculateSectionTotal(currentLiabilities);
    const totalNonCurrentLiabilities = this.calculateSectionTotal(nonCurrentLiabilities);
    const totalLiabilities = totalCurrentLiabilities.add(totalNonCurrentLiabilities);

    const totalEquityAccounts = this.calculateSectionTotal(equityAccounts);
    const totalEquity = totalEquityAccounts.add(retainedEarnings);

    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);

    // Validate balance sheet equation
    const difference = totalAssets.sub(totalLiabilitiesAndEquity);
    const isBalanced = difference.abs().lessThan(0.01);

    const report: BalanceSheetReport = {
      metadata: {
        reportName: metadata.reportName,
        companyName: metadata.companyName,
        asOfDate,
        currency: metadata.currency,
        generatedAt: metadata.generatedAt
      },
      assets: {
        current: currentAssets,
        nonCurrent: nonCurrentAssets,
        totalAssets: totalAssets.toFixed(2)
      },
      liabilities: {
        current: currentLiabilities,
        nonCurrent: nonCurrentLiabilities,
        totalLiabilities: totalLiabilities.toFixed(2)
      },
      equity: {
        items: equityAccounts,
        retainedEarnings: retainedEarnings.toFixed(2),
        totalEquity: totalEquity.toFixed(2)
      },
      validation: {
        isBalanced,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
        difference: difference.toFixed(2)
      }
    };

    return report;
  }

  /**
   * Extract current assets (1xxx accounts with specific types)
   */
  private static extractCurrentAssets(balances: AccountBalance[]): ReportSection {
    const currentAssetAccounts = balances.filter(acc => {
      const code = acc.accountCode;
      return acc.accountType === 'asset' && (
        code.startsWith('10') || // Cash and cash equivalents
        code.startsWith('11') || // Accounts receivable
        code.startsWith('12') || // Inventory
        code.startsWith('13') || // Prepaid expenses
        code.startsWith('14')    // Other current assets
      );
    });

    const items: ReportLineItem[] = currentAssetAccounts.map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: Math.abs(parseFloat(account.netBalance)).toFixed(2)
    }));

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Current Assets',
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract non-current assets (1xxx accounts - fixed assets)
   */
  private static extractNonCurrentAssets(balances: AccountBalance[]): ReportSection {
    const nonCurrentAssetAccounts = balances.filter(acc => {
      const code = acc.accountCode;
      return acc.accountType === 'asset' && (
        code.startsWith('15') || // Property, plant, equipment
        code.startsWith('16') || // Intangible assets
        code.startsWith('17') || // Long-term investments
        code.startsWith('18') || // Other non-current assets
        code.startsWith('19')    // Accumulated depreciation (contra)
      );
    });

    const items: ReportLineItem[] = nonCurrentAssetAccounts.map(account => {
      // Handle accumulated depreciation (contra asset)
      const amount = account.accountCode.startsWith('19') 
        ? -Math.abs(parseFloat(account.netBalance))
        : Math.abs(parseFloat(account.netBalance));
      
      return {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: amount.toFixed(2)
      };
    });

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Non-Current Assets',
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract current liabilities (2xxx accounts with specific types)
   */
  private static extractCurrentLiabilities(balances: AccountBalance[]): ReportSection {
    const currentLiabilityAccounts = balances.filter(acc => {
      const code = acc.accountCode;
      return acc.accountType === 'liability' && (
        code.startsWith('20') || // Accounts payable
        code.startsWith('21') || // Accrued liabilities
        code.startsWith('22') || // Short-term debt
        code.startsWith('23') || // Current portion of long-term debt
        code.startsWith('24')    // Other current liabilities
      );
    });

    const items: ReportLineItem[] = currentLiabilityAccounts.map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: Math.abs(parseFloat(account.netBalance)).toFixed(2)
    }));

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Current Liabilities',
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract non-current liabilities (2xxx accounts - long-term)
   */
  private static extractNonCurrentLiabilities(balances: AccountBalance[]): ReportSection {
    const nonCurrentLiabilityAccounts = balances.filter(acc => {
      const code = acc.accountCode;
      return acc.accountType === 'liability' && (
        code.startsWith('25') || // Long-term debt
        code.startsWith('26') || // Deferred tax liabilities
        code.startsWith('27') || // Other long-term liabilities
        code.startsWith('28') ||
        code.startsWith('29')
      );
    });

    const items: ReportLineItem[] = nonCurrentLiabilityAccounts.map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: Math.abs(parseFloat(account.netBalance)).toFixed(2)
    }));

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Non-Current Liabilities',
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Extract equity accounts (3xxx accounts)
   */
  private static extractEquityAccounts(balances: AccountBalance[]): ReportSection {
    const equityAccounts = balances.filter(acc => {
      const code = acc.accountCode;
      return acc.accountType === 'equity' && (
        code.startsWith('30') || // Share capital
        code.startsWith('31') || // Additional paid-in capital
        code.startsWith('32') || // Treasury stock
        code.startsWith('33') || // Other comprehensive income
        code.startsWith('34') || // Reserves
        code.startsWith('35')    // Other equity (excluding retained earnings)
      );
    });

    const items: ReportLineItem[] = equityAccounts.map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: Math.abs(parseFloat(account.netBalance)).toFixed(2)
    }));

    const subtotal = items.reduce((sum, item) => 
      sum.add(new Decimal(item.amount)), new Decimal(0)
    );

    return {
      name: 'Equity',
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Calculate retained earnings
   * Retained Earnings = Beginning RE + Net Income - Dividends
   * For simplicity, we'll calculate cumulative P&L from inception
   */
  private static async calculateRetainedEarnings(
    tenantId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    // Get all revenue and expense account balances
    const balances = await this.getAccountBalances(
      tenantId,
      undefined,
      asOfDate,
      ['revenue', 'expense', 'other_income', 'other_expense']
    );

    // Calculate net income (revenue - expenses)
    let totalRevenue = new Decimal(0);
    let totalExpenses = new Decimal(0);

    balances.forEach(account => {
      const balance = new Decimal(account.netBalance);
      if (account.accountType === 'revenue' || account.accountType === 'other_income') {
        totalRevenue = totalRevenue.add(balance.abs());
      } else if (account.accountType === 'expense' || account.accountType === 'other_expense') {
        totalExpenses = totalExpenses.add(balance.abs());
      }
    });

    // Check for specific retained earnings account (3900 or similar)
    const [retainedEarningsAccount] = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(
            CASE 
              WHEN ${accounts.normalBalance} = 'credit' 
              THEN ${journalEntryLegs.credit} - ${journalEntryLegs.debit}
              ELSE ${journalEntryLegs.debit} - ${journalEntryLegs.credit}
            END
          ), 0)
        `
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, asOfDate),
          eq(accounts.code, '3900') // Standard retained earnings account
        )
      );

    const beginningRetainedEarnings = retainedEarningsAccount?.balance 
      ? new Decimal(retainedEarningsAccount.balance)
      : new Decimal(0);

    // Calculate total retained earnings
    const netIncome = totalRevenue.sub(totalExpenses);
    const retainedEarnings = beginningRetainedEarnings.add(netIncome);

    return retainedEarnings;
  }

  /**
   * Calculate section total
   */
  private static calculateSectionTotal(section: ReportSection): Decimal {
    return new Decimal(section.subtotal);
  }

  /**
   * Export Balance Sheet to various formats
   */
  static exportBalanceSheet(
    report: BalanceSheetReport,
    format: 'csv' | 'xlsx' | 'json'
  ): string | Buffer {
    const exportData: any[] = [];

    // Header
    exportData.push({
      'Account': report.metadata.companyName,
      'Amount': 'BALANCE SHEET',
      'Notes': ''
    });

    exportData.push({
      'Account': `As of ${report.metadata.asOfDate.toLocaleDateString()}`,
      'Amount': '',
      'Notes': ''
    });

    exportData.push({}); // Empty row

    // ASSETS
    exportData.push({
      'Account': 'ASSETS',
      'Amount': '',
      'Notes': ''
    });

    // Current Assets
    exportData.push({
      'Account': '  Current Assets',
      'Amount': '',
      'Notes': ''
    });

    report.assets.current.items.forEach(item => {
      exportData.push({
        'Account': `    ${item.accountName}`,
        'Amount': item.amount,
        'Notes': ''
      });
    });

    exportData.push({
      'Account': '  Total Current Assets',
      'Amount': report.assets.current.subtotal,
      'Notes': ''
    });

    // Non-Current Assets
    exportData.push({
      'Account': '  Non-Current Assets',
      'Amount': '',
      'Notes': ''
    });

    report.assets.nonCurrent.items.forEach(item => {
      exportData.push({
        'Account': `    ${item.accountName}`,
        'Amount': item.amount,
        'Notes': ''
      });
    });

    exportData.push({
      'Account': '  Total Non-Current Assets',
      'Amount': report.assets.nonCurrent.subtotal,
      'Notes': ''
    });

    exportData.push({
      'Account': 'TOTAL ASSETS',
      'Amount': report.assets.totalAssets,
      'Notes': ''
    });

    exportData.push({}); // Empty row

    // LIABILITIES
    exportData.push({
      'Account': 'LIABILITIES',
      'Amount': '',
      'Notes': ''
    });

    // Current Liabilities
    exportData.push({
      'Account': '  Current Liabilities',
      'Amount': '',
      'Notes': ''
    });

    report.liabilities.current.items.forEach(item => {
      exportData.push({
        'Account': `    ${item.accountName}`,
        'Amount': item.amount,
        'Notes': ''
      });
    });

    exportData.push({
      'Account': '  Total Current Liabilities',
      'Amount': report.liabilities.current.subtotal,
      'Notes': ''
    });

    // Non-Current Liabilities
    exportData.push({
      'Account': '  Non-Current Liabilities',
      'Amount': '',
      'Notes': ''
    });

    report.liabilities.nonCurrent.items.forEach(item => {
      exportData.push({
        'Account': `    ${item.accountName}`,
        'Amount': item.amount,
        'Notes': ''
      });
    });

    exportData.push({
      'Account': '  Total Non-Current Liabilities',
      'Amount': report.liabilities.nonCurrent.subtotal,
      'Notes': ''
    });

    exportData.push({
      'Account': 'TOTAL LIABILITIES',
      'Amount': report.liabilities.totalLiabilities,
      'Notes': ''
    });

    exportData.push({}); // Empty row

    // EQUITY
    exportData.push({
      'Account': 'EQUITY',
      'Amount': '',
      'Notes': ''
    });

    report.equity.items.items.forEach(item => {
      exportData.push({
        'Account': `  ${item.accountName}`,
        'Amount': item.amount,
        'Notes': ''
      });
    });

    exportData.push({
      'Account': '  Retained Earnings',
      'Amount': report.equity.retainedEarnings,
      'Notes': ''
    });

    exportData.push({
      'Account': 'TOTAL EQUITY',
      'Amount': report.equity.totalEquity,
      'Notes': ''
    });

    exportData.push({}); // Empty row

    exportData.push({
      'Account': 'TOTAL LIABILITIES AND EQUITY',
      'Amount': report.validation.totalLiabilitiesAndEquity,
      'Notes': ''
    });

    // Validation
    exportData.push({}); // Empty row
    exportData.push({
      'Account': 'Balance Check',
      'Amount': report.validation.isBalanced ? 'BALANCED' : 'IMBALANCED',
      'Notes': report.validation.difference !== '0.00' 
        ? `Difference: ${report.validation.difference}`
        : ''
    });

    // Export based on format
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.exportToCSV(exportData);
    } else {
      return this.exportToExcel(exportData, 'Balance Sheet');
    }
  }
}