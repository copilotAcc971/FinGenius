import { db } from '../db';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { 
  bankTransactions, 
  bankAccounts, 
  openBankingConnections,
  type InsertBankTransaction,
  type BankTransaction
} from '@shared/schema';
import { OpenBankingService, TokenRefreshError } from './service';
import { tokenEncryption } from './encryption';
import { openBankingProviderFactory } from './providers';
import type { Transaction } from './providers/base-provider';

// Maximum transactions per sync to prevent memory/performance issues
const MAX_TRANSACTIONS_PER_SYNC = 500;

export class TransactionSyncService {
  constructor(private tenantId: string) {}

  /**
   * Sync transactions for a specific bank account
   */
  async syncAccountTransactions(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<{ synced: number; duplicates: number; total: number }> {
    try {
      console.log(`[TransactionSyncService] Syncing transactions for account ${accountId}`, {
        tenantId: this.tenantId,
        startDate,
        endDate,
        limit
      });

      // Enforce maximum limit
      const effectiveLimit = Math.min(limit || MAX_TRANSACTIONS_PER_SYNC, MAX_TRANSACTIONS_PER_SYNC);

      // Get bank account with connection info and lastSyncedAt
      const [account] = await db
        .select()
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.id, accountId),
            eq(bankAccounts.tenantId, this.tenantId)
          )
        )
        .limit(1);

      if (!account) {
        throw new Error(`Bank account ${accountId} not found`);
      }

      // Use lastSyncedAt as startDate if not provided
      // Default to 30 days back if no lastSyncedAt
      const effectiveStartDate = startDate 
        || account.lastSyncedAt 
        || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      console.log(`[TransactionSyncService] Using start date: ${effectiveStartDate.toISOString()}`);

      // Get connection
      const [connection] = await db
        .select()
        .from(openBankingConnections)
        .where(
          and(
            eq(openBankingConnections.id, account.connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        )
        .limit(1);

      if (!connection) {
        throw new Error(`Connection ${account.connectionId} not found`);
      }

      if (connection.status !== 'active') {
        throw new Error(`Connection ${connection.id} is not active (status: ${connection.status})`);
      }

      // Initialize OpenBankingService for token management
      const obService = new OpenBankingService(this.tenantId);
      
      // Check if token needs refresh
      let accessToken = connection.accessToken;
      if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) <= new Date()) {
        console.log('[TransactionSyncService] Access token expired, refreshing...');
        try {
          await obService.refreshConnection(connection.id);
          
          // Get updated connection with new token
          const [updatedConnection] = await db
            .select()
            .from(openBankingConnections)
            .where(eq(openBankingConnections.id, connection.id))
            .limit(1);
          
          if (!updatedConnection) {
            throw new Error('Failed to get updated connection after refresh');
          }
          
          accessToken = updatedConnection.accessToken;
        } catch (error) {
          console.error('[TransactionSyncService] Token refresh failed:', error);
          throw new TokenRefreshError(
            `Failed to refresh token for connection ${connection.id}`,
            error instanceof Error ? error : undefined
          );
        }
      }

      // Decrypt access token
      const decryptedAccessToken = await tokenEncryption.decrypt(
        accessToken,
        connection.encryptionIV!,
        connection.encryptionAuthTag!,
        connection.encryptionKeyVersion!
      );

      // Get provider and fetch transactions with limit
      const provider = openBankingProviderFactory.createProvider(connection.provider);
      
      const transactions = await provider.getTransactions(
        decryptedAccessToken,
        account.accountId, // External provider account ID
        {
          startDate: effectiveStartDate,
          endDate,
          limit: effectiveLimit
        }
      );

      console.log(`[TransactionSyncService] Fetched ${transactions.length} transactions from provider`);

      // Sync transactions to database
      let synced = 0;
      let duplicates = 0;

      for (const transaction of transactions) {
        // Insert new transaction with proper field names
        const transactionData: InsertBankTransaction = {
          tenantId: this.tenantId,
          connectionId: connection.id,
          bankAccountId: accountId, // FK to bankAccounts.id
          providerTransactionId: transaction.id, // Provider's transaction ID
          accountId: account.accountId, // External provider account ID (for unique constraint)
          date: transaction.date,
          description: transaction.description || '',
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          type: transaction.type,
          pending: transaction.pending || false,
          reconciliationStatus: 'unmatched',
        };

        try {
          await db.insert(bankTransactions).values(transactionData);
          synced++;
        } catch (error: any) {
          // Check for unique constraint violation (23505 is Postgres unique_violation error)
          if (error.code === '23505' || error.constraint?.includes('unique')) {
            duplicates++;
            console.log(`[TransactionSyncService] Duplicate transaction detected: ${transaction.id}`);
            continue;
          }
          // Re-throw other errors
          console.error('[TransactionSyncService] Error inserting transaction:', error);
          throw error;
        }
      }

