/**
 * Historical Balance Service
 * 
 * Tracks account balances over time with support for journal entry posting integration.
 * Provides accurate point-in-time balance calculations, running balance tracking,
 * and IFRS-compliant foreign exchange gain/loss calculations.
 * 
 * **Core Responsibilities:**
 * - Calculate opening balances for accounts at period start
 * - Record individual transactions with running balances
 * - Update historical balance records when journal entries are posted
 * - Provide current and historical balance queries
 * - Calculate FX gain/loss for multi-currency accounts
 * 
 * **Integration Points:**
 * - Called by journal entry posting workflow
 * - Used by financial reports for balance sheet, trial balance
 * - Supports IFRS compliance for multi-currency accounting
 * 
 * @module server/accounting/historical-balance-service
 */

import { db } from '../db';
import type { DBTransaction } from './service';
import {
  accounts,
  journalEntries,
  journalEntryLegs,
  historicalBalances,
  accountTransactionHistory,
  exchangeRates,
  type Account,
  type JournalEntry,
  type JournalEntryLeg,
  type HistoricalBalance,
  type AccountTransactionHistory,
  type InsertHistoricalBalance,
  type InsertAccountTransactionHistory,
} from '@shared/schema';
import { eq, and, lt, lte, gte, desc, asc, sql, between } from 'drizzle-orm';
import {
  ValidationError,
  AccountingError,
  NotFoundError,
  logError,
} from './errors';

// ====================================
// TYPE DEFINITIONS
// ====================================

/**
 * Account Normal Balance Type
 * Determines whether an account's positive balance is a debit or credit
 */
type NormalBalanceType = 'debit' | 'credit';

/**
 * Foreign Exchange Difference Result
 * Contains calculated FX gain/loss amounts for IFRS compliance
 */
export interface FXDifferenceResult {
  fxGain: string;
  fxLoss: string;
  netDifference: string;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Determine the normal balance type for an account
 * 
 * **Account Type Mapping:**
 * - Assets: Debit normal (increases with debits)
 * - Expenses: Debit normal (increases with debits)
 * - Liabilities: Credit normal (increases with credits)
 * - Equity: Credit normal (increases with credits)
 * - Income/Revenue: Credit normal (increases with credits)
 * 
 * @param accountType - Account type from chartOfAccounts
 * @returns 'debit' or 'credit'
 */
function getNormalBalanceType(accountType: string): NormalBalanceType {
  const normalizedType = accountType.toLowerCase();
  
  if (normalizedType === 'asset' || normalizedType === 'expense') {
    return 'debit';
  }
  
  if (normalizedType === 'liability' || normalizedType === 'equity' || normalizedType === 'income') {
    return 'credit';
  }
  
  throw new ValidationError(
    `Unknown account type: ${accountType}`,
    { accountType }
  );
}

/**
 * Calculate balance based on normal balance type
 * 
 * **Formula:**
 * - Debit normal accounts: balance = total debits - total credits
 * - Credit normal accounts: balance = total credits - total debits
 * 
 * @param totalDebits - Sum of all debit amounts
 * @param totalCredits - Sum of all credit amounts
 * @param normalBalanceType - Account's normal balance type
 * @returns Calculated balance (can be negative)
 */
function calculateBalance(
  totalDebits: number,
  totalCredits: number,
  normalBalanceType: NormalBalanceType
): number {
  if (normalBalanceType === 'debit') {
    return totalDebits - totalCredits;
  } else {
    return totalCredits - totalDebits;
  }
}

/**
 * Get the period boundaries (month start/end) for a given date
 * 
 * @param date - Date to get period for
 * @returns Object with periodStart and periodEnd timestamps
 */
function getPeriodBoundaries(date: Date): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { periodStart, periodEnd };
}

/**
 * Normalize decimal to 2 decimal places
 * 
 * @param value - Decimal value as string or number
 * @returns Normalized decimal string
 */
function normalizeDecimal(value: string | number): string {
  return parseFloat(value.toString()).toFixed(2);
}

// ====================================
// CORE SERVICE FUNCTIONS
// ====================================

