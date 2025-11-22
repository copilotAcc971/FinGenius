/**
 * Base Report Service
 * Common functionality for all financial reports
 * 
 * CRITICAL: All financial calculations use Decimal.js for precision
 * Server-side calculations only - never trust client data
 */

import Decimal from 'decimal.js';
import { db } from '../../db';
import { 
  journalEntries,
  journalEntryLegs,
  accounts,
  exchangeRates,
  currencies,
  tenantCompanyProfiles
} from '@shared/schema';
import { eq, and, gte, lte, sql, inArray, desc } from 'drizzle-orm';
import { getLatestRate } from '../fx-rates';
import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';

// Configure Decimal.js for financial precision
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ComparisonPeriod {
  currentPeriod: DateRange;
  previousPeriod?: DateRange;
}

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: string;
  creditBalance: string;
  netBalance: string;
  currency: string;
  openingBalance?: string;
  periodActivity?: string;
  closingBalance?: string;
}

export interface ReportLineItem {
  accountCode: string;
  accountName: string;
  amount: string;
  percentageOfTotal?: string;
  previousPeriodAmount?: string;
  variance?: string;
  variancePercentage?: string;
}

export interface ReportSection {
  name: string;
  items: ReportLineItem[];
  subtotal: string;
  previousPeriodSubtotal?: string;
}

export interface ReportMetadata {
  reportName: string;
  companyName: string;
  reportDate: string;
  dateRange?: DateRange;
  asOfDate?: Date;
  currency: string;
  preparedBy?: string;
  generatedAt: string;
}

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  includeDetails?: boolean;
  includeSummary?: boolean;
}

export class BaseReportService {
  /**
   * Get account balances for a specific period
   * Only includes POSTED journal entries
   */
  static async getAccountBalances(
    tenantId: string,
    dateRange?: DateRange,
    asOfDate?: Date,
    accountTypes?: string[]
  ): Promise<AccountBalance[]> {
    // Build date condition
    let dateCondition = eq(journalEntries.status, 'posted');
    
    if (dateRange) {
      dateCondition = and(
        dateCondition,
        gte(journalEntries.entryDate, dateRange.startDate),
        lte(journalEntries.entryDate, dateRange.endDate)
      ) as any;
    } else if (asOfDate) {
      dateCondition = and(
        dateCondition,
        lte(journalEntries.entryDate, asOfDate)
      ) as any;
    }

    // Query journal entries with their legs
    const query = db
      .select({
        accountId: accounts.id,
        accountCode: accounts.code,
        accountName: accounts.name,
        accountType: accounts.accountType,
        normalBalance: accounts.normalBalance,
        debit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          dateCondition,
          accountTypes ? inArray(accounts.accountType, accountTypes) : undefined
        )
      )
      .groupBy(accounts.id, accounts.code, accounts.name, accounts.accountType, accounts.normalBalance);

    const results = await query;

    // Calculate net balances
    return results.map(row => {
      const debit = new Decimal(row.debit || 0);
      const credit = new Decimal(row.credit || 0);
      
      // Calculate net balance based on normal balance
      let netBalance: Decimal;
      if (row.normalBalance === 'debit') {
        netBalance = debit.sub(credit);
      } else {
        netBalance = credit.sub(debit);
      }

      return {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        debitBalance: debit.toFixed(2),
        creditBalance: credit.toFixed(2),
        netBalance: netBalance.toFixed(2),
        currency: 'USD' // Default, should be fetched from tenant settings
      };
    });
  }

  /**
   * Get opening balance for accounts as of a specific date
   */
  static async getOpeningBalance(
    tenantId: string,
    accountId: string,
    beforeDate: Date
  ): Promise<string> {
    const result = await db
      .select({
        debit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`,
        normalBalance: accounts.normalBalance
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntryLegs.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, beforeDate)
        )
      )
      .groupBy(accounts.normalBalance)
      .limit(1);

    if (!result.length) return '0.00';

    const debit = new Decimal(result[0].debit);
    const credit = new Decimal(result[0].credit);
    const normalBalance = result[0].normalBalance;

    const balance = normalBalance === 'debit' 
      ? debit.sub(credit)
      : credit.sub(debit);

    return balance.toFixed(2);
  }

  /**
   * Get period activity for an account
   */
  static async getPeriodActivity(
    tenantId: string,
    accountId: string,
    dateRange: DateRange
  ): Promise<{ debits: string; credits: string; net: string }> {
    const result = await db
      .select({
        debit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`,
        normalBalance: accounts.normalBalance
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntryLegs.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, dateRange.startDate),
          lte(journalEntries.entryDate, dateRange.endDate)
        )
      )
      .groupBy(accounts.normalBalance)
      .limit(1);

    if (!result.length) {
      return { debits: '0.00', credits: '0.00', net: '0.00' };
    }

    const debit = new Decimal(result[0].debit);
    const credit = new Decimal(result[0].credit);
    const normalBalance = result[0].normalBalance;

