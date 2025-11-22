import { db } from '../db';
import { invoices, bills } from '../../shared/schema';
import { and, between, eq } from 'drizzle-orm';

interface ChartDataPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ComparisonData {
  current: { period: string; revenue: number; expenses: number; profit: number; margin: number };
  previous: { period: string; revenue: number; expenses: number; profit: number; margin: number };
  variance: { revenue: { amount: number; percentage: number }; expenses: { amount: number; percentage: number }; profit: { amount: number; percentage: number } };
}

export class InteractiveReportingService {
  async getTrendData(tenantId: string, days: number = 30): Promise<ChartDataPoint[]> {
    const data: ChartDataPoint[] = [];
    const today = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      
      const dayRevenue = await db.select().from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), between(invoices.invoiceDate, startOfDay, endOfDay)));
      const revenue = dayRevenue.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
      
      const dayExpenses = await db.select().from(bills)
        .where(and(eq(bills.tenantId, tenantId), between(bills.billDate, startOfDay, endOfDay)));
      const expenses = dayExpenses.reduce((sum, bill) => sum + parseFloat(bill.total || '0'), 0);
      
      data.push({ date: date.toISOString().split('T')[0], revenue, expenses, profit: revenue - expenses });
    }
    return data;
  }

  async comparePeriods(tenantId: string, currentStart: Date, currentEnd: Date, comparisonType: 'year' | 'quarter' | 'month'): Promise<ComparisonData> {
    let previousStart = new Date(currentStart);
    let previousEnd = new Date(currentEnd);
    
    if (comparisonType === 'year') {
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
    } else if (comparisonType === 'quarter') {
      previousStart.setMonth(previousStart.getMonth() - 3);
      previousEnd.setMonth(previousEnd.getMonth() - 3);
    } else {
      previousStart.setMonth(previousStart.getMonth() - 1);
      previousEnd.setMonth(previousEnd.getMonth() - 1);
    }
    
    const currentInvoices = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), between(invoices.invoiceDate, currentStart, currentEnd)));
    const currentBills = await db.select().from(bills).where(and(eq(bills.tenantId, tenantId), between(bills.billDate, currentStart, currentEnd)));
    const currentRevenue = currentInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
    const currentExpenses = currentBills.reduce((sum, bill) => sum + parseFloat(bill.total || '0'), 0);
    const currentProfit = currentRevenue - currentExpenses;
    const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
    
    const previousInvoices = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), between(invoices.invoiceDate, previousStart, previousEnd)));
    const previousBills = await db.select().from(bills).where(and(eq(bills.tenantId, tenantId), between(bills.billDate, previousStart, previousEnd)));
    const previousRevenue = previousInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
    const previousExpenses = previousBills.reduce((sum, bill) => sum + parseFloat(bill.total || '0'), 0);
    const previousProfit = previousRevenue - previousExpenses;
    const previousMargin = previousRevenue > 0 ? (previousProfit / previousRevenue) * 100 : 0;
    
    const revenueVariance = currentRevenue - previousRevenue;
    const expensesVariance = currentExpenses - previousExpenses;
    const profitVariance = currentProfit - previousProfit;
    
    return {
      current: { period: `${currentStart.toDateString()} - ${currentEnd.toDateString()}`, revenue: currentRevenue, expenses: currentExpenses, profit: currentProfit, margin: currentMargin },
      previous: { period: `${previousStart.toDateString()} - ${previousEnd.toDateString()}`, revenue: previousRevenue, expenses: previousExpenses, profit: previousProfit, margin: previousMargin },
      variance: {
        revenue: { amount: revenueVariance, percentage: previousRevenue > 0 ? (revenueVariance / previousRevenue) * 100 : 0 },
        expenses: { amount: expensesVariance, percentage: previousExpenses > 0 ? (expensesVariance / previousExpenses) * 100 : 0 },
        profit: { amount: profitVariance, percentage: previousProfit !== 0 ? (profitVariance / Math.abs(previousProfit)) * 100 : 0 }
      }
    };
  }
}

export const interactiveReportingService = new InteractiveReportingService();
