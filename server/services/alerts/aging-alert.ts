import { db } from '../../db';
import { 
  invoices, 
  bills, 
  customers,
  vendors,
  alertInstances,
  type InsertAlertInstance 
} from '@shared/schema';
import { eq, and, lt, sql, desc } from 'drizzle-orm';

interface AgingBucket {
  current: { count: number; total: number; items: any[] };
  days30: { count: number; total: number; items: any[] };
  days60: { count: number; total: number; items: any[] };
  days90: { count: number; total: number; items: any[] };
  days120Plus: { count: number; total: number; items: any[] };
}

interface AgedReceivablesAlert {
  overdue60Days: any[];
  over90DaysExceedsThreshold: boolean;
  totalAR: number;
  over90DaysAmount: number;
  over90DaysPercentage: number;
}

interface AgedPayablesAlert {
  dueNext7Days: any[];
  overdue30Days: any[];
  totalDueNext7Days: number;
  totalOverdue30Days: number;
}

export class AgingAlertService {
  /**
   * Analyze aged receivables and create alerts
   */
  async analyzeAgedReceivables(tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate AR aging buckets
    const agingData = await this.calculateARAgingBuckets(tenantId, today);

    // Check for alerts:
    // 1. Invoices >60 days overdue
    const overdue60Days = [...agingData.days60.items, ...agingData.days90.items, ...agingData.days120Plus.items];
    
    // 2. Total AR >90 days exceeds 20% of total AR
    const totalAR = Object.values(agingData).reduce((sum, bucket) => sum + bucket.total, 0);
    const over90Days = agingData.days90.total + agingData.days120Plus.total;
    const over90Percentage = totalAR > 0 ? (over90Days / totalAR) * 100 : 0;

    // Create alerts if thresholds are exceeded
    if (overdue60Days.length > 0) {
      await this.createOverdueInvoicesAlert(tenantId, overdue60Days);
    }

    if (over90Percentage > 20) {
      await this.createAgedARThresholdAlert(tenantId, {
        totalAR,
        over90DaysAmount: over90Days,
        over90DaysPercentage: over90Percentage
      });
    }
  }

  /**
   * Analyze aged payables and create alerts
   */
  async analyzeAgedPayables(tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Bills due in next 7 days
    const dueNext7Days = await this.getBillsDueInNext7Days(tenantId, today);

    // 2. Bills overdue >30 days
    const overdue30Days = await this.getBillsOverdue30Days(tenantId, today);

    // Create alerts
    if (dueNext7Days.length > 0) {
      await this.createBillsDueAlert(tenantId, dueNext7Days);
    }

    if (overdue30Days.length > 0) {
      await this.createOverdueBillsAlert(tenantId, overdue30Days);
    }
  }

