import { db } from '../../db';
import { 
  bankAccounts, 
  invoices, 
  bills, 
  expenses,
  alertInstances,
  type InsertAlertInstance 
} from '@shared/schema';
import { eq, and, gte, lte, isNull, or, sql } from 'drizzle-orm';

interface CashFlowProjection {
  date: Date;
  projectedBalance: number;
  inflows: number;
  outflows: number;
  cumulativeFlow: number;
}

interface CashDeficiencyAlert {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  shortfallDate: Date | null;
  projectedShortfall: number;
  currentCashBalance: number;
  projections: CashFlowProjection[];
}

export class CashDeficiencyAlertService {
  /**
   * Analyze cash position and create alerts if deficiency is projected
   * @param tenantId - Tenant to analyze
   * @param forecastDays - Number of days to forecast (default: 30)
   * @param thresholds - Custom alert thresholds
   */
  async analyzeCashPosition(
    tenantId: string,
    forecastDays: number = 30,
    thresholds = {
      critical: 5000,
      warning: 10000,
      info: 20000
    }
  ): Promise<CashDeficiencyAlert | null> {
    // Step 1: Get current cash balance from all bank accounts
    const currentCashBalance = await this.getCurrentCashBalance(tenantId);

    // Step 2: Get expected cash inflows (unpaid invoices by due date)
    const expectedInflows = await this.getExpectedInflows(tenantId, forecastDays);

    // Step 3: Get expected cash outflows (unpaid bills by due date)
    const expectedOutflows = await this.getExpectedOutflows(tenantId, forecastDays);

    // Step 4: Calculate daily net cash flow projections
    const projections = this.calculateDailyProjections(
      currentCashBalance,
      expectedInflows,
      expectedOutflows,
      forecastDays
    );

    // Step 5: Identify shortfall dates and severity
    const shortfall = this.identifyShortfall(projections, thresholds);

    if (!shortfall) {
      return null; // No deficiency projected
    }

    // Step 6: Create alert based on severity
    const alert = this.createDeficiencyAlert(
      shortfall,
      currentCashBalance,
      projections,
      thresholds
    );

    // Step 7: Save alert instance to database
    if (alert) {
      await this.saveAlertInstance(tenantId, alert);
    }

    return alert;
  }

