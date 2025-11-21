import { db } from '../../db';
import { 
  invoices,
  bills,
  journalEntries,
  expenses,
  approvalRequests,
  approvalWorkflows,
  users,
  tenantMemberRoles,
  roles,
  alertInstances,
  type InsertAlertInstance 
} from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

interface PendingItem {
  id: string;
  type: 'invoice' | 'bill' | 'journal_entry' | 'expense';
  number: string;
  description: string;
  amount: number;
  submittedBy: string | null;
  submittedAt: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  daysWaiting: number;
  url: string;
}

interface PendingApprovalsSummary {
  totalCount: number;
  byType: {
    invoices: number;
    bills: number;
    journalEntries: number;
    expenses: number;
  };
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  items: PendingItem[];
}

export class PendingApprovalsAlertService {
  /**
   * Aggregate all pending approvals and create daily digest alert
   */
  async aggregatePendingApprovals(tenantId: string, userId?: string): Promise<PendingApprovalsSummary> {
    const today = new Date();

    // Collect all items pending approval from different sources
    const [pendingInvoices, pendingBills, pendingJournalEntries, pendingExpenses] = await Promise.all([
      this.getPendingInvoices(tenantId),
      this.getPendingBills(tenantId),
      this.getPendingJournalEntries(tenantId),
      this.getPendingExpenses(tenantId)
    ]);

    // Combine all pending items
    const allPendingItems: PendingItem[] = [
      ...pendingInvoices,
      ...pendingBills,
      ...pendingJournalEntries,
      ...pendingExpenses
    ];

    // Calculate summary statistics
    const summary: PendingApprovalsSummary = {
      totalCount: allPendingItems.length,
      byType: {
        invoices: pendingInvoices.length,
        bills: pendingBills.length,
        journalEntries: pendingJournalEntries.length,
        expenses: pendingExpenses.length
      },
      byPriority: {
        critical: allPendingItems.filter(i => i.priority === 'critical').length,
        high: allPendingItems.filter(i => i.priority === 'high').length,
        medium: allPendingItems.filter(i => i.priority === 'medium').length,
        low: allPendingItems.filter(i => i.priority === 'low').length
      },
      items: allPendingItems.sort((a, b) => {
        // Sort by priority first, then by days waiting
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.daysWaiting - a.daysWaiting;
      })
    };

    // Create alert if there are pending items
    if (summary.totalCount > 0) {
      await this.createPendingApprovalsDigest(tenantId, summary);
    }

    return summary;
  }

