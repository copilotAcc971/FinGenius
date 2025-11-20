import { storage } from '../storage';
import { db } from '../db';
import { accounts, type Account, type Invoice, type Bill } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export interface DashboardMetrics {
  timestamp: string;
  tenantId: string;
  kpis: {
    totalRevenueToday: string;
    totalExpensesToday: string;
    outstandingInvoices: {
      count: number;
      total: string;
    };
    overdueInvoices: {
      count: number;
      total: string;
    };
    pendingPayments: {
      count: number;
      total: string;
    };
    cashPosition: string;
    arAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
    apAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
  };
}

export async function calculateDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  // Get all invoices for AR calculations
  const invoices = await storage.getInvoicesByTenant(tenantId, false);
  
  // Outstanding invoices (sent or partial)
  const outstandingInvoices = invoices.filter((inv: Invoice) => 
    inv.status === 'sent' || inv.status === 'partial'
  );
  
  // Overdue invoices
  const overdueInvoices = outstandingInvoices.filter((inv: Invoice) => 
    inv.dueDate && new Date(inv.dueDate) < today
  );

  // Get bills for AP calculations
  const bills = await storage.getBillsByTenant(tenantId);
  
  // Pending bills
  const pendingBills = bills.filter((bill: Bill) => 
    bill.status === 'open' || bill.status === 'partial'
  );

  // Calculate AR aging
  const arAging = calculateAging(outstandingInvoices.map((inv: Invoice) => ({
    dueDate: inv.dueDate,
    balance: inv.total || '0'
  })), today);

  // Calculate AP aging
  const apAging = calculateAging(pendingBills.map((bill: Bill) => ({
    dueDate: bill.dueDate,
    balance: bill.total || '0'
  })), today);

  // Get cash accounts balance - query accounts table directly for cash/bank accounts
  const cashAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        or(
          eq(accounts.isCashEquivalent, true),
          eq(accounts.type, 'asset')
        )
      )
    );
  
  const cashPosition = cashAccounts.reduce((sum: number, acc: Account) => 
    sum + parseFloat(acc.currentBalance || '0'), 0
  );

  // Revenue and expenses today (simplified - would need journal entries in production)
  // For now, we'll use approved invoices and bills posted today
  const revenueToday = invoices
    .filter((inv: Invoice) => {
      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      return invDate && invDate >= startOfToday && invDate <= endOfToday && inv.status !== 'draft';
    })
    .reduce((sum: number, inv: Invoice) => sum + parseFloat(inv.total || '0'), 0);

  const expensesToday = bills
    .filter((bill: Bill) => {
      const billDate = bill.billDate ? new Date(bill.billDate) : null;
      return billDate && billDate >= startOfToday && billDate <= endOfToday && bill.status !== 'draft';
    })
    .reduce((sum: number, bill: Bill) => sum + parseFloat(bill.total || '0'), 0);

  return {
    timestamp: new Date().toISOString(),
    tenantId,
    kpis: {
      totalRevenueToday: revenueToday.toFixed(2),
      totalExpensesToday: expensesToday.toFixed(2),
      outstandingInvoices: {
        count: outstandingInvoices.length,
        total: outstandingInvoices.reduce((sum: number, inv: Invoice) => 
          sum + parseFloat(inv.total || '0'), 0
        ).toFixed(2)
      },
      overdueInvoices: {
        count: overdueInvoices.length,
        total: overdueInvoices.reduce((sum: number, inv: Invoice) => 
          sum + parseFloat(inv.total || '0'), 0
        ).toFixed(2)
      },
      pendingPayments: {
        count: pendingBills.length,
        total: pendingBills.reduce((sum: number, bill: Bill) => 
          sum + parseFloat(bill.total || '0'), 0
        ).toFixed(2)
      },
      cashPosition: cashPosition.toFixed(2),
      arAgingSummary: arAging,
      apAgingSummary: apAging
    }
  };
}

interface AgingItem {
  dueDate: Date | string | null;
  balance: string;
}

function calculateAging(items: AgingItem[], referenceDate: Date) {
  const buckets = {
    current: 0,
    days30: 0,
    days60: 0,
    days90Plus: 0
  };

  items.forEach((item: AgingItem) => {
    if (!item.dueDate) {
      buckets.current = buckets.current + parseFloat(item.balance);
      return;
    }

    const dueDate = new Date(item.dueDate);
    const daysOverdue = Math.floor((referenceDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const balance = parseFloat(item.balance);

    if (daysOverdue <= 0) {
      buckets.current = buckets.current + balance;
    } else if (daysOverdue <= 30) {
      buckets.days30 = buckets.days30 + balance;
    } else if (daysOverdue <= 60) {
      buckets.days60 = buckets.days60 + balance;
    } else {
      buckets.days90Plus = buckets.days90Plus + balance;
    }
  });

  return {
    current: buckets.current.toFixed(2),
    days30: buckets.days30.toFixed(2),
    days60: buckets.days60.toFixed(2),
    days90Plus: buckets.days90Plus.toFixed(2)
  };
}
