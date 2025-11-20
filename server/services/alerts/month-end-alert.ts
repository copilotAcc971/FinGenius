import { db } from '../../db';
import { 
  checklistTemplates,
  checklistInstances,
  journalEntries,
  bankReconciliations,
  bills,
  purchaseOrders,
  assets,
  alertInstances,
  type InsertChecklistInstance,
  type InsertAlertInstance,
  type ChecklistTemplate,
  type ChecklistInstance
} from '@shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  responsibleRole: string;
  estimatedTime: number; // in minutes
  autoCheck?: {
    type: 'count_zero' | 'all_complete' | 'custom';
    query?: string;
  };
}

interface ChecklistProgress {
  totalItems: number;
  completedItems: number;
  percentageComplete: number;
  estimatedTimeRemaining: number;
  itemsStatus: {
    [itemId: string]: {
      completed: boolean;
      completedBy?: string;
      completedAt?: string;
    };
  };
}

export class MonthEndAlertService {
  /**
   * Standard month-end checklist items
   */
  private readonly STANDARD_CHECKLIST_ITEMS: ChecklistItem[] = [
    {
      id: 'review-post-journal-entries',
      title: 'Review and post all draft journal entries',
      description: 'Ensure all draft journal entries are reviewed and posted to the ledger',
      responsibleRole: 'accountant',
      estimatedTime: 30,
      autoCheck: {
        type: 'count_zero',
        query: 'draft_journal_entries'
      }
    },
    {
      id: 'reconcile-bank-accounts',
      title: 'Reconcile all bank accounts',
      description: 'Complete bank reconciliations for all active bank accounts',
      responsibleRole: 'accountant',
      estimatedTime: 60,
      autoCheck: {
        type: 'all_complete',
        query: 'bank_reconciliations'
      }
    },
    {
      id: 'review-aged-ar',
      title: 'Review aged AR and create bad debt provisions',
      description: 'Review accounts receivable aging report and create provisions for uncollectible accounts',
      responsibleRole: 'accountant',
      estimatedTime: 45
    },
    {
      id: 'confirm-bills-entered',
      title: 'Confirm all bills are entered and matched to POs',
      description: 'Verify all vendor bills have been entered and matched to purchase orders',
      responsibleRole: 'accountant',
      estimatedTime: 30
    },
    {
      id: 'record-accrued-expenses',
      title: 'Record accrued expenses',
      description: 'Create journal entries for expenses incurred but not yet billed',
      responsibleRole: 'accountant',
      estimatedTime: 45
    },
    {
      id: 'depreciate-fixed-assets',
      title: 'Depreciate fixed assets',
      description: 'Calculate and record monthly depreciation for all fixed assets',
      responsibleRole: 'accountant',
      estimatedTime: 30,
      autoCheck: {
        type: 'custom',
        query: 'asset_depreciation'
      }
    },
    {
      id: 'review-inventory-valuation',
      title: 'Review inventory valuation',
      description: 'Perform NRV assessment and write-down obsolete or damaged inventory',
      responsibleRole: 'accountant',
      estimatedTime: 60
    },
    {
      id: 'generate-financial-statements',
      title: 'Generate P&L and Balance Sheet',
      description: 'Generate preliminary financial statements for review',
      responsibleRole: 'accountant',
      estimatedTime: 15
    },
    {
      id: 'variance-analysis',
      title: 'Variance analysis vs budget',
      description: 'Compare actual results to budget and explain significant variances',
      responsibleRole: 'controller',
      estimatedTime: 90
    },
    {
      id: 'close-accounting-period',
      title: 'Close accounting period',
      description: 'Lock the accounting period to prevent further changes',
      responsibleRole: 'controller',
      estimatedTime: 5
    }
  ];

  /**
   * Create month-end checklist from template or generate standard checklist
   */
  async createMonthEndChecklist(
    tenantId: string,
    period: string // Format: 'YYYY-MM' e.g., '2025-01'
  ): Promise<ChecklistInstance> {
    // Check if checklist already exists for this period
    const existing = await db
      .select()
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.tenantId, tenantId),
          eq(checklistInstances.period, period)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Try to get template
    const template = await this.getMonthEndTemplate(tenantId);
    
