import cron from 'node-cron';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { runAllAlerts } from '../services/alerts';

/**
 * Alert Engine Cron Job
 * 
 * Runs daily at 9 AM UTC to:
 * - Analyze cash deficiency forecasts
 * - Generate aged AR/AP alerts
 * - Create pending approvals digest
 * - Update month-end checklists
 */

let alertEngineJob: cron.ScheduledTask | null = null;

export async function initializeAlertEngine() {
  console.log('[Alert Engine] Initializing daily alert engine job...');
  console.log('[Alert Engine] Schedule: 0 9 * * * (9 AM UTC daily)');

  // Stop existing job if running
  if (alertEngineJob) {
    alertEngineJob.stop();
  }

  // Schedule job to run daily at 9 AM UTC
  alertEngineJob = cron.schedule('0 9 * * *', async () => {
    console.log('[Alert Engine] Starting daily alert processing...');
    
    try {
      // Get all active tenants
      const allTenants = await db.select({ id: tenants.id }).from(tenants);
      
      console.log(`[Alert Engine] Processing alerts for ${allTenants.length} tenants`);
      
      // Run alerts for each tenant
      for (const tenant of allTenants) {
        try {
          await runAllAlerts(tenant.id);
          console.log(`[Alert Engine] ✓ Completed alerts for tenant ${tenant.id}`);
        } catch (error) {
          console.error(`[Alert Engine] ✗ Failed to process alerts for tenant ${tenant.id}:`, error);
        }
      }
      
      console.log('[Alert Engine] Daily alert processing complete');
    } catch (error) {
      console.error('[Alert Engine] Critical error during alert processing:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[Alert Engine] ✓ Daily alert engine job successfully scheduled');
}

/**
 * Manually trigger alerts for a specific tenant
 * Useful for testing or on-demand alert generation
 */
export async function triggerAlertsForTenant(tenantId: string): Promise<void> {
  console.log(`[Alert Engine] Manually triggering alerts for tenant ${tenantId}`);
  
  try {
    await runAllAlerts(tenantId);
    console.log(`[Alert Engine] ✓ Successfully processed alerts for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[Alert Engine] ✗ Failed to process alerts for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Manually trigger alerts for all tenants
 * Useful for testing or immediate alert generation
 */
export async function triggerAlertsForAllTenants(): Promise<void> {
  console.log('[Alert Engine] Manually triggering alerts for all tenants');
  
  try {
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    
    for (const tenant of allTenants) {
      try {
        await runAllAlerts(tenant.id);
        console.log(`[Alert Engine] ✓ Completed alerts for tenant ${tenant.id}`);
      } catch (error) {
        console.error(`[Alert Engine] ✗ Failed for tenant ${tenant.id}:`, error);
      }
    }
    
    console.log('[Alert Engine] ✓ Successfully processed alerts for all tenants');
  } catch (error) {
    console.error('[Alert Engine] ✗ Failed to process alerts:', error);
    throw error;
  }
}