/**
 * Calculate opening balance for an account at the beginning of a period
 * 
 * **Purpose:** Determine the account balance at the start of a period by summing
 * all historical transactions before that date and accounting for normal balance type.
 * 
 * **Logic:**
 * 1. Fetch account to determine normal balance type
 * 2. Sum all debits and credits from accountTransactionHistory BEFORE periodStartDate
 * 3. Calculate balance based on normal balance type:
 *    - Debit-normal accounts: opening balance = total debits - total credits
 *    - Credit-normal accounts: opening balance = total credits - total debits
 * 
 * **Edge Cases:**
 * - Account has no transactions before period: returns "0.00"
 * - Account doesn't exist: throws NotFoundError
 * - First period for account: returns account's opening balance or "0.00"
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param accountId - Account to calculate opening balance for
 * @param periodStartDate - Start date of the period
 * @param tx - Optional database transaction for atomicity
 * @returns Opening balance as decimal string (can be negative)
 * 
 * @example
 * ```typescript
 * const openingBalance = await calculateOpeningBalance(
 *   'tenant-123',
 *   'account-456',
 *   new Date('2024-01-01')
 * );
 * console.log(openingBalance); // "10500.00"
 * ```
 */
export async function calculateOpeningBalance(
  tenantId: string,
  accountId: string,
  periodStartDate: Date,
  tx?: DBTransaction
): Promise<string> {
  const database = tx || db;
  
  try {
    // Fetch account to determine normal balance type
    const [account] = await database
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.id, accountId),
        eq(accounts.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!account) {
      throw new NotFoundError(
        `Account not found: ${accountId}`,
        { tenantId, accountId }
      );
    }
    
    // Sum all debits and credits before the period start date
    const [result] = await database
      .select({
        totalDebits: sql<string>`COALESCE(SUM(${accountTransactionHistory.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${accountTransactionHistory.creditAmount}), 0)`,
      })
      .from(accountTransactionHistory)
      .where(and(
        eq(accountTransactionHistory.tenantId, tenantId),
        eq(accountTransactionHistory.accountId, accountId),
        lt(accountTransactionHistory.transactionDate, periodStartDate)
      ));
    
    const totalDebits = parseFloat(result?.totalDebits || '0');
    const totalCredits = parseFloat(result?.totalCredits || '0');
    
    // Calculate balance based on account normal balance type
    const normalBalanceType = getNormalBalanceType(account.type);
    const openingBalance = calculateBalance(totalDebits, totalCredits, normalBalanceType);
    
    return normalizeDecimal(openingBalance);
  } catch (error) {
    logError(error as Error, {
      function: 'calculateOpeningBalance',
      tenantId,
      accountId,
      periodStartDate: periodStartDate.toISOString(),
    });
    throw error;
  }
}

/**
 * Record individual transaction to accountTransactionHistory table
 * 
 * **Purpose:** Create an audit trail record for each debit/credit with running balance
 * for accurate point-in-time balance queries and compliance requirements.
 * 
 * **Logic:**
 * 1. Validate that exactly one of debitAmount or creditAmount is non-zero
 * 2. Determine transaction type based on which amount is set
 * 3. Insert transaction record with all details including running balance
 * 4. Link to journal entry leg for traceability
 * 
 * **Transaction Safety:**
 * - MUST be called within a database transaction (tx parameter required)
 * - Ensures atomicity with journal entry posting
 * - Running balance must be calculated by caller
 * 
 * **Source Document Tracking:**
 * - Records source document type and ID for audit trail
 * - Enables reverse lookup from transactions to source documents
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param accountId - Account this transaction affects
 * @param journalEntryLegId - Link to the journal entry leg that created this transaction
 * @param transactionDate - Date of the transaction
 * @param debitAmount - Debit amount (or "0.00")
 * @param creditAmount - Credit amount (or "0.00")
 * @param runningBalance - Cumulative account balance after this transaction
 * @param tx - Optional database transaction for atomicity
 * @returns Created AccountTransactionHistory record
 * 
 * @throws {ValidationError} If both debitAmount and creditAmount are non-zero or both are zero
 * 
 * @example
 * ```typescript
 * const transaction = await recordAccountTransaction(
 *   'tenant-123',
 *   'account-456',
 *   'leg-789',
 *   new Date('2024-01-15'),
 *   '1000.00',
 *   '0.00',
 *   '11500.00',
 *   tx
 * );
 * ```
 */