    // Use template items or standard items
    const items = template ? template.items : this.STANDARD_CHECKLIST_ITEMS;

    // Calculate due date (last day of the month)
    const [year, month] = period.split('-').map(Number);
    const dueDate = new Date(year, month, 0); // Last day of month
    dueDate.setHours(23, 59, 59, 999);

    // Create checklist instance
    const checklistData: InsertChecklistInstance = {
      tenantId,
      templateId: template?.id || null,
      period,
      status: 'not_started',
      itemsCompleted: {},
      progress: 0,
      dueDate: dueDate.toISOString()
    };

    const [checklist] = await db
      .insert(checklistInstances)
      .values(checklistData)
      .returning();

    // Send initial reminders
    await this.scheduleReminders(tenantId, checklist.id, period, dueDate);

    return checklist;
  }

  /**
   * Get month-end checklist template for tenant
   */
  private async getMonthEndTemplate(tenantId: string): Promise<ChecklistTemplate | null> {
    const templates = await db
      .select()
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.tenantId, tenantId),
          eq(checklistTemplates.frequency, 'monthly')
        )
      )
      .limit(1);

    return templates.length > 0 ? templates[0] : null;
  }

  /**
   * Update checklist progress and auto-check items
   */
  async updateChecklistProgress(
    tenantId: string,
    checklistId: string
  ): Promise<ChecklistProgress> {
    const [checklist] = await db
      .select()
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.id, checklistId),
          eq(checklistInstances.tenantId, tenantId)
        )
      );

    if (!checklist) {
      throw new Error('Checklist not found');
    }

    // Get template or use standard items
    const template = checklist.templateId 
      ? await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, checklist.templateId)).limit(1).then(t => t[0])
      : null;

    const items = (template?.items as ChecklistItem[]) || this.STANDARD_CHECKLIST_ITEMS;
    const itemsCompleted = (checklist.itemsCompleted as any) || {};

    // Auto-check items
    for (const item of items) {
      if (item.autoCheck && !itemsCompleted[item.id]?.completed) {
        const isComplete = await this.checkItemCompletion(tenantId, item, checklist.period);
        if (isComplete) {
          itemsCompleted[item.id] = {
            completed: true,
            completedBy: 'system',
            completedAt: new Date().toISOString()
          };
        }
      }
    }

    // Calculate progress
    const totalItems = items.length;
    const completedCount = Object.values(itemsCompleted).filter((item: any) => item.completed).length;
    const percentageComplete = Math.round((completedCount / totalItems) * 100);

    // Calculate estimated time remaining
    const incompleteItems = items.filter(item => !itemsCompleted[item.id]?.completed);
    const estimatedTimeRemaining = incompleteItems.reduce((sum, item) => sum + item.estimatedTime, 0);

    // Update checklist
    const newStatus = percentageComplete === 100 ? 'completed' : 
                     percentageComplete > 0 ? 'in_progress' : 
                     'not_started';

    await db
      .update(checklistInstances)
      .set({
        itemsCompleted,
        progress: percentageComplete,
        status: newStatus,
        completedAt: percentageComplete === 100 ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(checklistInstances.id, checklistId));

    return {
      totalItems,
      completedItems: completedCount,
      percentageComplete,
      estimatedTimeRemaining,
      itemsStatus: itemsCompleted
    };
  }

  /**
   * Auto-check if a checklist item is complete
   */
  private async checkItemCompletion(
    tenantId: string,
    item: ChecklistItem,
    period: string
  ): Promise<boolean> {
    if (!item.autoCheck) return false;

    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    switch (item.autoCheck.query) {
      case 'draft_journal_entries': {
        // Check if there are no draft journal entries for the period
        const draftEntries = await db
          .select({ count: sql<number>`count(*)` })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.tenantId, tenantId),
              eq(journalEntries.status, 'draft'),
              sql`${journalEntries.entryDate} >= ${periodStart.toISOString()}`,
              sql`${journalEntries.entryDate} <= ${periodEnd.toISOString()}`
            )
          );
        return Number(draftEntries[0]?.count) === 0;
      }

      case 'bank_reconciliations': {
        // Check if all bank accounts have reconciliations for the period
        const reconciliations = await db
          .select({ count: sql<number>`count(*)` })
          .from(bankReconciliations)
          .where(
            and(
              eq(bankReconciliations.tenantId, tenantId),
              eq(bankReconciliations.status, 'reconciled'),
              sql`${bankReconciliations.statementDate} >= ${periodStart.toISOString()}`,
              sql`${bankReconciliations.statementDate} <= ${periodEnd.toISOString()}`
            )
          );
        // This is simplified - in production, you'd check against actual number of bank accounts
        return Number(reconciliations[0]?.count) > 0;
      }

      case 'asset_depreciation': {
        // Check if depreciation has been run for the period
        // This would check for journal entries with depreciation transactions
        const depreciationEntries = await db
          .select({ count: sql<number>`count(*)` })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.tenantId, tenantId),
              eq(journalEntries.status, 'posted'),
              sql`${journalEntries.description} ILIKE '%depreciation%'`,
              sql`${journalEntries.entryDate} >= ${periodStart.toISOString()}`,
              sql`${journalEntries.entryDate} <= ${periodEnd.toISOString()}`
            )
          );
        return Number(depreciationEntries[0]?.count) > 0;
      }

      default:
        return false;
    }
  }

  /**
   * Schedule reminder alerts for month-end closing
   */
  private async scheduleReminders(
    tenantId: string,
    checklistId: string,
    period: string,
    dueDate: Date
  ): Promise<void> {
    const now = new Date();
    
    // Reminder dates
    const sevenDaysBefore = new Date(dueDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    
    const threeDaysBefore = new Date(dueDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

    // Create reminder alerts
    const reminders = [
      { date: sevenDaysBefore, title: '7-Day Month-End Reminder', priority: 'medium' as const },
      { date: threeDaysBefore, title: '3-Day Month-End Reminder', priority: 'high' as const },
      { date: dueDate, title: 'Month-End Closing Today', priority: 'critical' as const }
    ];

    for (const reminder of reminders) {
      // Only create reminders for future dates
      if (reminder.date > now) {
        const alertData: InsertAlertInstance = {
          tenantId,
          alertType: 'month_end',
          priority: reminder.priority,
          title: `📅 ${reminder.title}`,
          message: `Month-end closing for ${period} is due on ${dueDate.toLocaleDateString()}. ` +
            `Please review and complete all checklist items.`,
          actionUrl: `/settings/month-end-checklist/${checklistId}`,
          quickActions: [
            { label: 'View Checklist', action: 'navigate', params: { url: `/settings/month-end-checklist/${checklistId}` } }
          ],
          metadata: {
            checklistId,
            period,
            dueDate: dueDate.toISOString(),
            reminderType: reminder.date === dueDate ? 'due_today' : `${Math.ceil((dueDate.getTime() - reminder.date.getTime()) / (1000 * 60 * 60 * 24))}_days_before`
          },
          status: 'new',
          expiresAt: new Date(reminder.date.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };

        await db.insert(alertInstances).values(alertData);
      }
    }
  }

  /**
   * Mark a checklist item as complete
   */
  async markItemComplete(
    tenantId: string,
    checklistId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    const [checklist] = await db
      .select()
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.id, checklistId),
          eq(checklistInstances.tenantId, tenantId)
        )
      );

    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const itemsCompleted = (checklist.itemsCompleted as any) || {};
    itemsCompleted[itemId] = {
      completed: true,
      completedBy: userId,
      completedAt: new Date().toISOString()
    };

    await db
      .update(checklistInstances)
      .set({
        itemsCompleted,
        updatedAt: new Date().toISOString()
      })
      .where(eq(checklistInstances.id, checklistId));

    // Update progress
    await this.updateChecklistProgress(tenantId, checklistId);
  }

  /**
   * Get current month-end checklist
   */
  async getCurrentMonthEndChecklist(tenantId: string): Promise<ChecklistInstance | null> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const checklists = await db
      .select()
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.tenantId, tenantId),
          eq(checklistInstances.period, period)
        )
      )
      .limit(1);

    if (checklists.length === 0) {
      // Auto-create checklist for current month
      return this.createMonthEndChecklist(tenantId, period);
    }

    return checklists[0];
  }
}

export const monthEndAlertService = new MonthEndAlertService();
