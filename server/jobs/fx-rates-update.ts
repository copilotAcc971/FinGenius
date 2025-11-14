import cron from 'node-cron';
import { storage } from '../storage';
import { updateExchangeRatesForTenant } from '../services/fx-rates';

let jobStarted = false;

/**
 * Start the scheduled FX rates update job
 * Runs daily at 6 AM UTC (after central banks publish rates)
 */
export function startFXRatesUpdateJob(): void {
  if (jobStarted) {
    console.log('FX rates update job already started');
    return;
  }

  console.log('Initializing FX rates update cron job (runs daily at 6 AM UTC)...');

  // Run daily at 6 AM UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('==============================================');
    console.log('Starting daily FX rates update job...');
    console.log(`Execution time: ${new Date().toISOString()}`);
    console.log('==============================================');

    try {
      // Get all tenants that have multi-currency enabled
      const allTenants = await getAllTenantsWithMultiCurrency();

      if (allTenants.length === 0) {
        console.log('No tenants with multi-currency support found');
        return;
      }

      console.log(`Found ${allTenants.length} tenants with multi-currency support`);

      let successCount = 0;
      let failureCount = 0;

      for (const tenant of allTenants) {
        try {
          console.log(`\nUpdating rates for tenant: ${tenant.name} (${tenant.id})...`);
          await updateExchangeRatesForTenant(tenant.id);
          successCount++;
          console.log(`✓ Successfully updated rates for tenant ${tenant.name}`);
        } catch (error) {
          failureCount++;
          console.error(`✗ Failed to update rates for tenant ${tenant.name}:`, error);
          
          // In production, you would send alert notifications here
          // Example: await sendAlertEmail(tenant.ownerId, `FX rate update failed for ${tenant.name}`);
        }
      }

      console.log('\n==============================================');
      console.log('Daily FX rates update job completed');
      console.log(`Summary: ${successCount} succeeded, ${failureCount} failed`);
      console.log('==============================================\n');
    } catch (error) {
      console.error('Critical error in FX rates update job:', error);
    }
  });

  jobStarted = true;
  console.log('✓ FX rates update job successfully scheduled');
}

/**
 * Get all tenants that have multi-currency support enabled
 * (i.e., tenants that have more than one active currency)
 */
async function getAllTenantsWithMultiCurrency(): Promise<Array<{ id: string; name: string }>> {
  try {
    // Get all currencies grouped by tenant
    const allCurrencies = await storage.getAllCurrenciesGroupedByTenant();
    
    const tenantsWithMultiCurrency: Array<{ id: string; name: string }> = [];

    for (const [tenantId, currencies] of Object.entries(allCurrencies)) {
      const activeCurrencies = currencies.filter((c: any) => c.isActive);
      
      // Only include tenants with 2+ active currencies
      if (activeCurrencies.length >= 2) {
        const tenant = await storage.getTenant(tenantId);
        if (tenant) {
          tenantsWithMultiCurrency.push({
            id: tenant.id,
            name: tenant.name,
          });
        }
      }
    }

    return tenantsWithMultiCurrency;
  } catch (error) {
    console.error('Error getting tenants with multi-currency:', error);
    return [];
  }
}

/**
 * Manually trigger FX rates update for all tenants
 * Useful for testing or immediate updates
 */
export async function triggerManualFXRatesUpdate(): Promise<{
  success: boolean;
  tenantsUpdated: number;
  errors: string[];
}> {
  console.log('Manually triggering FX rates update for all tenants...');

  const errors: string[] = [];
  const allTenants = await getAllTenantsWithMultiCurrency();

  if (allTenants.length === 0) {
    return {
      success: true,
      tenantsUpdated: 0,
      errors: ['No tenants with multi-currency support found'],
    };
  }

  let tenantsUpdated = 0;

  for (const tenant of allTenants) {
    try {
      await updateExchangeRatesForTenant(tenant.id);
      tenantsUpdated++;
    } catch (error) {
      const errorMsg = `Failed to update tenant ${tenant.name}: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    tenantsUpdated,
    errors,
  };
}