  /**
   * Calculate AR aging buckets
   */
  private async calculateARAgingBuckets(tenantId: string, today: Date): Promise<AgingBucket> {
    const unpaidInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: customers.name,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        status: invoices.status
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          lt(invoices.dueDate, today.toISOString())
        )
      )
      .orderBy(desc(invoices.dueDate));

    const buckets: AgingBucket = {
      current: { count: 0, total: 0, items: [] },
      days30: { count: 0, total: 0, items: [] },
      days60: { count: 0, total: 0, items: [] },
      days90: { count: 0, total: 0, items: [] },
      days120Plus: { count: 0, total: 0, items: [] }
    };

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amountDue = parseFloat(invoice.totalAmount || '0') - parseFloat(invoice.amountPaid || '0');

      const item = {
        ...invoice,
        daysOverdue,
        amountDue
      };

      if (daysOverdue < 0) {
        buckets.current.items.push(item);
        buckets.current.total += amountDue;
        buckets.current.count++;
      } else if (daysOverdue < 30) {
        buckets.days30.items.push(item);
        buckets.days30.total += amountDue;
        buckets.days30.count++;
      } else if (daysOverdue < 60) {
        buckets.days60.items.push(item);
        buckets.days60.total += amountDue;
        buckets.days60.count++;
      } else if (daysOverdue < 90) {
        buckets.days90.items.push(item);
        buckets.days90.total += amountDue;
        buckets.days90.count++;
      } else {
        buckets.days120Plus.items.push(item);
        buckets.days120Plus.total += amountDue;
        buckets.days120Plus.count++;
      }
    }

    return buckets;
  }

  /**
   * Get bills due in next 7 days
   */
  private async getBillsDueInNext7Days(tenantId: string, today: Date): Promise<any[]> {
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        issueDate: bills.issueDate,
        dueDate: bills.dueDate,
        totalAmount: bills.totalAmount,
        status: bills.status
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          eq(bills.status, 'unpaid'),
          sql`${bills.dueDate} >= ${today.toISOString()}`,
          sql`${bills.dueDate} <= ${sevenDaysFromNow.toISOString()}`
        )
      )
      .orderBy(bills.dueDate);

    return dueBills.map(bill => ({
      ...bill,
      daysUntilDue: Math.ceil((new Date(bill.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }));
  }

  /**
   * Get bills overdue by more than 30 days
   */
  private async getBillsOverdue30Days(tenantId: string, today: Date): Promise<any[]> {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        issueDate: bills.issueDate,
        dueDate: bills.dueDate,
        totalAmount: bills.totalAmount,
        status: bills.status
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          eq(bills.status, 'unpaid'),
          lt(bills.dueDate, thirtyDaysAgo.toISOString())
        )
      )
      .orderBy(bills.dueDate);

    return overdueBills.map(bill => ({
      ...bill,
      daysOverdue: Math.floor((today.getTime() - new Date(bill.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    }));
  }

  /**
   * Create alert for invoices >60 days overdue
   */
  private async createOverdueInvoicesAlert(tenantId: string, overdueInvoices: any[]): Promise<void> {
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    const count = overdueInvoices.length;

    const topInvoices = overdueInvoices
      .sort((a, b) => b.amountDue - a.amountDue)
      .slice(0, 5);

    const invoiceList = topInvoices
      .map(inv => `• ${inv.invoiceNumber} - ${inv.customerName}: $${inv.amountDue.toLocaleString()} (${inv.daysOverdue} days overdue)`)
      .join('\n');

    const message = `${count} invoice(s) are overdue by more than 60 days, totaling $${totalOverdue.toLocaleString()}.\n\nTop overdue invoices:\n${invoiceList}${count > 5 ? `\n\n+${count - 5} more invoices` : ''}`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'aged_ar',
      priority: count > 10 ? 'critical' : count > 5 ? 'high' : 'medium',
      title: '📊 Aged Receivables Alert - Collection Priority',
      message,
      actionUrl: '/customers/ar-aging',
      quickActions: [
        { label: 'View AR Aging Report', action: 'navigate', params: { url: '/customers/ar-aging' } },
        { label: 'Send Collection Emails', action: 'bulk_action', params: { type: 'send_reminder', invoiceIds: overdueInvoices.map(i => i.id) } }
      ],
      metadata: {
        count,
        totalOverdue,
        oldestDaysOverdue: Math.max(...overdueInvoices.map(i => i.daysOverdue)),
        invoiceIds: overdueInvoices.map(i => i.id)
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Create alert when AR >90 days exceeds 20% threshold
   */
  private async createAgedARThresholdAlert(
    tenantId: string,
    data: { totalAR: number; over90DaysAmount: number; over90DaysPercentage: number }
  ): Promise<void> {
    const message = `Your accounts receivable over 90 days old represents ${data.over90DaysPercentage.toFixed(1)}% of total AR ` +
      `($${data.over90DaysAmount.toLocaleString()} out of $${data.totalAR.toLocaleString()}). ` +
      `This exceeds the recommended threshold of 20%. Consider creating bad debt provisions and escalating collection efforts.`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'aged_ar',
      priority: data.over90DaysPercentage > 30 ? 'critical' : 'high',
      title: '⚠️ Aged AR Threshold Exceeded',
      message,
      actionUrl: '/customers/ar-aging',
      quickActions: [
        { label: 'View AR Aging Report', action: 'navigate', params: { url: '/customers/ar-aging' } },
        { label: 'Create Bad Debt Provision', action: 'navigate', params: { url: '/journal-entries/new' } }
      ],
      metadata: {
        totalAR: data.totalAR,
        over90DaysAmount: data.over90DaysAmount,
        over90DaysPercentage: data.over90DaysPercentage
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Create alert for bills due in next 7 days
   */
  private async createBillsDueAlert(tenantId: string, dueBills: any[]): Promise<void> {
    const totalDue = dueBills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount || '0'), 0);
    const count = dueBills.length;

    const billList = dueBills
      .slice(0, 5)
      .map(bill => `• ${bill.billNumber} - ${bill.vendorName}: $${parseFloat(bill.totalAmount || '0').toLocaleString()} (due in ${bill.daysUntilDue} days)`)
      .join('\n');

    const message = `${count} bill(s) are due within the next 7 days, totaling $${totalDue.toLocaleString()}.\n\nUpcoming bills:\n${billList}${count > 5 ? `\n\n+${count - 5} more bills` : ''}`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'aged_ap',
      priority: totalDue > 50000 ? 'high' : 'medium',
      title: '💳 Bills Due Soon - Payment Reminder',
      message,
      actionUrl: '/vendors/ap-aging',
      quickActions: [
        { label: 'View AP Aging Report', action: 'navigate', params: { url: '/vendors/ap-aging' } },
        { label: 'Schedule Payments', action: 'bulk_action', params: { type: 'schedule_payment', billIds: dueBills.map(b => b.id) } }
      ],
      metadata: {
        count,
        totalDue,
        billIds: dueBills.map(b => b.id)
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Create alert for bills overdue >30 days
   */
  private async createOverdueBillsAlert(tenantId: string, overdueBills: any[]): Promise<void> {
    const totalOverdue = overdueBills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount || '0'), 0);
    const count = overdueBills.length;

    const billList = overdueBills
      .slice(0, 5)
      .map(bill => `• ${bill.billNumber} - ${bill.vendorName}: $${parseFloat(bill.totalAmount || '0').toLocaleString()} (${bill.daysOverdue} days overdue)`)
      .join('\n');

    const message = `${count} bill(s) are overdue by more than 30 days, totaling $${totalOverdue.toLocaleString()}. ` +
      `This may damage vendor relationships and credit terms.\n\nOverdue bills:\n${billList}${count > 5 ? `\n\n+${count - 5} more bills` : ''}`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'aged_ap',
      priority: count > 5 ? 'critical' : 'high',
      title: '🚨 Overdue Bills - Vendor Relationship Risk',
      message,
      actionUrl: '/vendors/ap-aging',
      quickActions: [
        { label: 'View AP Aging Report', action: 'navigate', params: { url: '/vendors/ap-aging' } },
        { label: 'Pay Now', action: 'bulk_action', params: { type: 'pay_bills', billIds: overdueBills.map(b => b.id) } }
      ],
      metadata: {
        count,
        totalOverdue,
        oldestDaysOverdue: Math.max(...overdueBills.map(b => b.daysOverdue)),
        billIds: overdueBills.map(b => b.id)
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }
}

export const agingAlertService = new AgingAlertService();
