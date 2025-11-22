import { Decimal } from 'decimal.js';
import { openBankingProviderFactory } from './providers';
import { OpenBankingService } from './service';
import { TransactionSyncService } from './transaction-sync-service';
import { ReconciliationService } from './reconciliation-service';
import { db } from '../db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { 
  openBankingConnections, 
  openBankingPayments,
  bankAccounts,
  bankTransactions,
} from '@shared/schema';

// Retry statistics tracking
interface RetryStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalRetries: number;
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
  averageResponseTime: number;
  tokenRefreshes: number;
}

// Sync status tracking
interface SyncStatus {
  connectionId: string;
  status: 'idle' | 'syncing' | 'failed' | 'completed';
  lastSyncTime?: Date;
  nextScheduledSync?: Date;
  totalTransactionsSynced: number;
  pendingTransactions: number;
  failedTransactions: number;
  lastError?: string;
  retryCount: number;
}

// Health monitoring data
interface HealthMetrics {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  apiAvailability: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  retryStatistics: RetryStatistics;
  syncStatuses: SyncStatus[];
  lastHealthCheck: Date;
}

export class OpenBankingManager {
  private service: OpenBankingService;
  private syncService: TransactionSyncService;
  private reconciliationService: ReconciliationService;
  
  // Track retry statistics per tenant
  private retryStats: Map<string, RetryStatistics> = new Map();
  
  // Track sync status per connection
  private syncStatuses: Map<string, SyncStatus> = new Map();
  
  // Health metrics cache
  private healthMetrics: Map<string, HealthMetrics> = new Map();
  
  constructor() {
    this.service = new OpenBankingService();
    this.syncService = new TransactionSyncService();
    this.reconciliationService = new ReconciliationService();
    
    // Initialize retry statistics
    this.initializeRetryStatistics();
  }
  
  /**
   * Initialize retry statistics tracking
   */
  private initializeRetryStatistics(): void {
    // Reset statistics every hour to prevent memory growth
    setInterval(() => {
      this.retryStats.clear();
      console.log('[OpenBankingManager] Reset retry statistics');
    }, 60 * 60 * 1000); // 1 hour
  }
  
  /**
   * Track a request for statistics
   */
  private trackRequest(
    tenantId: string,
    success: boolean,
    responseTime: number,
    retries: number = 0
  ): void {
    const stats = this.retryStats.get(tenantId) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0,
      averageResponseTime: 0,
      tokenRefreshes: 0,
    };
    
    stats.totalRequests++;
    stats.totalRetries += retries;
    
    if (success) {
      stats.successfulRequests++;
      stats.lastSuccessTime = new Date();
    } else {
      stats.failedRequests++;
      stats.lastFailureTime = new Date();
    }
    
    // Calculate running average response time
    stats.averageResponseTime = 
      (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
    
    this.retryStats.set(tenantId, stats);
  }
  
