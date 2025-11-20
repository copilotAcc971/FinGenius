import { db } from '../../db';
import { 
  complianceDeadlines,
  alertInstances,
  type ComplianceDeadline,
  type InsertAlertInstance
} from '@shared/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';

interface ComplianceReminderSchedule {
  deadline: ComplianceDeadline;
  daysUntilDeadline: number;
  reminderType: '30_days' | '14_days' | '7_days' | '3_days' | '1_day' | 'overdue';
  priority: 'critical' | 'high' | 'medium' | 'low';
  requiresEscalation: boolean;
}

export class ComplianceAlertService {
  /**
   * Reminder schedule (days before deadline)
   */
  private readonly REMINDER_SCHEDULE = [30, 14, 7, 3, 1];

  /**
   * Track compliance deadlines and create reminder alerts
   */
  async trackDeadlines(tenantId: string): Promise<void> {
    console.log(`[Compliance Alert] Tracking compliance deadlines for tenant ${tenantId}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all upcoming and overdue deadlines
    const upcomingDeadlines = await this.getUpcomingDeadlines(tenantId, today);

    for (const deadline of upcomingDeadlines) {
      const daysUntilDeadline = this.calculateDaysUntil(deadline.dueDate, today);
      
      // Determine reminder type
      let reminderType: ComplianceReminderSchedule['reminderType'] = '30_days';
      let priority: ComplianceReminderSchedule['priority'] = 'medium';
      
      if (daysUntilDeadline < 0) {
        reminderType = 'overdue';
        priority = 'critical';
      } else if (daysUntilDeadline <= 1) {
        reminderType = '1_day';
        priority = 'critical';
      } else if (daysUntilDeadline <= 3) {
        reminderType = '3_days';
        priority = 'high';
      } else if (daysUntilDeadline <= 7) {
        reminderType = '7_days';
        priority = 'high';
      } else if (daysUntilDeadline <= 14) {
        reminderType = '14_days';
        priority = 'medium';
      } else if (daysUntilDeadline <= 30) {
        reminderType = '30_days';
        priority = 'medium';
      }

      // Check if escalation is needed (3-day reminder not actioned)
      const requiresEscalation = await this.checkEscalationRequired(
        tenantId,
        deadline.id,
        daysUntilDeadline
      );

      const reminder: ComplianceReminderSchedule = {
        deadline,
        daysUntilDeadline,
        reminderType,
        priority: requiresEscalation ? 'critical' : priority,
        requiresEscalation
      };

      // Check if we should send this reminder
      if (this.shouldSendReminder(reminderType, daysUntilDeadline)) {
        await this.createComplianceReminder(tenantId, reminder);
      }
    }

    console.log(`[Compliance Alert] Processed ${upcomingDeadlines.length} compliance deadlines`);
  }

  /**
   * Get upcoming and overdue compliance deadlines
   */
  private async getUpcomingDeadlines(
    tenantId: string,
    today: Date
  ): Promise<ComplianceDeadline[]> {
    // Get deadlines in the next 30 days and overdue deadlines
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deadlines = await db
      .select()
      .from(complianceDeadlines)
      .where(
        and(
          eq(complianceDeadlines.tenantId, tenantId),
          gte(complianceDeadlines.dueDate, ninetyDaysAgo.toISOString()),
          lte(complianceDeadlines.dueDate, thirtyDaysFromNow.toISOString()),
          isNull(complianceDeadlines.completedAt)
        )
      );

    return deadlines;
  }

  /**
   * Calculate days until deadline
   */
  private calculateDaysUntil(deadlineDate: string, today: Date): number {
    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if escalation is required
   */
  private async checkEscalationRequired(
    tenantId: string,
    deadlineId: string,
    daysUntilDeadline: number
  ): Promise<boolean> {
    // Escalate if we're at 3 days and no action has been taken
    if (daysUntilDeadline === 3 || daysUntilDeadline < 3) {
      // Check if there was a previous 3-day or 7-day alert that wasn't actioned
      const previousAlerts = await db
        .select()
        .from(alertInstances)
        .where(
          and(
            eq(alertInstances.tenantId, tenantId),
            eq(alertInstances.alertType, 'compliance_deadline')
          )
        );

      // Check if any alert for this deadline was created 4+ days ago and still not actioned
      const hasUnactionedAlert = previousAlerts.some(alert => {
        const metadata = alert.metadata as any;
        if (metadata?.deadlineId === deadlineId) {
          const alertCreated = new Date(alert.createdAt);
          const daysAgo = Math.floor(
            (new Date().getTime() - alertCreated.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysAgo >= 4 && alert.status === 'new';
        }
        return false;
      });

      return hasUnactionedAlert;
    }

    return false;
  }

  /**
   * Determine if we should send this reminder
   */
  private shouldSendReminder(
    reminderType: ComplianceReminderSchedule['reminderType'],
    daysUntilDeadline: number
  ): boolean {
    // Send reminders at exact intervals or when overdue
    if (reminderType === 'overdue') {
      // Send overdue reminders every week
      return daysUntilDeadline % 7 === 0 || daysUntilDeadline === -1;
    }

    // Send at exact reminder intervals
    return this.REMINDER_SCHEDULE.includes(daysUntilDeadline);
  }

  /**
   * Create compliance reminder alert
   */
  private async createComplianceReminder(
    tenantId: string,
    reminder: ComplianceReminderSchedule
  ): Promise<void> {
    const { deadline, daysUntilDeadline, reminderType, priority, requiresEscalation } = reminder;

    let title = '';
    let message = '';
    const escalationNote = requiresEscalation 
      ? '\n\n⚠️ ESCALATION: This deadline has not been actioned. CFO/Owner notification required.' 
      : '';

    if (daysUntilDeadline < 0) {
      const daysOverdue = Math.abs(daysUntilDeadline);
      title = `🚨 OVERDUE: ${deadline.title}`;
      message = `This compliance deadline was due ${daysOverdue} day(s) ago (${new Date(deadline.dueDate).toLocaleDateString()}).\n\n` +
        `Type: ${deadline.deadlineType}\n` +
        `Authority: ${deadline.regulatoryAuthority}\n\n` +
        `${deadline.description}\n\n` +
        `Immediate action required to avoid penalties and regulatory consequences.${escalationNote}`;
    } else if (daysUntilDeadline === 0) {
      title = `🚨 DUE TODAY: ${deadline.title}`;
      message = `This compliance deadline is due TODAY (${new Date(deadline.dueDate).toLocaleDateString()}).\n\n` +
        `Type: ${deadline.deadlineType}\n` +
        `Authority: ${deadline.regulatoryAuthority}\n\n` +
        `${deadline.description}\n\n` +
        `Complete immediately to avoid penalties.${escalationNote}`;
    } else {
      title = `⏰ ${daysUntilDeadline}-Day Reminder: ${deadline.title}`;
      message = `This compliance deadline is due in ${daysUntilDeadline} day(s) (${new Date(deadline.dueDate).toLocaleDateString()}).\n\n` +
        `Type: ${deadline.deadlineType}\n` +
        `Authority: ${deadline.regulatoryAuthority}\n\n` +
        `${deadline.description}${escalationNote}`;
    }

    // Add penalty information if available
    if (deadline.penaltyAmount) {
      message += `\n\n💰 Penalty for non-compliance: ${deadline.penaltyAmount}`;
    }

    // Build quick actions
    const quickActions: any[] = [
      { 
        label: 'View Details', 
        action: 'navigate', 
        params: { url: `/compliance/deadlines/${deadline.id}` } 
      }
    ];

    // Add specific actions based on deadline type
    if (deadline.deadlineType === 'tax_filing') {
      quickActions.push({
        label: 'Generate Tax Report',
        action: 'navigate',
        params: { url: '/reports/tax-reports' }
      });
    } else if (deadline.deadlineType === 'e_invoicing') {
      quickActions.push({
        label: 'Submit E-Invoices',
        action: 'navigate',
        params: { url: '/compliance/e-invoicing' }
      });
    } else if (deadline.deadlineType === 'audit_submission') {
      quickActions.push({
        label: 'Prepare Audit Package',
        action: 'navigate',
        params: { url: '/documents?filter=audit' }
      });
    }

    quickActions.push({
      label: 'Mark as Complete',
      action: 'complete_deadline',
      params: { deadlineId: deadline.id }
    });

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'compliance_deadline',
      priority: requiresEscalation ? 'critical' : priority,
      title,
      message,
      actionUrl: `/compliance/deadlines/${deadline.id}`,
      quickActions,
      metadata: {
        deadlineId: deadline.id,
        deadlineType: deadline.deadlineType,
        dueDate: deadline.dueDate,
        daysUntilDeadline,
        reminderType,
        requiresEscalation,
        regulatoryAuthority: deadline.regulatoryAuthority,
        penaltyAmount: deadline.penaltyAmount
      },
      status: 'new',
      expiresAt: this.calculateAlertExpiration(daysUntilDeadline)
    };

    await db.insert(alertInstances).values(alertData);

    console.log(`[Compliance Alert] Created ${reminderType} reminder for: ${deadline.title}`);
  }

  /**
   * Calculate when the alert should expire
   */
  private calculateAlertExpiration(daysUntilDeadline: number): string {
    const expirationDate = new Date();
    
    if (daysUntilDeadline < 0) {
      // Overdue: expire in 7 days
      expirationDate.setDate(expirationDate.getDate() + 7);
    } else if (daysUntilDeadline <= 3) {
      // Critical: expire in 3 days
      expirationDate.setDate(expirationDate.getDate() + 3);
    } else {
      // Normal: expire when next reminder is due
      const nextReminder = this.REMINDER_SCHEDULE.find(days => days < daysUntilDeadline);
      if (nextReminder) {
        expirationDate.setDate(expirationDate.getDate() + (daysUntilDeadline - nextReminder));
      } else {
        expirationDate.setDate(expirationDate.getDate() + 7);
      }
    }

    return expirationDate.toISOString();
  }

  /**
   * Mark deadline as complete
   */
  async markDeadlineComplete(
    tenantId: string,
    deadlineId: string,
    userId: string
  ): Promise<void> {
    await db
      .update(complianceDeadlines)
      .set({
        completedAt: new Date().toISOString(),
        completedBy: userId,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(complianceDeadlines.id, deadlineId),
          eq(complianceDeadlines.tenantId, tenantId)
        )
      );

    console.log(`[Compliance Alert] Deadline ${deadlineId} marked as complete`);
  }

  /**
   * Create upcoming deadlines for standard compliance requirements
   * This can be called during tenant onboarding or periodically
   */
  async initializeStandardDeadlines(
    tenantId: string,
    country: 'UAE' | 'KSA'
  ): Promise<void> {
    const currentYear = new Date().getFullYear();
    const standardDeadlines: any[] = [];

    if (country === 'UAE') {
      // UAE VAT Return (Quarterly)
      for (let quarter = 1; quarter <= 4; quarter++) {
        const dueDate = new Date(currentYear, quarter * 3, 28); // 28 days after quarter end
        standardDeadlines.push({
          tenantId,
          deadlineType: 'tax_filing',
          title: `UAE VAT Return Q${quarter} ${currentYear}`,
          description: `Federal Tax Authority VAT return filing for Q${quarter} ${currentYear}`,
          dueDate: dueDate.toISOString(),
          regulatoryAuthority: 'Federal Tax Authority (FTA)',
          penaltyAmount: 'AED 1,000 - 10,000 depending on delay',
          isRecurring: true,
          recurringPeriod: 'quarterly'
        });
      }

      // Corporate Tax Return (Annual)
      const corpTaxDue = new Date(currentYear + 1, 8, 30); // 9 months after year-end
      standardDeadlines.push({
        tenantId,
        deadlineType: 'tax_filing',
        title: `UAE Corporate Tax Return ${currentYear}`,
        description: `Corporate tax return filing for financial year ${currentYear}`,
        dueDate: corpTaxDue.toISOString(),
        regulatoryAuthority: 'Federal Tax Authority (FTA)',
        penaltyAmount: 'AED 500 - 50,000 depending on delay',
        isRecurring: true,
        recurringPeriod: 'yearly'
      });

      // E-invoicing Peppol (14-day transmission requirement)
      // This would be generated dynamically based on invoice dates
    }

    if (country === 'KSA') {
      // KSA VAT Return (Monthly)
      for (let month = 1; month <= 12; month++) {
        const dueDate = new Date(currentYear, month, 28);
        standardDeadlines.push({
          tenantId,
          deadlineType: 'tax_filing',
          title: `KSA VAT Return - ${new Date(currentYear, month - 1).toLocaleDateString('en-US', { month: 'long' })} ${currentYear}`,
          description: `ZATCA VAT return filing for ${new Date(currentYear, month - 1).toLocaleDateString('en-US', { month: 'long' })}`,
          dueDate: dueDate.toISOString(),
          regulatoryAuthority: 'ZATCA (Zakat, Tax and Customs Authority)',
          penaltyAmount: 'SAR 5,000 - 25,000 depending on delay',
          isRecurring: true,
          recurringPeriod: 'monthly'
        });
      }

      // Zakat Return (Annual)
      const zakatDue = new Date(currentYear, 11, 31); // End of calendar year
      standardDeadlines.push({
        tenantId,
        deadlineType: 'tax_filing',
        title: `KSA Zakat Return ${currentYear}`,
        description: `Zakat and corporate tax return filing for ${currentYear}`,
        dueDate: zakatDue.toISOString(),
        regulatoryAuthority: 'ZATCA',
        penaltyAmount: 'SAR 10,000 - 50,000 depending on delay',
        isRecurring: true,
        recurringPeriod: 'yearly'
      });
    }

    // Insert deadlines
    for (const deadline of standardDeadlines) {
      // Only insert if due date is in the future
      if (new Date(deadline.dueDate) > new Date()) {
        await db.insert(complianceDeadlines).values(deadline);
      }
    }

    console.log(`[Compliance Alert] Initialized ${standardDeadlines.length} standard deadlines for tenant ${tenantId}`);
  }
}

export const complianceAlertService = new ComplianceAlertService();
