/**
 * Trial Balance Service
 * 
 * CRITICAL: Must verify that total debits equal total credits
 * Shows all accounts with their debit/credit balances
 * Foundation for financial statement preparation
 */

import Decimal from 'decimal.js';
import { BaseReportService, DateRange, AccountBalance } from './base-report.service';
import { db } from '../../db';
import { journalEntries, journalEntryLegs, accounts } from '@shared/schema';
import { eq, and, lte, gte, sql } from 'drizzle-orm';

// Configure Decimal.js
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface TrialBalanceAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalanceReport {
  metadata: {
    reportName: string;
    companyName: string;
    asOfDate: Date;
    currency: string;
    generatedAt: string;
  };
  accounts: TrialBalanceAccount[];
  totals: {
    openingDebits: string;
    openingCredits: string;
    periodDebits: string;
    periodCredits: string;
    closingDebits: string;
    closingCredits: string;
  };
  validation: {
    isBalanced: boolean;
    debitCreditDifference: string;
    message: string;
  };
}

export class TrialBalanceService extends BaseReportService {
  /**
   * Generate Trial Balance as of a specific date
   */
  static async generateTrialBalance(
    tenantId: string,
    asOfDate: Date,
    showZeroBalances: boolean = false
  ): Promise<TrialBalanceReport> {
    // Get metadata
    const metadata = await this.getReportMetadata(
      tenantId,
      'Trial Balance',
      undefined,
      asOfDate
    );

    // Calculate period start (beginning of year)
    const periodStart = new Date(asOfDate.getFullYear(), 0, 1);

    // Get all accounts
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.tenantId, tenantId));

    const trialBalanceAccounts: TrialBalanceAccount[] = [];

    // Process each account
    for (const account of allAccounts) {
      // Get opening balance (before period start)
      const openingBalance = await this.getAccountBalanceBeforeDate(
        tenantId,
        account.id,
        periodStart
      );

      // Get period activity
      const periodActivity = await this.getAccountPeriodActivity(
        tenantId,
        account.id,
        periodStart,
        asOfDate
      );

      // Calculate closing balance
      const closingDebit = openingBalance.debit.add(periodActivity.debit);
      const closingCredit = openingBalance.credit.add(periodActivity.credit);

      // Skip zero balance accounts if requested
      if (!showZeroBalances && closingDebit.isZero() && closingCredit.isZero()) {
        continue;
      }

      // Format based on normal balance
      let formattedAccount: TrialBalanceAccount;
      
      if (account.normalBalance === 'debit') {
        const netBalance = closingDebit.sub(closingCredit);
        if (netBalance.isPositive()) {
          formattedAccount = {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.accountType,
            openingDebit: openingBalance.debit.sub(openingBalance.credit).abs().toFixed(2),
            openingCredit: '0.00',
            periodDebit: periodActivity.debit.toFixed(2),
            periodCredit: periodActivity.credit.toFixed(2),
            closingDebit: netBalance.toFixed(2),
            closingCredit: '0.00'
          };
        } else {
          formattedAccount = {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.accountType,
            openingDebit: '0.00',
            openingCredit: openingBalance.credit.sub(openingBalance.debit).abs().toFixed(2),
            periodDebit: periodActivity.debit.toFixed(2),
            periodCredit: periodActivity.credit.toFixed(2),
            closingDebit: '0.00',
            closingCredit: netBalance.abs().toFixed(2)
          };
        }
      } else {
        const netBalance = closingCredit.sub(closingDebit);
        if (netBalance.isPositive()) {
          formattedAccount = {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.accountType,
            openingDebit: '0.00',
            openingCredit: openingBalance.credit.sub(openingBalance.debit).abs().toFixed(2),
            periodDebit: periodActivity.debit.toFixed(2),
            periodCredit: periodActivity.credit.toFixed(2),
            closingDebit: '0.00',
            closingCredit: netBalance.toFixed(2)
          };
        } else {
          formattedAccount = {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.accountType,
            openingDebit: openingBalance.debit.sub(openingBalance.credit).abs().toFixed(2),
            openingCredit: '0.00',
            periodDebit: periodActivity.debit.toFixed(2),
            periodCredit: periodActivity.credit.toFixed(2),
            closingDebit: netBalance.abs().toFixed(2),
            closingCredit: '0.00'
          };
        }
      }

      trialBalanceAccounts.push(formattedAccount);
    }

    // Sort accounts by code
    trialBalanceAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    // Calculate totals
    const totals = this.calculateTotals(trialBalanceAccounts);

    // Validate balance
    const closingDebitTotal = new Decimal(totals.closingDebits);
    const closingCreditTotal = new Decimal(totals.closingCredits);
    const difference = closingDebitTotal.sub(closingCreditTotal).abs();
    const isBalanced = difference.lessThan(0.01);

    const validation = {
      isBalanced,
      debitCreditDifference: difference.toFixed(2),
      message: isBalanced 
        ? 'Trial balance is in balance'
        : `Trial balance is OUT OF BALANCE by ${difference.toFixed(2)}`
    };

    return {
      metadata: {
        reportName: metadata.reportName,
        companyName: metadata.companyName,
        asOfDate,
        currency: metadata.currency,
        generatedAt: metadata.generatedAt
      },
      accounts: trialBalanceAccounts,
      totals,
      validation
    };
  }

  /**
   * Get account balance before a specific date
   */
  private static async getAccountBalanceBeforeDate(
    tenantId: string,
    accountId: string,
    beforeDate: Date
  ): Promise<{ debit: Decimal; credit: Decimal }> {
    const result = await db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntryLegs.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, beforeDate)
        )
      );

    return {
      debit: new Decimal(result[0]?.totalDebit || 0),
      credit: new Decimal(result[0]?.totalCredit || 0)
    };
  }

  /**
   * Get account activity for a specific period
   */
  private static async getAccountPeriodActivity(
    tenantId: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ debit: Decimal; credit: Decimal }> {
    const result = await db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntryLegs.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      );

    return {
      debit: new Decimal(result[0]?.totalDebit || 0),
      credit: new Decimal(result[0]?.totalCredit || 0)
    };
  }

  /**
   * Calculate totals for all columns
   */
  private static calculateTotals(accounts: TrialBalanceAccount[]) {
    let openingDebits = new Decimal(0);
    let openingCredits = new Decimal(0);
    let periodDebits = new Decimal(0);
    let periodCredits = new Decimal(0);
    let closingDebits = new Decimal(0);
    let closingCredits = new Decimal(0);

    accounts.forEach(account => {
      openingDebits = openingDebits.add(new Decimal(account.openingDebit));
      openingCredits = openingCredits.add(new Decimal(account.openingCredit));
      periodDebits = periodDebits.add(new Decimal(account.periodDebit));
      periodCredits = periodCredits.add(new Decimal(account.periodCredit));
      closingDebits = closingDebits.add(new Decimal(account.closingDebit));
      closingCredits = closingCredits.add(new Decimal(account.closingCredit));
    });

    return {
      openingDebits: openingDebits.toFixed(2),
      openingCredits: openingCredits.toFixed(2),
      periodDebits: periodDebits.toFixed(2),
      periodCredits: periodCredits.toFixed(2),
      closingDebits: closingDebits.toFixed(2),
      closingCredits: closingCredits.toFixed(2)
    };
  }

  /**
   * Export Trial Balance to various formats
   */
  static exportTrialBalance(
    report: TrialBalanceReport,
    format: 'csv' | 'xlsx' | 'json'
  ): string | Buffer {
    const exportData: any[] = [];

    // Header
    exportData.push({
      'Account Code': report.metadata.companyName,
      'Account Name': 'TRIAL BALANCE',
      'Opening Debit': '',
      'Opening Credit': '',
      'Period Debit': '',
      'Period Credit': '',
      'Closing Debit': '',
      'Closing Credit': ''
    });

    exportData.push({
      'Account Code': `As of ${report.metadata.asOfDate.toLocaleDateString()}`,
      'Account Name': '',
      'Opening Debit': '',
      'Opening Credit': '',
      'Period Debit': '',
      'Period Credit': '',
      'Closing Debit': '',
      'Closing Credit': ''
    });

    exportData.push({}); // Empty row

    // Column headers
    exportData.push({
      'Account Code': 'Account Code',
      'Account Name': 'Account Name',
      'Opening Debit': 'Opening Debit',
      'Opening Credit': 'Opening Credit',
      'Period Debit': 'Period Debit',
      'Period Credit': 'Period Credit',
      'Closing Debit': 'Closing Debit',
      'Closing Credit': 'Closing Credit'
    });

    // Account data
    report.accounts.forEach(account => {
      exportData.push({
        'Account Code': account.accountCode,
        'Account Name': account.accountName,
        'Opening Debit': account.openingDebit,
        'Opening Credit': account.openingCredit,
        'Period Debit': account.periodDebit,
        'Period Credit': account.periodCredit,
        'Closing Debit': account.closingDebit,
        'Closing Credit': account.closingCredit
      });
    });

    // Totals
    exportData.push({}); // Empty row
    exportData.push({
      'Account Code': '',
      'Account Name': 'TOTALS',
      'Opening Debit': report.totals.openingDebits,
      'Opening Credit': report.totals.openingCredits,
      'Period Debit': report.totals.periodDebits,
      'Period Credit': report.totals.periodCredits,
      'Closing Debit': report.totals.closingDebits,
      'Closing Credit': report.totals.closingCredits
    });

    // Validation
    exportData.push({}); // Empty row
    exportData.push({
      'Account Code': '',
      'Account Name': 'Balance Check',
      'Opening Debit': '',
      'Opening Credit': '',
      'Period Debit': '',
      'Period Credit': '',
      'Closing Debit': report.validation.isBalanced ? 'BALANCED' : 'OUT OF BALANCE',
      'Closing Credit': report.validation.debitCreditDifference
    });

    // Export based on format
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.exportToCSV(exportData);
    } else {
      return this.exportToExcel(exportData, 'Trial Balance');
    }
  }

  /**
   * Get journal entries for a specific account (for drill-down)
   */
  static async getAccountJournalEntries(
    tenantId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    let query = db
      .select({
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        description: journalEntries.description,
        debit: journalEntryLegs.debit,
        credit: journalEntryLegs.credit,
        legDescription: journalEntryLegs.description
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntryLegs.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          startDate ? gte(journalEntries.entryDate, startDate) : undefined,
          endDate ? lte(journalEntries.entryDate, endDate) : undefined
        )
      )
      .orderBy(journalEntries.entryDate);

    return await query;
  }
}