  /**
   * Handle TOKEN_REFRESHED responses by updating tokens and retrying
   */
  public async handleTokenRefreshed(
    connectionId: string,
    newTokens: { accessToken: string; refreshToken: string; expiresIn: number },
    operation: () => Promise<any>
  ): Promise<any> {
    try {
      // Update tokens in database
      await db.update(openBankingConnections)
        .set({
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(openBankingConnections.id, connectionId));
      
      // Track token refresh
      const connection = await db.query.openBankingConnections.findFirst({
        where: eq(openBankingConnections.id, connectionId),
      });
      
      if (connection) {
        const stats = this.retryStats.get(connection.tenantId) || {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalRetries: 0,
          averageResponseTime: 0,
          tokenRefreshes: 0,
        };
        stats.tokenRefreshes++;
        this.retryStats.set(connection.tenantId, stats);
      }
      
      // Retry the operation with new tokens
      return await operation();
    } catch (error) {
      console.error('[OpenBankingManager] Error handling token refresh:', error);
      throw error;
    }
  }
  
  /**
   * Get health status for a specific provider
   */
  public async getProviderHealth(provider: string, tenantId: string): Promise<HealthMetrics> {
    try {
      const startTime = Date.now();
      
      // Get provider instance
      const providerInstance = openBankingProviderFactory.getProvider(provider as any);
      
      // Get provider-specific health status
      let providerHealth: any = {
        provider,
        status: 'healthy',
        apiAvailability: true,
        circuitBreakerState: 'closed',
      };
      
      if ('getLeanHealthStatus' in providerInstance) {
        providerHealth = await (providerInstance as any).getLeanHealthStatus();
      }
      
      // Get retry statistics
      const retryStats = this.retryStats.get(tenantId) || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRetries: 0,
        averageResponseTime: 0,
        tokenRefreshes: 0,
      };
      
      // Get sync statuses for this tenant
      const connections = await db.query.openBankingConnections.findMany({
        where: and(
          eq(openBankingConnections.tenantId, tenantId),
          eq(openBankingConnections.provider, provider)
        ),
      });
      
      const syncStatuses: SyncStatus[] = connections.map(conn => {
        const status = this.syncStatuses.get(conn.id) || {
          connectionId: conn.id,
          status: 'idle' as const,
          lastSyncTime: conn.lastSyncedAt || undefined,
          totalTransactionsSynced: 0,
          pendingTransactions: 0,
          failedTransactions: 0,
          retryCount: 0,
        };
        return status;
      });
      
      const responseTime = Date.now() - startTime;
      
      const healthMetrics: HealthMetrics = {
        provider,
        status: providerHealth.status || 'healthy',
        apiAvailability: providerHealth.apiAvailable !== false,
        circuitBreakerState: providerHealth.circuitBreaker?.state || 'closed',
        retryStatistics: retryStats,
        syncStatuses,
        lastHealthCheck: new Date(),
      };
      
      // Cache the health metrics
      this.healthMetrics.set(`${tenantId}:${provider}`, healthMetrics);
      
      // Track this health check as a request
      this.trackRequest(tenantId, true, responseTime);
      
      return healthMetrics;
    } catch (error) {
      console.error('[OpenBankingManager] Error getting provider health:', error);
      
      // Return degraded health status on error
      return {
        provider,
        status: 'unhealthy',
        apiAvailability: false,
        circuitBreakerState: 'open',
        retryStatistics: this.retryStats.get(tenantId) || {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalRetries: 0,
          averageResponseTime: 0,
          tokenRefreshes: 0,
        },
        syncStatuses: [],
        lastHealthCheck: new Date(),
      };
    }
  }
  
  /**
   * Get overall health status for all providers
   */
  public async getAllProvidersHealth(tenantId: string): Promise<HealthMetrics[]> {
    const providers = ['lean', 'mastercard', 'nym', 'marketplace'];
    const healthStatuses = await Promise.all(
      providers.map(provider => this.getProviderHealth(provider, tenantId))
    );
    return healthStatuses;
  }
  
  /**
   * Update sync status for a connection
   */
  public updateSyncStatus(
    connectionId: string,
    updates: Partial<SyncStatus>
  ): void {
    const currentStatus = this.syncStatuses.get(connectionId) || {
      connectionId,
      status: 'idle' as const,
      totalTransactionsSynced: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      retryCount: 0,
    };
    
    this.syncStatuses.set(connectionId, {
      ...currentStatus,
      ...updates,
    });
  }
  
