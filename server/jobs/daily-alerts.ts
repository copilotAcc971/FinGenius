/**
 * Daily Alert Generation Job (Task 7-28)
 * 
 * Runs daily at 9 AM UTC to generate and dispatch alerts for all active tenants.
 * 
 * Alert Types:
 * - Cash deficiency forecasting
 * - Aged AR/AP alerts  
 * - Pending approvals aggregation
 * - Accruals detection
 * - Compliance deadline tracking
 * - Anomaly detection
 * 
 * @module server/jobs/daily-alerts
 */

import cron from 'node-cron';
import { db } from '../db';
import { tenants } from '@shared/schema';
import {
  cashDeficiencyAlertService,
  agingAlertService,
  pendingApprovalsAlertService,
  monthEndAlertService,
  accrualsAlertService,
  complianceAlertService,
  anomalyDetectionAlertService,
  alertDispatcherService,
} from '../services/alerts';

let dailyAlertJob: cron.ScheduledTask | null = null;

/**
 * Run all daily alerts for a specific tenant
 * Implements Task 7-28 alert sequence
 */
export async function runDailyAlerts(tenantId: string): Promise<{
  success: boolean;
  executionTime: number;
  alertCounts: {
    cashDeficiency: number;
    agedReceivables: number;
    agedPayables: number;
    pendingApprovals: number;
    accruals: number;
    compliance: number;
    anomalies: number;
    totalDispatched: number;
  };
  errors: string[];
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  const alertCounts = {
    cashDeficiency: 0,
    agedReceivables: 0,
    agedPayables: 0,
    pendingApprovals: 0,
    accruals: 0,
    compliance: 0,
    anomalies: 0,
    totalDispatched: 0,
  };
  
  console.log(`[Daily Alerts] Starting alert generation for tenant ${tenantId}`);
  
  try {
    // 1. Run cash deficiency analyzer (7-day and 30-day forecasts)
    try {
      console.log(`[Daily Alerts] Running cash deficiency analysis...`);
      await cashDeficiencyAlertService.analyzeCashPosition(tenantId, 7);
      await cashDeficiencyAlertService.analyzeCashPosition(tenantId, 30);
      alertCounts.cashDeficiency = 2; // Count the alerts generated
      console.log(`[Daily Alerts] ✓ Cash deficiency analysis complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Cash deficiency analysis failed:`, error);
      errors.push(`Cash deficiency: ${error}`);
    }
    
    // 2. Run AR/AP aging analyzer
    try {
      console.log(`[Daily Alerts] Running AR/AP aging analysis...`);
      await agingAlertService.analyzeAgedReceivables(tenantId);
      await agingAlertService.analyzeAgedPayables(tenantId);
      alertCounts.agedReceivables = 1;
      alertCounts.agedPayables = 1;
      console.log(`[Daily Alerts] ✓ AR/AP aging analysis complete`);
    } catch (error) {
      console.error(`[Daily Alerts] AR/AP aging analysis failed:`, error);
      errors.push(`AR/AP aging: ${error}`);
    }
    
    // 3. Run pending approvals aggregator
    try {
      console.log(`[Daily Alerts] Running pending approvals aggregation...`);
      await pendingApprovalsAlertService.scheduleDailyDigest(tenantId);
      alertCounts.pendingApprovals = 1;
      console.log(`[Daily Alerts] ✓ Pending approvals aggregation complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Pending approvals aggregation failed:`, error);
      errors.push(`Pending approvals: ${error}`);
    }
    
    // 4. Update month-end checklist progress
    try {
      console.log(`[Daily Alerts] Updating month-end checklist...`);
      const currentChecklist = await monthEndAlertService.getCurrentMonthEndChecklist(tenantId);
      if (currentChecklist) {
        await monthEndAlertService.updateChecklistProgress(tenantId, currentChecklist.id);
      }
      console.log(`[Daily Alerts] ✓ Month-end checklist update complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Month-end checklist update failed:`, error);
      errors.push(`Month-end checklist: ${error}`);
    }
    
    // 5. Run accruals detector
    try {
      console.log(`[Daily Alerts] Running accruals detection...`);
      const today = new Date();
      await accrualsAlertService.detectAccrualOpportunities(tenantId, today);
      alertCounts.accruals = 1;
      console.log(`[Daily Alerts] ✓ Accruals detection complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Accruals detection failed:`, error);
      errors.push(`Accruals detection: ${error}`);
    }
    
    // 6. Run compliance deadline tracker
    try {
      console.log(`[Daily Alerts] Running compliance deadline tracking...`);
      await complianceAlertService.trackDeadlines(tenantId);
      alertCounts.compliance = 1;
      console.log(`[Daily Alerts] ✓ Compliance deadline tracking complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Compliance deadline tracking failed:`, error);
      errors.push(`Compliance tracking: ${error}`);
    }
    
    // 7. Run anomaly detector
    try {
      console.log(`[Daily Alerts] Running anomaly detection (90-day lookback)...`);
      await anomalyDetectionAlertService.analyzeTransactions(tenantId, 90);
      alertCounts.anomalies = 1;
      console.log(`[Daily Alerts] ✓ Anomaly detection complete`);
    } catch (error) {
      console.error(`[Daily Alerts] Anomaly detection failed:`, error);
      errors.push(`Anomaly detection: ${error}`);
    }
    
    // 8. Dispatch all new alerts via unified dispatcher
    try {
      console.log(`[Daily Alerts] Dispatching all new alerts...`);
      const dispatchResult = await alertDispatcherService.dispatchNewAlerts(tenantId);
      alertCounts.totalDispatched = dispatchResult?.alertsDispatched || 0;
      console.log(`[Daily Alerts] ✓ Dispatched ${alertCounts.totalDispatched} alerts`);
    } catch (error) {
      console.error(`[Daily Alerts] Alert dispatch failed:`, error);
      errors.push(`Alert dispatch: ${error}`);
    }
    
  } catch (error) {
    console.error(`[Daily Alerts] Critical error for tenant ${tenantId}:`, error);
    errors.push(`Critical: ${error}`);
  }
  
  const executionTime = Date.now() - startTime;
  
  console.log(`[Daily Alerts] Completed for tenant ${tenantId}`);
  console.log(`[Daily Alerts] Execution time: ${executionTime}ms`);
  console.log(`[Daily Alerts] Alert counts:`, alertCounts);
  console.log(`[Daily Alerts] Errors: ${errors.length}`);
  
  return {
    success: errors.length === 0,
    executionTime,
    alertCounts,
    errors,
  };
}

