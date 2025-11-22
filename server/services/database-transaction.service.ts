/**
 * Database Transaction Service
 * 
 * CRITICAL: This service provides atomic transaction handling for all financial operations
 * Ensures ACID compliance and prevents partial updates in case of failures
 * 
 * Features:
 * - Atomic transaction wrapping with automatic rollback
 * - Nested transaction support using PostgreSQL savepoints
 * - Deadlock detection and automatic retry
 * - Transaction monitoring and slow query logging
 * - Comprehensive error handling and audit logging
 * 
 * @module server/services/database-transaction.service
 */

import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import type { DBTransaction } from '../accounting/service';
import { enhancedAuditLogger } from './audit-logger.service';
import { AccountingError, IntegrityError, ValidationError } from '../accounting/errors';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

// ====================================
// TYPE DEFINITIONS
// ====================================

export interface TransactionOptions {
  /**
   * Maximum number of retry attempts for deadlock recovery
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   * @default 100
   */
  retryDelay?: number;
  
  /**
   * Transaction isolation level
   * @default 'read committed'
   */
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
  
  /**
   * Enable transaction monitoring and logging
   * @default true
   */
  enableMonitoring?: boolean;
  
  /**
   * Threshold for slow transaction warning (milliseconds)
   * @default 1000
   */
  slowTransactionThreshold?: number;
  
  /**
   * Transaction description for logging
   */
  description?: string;
  
  /**
   * User ID for audit logging
   */
  userId?: string;
  
  /**
   * Tenant ID for multi-tenant isolation
   */
  tenantId?: string;
}

export interface TransactionMetrics {
  transactionId: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
  retryCount: number;
  error?: Error;
  operations: string[];
  savepoints: string[];
}

export interface SavepointHandle {
  name: string;
  release: () => Promise<void>;
  rollbackTo: () => Promise<void>;
}

// ====================================
// TRANSACTION MONITORING
// ====================================

class TransactionMonitor {
  private static metrics = new Map<string, TransactionMetrics>();
  
  static startTransaction(id: string, description?: string): TransactionMetrics {
    const metrics: TransactionMetrics = {
      transactionId: id,
      description,
      startTime: new Date(),
      status: 'pending',
      retryCount: 0,
      operations: [],
      savepoints: []
    };
    
    this.metrics.set(id, metrics);
    return metrics;
  }
  
  static endTransaction(id: string, status: 'committed' | 'rolled_back' | 'failed', error?: Error): void {
    const metrics = this.metrics.get(id);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      metrics.status = status;
      metrics.error = error;
      
      // Clean up old metrics after 5 minutes
      setTimeout(() => this.metrics.delete(id), 300000);
    }
  }
  
  static addOperation(id: string, operation: string): void {
    const metrics = this.metrics.get(id);
    if (metrics) {
      metrics.operations.push(operation);
    }
  }
  
  static addSavepoint(id: string, savepoint: string): void {
    const metrics = this.metrics.get(id);
    if (metrics) {
      metrics.savepoints.push(savepoint);
    }
  }
  
  static incrementRetryCount(id: string): void {
    const metrics = this.metrics.get(id);
    if (metrics) {
      metrics.retryCount++;
    }
  }
  
  static getMetrics(id: string): TransactionMetrics | undefined {
    return this.metrics.get(id);
  }
  
  static getAllMetrics(): TransactionMetrics[] {
    return Array.from(this.metrics.values());
  }
  
  static getSlowTransactions(threshold: number = 1000): TransactionMetrics[] {
    return Array.from(this.metrics.values())
      .filter(m => m.duration && m.duration > threshold);
  }
}

// ====================================
// ERROR DETECTION
// ====================================

/**
 * Detects if an error is a PostgreSQL deadlock error
 */
function isDeadlockError(error: any): boolean {
  // PostgreSQL deadlock error code is 40P01
  return error?.code === '40P01' || 
         error?.message?.toLowerCase().includes('deadlock');
}

/**
 * Detects if an error is a serialization failure
 */
function isSerializationError(error: any): boolean {
  // PostgreSQL serialization failure code is 40001
  return error?.code === '40001' || 
         error?.message?.toLowerCase().includes('serialization');
}

/**
 * Detects if an error is a constraint violation
 */
function isConstraintError(error: any): boolean {
  // PostgreSQL constraint violation codes start with 23
  return error?.code?.startsWith('23');
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: any): boolean {
  return isDeadlockError(error) || isSerializationError(error);
}

// ====================================
// MAIN TRANSACTION SERVICE
// ====================================

