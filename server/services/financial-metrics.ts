/**
 * Financial Metrics Calculation Engine (Task 7-12)
 * 
 * This service calculates comprehensive financial metrics for credit passport analysis.
 * Metrics are grouped into 6 categories: Liquidity, Leverage, Profitability, 
 * Cash Flow, Operational, and Payment Behavior.
 * 
 * @module server/services/financial-metrics
 */

import { db } from '../db';
import {
  financialMetricsSnapshot,
  accounts,
  journalEntryLegs,
  journalEntries,
  bills,
  payments,
  type InsertFinancialMetricsSnapshot,
  type FinancialMetricsSnapshot,
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc, inArray } from 'drizzle-orm';
import type { IStorage } from '../storage';

/**
 * Helper to safely divide two numbers, returning null if denominator is zero
 */
function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !isFinite(denominator)) return null;
  const result = numerator / denominator;
  return isFinite(result) ? result : null;
}

/**
 * Calculate standard deviation for cash flow volatility
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Get account balance by category/type for a given date
 */
async function getAccountBalance(
  tenantId: string,
  asOfDate: Date,
  filters: {
    category?: string;
    type?: string;
    codes?: string[];
  }
): Promise<number> {
  const conditions = [eq(accounts.tenantId, tenantId)];
  
  if (filters.category) {
    conditions.push(eq(accounts.category, filters.category));
  }
  if (filters.type) {
    conditions.push(eq(accounts.type, filters.type));
  }
  
  const accountsQuery = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(...conditions));
  
  if (accountsQuery.length === 0) return 0;
  
  const accountIds = accountsQuery.map(a => a.id);
  
  const result = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(CASE WHEN ${journalEntryLegs.type} = 'Debit' THEN ${journalEntryLegs.amount} ELSE 0 END), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${journalEntryLegs.type} = 'Credit' THEN ${journalEntryLegs.amount} ELSE 0 END), 0)`,
    })
    .from(journalEntryLegs)
    .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        inArray(journalEntryLegs.accountId, accountIds),
        lte(journalEntries.entryDate, asOfDate),
        eq(journalEntries.status, 'posted')
      )
    );
  
  const totalDebit = parseFloat(result[0]?.totalDebit || '0');
  const totalCredit = parseFloat(result[0]?.totalCredit || '0');
  
  return totalDebit - totalCredit;
}

/**
 * Get revenue for a date range
 */
async function getRevenue(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const revenueAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        eq(accounts.type, 'Income')
      )
    );
  
  if (revenueAccounts.length === 0) return 0;
  
  const accountIds = revenueAccounts.map(a => a.id);
  
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${journalEntryLegs.amount}), 0)`,
    })
    .from(journalEntryLegs)
    .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        inArray(journalEntryLegs.accountId, accountIds),
        gte(journalEntries.entryDate, startDate),
        lte(journalEntries.entryDate, endDate),
        eq(journalEntries.status, 'posted'),
        eq(journalEntryLegs.type, 'Credit')
      )
    );
  
  return parseFloat(result[0]?.total || '0');
}

/**
 * Get COGS (Cost of Goods Sold) for a date range
 */
async function getCOGS(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const cogsAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        eq(accounts.type, 'Cost of Goods Sold')
      )
    );
  
  if (cogsAccounts.length === 0) return 0;
  
  const accountIds = cogsAccounts.map(a => a.id);
  
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${journalEntryLegs.amount}), 0)`,
    })
    .from(journalEntryLegs)
    .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        inArray(journalEntryLegs.accountId, accountIds),
        gte(journalEntries.entryDate, startDate),
        lte(journalEntries.entryDate, endDate),
        eq(journalEntries.status, 'posted'),
        eq(journalEntryLegs.type, 'Debit')
      )
    );
  
  return parseFloat(result[0]?.total || '0');
}

/**
 * Get net income for a date range
 */
async function getNetIncome(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const revenue = await getRevenue(tenantId, startDate, endDate);
  
  const expenseAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        sql`${accounts.type} IN ('Expense', 'Cost of Goods Sold')`
      )
    );
  
  if (expenseAccounts.length === 0) return revenue;
  
  const accountIds = expenseAccounts.map(a => a.id);
  
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${journalEntryLegs.amount}), 0)`,
    })
    .from(journalEntryLegs)
    .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        inArray(journalEntryLegs.accountId, accountIds),
        gte(journalEntries.entryDate, startDate),
        lte(journalEntries.entryDate, endDate),
        eq(journalEntries.status, 'posted'),
        eq(journalEntryLegs.type, 'Debit')
      )
    );
  
  const totalExpenses = parseFloat(result[0]?.total || '0');
  return revenue - totalExpenses;
}

/**
 * Calculate average payment delay in days
 */