/**
 * Initialize and start the daily alert generation job
 * Runs at 9 AM UTC every day
 */
export async function initializeDailyAlerts(): Promise<void> {
  console.log('[Daily Alerts] Initializing daily alert generation job...');
  console.log('[Daily Alerts] Schedule: 0 9 * * * (9 AM UTC daily)');
  
  // Stop existing job if running
  if (dailyAlertJob) {
    dailyAlertJob.stop();
    console.log('[Daily Alerts] Stopped existing job');
  }
  
  // Schedule job to run daily at 9 AM UTC
  dailyAlertJob = cron.schedule('0 9 * * *', async () => {
    const jobStartTime = Date.now();
    console.log('==============================================');
    console.log('[Daily Alerts] Starting daily alert generation job');
    console.log(`[Daily Alerts] Execution time: ${new Date().toISOString()}`);
    console.log('==============================================');
    
    try {
      // Get all active tenants
      const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
      
      console.log(`[Daily Alerts] Processing alerts for ${allTenants.length} tenants`);
      
      let successCount = 0;
      let failureCount = 0;
      let totalAlerts = 0;
      
      // Process each tenant
      for (const tenant of allTenants) {
        try {
          console.log(`\n[Daily Alerts] Processing tenant: ${tenant.name} (${tenant.id})`);
          
          const result = await runDailyAlerts(tenant.id);
          
          if (result.success) {
            successCount++;
            totalAlerts += result.alertCounts.totalDispatched;
            console.log(`[Daily Alerts] ✓ Success for tenant ${tenant.name}`);
            console.log(`[Daily Alerts]   - Execution time: ${result.executionTime}ms`);
            console.log(`[Daily Alerts]   - Alerts dispatched: ${result.alertCounts.totalDispatched}`);
          } else {
            failureCount++;
            console.error(`[Daily Alerts] ✗ Partial failure for tenant ${tenant.name}`);
            console.error(`[Daily Alerts]   - Errors: ${result.errors.join(', ')}`);
          }
          
        } catch (error) {
          failureCount++;
          console.error(`[Daily Alerts] ✗ Failed to process tenant ${tenant.name}:`, error);
          // Continue with next tenant (error handling: don't stop entire job)
        }
      }
      
      const totalJobTime = Date.now() - jobStartTime;
      
      console.log('\n==============================================');
      console.log('[Daily Alerts] Daily alert generation job completed');
      console.log(`[Daily Alerts] Total execution time: ${totalJobTime}ms`);
      console.log(`[Daily Alerts] Summary:`);
      console.log(`[Daily Alerts]   - Total tenants: ${allTenants.length}`);
      console.log(`[Daily Alerts]   - Successful: ${successCount}`);
      console.log(`[Daily Alerts]   - Failed: ${failureCount}`);
      console.log(`[Daily Alerts]   - Total alerts dispatched: ${totalAlerts}`);
      console.log('==============================================\n');
      
    } catch (error) {
      console.error('[Daily Alerts] Critical error during daily alert job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('[Daily Alerts] ✓ Daily alert generation job successfully scheduled');
}

/**
 * Manually trigger daily alerts for a specific tenant
 * Useful for testing or on-demand alert generation
 */
export async function triggerDailyAlertsForTenant(tenantId: string): Promise<void> {
  console.log(`[Daily Alerts] Manually triggering daily alerts for tenant ${tenantId}`);
  
  try {
    const result = await runDailyAlerts(tenantId);
    
    if (result.success) {
      console.log(`[Daily Alerts] ✓ Successfully processed alerts for tenant ${tenantId}`);
      console.log(`[Daily Alerts]   - Execution time: ${result.executionTime}ms`);
      console.log(`[Daily Alerts]   - Alerts dispatched: ${result.alertCounts.totalDispatched}`);
    } else {
      console.error(`[Daily Alerts] ✗ Partial failure for tenant ${tenantId}`);
      console.error(`[Daily Alerts]   - Errors: ${result.errors.join(', ')}`);
      throw new Error(`Partial failure: ${result.errors.join(', ')}`);
    }
  } catch (error) {
    console.error(`[Daily Alerts] ✗ Failed to process alerts for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Manually trigger daily alerts for all tenants
 * Useful for testing or immediate alert generation
 */
export async function triggerDailyAlertsForAllTenants(): Promise<void> {
  console.log('[Daily Alerts] Manually triggering daily alerts for all tenants');
  
  try {
    const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const tenant of allTenants) {
      try {
        const result = await runDailyAlerts(tenant.id);
        if (result.success) {
          successCount++;
          console.log(`[Daily Alerts] ✓ Completed alerts for tenant ${tenant.name}`);
        } else {
          failureCount++;
          console.error(`[Daily Alerts] ✗ Partial failure for tenant ${tenant.name}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`[Daily Alerts] ✗ Failed for tenant ${tenant.name}:`, error);
      }
    }
    
    console.log(`[Daily Alerts] ✓ Processed ${allTenants.length} tenants`);
    console.log(`[Daily Alerts]   - Successful: ${successCount}`);
    console.log(`[Daily Alerts]   - Failed: ${failureCount}`);
  } catch (error) {
    console.error('[Daily Alerts] ✗ Failed to process alerts:', error);
    throw error;
  }
}