export async function recordAccountTransaction(
  tenantId: string,
  accountId: string,
  journalEntryLegId: string,
  transactionDate: Date,
  debitAmount: string,
  creditAmount: string,
  runningBalance: string,
  tx?: DBTransaction
): Promise<AccountTransactionHistory> {
  const database = tx || db;
  
  try {
    // Validate that exactly one of debitAmount or creditAmount is non-zero
    const debit = parseFloat(debitAmount);
    const credit = parseFloat(creditAmount);
    
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new ValidationError(
        'Exactly one of debitAmount or creditAmount must be non-zero',
        { debitAmount, creditAmount }
      );
    }
    
    // Determine transaction type
    const transactionType = debit > 0 ? 'debit' : 'credit';
    
    // Fetch journal entry leg to get journal entry ID and source document info
    const [leg] = await database
      .select({
        journalEntryId: journalEntryLegs.journalEntryId,
        description: journalEntryLegs.description,
        currencyCode: journalEntryLegs.transactionCurrencyCode,
      })
      .from(journalEntryLegs)
      .where(eq(journalEntryLegs.id, journalEntryLegId))
      .limit(1);
    
    if (!leg) {
      throw new NotFoundError(
        `Journal entry leg not found: ${journalEntryLegId}`,
        { journalEntryLegId }
      );
    }
    
    // Fetch journal entry for source document tracking
    const [entry] = await database
      .select({
        sourceDocumentType: journalEntries.sourceDocumentType,
        sourceDocumentId: journalEntries.sourceDocumentId,
      })
      .from(journalEntries)
      .where(eq(journalEntries.id, leg.journalEntryId))
      .limit(1);
    
    // Insert transaction record
    const transactionData: InsertAccountTransactionHistory = {
      tenantId,
      accountId,
      journalEntryId: leg.journalEntryId,
      journalEntryLegId,
      transactionDate,
      transactionType,
      sourceDocumentType: entry?.sourceDocumentType || null,
      sourceDocumentId: entry?.sourceDocumentId || null,
      debitAmount: normalizeDecimal(debitAmount),
      creditAmount: normalizeDecimal(creditAmount),
      runningBalance: normalizeDecimal(runningBalance),
      currencyCode: leg.currencyCode || 'USD',
      description: leg.description || null,
    };
    
    const [created] = await database
      .insert(accountTransactionHistory)
      .values(transactionData)
      .returning();
    
    return created;
  } catch (error) {
    logError(error as Error, {
      function: 'recordAccountTransaction',
      tenantId,
      accountId,
      journalEntryLegId,
      transactionDate: transactionDate.toISOString(),
    });
    throw error;
  }
}

/**
 * Update historical balances for all accounts affected by a journal entry
 * 
 * **Purpose:** When a journal entry is posted, update the historical balance records
 * and transaction history for all affected accounts to maintain accurate balance tracking.
 * 
 * **Logic:**
 * 1. Fetch journal entry to get entry date
 * 2. Fetch all journal entry legs for this entry
 * 3. Group legs by accountId
 * 4. For each affected account:
 *    a. Determine period (month/year) from entry date
 *    b. Calculate opening balance for that period
 *    c. Get all existing transactions in the period (sorted by date)
 *    d. Recalculate running balances for each transaction
 *    e. Record new transaction with running balance
 *    f. Upsert historicalBalances record with opening/closing balances
 * 
 * **Transaction Safety:**
 * - MUST be called within a database transaction
 * - Ensures all balance updates are atomic with journal entry posting
 * - Rollback on any failure maintains data integrity
 * 
 * **Period Management:**
 * - Uses monthly periods (period start = 1st of month, period end = last day of month)
 * - Automatically creates historical balance records for new periods
 * - Updates existing records if entry date falls in existing period
 * 
 * **Running Balance Calculation:**
 * - Recalculates running balances chronologically within the period
 * - Accounts for normal balance type (debit vs credit)
 * - Ensures transaction order is preserved
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param journalEntryId - Journal entry that was posted
 * @param tx - Database transaction (REQUIRED for atomicity)
 * @returns Array of account IDs that were updated
 * 
 * @throws {ValidationError} If transaction parameter is not provided
 * @throws {NotFoundError} If journal entry doesn't exist
 * @throws {AccountingError} If balance calculations fail
 * 
 * @example
 * ```typescript
 * await db.transaction(async (tx) => {
 *   // Post journal entry
 *   await postJournalEntry(entryId, tx);
 *   
 *   // Update historical balances
 *   const updatedAccounts = await updateHistoricalBalances(
 *     'tenant-123',
 *     'entry-456',
 *     tx
 *   );
 *   
 *   console.log(`Updated ${updatedAccounts.length} accounts`);
 * });
 * ```
 */