      // Update lastSyncedAt after successful sync
      await db.update(bankAccounts)
        .set({ lastSyncedAt: new Date() })
        .where(eq(bankAccounts.id, accountId));

      console.log(`[TransactionSyncService] Sync complete:`, {
        total: transactions.length,
        synced,
        duplicates,
        lastSyncedAt: new Date().toISOString()
      });

      return {
        synced,
        duplicates,
        total: transactions.length
      };
    } catch (error) {
      console.error('[TransactionSyncService] Error syncing transactions:', error);
      throw error;
    }
  }

  /**
   * List transactions for a bank account with pagination
   */
  async listAccountTransactions(
    accountId: string,
    options: { startDate?: Date; endDate?: Date; limit: number; offset: number }
  ): Promise<{ transactions: BankTransaction[]; total: number }> {
    try {
      console.log(`[TransactionSyncService] Listing transactions for account ${accountId}`, {
        tenantId: this.tenantId,
        options
      });

      // Build where conditions
      const whereConditions = [
        eq(bankTransactions.tenantId, this.tenantId),
        eq(bankTransactions.bankAccountId, accountId),
      ];

      if (options.startDate) {
        whereConditions.push(gte(bankTransactions.date, options.startDate));
      }

      if (options.endDate) {
        whereConditions.push(lte(bankTransactions.date, options.endDate));
      }

      // Count total matching transactions
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bankTransactions)
        .where(and(...whereConditions));

      // Fetch paginated results
      const transactions = await db
        .select()
        .from(bankTransactions)
        .where(and(...whereConditions))
        .orderBy(desc(bankTransactions.date))
        .limit(options.limit)
        .offset(options.offset);

      console.log(`[TransactionSyncService] Found ${transactions.length} transactions (total: ${count})`);

      return {
        transactions,
        total: Number(count)
      };
    } catch (error) {
      console.error('[TransactionSyncService] Error listing transactions:', error);
      throw error;
    }
  }

  /**
   * Sync transactions for all active bank accounts
   */
  async syncAllAccounts(): Promise<void> {
    try {
      console.log(`[TransactionSyncService] Syncing all accounts for tenant ${this.tenantId}`);

      // Get all active connections for this tenant
      const connections = await db
        .select()
        .from(openBankingConnections)
        .where(
          and(
            eq(openBankingConnections.tenantId, this.tenantId),
            eq(openBankingConnections.status, 'active')
          )
        );

      console.log(`[TransactionSyncService] Found ${connections.length} active connections`);

      // For each connection, get all accounts and sync
      for (const connection of connections) {
        try {
          const accounts = await db
            .select()
            .from(bankAccounts)
            .where(
              and(
                eq(bankAccounts.connectionId, connection.id),
                eq(bankAccounts.tenantId, this.tenantId)
              )
            );

          console.log(`[TransactionSyncService] Connection ${connection.id}: ${accounts.length} accounts`);

          for (const account of accounts) {
            try {
              // Don't pass startDate - let service use lastSyncedAt for incremental sync
              const result = await this.syncAccountTransactions(
                account.id,
                undefined, // startDate - will use lastSyncedAt
                undefined, // endDate - will use current date
                MAX_TRANSACTIONS_PER_SYNC
              );

              console.log(`[TransactionSyncService] Account ${account.id} sync result:`, result);
            } catch (error) {
              console.error(`[TransactionSyncService] Error syncing account ${account.id}:`, error);
              // Continue with next account
            }
          }
        } catch (error) {
          console.error(`[TransactionSyncService] Error processing connection ${connection.id}:`, error);
          // Continue with next connection
        }
      }

      console.log(`[TransactionSyncService] All accounts sync complete for tenant ${this.tenantId}`);
    } catch (error) {
      console.error('[TransactionSyncService] Error syncing all accounts:', error);
      throw error;
    }
  }
}