    const net = normalBalance === 'debit' 
      ? debit.sub(credit)
      : credit.sub(debit);

    return {
      debits: debit.toFixed(2),
      credits: credit.toFixed(2),
      net: net.toFixed(2)
    };
  }

  /**
   * Calculate comparison period (e.g., previous year, previous quarter)
   */
  static calculateComparisonPeriod(
    dateRange: DateRange,
    comparisonType: 'year' | 'quarter' | 'month'
  ): DateRange {
    const { startDate, endDate } = dateRange;
    
    let previousStart: Date;
    let previousEnd: Date;

    switch (comparisonType) {
      case 'year':
        previousStart = new Date(startDate);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        previousEnd = new Date(endDate);
        previousEnd.setFullYear(previousEnd.getFullYear() - 1);
        break;
      
      case 'quarter':
        previousStart = new Date(startDate);
        previousStart.setMonth(previousStart.getMonth() - 3);
        previousEnd = new Date(endDate);
        previousEnd.setMonth(previousEnd.getMonth() - 3);
        break;
      
      case 'month':
        previousStart = new Date(startDate);
        previousStart.setMonth(previousStart.getMonth() - 1);
        previousEnd = new Date(endDate);
        previousEnd.setMonth(previousEnd.getMonth() - 1);
        break;
    }

    return {
      startDate: previousStart,
      endDate: previousEnd
    };
  }

  /**
   * Calculate variance between two amounts
   */
  static calculateVariance(
    currentAmount: string | number,
    previousAmount: string | number
  ): { variance: string; variancePercentage: string } {
    const current = new Decimal(currentAmount);
    const previous = new Decimal(previousAmount);

    const variance = current.sub(previous);
    
    let variancePercentage = new Decimal(0);
    if (!previous.isZero()) {
      variancePercentage = variance.div(previous).mul(100);
    }

    return {
      variance: variance.toFixed(2),
      variancePercentage: variancePercentage.toFixed(2)
    };
  }

  /**
   * Get report metadata
   */
  static async getReportMetadata(
    tenantId: string,
    reportName: string,
    dateRange?: DateRange,
    asOfDate?: Date
  ): Promise<ReportMetadata> {
    // Get company profile
    const [companyProfile] = await db
      .select()
      .from(tenantCompanyProfiles)
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .limit(1);

    const companyName = companyProfile?.companyName || 'Company Name';

    // Get default currency
    const [defaultCurrency] = await db
      .select()
      .from(currencies)
      .where(
        and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isDefault, true)
        )
      )
      .limit(1);

    return {
      reportName,
      companyName,
      reportDate: asOfDate 
        ? asOfDate.toLocaleDateString()
        : dateRange 
        ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
        : new Date().toLocaleDateString(),
      dateRange,
      asOfDate,
      currency: defaultCurrency?.code || 'USD',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Convert amounts to base currency if needed
   */
  static async convertToBaseCurrency(
    amount: string | number,
    fromCurrency: string,
    toCurrency: string,
    tenantId: string,
    date?: Date
  ): Promise<string> {
    if (fromCurrency === toCurrency) {
      return new Decimal(amount).toFixed(2);
    }

    const rate = await getLatestRate(tenantId, fromCurrency, toCurrency, date);
    
    if (!rate) {
      console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
      return new Decimal(amount).toFixed(2);
    }

    return new Decimal(amount).mul(rate).toFixed(2);
  }

  /**
   * Export report to CSV format
   */
  static exportToCSV(data: any[], fields?: string[]): string {
    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  /**
   * Export report to Excel format
   */
  static exportToExcel(data: any[], sheetName: string = 'Report'): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Format report data for export
   */
  static formatForExport(
    sections: ReportSection[],
    metadata: ReportMetadata
  ): any[] {
    const exportData: any[] = [];

    // Add metadata rows
    exportData.push({
      'Report': metadata.reportName,
      'Company': metadata.companyName,
      'Date': metadata.reportDate,
      'Currency': metadata.currency
    });
    
    exportData.push({}); // Empty row for spacing

    // Add report data
    sections.forEach(section => {
      // Section header
      exportData.push({
        'Account': section.name,
        'Amount': '',
        'Previous Period': '',
        'Variance': '',
        'Variance %': ''
      });

      // Section items
      section.items.forEach(item => {
        exportData.push({
          'Account': `  ${item.accountName}`,
          'Amount': item.amount,
          'Previous Period': item.previousPeriodAmount || '',
          'Variance': item.variance || '',
          'Variance %': item.variancePercentage || ''
        });
      });

      // Section subtotal
      exportData.push({
        'Account': `Total ${section.name}`,
        'Amount': section.subtotal,
        'Previous Period': section.previousPeriodSubtotal || '',
        'Variance': '',
        'Variance %': ''
      });

      exportData.push({}); // Empty row for spacing
    });

    return exportData;
  }
}