export async function updateHistoricalBalances(
  tenantId: string,
  journalEntryId: string,
  tx: DBTransaction
): Promise<string[]> {
  if (!tx) {
    throw new ValidationError(
      'Transaction parameter is required for updateHistoricalBalances',
      { function: 'updateHistoricalBalances' }
    );
  }
  
  try {
    // Fetch journal entry
    const [entry] = await tx
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!entry) {
      throw new NotFoundError(
        `Journal entry not found: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    // IDEMPOTENCY FIX: Delete any existing accountTransactionHistory rows for this journal entry
    // This ensures that posting the same journal entry multiple times (retries, reposts, reversals)
    // produces the same result without corrupting running balances with duplicate rows
    await tx.delete(accountTransactionHistory)
      .where(and(
        eq(accountTransactionHistory.tenantId, tenantId),
        eq(accountTransactionHistory.journalEntryId, journalEntryId)
      ));
    
    // Fetch all legs for this entry
    const legs = await tx
      .select()
      .from(journalEntryLegs)
      .where(and(
        eq(journalEntryLegs.journalEntryId, journalEntryId),
        eq(journalEntryLegs.tenantId, tenantId)
      ));
    
    if (legs.length === 0) {
      throw new AccountingError(
        `No journal entry legs found for entry: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    // Group legs by account ID
    const legsByAccount = legs.reduce((acc, leg) => {
      if (!acc[leg.accountId]) {
        acc[leg.accountId] = [];
      }
      acc[leg.accountId].push(leg);
      return acc;
    }, {} as Record<string, JournalEntryLeg[]>);
    
    const updatedAccountIds: string[] = [];
    
    // Process each affected account
    for (const [accountId, accountLegs] of Object.entries(legsByAccount)) {
      // Get period boundaries
      const { periodStart, periodEnd } = getPeriodBoundaries(entry.entryDate);
      
      // Calculate opening balance for this period
      const openingBalance = await calculateOpeningBalance(
        tenantId,
        accountId,
        periodStart,
        tx
      );
      
      // Fetch account for normal balance type
      const [account] = await tx
        .select()
        .from(accounts)
        .where(and(
          eq(accounts.id, accountId),
          eq(accounts.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!account) {
        throw new NotFoundError(
          `Account not found: ${accountId}`,
          { tenantId, accountId }
        );
      }
      
      const normalBalanceType = getNormalBalanceType(account.type);
      
      // Get all transactions in this period (including the new ones)
      const existingTransactions = await tx
        .select()
        .from(accountTransactionHistory)
        .where(and(
          eq(accountTransactionHistory.tenantId, tenantId),
          eq(accountTransactionHistory.accountId, accountId),
          gte(accountTransactionHistory.transactionDate, periodStart),
          lte(accountTransactionHistory.transactionDate, periodEnd)
        ))
        .orderBy(asc(accountTransactionHistory.transactionDate));
      
      // Build list of all transactions that should exist (existing + new from legs)
      const existingLegIds = new Set(
        existingTransactions.map(t => t.journalEntryLegId)
      );
      
      // Record new transactions and calculate running balances
      let runningBalance = parseFloat(openingBalance);
      
      // Create a combined list of all transactions sorted by date
      const allTransactions: Array<{
        date: Date;
        legId: string;
        debit: number;
        credit: number;
        isNew: boolean;
      }> = [];
      
      // Add existing transactions
      for (const trans of existingTransactions) {
        allTransactions.push({
          date: trans.transactionDate,
          legId: trans.journalEntryLegId!,
          debit: parseFloat(trans.debitAmount || '0'),
          credit: parseFloat(trans.creditAmount || '0'),
          isNew: false,
        });
      }
      
      // Add new transactions from legs
      for (const leg of accountLegs) {
        if (!existingLegIds.has(leg.id)) {
          const debit = leg.type === 'Debit' ? parseFloat(leg.amount) : 0;
          const credit = leg.type === 'Credit' ? parseFloat(leg.amount) : 0;
          
          allTransactions.push({
            date: entry.entryDate,
            legId: leg.id,
            debit,
            credit,
            isNew: true,
          });
        }
      }
      
      // Sort all transactions by date
      allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Calculate running balances and record new transactions
      for (const trans of allTransactions) {
        // Update running balance
        if (normalBalanceType === 'debit') {
          runningBalance += trans.debit - trans.credit;
        } else {
          runningBalance += trans.credit - trans.debit;
        }
        
        // Record new transaction
        if (trans.isNew) {
          await recordAccountTransaction(
            tenantId,
            accountId,
            trans.legId,
            trans.date,
            normalizeDecimal(trans.debit),
            normalizeDecimal(trans.credit),
            normalizeDecimal(runningBalance),
            tx
          );
        }
      }
      
      // Upsert historical balance record
      const closingBalance = normalizeDecimal(runningBalance);
      
      const historicalBalanceData: InsertHistoricalBalance = {
        tenantId,
        accountId,
        periodStart,
        periodEnd,
        openingBalance,
        closingBalance,
        currencyCode: entry.currencyCode || 'USD',
        exchangeRate: entry.exchangeRate ? entry.exchangeRate.toString() : '1.0',
      };
      
      // Try to update existing record, or insert new one
      const existing = await tx
        .select()
        .from(historicalBalances)
        .where(and(
          eq(historicalBalances.tenantId, tenantId),
          eq(historicalBalances.accountId, accountId),
          eq(historicalBalances.periodStart, periodStart),
          eq(historicalBalances.periodEnd, periodEnd)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        await tx
          .update(historicalBalances)
          .set({
            openingBalance,
            closingBalance,
          })
          .where(eq(historicalBalances.id, existing[0].id));
      } else {
        await tx
          .insert(historicalBalances)
          .values(historicalBalanceData);
      }
      
      updatedAccountIds.push(accountId);
      
      // CASCADE RECALCULATION FIX: Handle backdated entries by updating all future periods
      // When a backdated entry is posted, all future period balances must be recalculated
      // because running balances are cumulative and depend on historical transactions
      
      // Query for all future periods for this account (periods that start after current period end)
      const futurePeriods = await tx
        .select()
        .from(historicalBalances)
        .where(and(
          eq(historicalBalances.tenantId, tenantId),
          eq(historicalBalances.accountId, accountId),
          sql`${historicalBalances.periodStart} > ${periodEnd}`
        ))
        .orderBy(asc(historicalBalances.periodStart));
      
      // Process each future period in chronological order to recalculate balances
      let previousPeriodClosingBalance = closingBalance;
      
      for (const futurePeriod of futurePeriods) {
        const futurePeriodStart = futurePeriod.periodStart;
        const futurePeriodEnd = futurePeriod.periodEnd;
        
        // Delete old transaction history rows for this future period
        await tx
          .delete(accountTransactionHistory)
          .where(and(
            eq(accountTransactionHistory.tenantId, tenantId),
            eq(accountTransactionHistory.accountId, accountId),
            gte(accountTransactionHistory.transactionDate, futurePeriodStart),
            lte(accountTransactionHistory.transactionDate, futurePeriodEnd)
          ));
        
        // Opening balance for this period is the previous period's closing balance
        const futureOpeningBalance = previousPeriodClosingBalance;
        
        // Fetch all journal entry legs for this period chronologically
        const futureLegs = await tx
          .select({
            id: journalEntryLegs.id,
            journalEntryId: journalEntryLegs.journalEntryId,
            accountId: journalEntryLegs.accountId,
            type: journalEntryLegs.type,
            amount: journalEntryLegs.amount,
            entryDate: journalEntries.entryDate,
          })
          .from(journalEntryLegs)
          .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
          .where(and(
            eq(journalEntryLegs.tenantId, tenantId),
            eq(journalEntryLegs.accountId, accountId),
            gte(journalEntries.entryDate, futurePeriodStart),
            lte(journalEntries.entryDate, futurePeriodEnd),
            eq(journalEntries.status, 'posted')
          ))
          .orderBy(asc(journalEntries.entryDate));
        
        // Recalculate running balances for all transactions in this period
        let futureRunningBalance = parseFloat(futureOpeningBalance);
        
        for (const leg of futureLegs) {
          const debit = leg.type === 'Debit' ? parseFloat(leg.amount) : 0;
          const credit = leg.type === 'Credit' ? parseFloat(leg.amount) : 0;
          
          // Update running balance based on normal balance type
          if (normalBalanceType === 'debit') {
            futureRunningBalance += debit - credit;
          } else {
            futureRunningBalance += credit - debit;
          }
          
          // Insert transaction history record with recalculated running balance
          await recordAccountTransaction(
            tenantId,
            accountId,
            leg.id,
            leg.entryDate,
            normalizeDecimal(debit),
            normalizeDecimal(credit),
            normalizeDecimal(futureRunningBalance),
            tx
          );
        }
        
        // Update the historical balance record for this future period
        const futureClosingBalance = normalizeDecimal(futureRunningBalance);
        
        await tx
          .update(historicalBalances)
          .set({
            openingBalance: futureOpeningBalance,
            closingBalance: futureClosingBalance,
          })
          .where(eq(historicalBalances.id, futurePeriod.id));
        
        // This period's closing balance becomes the next period's opening balance
        previousPeriodClosingBalance = futureClosingBalance;
      }
    }
    
    return updatedAccountIds;
  } catch (error) {
    logError(error as Error, {
      function: 'updateHistoricalBalances',
      tenantId,
      journalEntryId,
    });
    throw error;
  }
}

/**
 * Get current or historical balance for an account
 * 
 * **Purpose:** Query account balance at a specific point in time or get current balance.
 * Used by financial reports, balance sheets, and user-facing balance displays.
 * 
 * **Logic:**
 * 1. If asOfDate provided (historical balance):
 *    a. Find the period containing asOfDate
 *    b. Get opening balance for that period
 *    c. Sum all transactions from period start to asOfDate
 *    d. Calculate final balance accounting for normal balance type
 * 
 * 2. If no asOfDate (current balance):
 *    a. Find the latest historicalBalances record
 *    b. If found: use closing balance + transactions since period end
 *    c. If not found: calculate from all transactions (fallback for new accounts)
 * 
 * **Performance Optimization:**
 * - Uses historicalBalances table for fast lookups
 * - Only calculates incremental transactions since last snapshot
 * - Efficient for frequently queried accounts
 * 
 * **Normal Balance Handling:**
 * - Accounts for account type (debit vs credit normal)
 * - Returns signed balance (can be negative)
 * - Debit-normal: positive = debit balance, negative = credit balance
 * - Credit-normal: positive = credit balance, negative = debit balance
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param accountId - Account to get balance for
 * @param asOfDate - Optional date for historical balance (defaults to current)
 * @param tx - Optional database transaction for consistent reads
 * @returns Account balance as decimal string (can be negative)
 * 
 * @example
 * ```typescript
 * // Get current balance
 * const currentBalance = await getAccountBalance('tenant-123', 'account-456');
 * console.log(currentBalance); // "15750.50"
 * 
 * // Get historical balance as of specific date
 * const historicalBalance = await getAccountBalance(
 *   'tenant-123',
 *   'account-456',
 *   new Date('2024-01-31')
 * );
 * console.log(historicalBalance); // "12300.00"
 * ```
 */
export async function getAccountBalance(
  tenantId: string,
  accountId: string,
  asOfDate?: Date,
  tx?: DBTransaction
): Promise<string> {
  const database = tx || db;
  
  try {
    // Fetch account for normal balance type
    const [account] = await database
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.id, accountId),
        eq(accounts.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!account) {
      throw new NotFoundError(
        `Account not found: ${accountId}`,
        { tenantId, accountId }
      );
    }
    
    const normalBalanceType = getNormalBalanceType(account.type);
    
    if (asOfDate) {
      // Historical balance query
      const { periodStart } = getPeriodBoundaries(asOfDate);
      
      // Get opening balance for the period
      const openingBalance = await calculateOpeningBalance(
        tenantId,
        accountId,
        periodStart,
        database
      );
      
      // Sum transactions from period start to asOfDate
      const [result] = await database
        .select({
          totalDebits: sql<string>`COALESCE(SUM(${accountTransactionHistory.debitAmount}), 0)`,
          totalCredits: sql<string>`COALESCE(SUM(${accountTransactionHistory.creditAmount}), 0)`,
        })
        .from(accountTransactionHistory)
        .where(and(
          eq(accountTransactionHistory.tenantId, tenantId),
          eq(accountTransactionHistory.accountId, accountId),
          gte(accountTransactionHistory.transactionDate, periodStart),
          lte(accountTransactionHistory.transactionDate, asOfDate)
        ));
      
      const periodDebits = parseFloat(result?.totalDebits || '0');
      const periodCredits = parseFloat(result?.totalCredits || '0');
      
      // Calculate balance
      let balance = parseFloat(openingBalance);
      
      if (normalBalanceType === 'debit') {
        balance += periodDebits - periodCredits;
      } else {
        balance += periodCredits - periodDebits;
      }
      
      return normalizeDecimal(balance);
    } else {
      // Current balance query - use latest historical balance + incremental transactions
      const [latestHistoricalBalance] = await database
        .select()
        .from(historicalBalances)
        .where(and(
          eq(historicalBalances.tenantId, tenantId),
          eq(historicalBalances.accountId, accountId)
        ))
        .orderBy(desc(historicalBalances.periodEnd))
        .limit(1);
      
      if (latestHistoricalBalance) {
        // Use closing balance from latest period + transactions since period end
        let balance = parseFloat(latestHistoricalBalance.closingBalance);
        
        const [result] = await database
          .select({
            totalDebits: sql<string>`COALESCE(SUM(${accountTransactionHistory.debitAmount}), 0)`,
            totalCredits: sql<string>`COALESCE(SUM(${accountTransactionHistory.creditAmount}), 0)`,
          })
          .from(accountTransactionHistory)
          .where(and(
            eq(accountTransactionHistory.tenantId, tenantId),
            eq(accountTransactionHistory.accountId, accountId),
            gte(accountTransactionHistory.transactionDate, latestHistoricalBalance.periodEnd)
          ));
        
        const incrementalDebits = parseFloat(result?.totalDebits || '0');
        const incrementalCredits = parseFloat(result?.totalCredits || '0');
        
        if (normalBalanceType === 'debit') {
          balance += incrementalDebits - incrementalCredits;
        } else {
          balance += incrementalCredits - incrementalDebits;
        }
        
        return normalizeDecimal(balance);
      } else {
        // No historical balance records - calculate from all transactions (fallback)
        const [result] = await database
          .select({
            totalDebits: sql<string>`COALESCE(SUM(${accountTransactionHistory.debitAmount}), 0)`,
            totalCredits: sql<string>`COALESCE(SUM(${accountTransactionHistory.creditAmount}), 0)`,
          })
          .from(accountTransactionHistory)
          .where(and(
            eq(accountTransactionHistory.tenantId, tenantId),
            eq(accountTransactionHistory.accountId, accountId)
          ));
        
        const totalDebits = parseFloat(result?.totalDebits || '0');
        const totalCredits = parseFloat(result?.totalCredits || '0');
        
        const balance = calculateBalance(totalDebits, totalCredits, normalBalanceType);
        
        return normalizeDecimal(balance);
      }
    }
  } catch (error) {
    logError(error as Error, {
      function: 'getAccountBalance',
      tenantId,
      accountId,
      asOfDate: asOfDate?.toISOString(),
    });
    throw error;
  }
}

/**
 * Calculate foreign exchange gain/loss for multi-currency accounts (IFRS compliance)
 * 
 * **Purpose:** Calculate unrealized FX gain/loss for accounts with foreign currency
 * transactions when period-end exchange rates differ from transaction-date rates.
 * Required for IFRS-compliant financial statements.
 * 
 * **Logic:**
 * 1. Get opening balance in base currency
 * 2. Get all transactions in the period
 * 3. For each transaction in foreign currency:
 *    a. Calculate amount at transaction-date rate (historical)
 *    b. Recalculate amount at period-end rate (current)
 *    c. Difference = FX gain/loss
 * 4. Aggregate all gains and losses
 * 5. Return net difference for journal entry creation
 * 
 * **IFRS Standards:**
 * - IAS 21: The Effects of Changes in Foreign Exchange Rates
 * - Monetary items revalued at period-end rates
 * - Non-monetary items at historical rates
 * - FX differences recognized in profit/loss
 * 
 * **Edge Cases:**
 * - No historical data available: returns zero values
 * - All transactions in base currency: returns zero values
 * - Missing exchange rates: throws error (must have rates for calculations)
 * 
 * **Integration:**
 * - Called during period-end close process
 * - Results used to create FX gain/loss journal entries
 * - Stored in historicalBalances for audit trail
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param accountId - Account to calculate FX differences for
 * @param periodStartDate - Start of the period
 * @param periodEndDate - End of the period (revaluation date)
 * @param baseCurrency - Base currency code for the tenant (e.g., 'USD')
 * @param tx - Optional database transaction for consistent reads
 * @returns FX gain/loss breakdown object or null if no data
 * 
 * @example
 * ```typescript
 * const fxDiff = await calculateExchangeDifference(
 *   'tenant-123',
 *   'account-456',
 *   new Date('2024-01-01'),
 *   new Date('2024-01-31'),
 *   'USD'
 * );
 * 
 * if (fxDiff) {
 *   console.log(`FX Gain: ${fxDiff.fxGain}`);
 *   console.log(`FX Loss: ${fxDiff.fxLoss}`);
 *   console.log(`Net: ${fxDiff.netDifference}`);
 * }
 * ```
 */
export async function calculateExchangeDifference(
  tenantId: string,
  accountId: string,
  periodStartDate: Date,
  periodEndDate: Date,
  baseCurrency: string,
  tx?: DBTransaction
): Promise<FXDifferenceResult | null> {
  const database = tx || db;
  
  try {
    // Get all transactions in foreign currencies for this period
    const transactions = await database
      .select()
      .from(accountTransactionHistory)
      .where(and(
        eq(accountTransactionHistory.tenantId, tenantId),
        eq(accountTransactionHistory.accountId, accountId),
        gte(accountTransactionHistory.transactionDate, periodStartDate),
        lte(accountTransactionHistory.transactionDate, periodEndDate),
        sql`${accountTransactionHistory.currencyCode} != ${baseCurrency}`
      ));
    
    if (transactions.length === 0) {
      // No foreign currency transactions - return zero values
      return {
        fxGain: '0.00',
        fxLoss: '0.00',
        netDifference: '0.00',
      };
    }
    
    // Get period-end exchange rate for each currency
    const currencyCodes = [...new Set(transactions.map(t => t.currencyCode))];
    
    let totalGain = 0;
    let totalLoss = 0;
    
    for (const currencyCode of currencyCodes) {
      // Get period-end exchange rate
      const [periodEndRate] = await database
        .select()
        .from(exchangeRates)
        .where(and(
          eq(exchangeRates.tenantId, tenantId),
          eq(exchangeRates.fromCurrencyCode, currencyCode),
          eq(exchangeRates.toCurrencyCode, baseCurrency),
          lte(exchangeRates.effectiveDate, periodEndDate)
        ))
        .orderBy(desc(exchangeRates.effectiveDate))
        .limit(1);
      
      if (!periodEndRate) {
        // FX CORRECTNESS FIX: Throw error instead of silently returning zero
        // This ensures FX misstatements are detected rather than hidden
        throw new AccountingError(
          `Exchange rate not found for ${currencyCode} to ${baseCurrency} on ${periodEndDate.toISOString().split('T')[0]}`,
          {
            tenantId,
            accountId,
            currencyCode,
            baseCurrency,
            periodEndDate: periodEndDate.toISOString(),
          }
        );
      }
      
      // Calculate FX difference for this currency's transactions
      const currencyTransactions = transactions.filter(t => t.currencyCode === currencyCode);
      
      for (const trans of currencyTransactions) {
        const transactionRate = parseFloat(trans.exchangeRate || '1.0');
        const periodEndRateValue = parseFloat(periodEndRate.rate);
        
        // Get transaction amount in foreign currency
        const foreignAmount = parseFloat(trans.debitAmount || '0') + parseFloat(trans.creditAmount || '0');
        
        // Calculate at historical rate (transaction date)
        const historicalBaseAmount = foreignAmount * transactionRate;
        
        // Recalculate at period-end rate
        const currentBaseAmount = foreignAmount * periodEndRateValue;
        
        // FX difference
        const difference = currentBaseAmount - historicalBaseAmount;
        
        if (difference > 0) {
          totalGain += difference;
        } else if (difference < 0) {
          totalLoss += Math.abs(difference);
        }
      }
    }
    
    const netDifference = totalGain - totalLoss;
    
    return {
      fxGain: normalizeDecimal(totalGain),
      fxLoss: normalizeDecimal(totalLoss),
      netDifference: normalizeDecimal(netDifference),
    };
  } catch (error) {
    logError(error as Error, {
      function: 'calculateExchangeDifference',
      tenantId,
      accountId,
      periodStartDate: periodStartDate.toISOString(),
      periodEndDate: periodEndDate.toISOString(),
      baseCurrency,
    });
    throw error;
  }
}
