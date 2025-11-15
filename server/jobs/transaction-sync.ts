import cron from 'node-cron';
import { db } from '../db';
import { tenants, openBankingConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { TransactionSyncService } from '../open-banking/transaction-sync-service';

let transactionSyncJob: cron.ScheduledTask | null = null;

/**
 * Initialize daily transaction sync job
 * Runs at 2 AM UTC every day
 */
export function initializeTransactionSync() {
  if (transactionSyncJob) {
    console.log('[TransactionSync] Job already initialized');
    return;
  }

  console.log('[TransactionSync] Initializing daily transaction sync job (2 AM UTC)');

  // Schedule job to run daily at 2 AM UTC
  transactionSyncJob = cron.schedule('0 2 * * *', async () => {
    console.log('[TransactionSync] Starting daily transaction sync...');
    await runTransactionSync();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[TransactionSync] Daily transaction sync job initialized');
}

/**
 * Stop the transaction sync job
 */
export function stopTransactionSync() {
  if (transactionSyncJob) {
    transactionSyncJob.stop();
    transactionSyncJob = null;
    console.log('[TransactionSync] Transaction sync job stopped');
  }
}

/**
 * Manually trigger transaction sync
 * Useful for testing or on-demand sync
 */
export async function runTransactionSync() {
  const startTime = new Date();
  console.log(`[TransactionSync] Starting transaction sync at ${startTime.toISOString()}`);

  try {
    // Get all tenants
    const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    console.log(`[TransactionSync] Found ${allTenants.length} tenants`);

    let totalTenantsProcessed = 0;
    let totalAccountsSynced = 0;
    let totalTransactionsSynced = 0;
    let totalErrors = 0;

    // Process each tenant
    for (const tenant of allTenants) {
      try {
        console.log(`[TransactionSync] Processing tenant: ${tenant.name} (${tenant.id})`);

        // Get active connections for this tenant
        const connections = await db
          .select()
          .from(openBankingConnections)
          .where(eq(openBankingConnections.tenantId, tenant.id));

        const activeConnections = connections.filter(c => c.status === 'active');
        
        console.log(`[TransactionSync] Tenant ${tenant.name}: ${activeConnections.length} active connections`);

        if (activeConnections.length === 0) {
          console.log(`[TransactionSync] Tenant ${tenant.name}: No active connections, skipping`);
          continue;
        }

        // Create sync service for this tenant
        const syncService = new TransactionSyncService(tenant.id);

        // Sync all accounts for this tenant
        try {
          await syncService.syncAllAccounts();
          totalTenantsProcessed++;
          console.log(`[TransactionSync] Tenant ${tenant.name}: Sync completed successfully`);
        } catch (error) {
          totalErrors++;
          console.error(`[TransactionSync] Tenant ${tenant.name}: Sync failed:`, error);
        }

      } catch (error) {
        totalErrors++;
        console.error(`[TransactionSync] Error processing tenant ${tenant.name}:`, error);
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log(`[TransactionSync] Transaction sync complete`, {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds: duration,
      totalTenants: allTenants.length,
      tenantsProcessed: totalTenantsProcessed,
      errors: totalErrors,
    });

  } catch (error) {
    console.error('[TransactionSync] Fatal error during transaction sync:', error);
    throw error;
  }
}

/**
 * Get the status of the transaction sync job
 */
export function getTransactionSyncStatus() {
  return {
    isRunning: transactionSyncJob !== null,
    schedule: '0 2 * * *', // 2 AM UTC daily
    timezone: 'UTC',
    nextRun: transactionSyncJob ? 'Next run at 2:00 AM UTC' : 'Not scheduled',
  };
}
