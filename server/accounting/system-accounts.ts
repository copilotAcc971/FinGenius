import { db } from '../db';
import { accounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ConfigurationError, ValidationError, logError } from './errors';

/**
 * Standard system account definition
 * These accounts form the foundational Chart of Accounts for every tenant
 */
interface SystemAccountDefinition {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  accountCategory: string;
  description: string;
  normalBalance: 'debit' | 'credit';
}

/**
 * Standard Chart of Accounts
 * 
 * Account Code Ranges:
 * - 1000-1999: Assets
 * - 2000-2999: Liabilities
 * - 3000-3999: Equity
 * - 4000-4999: Income/Revenue
 * - 5000-5999: Expenses
 * 
 * Normal Balance Convention:
 * - Assets & Expenses: Debit balance
 * - Liabilities, Equity & Income: Credit balance
 * - Contra-accounts (e.g., Accumulated Depreciation): Opposite of parent account type
 */
const SYSTEM_ACCOUNTS: SystemAccountDefinition[] = [
  // ============================================
  // ASSETS (1000-1999)
  // Normal Balance: Debit
  // ============================================
  {
    code: '1000',
    name: 'Cash',
    type: 'asset',
    accountCategory: 'Current Assets',
    description: 'Cash on hand and in bank accounts. Used for all cash transactions.',
    normalBalance: 'debit',
  },
  {
    code: '1200',
    name: 'Accounts Receivable',
    type: 'asset',
    accountCategory: 'Current Assets',
    description: 'Money owed by customers for goods/services delivered on credit. Tracks outstanding invoices.',
    normalBalance: 'debit',
  },
  {
    code: '1300',
    name: 'Inventory',
    type: 'asset',
    accountCategory: 'Current Assets',
    description: 'Value of goods held for sale. Tracks stock on hand at cost.',
    normalBalance: 'debit',
  },
  {
    code: '1500',
    name: 'Fixed Assets',
    type: 'asset',
    accountCategory: 'Non-Current Assets',
    description: 'Long-term tangible assets like equipment, vehicles, buildings. Recorded at cost.',
    normalBalance: 'debit',
  },
  {
    code: '1510',
    name: 'Accumulated Depreciation',
    type: 'asset',
    accountCategory: 'Non-Current Assets',
    description: 'Contra-asset account tracking cumulative depreciation of fixed assets. Reduces asset value on balance sheet.',
    normalBalance: 'credit',
  },

  // ============================================
  // LIABILITIES (2000-2999)
  // Normal Balance: Credit
  // ============================================
  {
    code: '2000',
    name: 'Accounts Payable',
    type: 'liability',
    accountCategory: 'Current Liabilities',
    description: 'Money owed to vendors/suppliers for goods/services received on credit. Tracks outstanding bills.',
    normalBalance: 'credit',
  },
  {
    code: '2100',
    name: 'Tax Payable',
    type: 'liability',
    accountCategory: 'Current Liabilities',
    description: 'Sales tax, VAT, or other taxes collected but not yet remitted to tax authorities.',
    normalBalance: 'credit',
  },
  {
    code: '2200',
    name: 'Employee Reimbursement Payable',
    type: 'liability',
    accountCategory: 'Current Liabilities',
    description: 'Amounts owed to employees for approved expense reimbursements. Cleared upon payment.',
    normalBalance: 'credit',
  },

  // ============================================
  // EQUITY (3000-3999)
  // Normal Balance: Credit
  // ============================================
  {
    code: '3000',
    name: "Owner's Equity",
    type: 'equity',
    accountCategory: 'Equity',
    description: "Owner's investment in the business. Represents ownership stake and capital contributions.",
    normalBalance: 'credit',
  },
  {
    code: '3100',
    name: 'Retained Earnings',
    type: 'equity',
    accountCategory: 'Equity',
    description: 'Cumulative net income retained in the business (not distributed to owners). Updated at year-end.',
    normalBalance: 'credit',
  },
  {
    code: '3200',
    name: 'Opening Balance Equity',
    type: 'equity',
    accountCategory: 'Equity',
    description: 'Temporary account for recording opening balances when setting up inventory or other assets. Typically cleared during setup.',
    normalBalance: 'credit',
  },

  // ============================================
  // INCOME/REVENUE (4000-4999)
  // Normal Balance: Credit
  // ============================================
  {
    code: '4000',
    name: 'Sales Revenue',
    type: 'income',
    accountCategory: 'Revenue',
    description: 'Income from selling goods. Primary revenue stream from product sales.',
    normalBalance: 'credit',
  },
  {
    code: '4100',
    name: 'Service Revenue',
    type: 'income',
    accountCategory: 'Revenue',
    description: 'Income from providing services. Revenue from professional services, consulting, etc.',
    normalBalance: 'credit',
  },
  {
    code: '4900',
    name: 'Other Revenue',
    type: 'income',
    accountCategory: 'Revenue',
    description: 'Income from sources other than primary operations (interest, gains, etc.).',
    normalBalance: 'credit',
  },
  {
    code: '4910',
    name: 'Foreign Exchange Gain',
    type: 'income',
    accountCategory: 'Revenue',
    description: 'Gains from foreign currency translation and settlement. Per IFRS IAS 21 and IFRS for SMEs Section 30.',
    normalBalance: 'credit',
  },

  // ============================================
  // EXPENSES (5000-5999)
  // Normal Balance: Debit
  // ============================================
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'expense',
    accountCategory: 'Cost of Sales',
    description: 'Direct costs of producing goods sold (materials, labor, manufacturing overhead).',
    normalBalance: 'debit',
  },
  {
    code: '5100',
    name: 'Operating Expenses',
    type: 'expense',
    accountCategory: 'Operating Expenses',
    description: 'General business expenses (rent, utilities, salaries, marketing, office supplies).',
    normalBalance: 'debit',
  },
  {
    code: '5200',
    name: 'Depreciation Expense',
    type: 'expense',
    accountCategory: 'Operating Expenses',
    description: 'Systematic allocation of fixed asset costs over their useful life. Non-cash expense.',
    normalBalance: 'debit',
  },
  {
    code: '5900',
    name: 'Foreign Exchange Loss',
    type: 'expense',
    accountCategory: 'Operating Expenses',
    description: 'Losses from foreign currency translation and settlement. Per IFRS IAS 21 and IFRS for SMEs Section 30.',
    normalBalance: 'debit',
  },
  {
    code: '5910',
    name: 'Inventory Adjustment',
    type: 'expense',
    accountCategory: 'Operating Expenses',
    description: 'Gains and losses from inventory adjustments (shrinkage, damage, corrections). Debited for losses, credited for gains.',
    normalBalance: 'debit',
  },
];