async function getAveragePaymentDelay(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const result = await db
    .select({
      avgDelay: sql<string>`AVG(EXTRACT(DAY FROM (${payments.paymentDate} - ${bills.dueDate})))`,
    })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .where(
      and(
        eq(bills.tenantId, tenantId),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate),
        sql`${payments.paymentDate} > ${bills.dueDate}`
      )
    );
  
  return parseFloat(result[0]?.avgDelay || '0');
}

/**
 * Calculate late payment rate
 */
async function getLatePaymentRate(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const allPayments = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .where(
      and(
        eq(bills.tenantId, tenantId),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate)
      )
    );
  
  const latePayments = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .where(
      and(
        eq(bills.tenantId, tenantId),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate),
        sql`${payments.paymentDate} > ${bills.dueDate}`
      )
    );
  
  const total = parseInt(allPayments[0]?.count || '0');
  const late = parseInt(latePayments[0]?.count || '0');
  
  return safeDivide(late * 100, total) || 0;
}

/**
 * Calculate all financial metrics for a tenant as of a specific date
 */
export async function calculateMetrics(
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<Omit<InsertFinancialMetricsSnapshot, 'tenantId'>> {
  const yearStart = new Date(asOfDate.getFullYear(), 0, 1);
  const lastYearStart = new Date(asOfDate.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(asOfDate.getFullYear() - 1, 11, 31);
  
  // Balance Sheet Items (as of date)
  const currentAssets = await getAccountBalance(tenantId, asOfDate, { category: 'Current Assets' });
  const cash = await getAccountBalance(tenantId, asOfDate, { type: 'Cash' });
  const inventory = await getAccountBalance(tenantId, asOfDate, { type: 'Inventory' });
  const accountsReceivable = await getAccountBalance(tenantId, asOfDate, { type: 'Accounts Receivable' });
  const currentLiabilities = await getAccountBalance(tenantId, asOfDate, { category: 'Current Liabilities' });
  const accountsPayable = await getAccountBalance(tenantId, asOfDate, { type: 'Accounts Payable' });
  const totalAssets = await getAccountBalance(tenantId, asOfDate, { type: 'Asset' });
  const totalDebt = currentLiabilities + await getAccountBalance(tenantId, asOfDate, { category: 'Long-term Liabilities' });
  const totalEquity = await getAccountBalance(tenantId, asOfDate, { type: 'Equity' });
  
  // P&L Items (year to date)
  const revenue = await getRevenue(tenantId, yearStart, asOfDate);
  const cogs = await getCOGS(tenantId, yearStart, asOfDate);
  const netIncome = await getNetIncome(tenantId, yearStart, asOfDate);
  const grossProfit = revenue - cogs;
  
  // Prior year revenue for growth calculation
  const priorRevenue = await getRevenue(tenantId, lastYearStart, lastYearEnd);
  
  // Interest expense (from expense accounts)
  const interestExpenseAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        sql`LOWER(${accounts.name}) LIKE '%interest%'`,
        eq(accounts.type, 'Expense')
      )
    );
  
  let interestExpense = 0;
  if (interestExpenseAccounts.length > 0) {
    const accountIds = interestExpenseAccounts.map(a => a.id);
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${journalEntryLegs.amount}), 0)`,
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          inArray(journalEntryLegs.accountId, accountIds),
          gte(journalEntries.entryDate, yearStart),
          lte(journalEntries.entryDate, asOfDate),
          eq(journalEntries.status, 'posted'),
          eq(journalEntryLegs.type, 'Debit')
        )
      );
    interestExpense = parseFloat(result[0]?.total || '0');
  }
  
  const ebit = netIncome + interestExpense;
  
  // Cash flow (simplified - using operating cash flow from cash account changes)
  const cashStartOfYear = await getAccountBalance(tenantId, yearStart, { type: 'Cash' });
  const operatingCashFlow = cash - cashStartOfYear;
  
  // Capital expenditures (PP&E purchases)
  const ppeAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        sql`${accounts.category} = 'Property, Plant & Equipment'`
      )
    );
  
  let capitalExpenditures = 0;
  if (ppeAccounts.length > 0) {
    const accountIds = ppeAccounts.map(a => a.id);
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${journalEntryLegs.amount}), 0)`,
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          inArray(journalEntryLegs.accountId, accountIds),
          gte(journalEntries.entryDate, yearStart),
          lte(journalEntries.entryDate, asOfDate),
          eq(journalEntries.status, 'posted'),
          eq(journalEntryLegs.type, 'Debit')
        )
      );
    capitalExpenditures = parseFloat(result[0]?.total || '0');
  }
  
  const freeCashFlow = operatingCashFlow - capitalExpenditures;
  
  // Cash flow volatility (last 12 months)
  const monthlyCashFlows: number[] = [];
  for (let i = 0; i < 12; i++) {
    const monthEnd = new Date(asOfDate);
    monthEnd.setMonth(asOfDate.getMonth() - i);
    const monthStart = new Date(monthEnd);
    monthStart.setMonth(monthEnd.getMonth() - 1);
    
    const cashAtStart = await getAccountBalance(tenantId, monthStart, { type: 'Cash' });
    const cashAtEnd = await getAccountBalance(tenantId, monthEnd, { type: 'Cash' });
    monthlyCashFlows.push(cashAtEnd - cashAtStart);
  }
  
  const cashFlowVolatility = calculateStdDev(monthlyCashFlows) / Math.abs(operatingCashFlow || 1);
  
  // Payment behavior metrics
  const avgPaymentDelay = await getAveragePaymentDelay(tenantId, yearStart, asOfDate);
  const latePaymentRate = await getLatePaymentRate(tenantId, yearStart, asOfDate);
  
  // Calculate all ratios
  const currentRatio = safeDivide(currentAssets, currentLiabilities);
  const quickRatio = safeDivide(currentAssets - inventory, currentLiabilities);
  const cashRatio = safeDivide(cash, currentLiabilities);
  const workingCapital = currentAssets - currentLiabilities;
  
  const debtToEquityRatio = safeDivide(totalDebt, totalEquity);
  const debtToAssetsRatio = safeDivide(totalDebt, totalAssets);
  const interestCoverageRatio = safeDivide(ebit, interestExpense);
  
  const grossProfitMargin = safeDivide(grossProfit, revenue);
  const netProfitMargin = safeDivide(netIncome, revenue);
  const returnOnAssets = safeDivide(netIncome, totalAssets);
  const returnOnEquity = safeDivide(netIncome, totalEquity);
  
  const daysInReceivables = safeDivide(accountsReceivable * 365, revenue);
  const daysInPayables = safeDivide(accountsPayable * 365, cogs);
  const inventoryTurnover = safeDivide(cogs, inventory);
  const revenueGrowthRate = safeDivide((revenue - priorRevenue) * 100, priorRevenue);
  
  return {
    snapshotDate: asOfDate,
    // Liquidity
    currentRatio: currentRatio?.toFixed(4) || null,
    quickRatio: quickRatio?.toFixed(4) || null,
    cashRatio: cashRatio?.toFixed(4) || null,
    workingCapital: workingCapital.toFixed(2),
    // Leverage
    debtToEquityRatio: debtToEquityRatio?.toFixed(4) || null,
    debtToAssetsRatio: debtToAssetsRatio?.toFixed(4) || null,
    interestCoverageRatio: interestCoverageRatio?.toFixed(4) || null,
    // Profitability
    grossProfitMargin: grossProfitMargin?.toFixed(4) || null,
    netProfitMargin: netProfitMargin?.toFixed(4) || null,
    returnOnAssets: returnOnAssets?.toFixed(4) || null,
    returnOnEquity: returnOnEquity?.toFixed(4) || null,
    // Cash Flow
    operatingCashFlow: operatingCashFlow.toFixed(2),
    freeCashFlow: freeCashFlow.toFixed(2),
    cashFlowVolatility: cashFlowVolatility.toFixed(4),
    // Operational
    daysInReceivables: daysInReceivables?.toFixed(2) || null,
    daysInPayables: daysInPayables?.toFixed(2) || null,
    inventoryTurnover: inventoryTurnover?.toFixed(4) || null,
    revenueGrowthRate: revenueGrowthRate?.toFixed(4) || null,
    // Payment Behavior
    averagePaymentDelay: avgPaymentDelay.toFixed(2),
    latePaymentRate: latePaymentRate.toFixed(4),
  };
}

/**
 * Save financial metrics snapshot to database
 */
export async function saveSnapshot(
  tenantId: string,
  metrics: Omit<InsertFinancialMetricsSnapshot, 'tenantId'>
): Promise<FinancialMetricsSnapshot> {
  const [snapshot] = await db
    .insert(financialMetricsSnapshot)
    .values({
      tenantId,
      ...metrics,
    })
    .returning();
  
  return snapshot;
}

/**
 * Get the most recent metrics snapshot for a tenant
 */
export async function getLatestSnapshot(
  tenantId: string
): Promise<FinancialMetricsSnapshot | null> {
  const [snapshot] = await db
    .select()
    .from(financialMetricsSnapshot)
    .where(eq(financialMetricsSnapshot.tenantId, tenantId))
    .orderBy(desc(financialMetricsSnapshot.snapshotDate))
    .limit(1);
  
  return snapshot || null;
}

/**
 * Calculate and save financial metrics snapshot
 */
export async function calculateAndSaveMetrics(
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<FinancialMetricsSnapshot> {
  const metrics = await calculateMetrics(tenantId, asOfDate);
  return await saveSnapshot(tenantId, metrics);
}