export class DatabaseTransactionService {
  private static transactionCounter = 0;
  
  /**
   * Generate unique transaction ID
   */
  private static generateTransactionId(): string {
    const timestamp = Date.now();
    const counter = ++this.transactionCounter;
    return `tx_${timestamp}_${counter}`;
  }
  
  /**
   * Execute a function within a database transaction with automatic rollback on error
   * 
   * @param operation - Async function that receives the transaction client
   * @param options - Transaction configuration options
   * @returns Result of the operation
   * @throws Re-throws any error after rollback
   * 
   * @example
   * ```typescript
   * const result = await DatabaseTransactionService.executeInTransaction(
   *   async (tx) => {
   *     const invoice = await tx.insert(invoices).values({...}).returning();
   *     const lineItems = await tx.insert(invoiceLineItems).values([...]).returning();
   *     return { invoice: invoice[0], lineItems };
   *   },
   *   {
   *     description: 'Create invoice with line items',
   *     tenantId: 'tenant-123',
   *     userId: 'user-456'
   *   }
   * );
   * ```
   */
  static async executeInTransaction<T>(
    operation: (tx: DBTransaction) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 100,
      isolationLevel = 'read committed',
      enableMonitoring = true,
      slowTransactionThreshold = 1000,
      description,
      userId,
      tenantId
    } = options;
    
    const transactionId = this.generateTransactionId();
    let metrics: TransactionMetrics | undefined;
    
    if (enableMonitoring) {
      metrics = TransactionMonitor.startTransaction(transactionId, description);
    }
    
    let lastError: Error | undefined;
    
