/**
 * Example usage of system accounts seeder
 * This file demonstrates how to use the seedSystemAccounts function
 * 
 * USAGE:
 * 
 * 1. Import the seeder:
 *    import { seedSystemAccounts } from './server/accounting/system-accounts';
 * 
 * 2. Call it when creating a new tenant:
 *    await seedSystemAccounts(newTenant.id);
 * 
 * 3. Idempotency: Safe to run multiple times
 *    await seedSystemAccounts(tenantId); // First run: creates all accounts
 *    await seedSystemAccounts(tenantId); // Second run: skips all, no errors
 * 
 * EXAMPLE INTEGRATION:
 */

import { seedSystemAccounts, hasSystemAccounts, getSystemAccountDefinitions } from './system-accounts';

/**
 * Example: Seed accounts when creating a new tenant
 */
async function onTenantCreated(tenantId: string) {
  console.log(`New tenant created: ${tenantId}`);
  
  try {
    // Seed system accounts
    await seedSystemAccounts(tenantId);
    console.log('✓ System accounts seeded successfully');
  } catch (error) {
    console.error('✗ Failed to seed system accounts:', error);
    // Handle error (e.g., notify admin, rollback tenant creation)
    throw error;
  }
}

/**
 * Example: Check if tenant has system accounts before operations
 */
async function ensureSystemAccountsExist(tenantId: string) {
  const exists = await hasSystemAccounts(tenantId);
  
  if (!exists) {
    console.log('System accounts not found, seeding...');
    await seedSystemAccounts(tenantId);
  } else {
    console.log('System accounts already exist');
  }
}

/**
 * Example: Get account definitions for documentation
 */
function documentSystemAccounts() {
  const accounts = getSystemAccountDefinitions();
  
  console.log('Standard Chart of Accounts:');
  console.log('===========================');
  
  for (const account of accounts) {
    console.log(`${account.code} - ${account.name}`);
    console.log(`  Type: ${account.type}`);
    console.log(`  Normal Balance: ${account.normalBalance}`);
    console.log(`  Description: ${account.description}`);
    console.log('');
  }
}

/**
 * INTEGRATION POINT: Add to tenant creation route
 * 
 * In server/routes.ts:
 * 
 * app.post('/api/tenants', async (req, res) => {
 *   try {
 *     const newTenant = await storage.createTenant({
 *       name: req.body.name,
 *       ownerId: req.user.id,
 *     });
 *     
 *     // Seed system accounts for new tenant
 *     await seedSystemAccounts(newTenant.id);
 *     
 *     return res.json(newTenant);
 *   } catch (error) {
 *     return res.status(500).json({ error: error.message });
 *   }
 * });
 */

export {
  onTenantCreated,
  ensureSystemAccountsExist,
  documentSystemAccounts,
};