  /**
   * Start transaction sync for a connection
   */
  public async startTransactionSync(
    connectionId: string,
    tenantId: string,
    options?: { forceSync?: boolean }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update sync status
      this.updateSyncStatus(connectionId, {
        status: 'syncing',
        lastError: undefined,
      });
      
      // Get connection details
      const connection = await db.query.openBankingConnections.findFirst({
        where: eq(openBankingConnections.id, connectionId),
      });
      
      if (!connection) {
        throw new Error('Connection not found');
      }
      
      // Sync transactions
      const result = await this.syncService.syncTransactionsForConnection(
        connectionId,
        tenantId,
        options
      );
      
      // Update sync status with results
      this.updateSyncStatus(connectionId, {
        status: 'completed',
        lastSyncTime: new Date(),
        nextScheduledSync: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        totalTransactionsSynced: result.transactionsSynced || 0,
        pendingTransactions: 0,
        failedTransactions: 0,
        retryCount: 0,
      });
      
      const responseTime = Date.now() - startTime;
      this.trackRequest(tenantId, true, responseTime);
      
    } catch (error: any) {
      console.error('[OpenBankingManager] Sync failed:', error);
      
      const currentStatus = this.syncStatuses.get(connectionId);
      const retryCount = (currentStatus?.retryCount || 0) + 1;
      
      // Update sync status with error
      this.updateSyncStatus(connectionId, {
        status: 'failed',
        lastError: error.message,
        retryCount,
        nextScheduledSync: new Date(Date.now() + Math.min(retryCount * 5 * 60 * 1000, 60 * 60 * 1000)), // Exponential backoff
      });
      
      const responseTime = Date.now() - startTime;
      this.trackRequest(tenantId, false, responseTime);
      
      throw error;
    }
  }
  
  /**
   * Get sync history for a connection
   */
  public async getSyncHistory(
    connectionId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      // In a real implementation, this would query a sync history table
      // For now, return current status as a single-item history
      const currentStatus = this.syncStatuses.get(connectionId);
      
      if (!currentStatus) {
        return [];
      }
      
      return [{
        connectionId,
        timestamp: currentStatus.lastSyncTime || new Date(),
        status: currentStatus.status,
        transactionsSynced: currentStatus.totalTransactionsSynced,
        error: currentStatus.lastError,
        retryCount: currentStatus.retryCount,
      }];
    } catch (error) {
      console.error('[OpenBankingManager] Error getting sync history:', error);
      return [];
    }
  }
  
  /**
   * Test connection health
   */
  public async testConnection(connectionId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const connection = await db.query.openBankingConnections.findFirst({
        where: eq(openBankingConnections.id, connectionId),
      });
      
      if (!connection) {
        return {
          success: false,
          message: 'Connection not found',
        };
      }
      
      const provider = openBankingProviderFactory.getProvider(connection.provider as any);
      
      // Test with a simple accounts fetch
      const startTime = Date.now();
      const accounts = await provider.getAccounts(
        connection.accessToken,
        connection.refreshToken || undefined
      );
      const responseTime = Date.now() - startTime;
      
      this.trackRequest(connection.tenantId, true, responseTime);
      
      return {
        success: true,
        message: `Connection is healthy. Found ${accounts.length} account(s).`,
        details: {
          responseTime,
          accountCount: accounts.length,
        },
      };
    } catch (error: any) {
      console.error('[OpenBankingManager] Connection test failed:', error);
      
      // Check if it's a TOKEN_REFRESHED response
      if (error.message?.startsWith('TOKEN_REFRESHED:')) {
        const newTokens = JSON.parse(error.message.substring('TOKEN_REFRESHED:'.length));
        
        // Update tokens and retry
        return await this.handleTokenRefreshed(
          connectionId,
          newTokens,
          () => this.testConnection(connectionId)
        );
      }
      
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: {
          error: error.message,
        },
      };
    }
  }
  
  /**
   * Get retry statistics for a tenant
   */
  public getRetryStatistics(tenantId: string): RetryStatistics | undefined {
    return this.retryStats.get(tenantId);
  }
  
  /**
   * Clear all cached data (for testing)
   */
  public clearCache(): void {
    this.retryStats.clear();
    this.syncStatuses.clear();
    this.healthMetrics.clear();
  }
}

// Export singleton instance
export const openBankingManager = new OpenBankingManager();