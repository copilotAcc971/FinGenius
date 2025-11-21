/**
 * Alert Services - Comprehensive Alert Engine
 * 
 * This module provides alert services for proactive financial monitoring:
 * 
 * 1. Cash Deficiency Forecasting: Analyze cash flow and project shortfalls
 * 2. Aged AR/AP Alerts: Monitor overdue receivables and payables
 * 3. Pending Approvals Aggregator: Daily digest of items needing approval
 * 4. Month-End Closing Checklist: Automated month-end closing workflow
 * 5. Accruals Detector: AI-powered accrual opportunity detection
 * 6. Compliance Deadline Tracker: Multi-stage reminder system for regulatory deadlines
 * 7. Anomaly Detection: ML-based transaction fraud and error detection
 * 8. Alert Dispatcher: Unified multi-channel alert delivery system
 */

export { cashDeficiencyAlertService, CashDeficiencyAlertService } from './cash-deficiency-alert';
export { agingAlertService, AgingAlertService } from './aging-alert';
export { pendingApprovalsAlertService, PendingApprovalsAlertService } from './pending-approvals-alert';
export { monthEndAlertService, MonthEndAlertService } from './month-end-alert';
export { accrualsAlertService, AccrualsAlertService } from './accruals-alert';
export { complianceAlertService, ComplianceAlertService } from './compliance-alert';
export { anomalyDetectionAlertService, AnomalyDetectionAlertService } from './anomaly-detection-alert';
export { alertDispatcherService, AlertDispatcherService } from './alert-dispatcher';

/**
 * Run all alert services for a tenant
 * This should be called daily via cron job
 */
export async function runAllAlerts(tenantId: string): Promise<void> {
  const { 
    cashDeficiencyAlertService, 
    agingAlertService, 
    pendingApprovalsAlertService,
    monthEndAlertService,
    accrualsAlertService,
    complianceAlertService,
    anomalyDetectionAlertService,
    alertDispatcherService
  } = await import('./index');

  try {
    // Run cash deficiency analysis (7-day and 30-day forecasts)
    await cashDeficiencyAlertService.analyzeCashPosition(tenantId, 7);
    await cashDeficiencyAlertService.analyzeCashPosition(tenantId, 30);

    // Analyze aged receivables and payables
    await agingAlertService.analyzeAgedReceivables(tenantId);
    await agingAlertService.analyzeAgedPayables(tenantId);

    // Generate pending approvals digest
    await pendingApprovalsAlertService.scheduleDailyDigest(tenantId);

    // Update month-end checklist progress
    const currentChecklist = await monthEndAlertService.getCurrentMonthEndChecklist(tenantId);
    if (currentChecklist) {
      await monthEndAlertService.updateChecklistProgress(tenantId, currentChecklist.id);
    }

    // Detect accrual opportunities (period-end analysis)
    const today = new Date();
    await accrualsAlertService.detectAccrualOpportunities(tenantId, today);

    // Track compliance deadlines
    await complianceAlertService.trackDeadlines(tenantId);

    // Analyze transactions for anomalies (90-day lookback)
    await anomalyDetectionAlertService.analyzeTransactions(tenantId, 90);

    // Dispatch all new alerts
    await alertDispatcherService.dispatchNewAlerts(tenantId);

  } catch (error) {
    console.error(`[Alert Engine] Error running alerts for tenant ${tenantId}:`, error);
    throw error;
  }
}