    // Retry loop for deadlock recovery
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0 && metrics) {
          TransactionMonitor.incrementRetryCount(transactionId);
          
          // Log retry attempt
          await enhancedAuditLogger.logSystemEvent({
            eventType: 'transaction_retry',
            severity: 'warning',
            description: `Transaction retry attempt ${attempt + 1} of ${maxRetries}`,
            metadata: {
              transactionId,
              attempt,
              lastError: lastError?.message,
              description
            },
            userId,
            tenantId
          });
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
        }
        
        // Execute transaction with isolation level
        const result = await db.transaction(async (tx) => {
          // Set transaction isolation level if not default
          if (isolationLevel !== 'read committed') {
            await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL ${sql.raw(isolationLevel.toUpperCase())}`);
          }
          
          // Record transaction start
          if (enableMonitoring) {
            TransactionMonitor.addOperation(transactionId, 'BEGIN TRANSACTION');
          }
          
          try {
            // Execute the operation
            const operationResult = await operation(tx);
            
            // Record successful completion
            if (enableMonitoring) {
              TransactionMonitor.addOperation(transactionId, 'COMMIT');
              TransactionMonitor.endTransaction(transactionId, 'committed');
              
              // Check for slow transaction
              const finalMetrics = TransactionMonitor.getMetrics(transactionId);
              if (finalMetrics && finalMetrics.duration && finalMetrics.duration > slowTransactionThreshold) {
                await enhancedAuditLogger.logSystemEvent({
                  eventType: 'slow_transaction',
                  severity: 'warning',
                  description: `Slow transaction detected: ${finalMetrics.duration}ms`,
                  metadata: {
                    transactionId,
                    duration: finalMetrics.duration,
                    threshold: slowTransactionThreshold,
                    operations: finalMetrics.operations,
                    description
                  },
                  userId,
                  tenantId
                });
              }
            }
            
            return operationResult;
          } catch (error) {
            // Record rollback
            if (enableMonitoring) {
              TransactionMonitor.addOperation(transactionId, 'ROLLBACK');
              TransactionMonitor.endTransaction(transactionId, 'rolled_back', error as Error);
            }
            
            throw error;
          }
        });
        
        // Log successful transaction
        if (enableMonitoring && metrics) {
          await enhancedAuditLogger.logSystemEvent({
            eventType: 'transaction_success',
            severity: 'info',
            description: `Transaction completed successfully${description ? `: ${description}` : ''}`,
            metadata: {
              transactionId,
              duration: metrics.duration,
              operationCount: metrics.operations.length,
              retryCount: attempt
            },
            userId,
            tenantId
          });
        }
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (!isRetryableError(error) || attempt === maxRetries - 1) {
          // Not retryable or last attempt - fail permanently
          if (enableMonitoring) {
            TransactionMonitor.endTransaction(transactionId, 'failed', error);
          }
          
          // Log transaction failure
          await enhancedAuditLogger.logSystemEvent({
            eventType: 'transaction_failure',
            severity: 'error',
            description: `Transaction failed${description ? `: ${description}` : ''}`,
            metadata: {
              transactionId,
              error: error.message,
              errorCode: error.code,
              isDeadlock: isDeadlockError(error),
              isSerialization: isSerializationError(error),
              isConstraint: isConstraintError(error),
              attempt: attempt + 1,
              maxRetries
            },
            userId,
            tenantId
          });
          
          // Re-throw with enhanced error message
          if (isDeadlockError(error)) {
            throw new IntegrityError(
              `Transaction deadlock detected after ${attempt + 1} attempts: ${error.message}`,
              { transactionId, originalError: error }
            );
          } else if (isSerializationError(error)) {
            throw new IntegrityError(
              `Transaction serialization failure after ${attempt + 1} attempts: ${error.message}`,
              { transactionId, originalError: error }
            );
          } else if (isConstraintError(error)) {
            throw new ValidationError(
              `Database constraint violation: ${error.message}`,
              { transactionId, originalError: error }
            );
          } else {
            throw error;
          }
        }
        
        // Will retry on next iteration
        console.log(`[Transaction] Retryable error detected, attempt ${attempt + 1} of ${maxRetries}:`, error.message);
      }
    }
    
    // Should never reach here, but TypeScript needs this
    throw lastError || new Error('Transaction failed after all retry attempts');
  }
  
  /**
   * Create a savepoint within a transaction for nested transaction support
   * 
   * @param tx - Transaction client from parent transaction
   * @param name - Optional savepoint name (auto-generated if not provided)
   * @returns SavepointHandle for managing the savepoint
   * 
   * @example
   * ```typescript
   * await DatabaseTransactionService.executeInTransaction(async (tx) => {
   *   // Main transaction operations
   *   await tx.insert(accounts).values({...});
   *   
   *   // Create savepoint for risky operation
   *   const savepoint = await DatabaseTransactionService.createSavepoint(tx, 'risky_op');
   *   
   *   try {
   *     // Risky operation
   *     await tx.update(accounts).set({...}).where(...);
   *     
   *     // If successful, release savepoint
   *     await savepoint.release();
   *   } catch (error) {
   *     // Rollback to savepoint on error
   *     await savepoint.rollbackTo();
   *     // Handle error without failing entire transaction
   *   }
   * });
   * ```
   */
  static async createSavepoint(
    tx: DBTransaction,
    name?: string
  ): Promise<SavepointHandle> {
    const savepointName = name || `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create savepoint
    await tx.execute(sql`SAVEPOINT ${sql.identifier(savepointName)}`);
    
    return {
      name: savepointName,
      
      /**
       * Release the savepoint (commits changes since savepoint)
       */
      release: async () => {
        await tx.execute(sql`RELEASE SAVEPOINT ${sql.identifier(savepointName)}`);
      },
      
      /**
       * Rollback to the savepoint (undoes changes since savepoint)
       */
      rollbackTo: async () => {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT ${sql.identifier(savepointName)}`);
      }
    };
  }
  
  /**
   * Execute multiple operations in parallel within the same transaction
   * All operations must succeed or all will be rolled back
   * 
   * @param operations - Array of async functions to execute
   * @param options - Transaction configuration options
   * @returns Array of results from each operation
   * 
   * @example
   * ```typescript
   * const [invoice, bill, payment] = await DatabaseTransactionService.executeParallelInTransaction([
   *   (tx) => createInvoice(tx, invoiceData),
   *   (tx) => createBill(tx, billData),
   *   (tx) => processPayment(tx, paymentData)
   * ], {
   *   description: 'Process monthly transactions'
   * });
   * ```
   */
  static async executeParallelInTransaction<T extends any[]>(
    operations: { [K in keyof T]: (tx: DBTransaction) => Promise<T[K]> },
    options: TransactionOptions = {}
  ): Promise<T> {
    return this.executeInTransaction(async (tx) => {
      const results = await Promise.all(
        operations.map(op => op(tx))
      );
      return results as T;
    }, options);
  }
  
  /**
   * Check current transaction status and metrics
   * 
   * @param transactionId - Optional specific transaction ID to check
   * @returns Transaction metrics or all active transactions
   */
  static getTransactionStatus(transactionId?: string): TransactionMetrics | TransactionMetrics[] | undefined {
    if (transactionId) {
      return TransactionMonitor.getMetrics(transactionId);
    }
    return TransactionMonitor.getAllMetrics();
  }
  
  /**
   * Get all slow transactions above threshold
   * 
   * @param threshold - Duration threshold in milliseconds (default: 1000)
   * @returns Array of slow transaction metrics
   */
  static getSlowTransactions(threshold: number = 1000): TransactionMetrics[] {
    return TransactionMonitor.getSlowTransactions(threshold);
  }
  
  /**
   * Validate that all amounts in a financial operation balance
   * Used before committing financial transactions
   * 
   * @param debits - Array of debit amounts
   * @param credits - Array of credit amounts
   * @param tolerance - Acceptable difference for rounding (default: 0.01)
   * @throws ValidationError if amounts don't balance
   */
  static validateFinancialBalance(
    debits: (string | number)[],
    credits: (string | number)[],
    tolerance: number = 0.01
  ): void {
    const totalDebits = debits.reduce((sum, amount) => 
      sum.add(new Decimal(amount || 0)), new Decimal(0)
    );
    
    const totalCredits = credits.reduce((sum, amount) => 
      sum.add(new Decimal(amount || 0)), new Decimal(0)
    );
    
    const difference = totalDebits.sub(totalCredits).abs();
    
    if (difference.greaterThan(tolerance)) {
      throw new ValidationError(
        `Financial amounts do not balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${difference.toFixed(2)}`,
        { totalDebits: totalDebits.toString(), totalCredits: totalCredits.toString(), difference: difference.toString() }
      );
    }
  }
}

// ====================================
// TRANSACTION PATTERNS
// ====================================

/**
 * Pattern 1: Simple all-or-nothing transaction
 * 
 * @example
 * ```typescript
 * await simpleTransaction(async (tx) => {
 *   await tx.insert(table1).values({...});
 *   await tx.update(table2).set({...});
 *   await tx.delete(table3).where(...);
 * });
 * ```
 */
export async function simpleTransaction<T>(
  operation: (tx: DBTransaction) => Promise<T>,
  description?: string
): Promise<T> {
  return DatabaseTransactionService.executeInTransaction(operation, { description });
}

/**
 * Pattern 2: Financial transaction with balance validation
 * 
 * @example
 * ```typescript
 * await financialTransaction(
 *   async (tx) => {
 *     const entry = await createJournalEntry(tx, data);
 *     await updateAccountBalances(tx, entry);
 *     return entry;
 *   },
 *   debits,
 *   credits
 * );
 * ```
 */
export async function financialTransaction<T>(
  operation: (tx: DBTransaction) => Promise<T>,
  debits: (string | number)[],
  credits: (string | number)[],
  options: TransactionOptions = {}
): Promise<T> {
  // Validate balance before executing
  DatabaseTransactionService.validateFinancialBalance(debits, credits);
  
  return DatabaseTransactionService.executeInTransaction(operation, {
    ...options,
    description: options.description || 'Financial transaction with balance validation'
  });
}

/**
 * Pattern 3: Transaction with compensation (saga pattern)
 * 
 * @example
 * ```typescript
 * await compensatingTransaction(
 *   async (tx) => {
 *     // Forward operation
 *     const result = await createOrder(tx, data);
 *     return result;
 *   },
 *   async (tx, result) => {
 *     // Compensation operation if forward fails
 *     await cancelOrder(tx, result.id);
 *   }
 * );
 * ```
 */
export async function compensatingTransaction<T>(
  forwardOperation: (tx: DBTransaction) => Promise<T>,
  compensationOperation: (tx: DBTransaction, result: T) => Promise<void>,
  options: TransactionOptions = {}
): Promise<T> {
  let result: T | undefined;
  
  try {
    result = await DatabaseTransactionService.executeInTransaction(
      forwardOperation,
      { ...options, description: `Forward: ${options.description}` }
    );
    return result;
  } catch (error) {
    // If forward operation fails and we have a partial result, run compensation
    if (result !== undefined) {
      try {
        await DatabaseTransactionService.executeInTransaction(
          (tx) => compensationOperation(tx, result!),
          { ...options, description: `Compensation: ${options.description}` }
        );
      } catch (compensationError) {
        console.error('Compensation transaction failed:', compensationError);
        // Log but don't throw - original error is more important
        await enhancedAuditLogger.logSystemEvent({
          eventType: 'compensation_failure',
          severity: 'error',
          description: 'Failed to execute compensation transaction',
          metadata: {
            originalError: (error as Error).message,
            compensationError: (compensationError as Error).message,
            description: options.description
          }
        });
      }
    }
    throw error;
  }
}

// ====================================
// EXPORTS
// ====================================

export default DatabaseTransactionService;
export {
  simpleTransaction as withTransaction,
  isDeadlockError,
  isSerializationError,
  isConstraintError,
  isRetryableError
};