/**
 * Validates that an account definition is correctly configured
 * Ensures normal balance matches account type conventions
 */
function validateAccountDefinition(account: SystemAccountDefinition): void {
  const validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
  
  if (!validTypes.includes(account.type)) {
    throw new ValidationError(
      `Invalid account type: ${account.type}`,
      { accountCode: account.code, validTypes }
    );
  }

  // Validate normal balance follows accounting conventions
  // Exception: Contra-accounts (like Accumulated Depreciation) have opposite balance
  const isContraAccount = account.code === '1510'; // Accumulated Depreciation
  
  if (account.type === 'asset' || account.type === 'expense') {
    if (!isContraAccount && account.normalBalance !== 'debit') {
      throw new ValidationError(
        `Account type '${account.type}' must have debit normal balance (except contra-accounts)`,
        { accountCode: account.code, accountName: account.name }
      );
    }
  } else {
    if (account.normalBalance !== 'credit') {
      throw new ValidationError(
        `Account type '${account.type}' must have credit normal balance`,
        { accountCode: account.code, accountName: account.name }
      );
    }
  }

  if (!account.code || account.code.trim() === '') {
    throw new ValidationError('Account code is required', { account });
  }

  if (!account.name || account.name.trim() === '') {
    throw new ValidationError('Account name is required', { account });
  }
}