  /**
   * Get pending invoices
   */
  private async getPendingInvoices(tenantId: string): Promise<PendingItem[]> {
    const pendingInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
        issueDate: invoices.issueDate,
        createdBy: invoices.createdBy,
        createdAt: invoices.createdAt
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'pending_approval')
        )
      );

    return pendingInvoices.map(invoice => {
      const daysWaiting = this.calculateDaysWaiting(invoice.createdAt);
      return {
        id: invoice.id,
        type: 'invoice' as const,
        number: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber}`,
        amount: parseFloat(invoice.totalAmount || '0'),
        submittedBy: invoice.createdBy,
        submittedAt: invoice.createdAt?.toISOString() || null,
        priority: this.determinePriority(parseFloat(invoice.totalAmount || '0'), daysWaiting),
        daysWaiting,
        url: `/invoices/${invoice.id}`
      };
    });
  }

  /**
   * Get pending bills
   */
  private async getPendingBills(tenantId: string): Promise<PendingItem[]> {
    const pendingBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        totalAmount: bills.totalAmount,
        issueDate: bills.issueDate,
        createdBy: bills.createdBy,
        createdAt: bills.createdAt
      })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, tenantId),
          sql`${bills.status} = 'pending_approval'`
        )
      );

    return pendingBills.map(bill => {
      const daysWaiting = this.calculateDaysWaiting(bill.createdAt);
      return {
        id: bill.id,
        type: 'bill' as const,
        number: bill.billNumber || 'N/A',
        description: `Bill ${bill.billNumber || bill.id}`,
        amount: parseFloat(bill.totalAmount || '0'),
        submittedBy: bill.createdBy,
        submittedAt: bill.createdAt?.toISOString() || null,
        priority: this.determinePriority(parseFloat(bill.totalAmount || '0'), daysWaiting),
        daysWaiting,
        url: `/bills/${bill.id}`
      };
    });
  }

  /**
   * Get pending journal entries
   */
  private async getPendingJournalEntries(tenantId: string): Promise<PendingItem[]> {
    const pendingJournalEntries = await db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        entryDate: journalEntries.entryDate,
        createdBy: journalEntries.createdBy,
        createdAt: journalEntries.createdAt
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.status, 'pending_approval')
        )
      );

    // Get total amounts for each journal entry
    const entriesWithAmounts = await Promise.all(
      pendingJournalEntries.map(async (entry) => {
        const legs = await db
          .select({
            debitAmount: sql<string>`SUM(CAST(debit_amount AS DECIMAL))`
          })
          .from(sql`journal_entry_legs`)
          .where(sql`journal_entry_id = ${entry.id}`);

        const totalDebit = parseFloat(legs[0]?.debitAmount || '0');
        const daysWaiting = this.calculateDaysWaiting(entry.createdAt);

        return {
          id: entry.id,
          type: 'journal_entry' as const,
          number: entry.entryNumber,
          description: entry.description || `Journal Entry ${entry.entryNumber}`,
          amount: totalDebit,
          submittedBy: entry.createdBy,
          submittedAt: entry.createdAt?.toISOString() || null,
          priority: this.determinePriority(totalDebit, daysWaiting),
          daysWaiting,
          url: `/journal-entries/${entry.id}`
        };
      })
    );

    return entriesWithAmounts;
  }

  /**
   * Get pending expenses
   */
  private async getPendingExpenses(tenantId: string): Promise<PendingItem[]> {
    const pendingExpenses = await db
      .select({
        id: expenses.id,
        description: expenses.description,
        amount: expenses.amount,
        date: expenses.date,
        employeeId: expenses.employeeId,
        submittedAt: expenses.submittedAt
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.tenantId, tenantId),
          eq(expenses.status, 'pending_approval')
        )
      );

    return pendingExpenses.map(expense => {
      const daysWaiting = this.calculateDaysWaiting(expense.submittedAt);
      return {
        id: expense.id,
        type: 'expense' as const,
        number: expense.id.substring(0, 8),
        description: expense.description || 'Employee Expense',
        amount: parseFloat(expense.amount || '0'),
        submittedBy: expense.employeeId,
        submittedAt: expense.submittedAt?.toISOString() || null,
        priority: this.determinePriority(parseFloat(expense.amount || '0'), daysWaiting),
        daysWaiting,
        url: `/expenses/${expense.id}`
      };
    });
  }

  /**
   * Calculate days waiting for approval
   */
  private calculateDaysWaiting(submittedAt: Date | string | null | undefined): number {
    if (!submittedAt) return 0;
    
    const submitted = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
    const now = new Date();
    return Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine priority based on amount and days waiting
   */
  private determinePriority(amount: number, daysWaiting: number): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: High amount AND waiting >7 days, OR any amount waiting >14 days
    if ((amount > 50000 && daysWaiting > 7) || daysWaiting > 14) {
      return 'critical';
    }
    
    // High: High amount OR waiting >5 days
    if (amount > 50000 || daysWaiting > 5) {
      return 'high';
    }
    
    // Medium: Medium amount OR waiting >3 days
    if (amount > 10000 || daysWaiting > 3) {
      return 'medium';
    }
    
    // Low: Everything else
    return 'low';
  }

  /**
   * Create daily digest alert for pending approvals
   */
  private async createPendingApprovalsDigest(
    tenantId: string,
    summary: PendingApprovalsSummary
  ): Promise<void> {
    const { totalCount, byType, byPriority, items } = summary;

    // Build summary message
    let message = `You have ${totalCount} item(s) pending approval:\n\n`;
    
    if (byType.invoices > 0) message += `• ${byType.invoices} Invoice(s)\n`;
    if (byType.bills > 0) message += `• ${byType.bills} Bill(s)\n`;
    if (byType.journalEntries > 0) message += `• ${byType.journalEntries} Journal Entr${byType.journalEntries === 1 ? 'y' : 'ies'}\n`;
    if (byType.expenses > 0) message += `• ${byType.expenses} Expense(s)\n`;

    message += '\nPriority Breakdown:\n';
    if (byPriority.critical > 0) message += `• 🚨 ${byPriority.critical} Critical\n`;
    if (byPriority.high > 0) message += `• ⚠️ ${byPriority.high} High\n`;
    if (byPriority.medium > 0) message += `• ℹ️ ${byPriority.medium} Medium\n`;
    if (byPriority.low > 0) message += `• ✓ ${byPriority.low} Low\n`;

    // Add top 5 items awaiting longest
    const topItems = items.slice(0, 5);
    if (topItems.length > 0) {
      message += '\nLongest Waiting:\n';
      topItems.forEach(item => {
        message += `• ${item.description} - $${item.amount.toLocaleString()} (${item.daysWaiting} days)\n`;
      });
    }

    // Determine overall priority
    let overallPriority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (byPriority.critical > 0) overallPriority = 'critical';
    else if (byPriority.high > 0) overallPriority = 'high';
    else if (byPriority.medium > 0 || totalCount > 10) overallPriority = 'medium';

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'pending_approval',
      priority: overallPriority,
      title: '📋 Pending Approvals Digest',
      message,
      actionUrl: '/approvals',
      quickActions: items.slice(0, 10).map(item => ({
        label: `Review ${item.type.replace('_', ' ')} ${item.number}`,
        action: 'navigate',
        params: { url: item.url }
      })),
      metadata: {
        totalCount,
        byType,
        byPriority,
        itemIds: items.map(i => ({ id: i.id, type: i.type }))
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expires in 24 hours
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Get pending approvals for a specific user based on their role
   */
  async getPendingApprovalsForUser(tenantId: string, userId: string): Promise<PendingApprovalsSummary> {
    // For now, return all pending approvals
    // Future enhancement: Filter based on user's approval authority in RBAC
    return this.aggregatePendingApprovals(tenantId, userId);
  }

  /**
   * Schedule daily digest at 9 AM
   * This would be called by a cron job
   */
  async scheduleDailyDigest(tenantId: string): Promise<void> {
    const summary = await this.aggregatePendingApprovals(tenantId);
    
    // Alert is already created in aggregatePendingApprovals if there are pending items
  }
}

export const pendingApprovalsAlertService = new PendingApprovalsAlertService();