  /**
   * Get current total cash balance across all active bank accounts
   */
  private async getCurrentCashBalance(tenantId: string): Promise<number> {
    const accounts = await db
      .select({
        balance: bankAccounts.balance,
        availableBalance: bankAccounts.availableBalance
      })
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.tenantId, tenantId),
          eq(bankAccounts.status, 'active')
        )
      );

    const totalBalance = accounts.reduce((sum, account) => {
      const balance = parseFloat(account.availableBalance || account.balance || '0');
      return sum + balance;
    }, 0);

    return totalBalance;
  }

  /**
   * Get expected cash inflows from unpaid/partially paid invoices
   */
  private async getExpectedInflows(
    tenantId: string,
    forecastDays: number
  ): Promise<Map<string, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + forecastDays);

    const unpaidInvoices = await db
      .select({
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          or(
            eq(invoices.status, 'sent'),
            eq(invoices.status, 'overdue'),
            eq(invoices.status, 'partial')
          ),
          gte(invoices.dueDate, today.toISOString()),
          lte(invoices.dueDate, endDate.toISOString())
        )
      );

    const inflowsByDate = new Map<string, number>();

    for (const invoice of unpaidInvoices) {
      const dateKey = new Date(invoice.dueDate).toISOString().split('T')[0];
      const amountDue = parseFloat(invoice.totalAmount || '0') - parseFloat(invoice.amountPaid || '0');
      
      inflowsByDate.set(
        dateKey,
        (inflowsByDate.get(dateKey) || 0) + amountDue
      );
    }

    return inflowsByDate;
  }

  /**
   * Get expected cash outflows from unpaid bills and pending expenses
   */
  private async getExpectedOutflows(
    tenantId: string,
    forecastDays: number
  ): Promise<Map<string, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + forecastDays);

    // Get unpaid bills
    const unpaidBills = await db
      .select({
        dueDate: bills.dueDate,
        totalAmount: bills.totalAmount
      })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, tenantId),
          or(
            eq(bills.status, 'unpaid'),
            eq(bills.status, 'scheduled')
          ),
          gte(bills.dueDate, today.toISOString()),
          lte(bills.dueDate, endDate.toISOString())
        )
      );

    // Get approved expenses pending reimbursement
    const pendingExpenses = await db
      .select({
        date: expenses.date,
        amount: expenses.amount
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.tenantId, tenantId),
          eq(expenses.status, 'approved'),
          isNull(expenses.reimbursedAt),
          gte(expenses.date, today.toISOString()),
          lte(expenses.date, endDate.toISOString())
        )
      );

    const outflowsByDate = new Map<string, number>();

    for (const bill of unpaidBills) {
      const dateKey = new Date(bill.dueDate).toISOString().split('T')[0];
      const amount = parseFloat(bill.totalAmount || '0');
      
      outflowsByDate.set(
        dateKey,
        (outflowsByDate.get(dateKey) || 0) + amount
      );
    }

    for (const expense of pendingExpenses) {
      const dateKey = new Date(expense.date).toISOString().split('T')[0];
      const amount = parseFloat(expense.amount || '0');
      
      outflowsByDate.set(
        dateKey,
        (outflowsByDate.get(dateKey) || 0) + amount
      );
    }

    return outflowsByDate;
  }

  /**
   * Calculate daily cash flow projections
   */
  private calculateDailyProjections(
    startingBalance: number,
    inflows: Map<string, number>,
    outflows: Map<string, number>,
    forecastDays: number
  ): CashFlowProjection[] {
    const projections: CashFlowProjection[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let runningBalance = startingBalance;

    for (let i = 0; i <= forecastDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];

      const dayInflows = inflows.get(dateKey) || 0;
      const dayOutflows = outflows.get(dateKey) || 0;
      const netFlow = dayInflows - dayOutflows;
      
      runningBalance += netFlow;

      projections.push({
        date,
        projectedBalance: runningBalance,
        inflows: dayInflows,
        outflows: dayOutflows,
        cumulativeFlow: netFlow
      });
    }

    return projections;
  }

  /**
   * Identify the first date when cash falls below threshold
   */
  private identifyShortfall(
    projections: CashFlowProjection[],
    thresholds: { critical: number; warning: number; info: number }
  ): { date: Date; amount: number; severity: 'critical' | 'high' | 'medium' } | null {
    for (const projection of projections) {
      if (projection.projectedBalance < thresholds.critical) {
        return {
          date: projection.date,
          amount: projection.projectedBalance,
          severity: 'critical'
        };
      } else if (projection.projectedBalance < thresholds.warning) {
        return {
          date: projection.date,
          amount: projection.projectedBalance,
          severity: 'high'
        };
      } else if (projection.projectedBalance < thresholds.info) {
        return {
          date: projection.date,
          amount: projection.projectedBalance,
          severity: 'medium'
        };
      }
    }

    return null;
  }

  /**
   * Create a detailed deficiency alert
   */
  private createDeficiencyAlert(
    shortfall: { date: Date; amount: number; severity: 'critical' | 'high' | 'medium' },
    currentBalance: number,
    projections: CashFlowProjection[],
    thresholds: any
  ): CashDeficiencyAlert {
    const daysUntilShortfall = Math.ceil(
      (shortfall.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    let title = '';
    let message = '';

    switch (shortfall.severity) {
      case 'critical':
        title = '🚨 Critical Cash Deficiency Alert';
        message = `Your cash balance is projected to fall below $${thresholds.critical.toLocaleString()} ` +
          `in ${daysUntilShortfall} days (${shortfall.date.toLocaleDateString()}). ` +
          `Projected balance: $${shortfall.amount.toLocaleString()}. ` +
          `Current balance: $${currentBalance.toLocaleString()}. ` +
          `Immediate action required to avoid cash shortfall.`;
        break;
      case 'high':
        title = '⚠️ Cash Deficiency Warning';
        message = `Your cash balance is projected to fall below $${thresholds.warning.toLocaleString()} ` +
          `in ${daysUntilShortfall} days (${shortfall.date.toLocaleDateString()}). ` +
          `Projected balance: $${shortfall.amount.toLocaleString()}. ` +
          `Current balance: $${currentBalance.toLocaleString()}. ` +
          `Review upcoming expenses and accelerate collections.`;
        break;
      case 'medium':
        title = 'ℹ️ Cash Flow Advisory';
        message = `Your cash balance is projected to fall below $${thresholds.info.toLocaleString()} ` +
          `in ${daysUntilShortfall} days (${shortfall.date.toLocaleDateString()}). ` +
          `Projected balance: $${shortfall.amount.toLocaleString()}. ` +
          `Current balance: $${currentBalance.toLocaleString()}. ` +
          `Monitor cash flow closely.`;
        break;
    }

    return {
      priority: shortfall.severity === 'critical' ? 'critical' : shortfall.severity === 'high' ? 'high' : 'medium',
      title,
      message,
      shortfallDate: shortfall.date,
      projectedShortfall: shortfall.amount,
      currentCashBalance: currentBalance,
      projections
    };
  }

  /**
   * Save alert instance to database
   */
  private async saveAlertInstance(
    tenantId: string,
    alert: CashDeficiencyAlert
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Alert expires in 7 days

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'cash_deficiency',
      priority: alert.priority,
      title: alert.title,
      message: alert.message,
      actionUrl: '/banking/reconciliations',
      quickActions: [
        { label: 'View Cash Flow', action: 'navigate', params: { url: '/banking/reconciliations' } },
        { label: 'Review Invoices', action: 'navigate', params: { url: '/invoices' } },
        { label: 'Review Bills', action: 'navigate', params: { url: '/bills' } }
      ],
      metadata: {
        shortfallDate: alert.shortfallDate?.toISOString(),
        projectedShortfall: alert.projectedShortfall,
        currentCashBalance: alert.currentCashBalance,
        projectionCount: alert.projections.length
      },
      status: 'new',
      expiresAt: expiresAt.toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Get average daily expenses over the last 30 days
   */
  async getAverageDailyExpenses(tenantId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${bills.totalAmount} AS DECIMAL)), 0)`
      })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, thirtyDaysAgo.toISOString())
        )
      );

    const totalExpenses = parseFloat(result[0]?.total || '0');
    return totalExpenses / 30;
  }
}

export const cashDeficiencyAlertService = new CashDeficiencyAlertService();