/**
 * Seeds standard system accounts for a tenant
 * 
 * **Idempotency Guarantee:**
 * - Checks if each account already exists by tenantId + code before creating
 * - Skips existing accounts without error
 * - Safe to run multiple times
 * 
 * **Transaction Safety:**
 * - All operations wrapped in database transaction
 * - Automatic rollback on any failure
 * - All accounts created or none
 * 
 * **Validation:**
 * - Validates all account definitions before processing
 * - Ensures account types and normal balances are correct
 * - Verifies all required fields are present
 * 
 * @param tenantId - The tenant ID to create system accounts for
 * @throws {ValidationError} - If account definitions are invalid
 * @throws {ConfigurationError} - If account creation fails
 * 
 * @example
 * ```typescript
 * // Seed system accounts for new tenant
 * await seedSystemAccounts(tenantId);
 * 
 * // Safe to run multiple times
 * await seedSystemAccounts(tenantId); // No duplicates, no errors
 * ```
 */
export async function seedSystemAccounts(tenantId: string): Promise<void> {
  const startTime = Date.now();
  
  console.log(`[System Accounts Seeder] Starting seed for tenant: ${tenantId}`);

  try {
    // Validate tenant ID
    if (!tenantId || tenantId.trim() === '') {
      throw new ValidationError('Tenant ID is required');
    }

    // Validate all account definitions before processing
    console.log(`[System Accounts Seeder] Validating ${SYSTEM_ACCOUNTS.length} account definitions...`);
    for (const account of SYSTEM_ACCOUNTS) {
      validateAccountDefinition(account);
    }

    // Use database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      let createdCount = 0;
      let skippedCount = 0;

      for (const accountDef of SYSTEM_ACCOUNTS) {
        // Check if account already exists (idempotency)
        const existing = await tx
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.tenantId, tenantId),
              eq(accounts.code, accountDef.code)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(`[System Accounts Seeder] Account ${accountDef.code} (${accountDef.name}) already exists, skipping`);
          skippedCount++;
          continue;
        }

        // Create new system account
        await tx.insert(accounts).values({
          tenantId,
          code: accountDef.code,
          name: accountDef.name,
          type: accountDef.type,
          accountCategory: accountDef.accountCategory,
          description: accountDef.description,
          isSystemAccount: true,
          isActive: true,
          openingBalance: '0.00',
          currentBalance: '0.00',
        });

        console.log(`[System Accounts Seeder] Created account ${accountDef.code} (${accountDef.name})`);
        createdCount++;
      }

      const duration = Date.now() - startTime;
      console.log(
        `[System Accounts Seeder] Completed successfully for tenant ${tenantId}:` +
        ` ${createdCount} created, ${skippedCount} skipped, ${duration}ms`
      );
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Re-throw validation errors as-is
    if (error instanceof ValidationError) {
      logError(error, { tenantId, duration });
      throw error;
    }

    // Wrap unknown errors as ConfigurationError
    const configError = new ConfigurationError(
      'Failed to seed system accounts',
      {
        tenantId,
        duration,
        originalError: error instanceof Error ? error.message : String(error),
      }
    );
    
    logError(configError, { tenantId, duration });
    throw configError;
  }
}

/**
 * Returns the list of system account definitions
 * Useful for documentation and testing purposes
 */
export function getSystemAccountDefinitions(): SystemAccountDefinition[] {
  return [...SYSTEM_ACCOUNTS];
}

/**
 * Checks if a tenant has system accounts seeded
 * 
 * @param tenantId - The tenant ID to check
 * @returns true if system accounts exist, false otherwise
 */
export async function hasSystemAccounts(tenantId: string): Promise<boolean> {
  try {
    const systemAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.isSystemAccount, true)
        )
      )
      .limit(1);

    return systemAccounts.length > 0;
  } catch (error) {
    logError(error as Error, { tenantId });
    return false;
  }
}
