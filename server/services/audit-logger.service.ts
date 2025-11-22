import { AuditLogger } from '../audit/audit-logger';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '@shared/schema';
import crypto from 'crypto';

// Initialize the base audit logger
const auditLogger = new AuditLogger(storage);

/**
 * Enhanced Audit Logger Service for SOX Compliance
 * 
 * This service provides comprehensive audit logging with:
 * - Before/after state capture
 * - Automatic entity state snapshots
 * - Session tracking
 * - Hash chain for tamper detection
 * - Compliance-specific metadata
 */
export class AuditLoggerService {
  private static previousLogHash: string | null = null;

  /**
   * Centralized audit wrapper function that automatically captures before/after states
   * and logs the operation with full context
   * 
   * @example
   * const result = await auditWrapper(
   *   'update_invoice',
   *   'invoice',
   *   invoiceId,
   *   tenantId,
   *   userId,
   *   async () => storage.updateInvoice(invoiceId, data),
   *   { reason: 'Correcting line item', sessionId: req.sessionID }
   * );
   */
  static async auditWrapper<T>(
    operation: string,
    entityType: string,
    entityId: string,
    tenantId: string,
    userId: string,
    executeFn: () => Promise<T>,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      reason?: string;
      justification?: string;
      approvalChain?: string[];
      bulkOperationId?: string;
      parentEntityType?: string;
      parentEntityId?: string;
      [key: string]: any;
    }
  ): Promise<T> {
    // Capture the before state
    const beforeState = await this.captureCurrentState(entityType, entityId, tenantId);
    
    try {
      // Execute the operation
      const result = await executeFn();
      
      // Capture the after state
      const afterState = await this.captureCurrentState(entityType, entityId, tenantId);
      
      // Generate hash for tamper detection
      const logHash = await this.generateLogHash(
        operation,
        entityType,
        entityId,
        beforeState,
        afterState,
        metadata
      );
      
      // Log the successful operation with full context
      await auditLogger.logFinancialTransaction({
        tenantId,
        userId,
        action: operation,
        entityType,
        entityId,
        changes: {
          before: beforeState,
          after: afterState,
        },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        wasSuccessful: true,
      });

      // Store additional metadata separately if needed
      if (metadata) {
        await this.storeAuditMetadata(
          tenantId,
          userId,
          operation,
          entityType,
          entityId,
          {
            ...metadata,
            logHash,
            previousLogHash: this.previousLogHash,
          }
        );
      }
      
      // Update the hash chain
      this.previousLogHash = logHash;
      
      return result;
    } catch (error: any) {
      // Log the failed operation
      await auditLogger.logFinancialTransaction({
        tenantId,
        userId,
        action: `${operation}_failed`,
        entityType,
        entityId,
        changes: {
          before: beforeState,
          after: null,
        },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        wasSuccessful: false,
        errorMessage: error.message || 'Unknown error',
      });
      
      throw error;
    }
  }

  /**
   * Capture the current state of an entity from the database
   */
  static async captureCurrentState(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<any> {
    if (!entityId || entityId === 'new') {
      return null;
    }

    try {
      switch (entityType) {
        case 'invoice':
          const [invoice] = await db
            .select()
            .from(schema.invoices)
            .where(and(
              eq(schema.invoices.id, entityId),
              eq(schema.invoices.tenantId, tenantId)
            ))
            .limit(1);
          return invoice || null;

        case 'bill':
          const [bill] = await db
            .select()
            .from(schema.bills)
            .where(and(
              eq(schema.bills.id, entityId),
              eq(schema.bills.tenantId, tenantId)
            ))
            .limit(1);
          return bill || null;

        case 'journal_entry':
          const [journalEntry] = await db
            .select()
            .from(schema.journalEntries)
            .where(and(
              eq(schema.journalEntries.id, entityId),
              eq(schema.journalEntries.tenantId, tenantId)
            ))
            .limit(1);
          return journalEntry || null;

        case 'customer':
          const [customer] = await db
            .select()
            .from(schema.customers)
            .where(and(
              eq(schema.customers.id, entityId),
              eq(schema.customers.tenantId, tenantId)
            ))
            .limit(1);
          return customer || null;

        case 'vendor':
          const [vendor] = await db
            .select()
            .from(schema.vendors)
            .where(and(
              eq(schema.vendors.id, entityId),
              eq(schema.vendors.tenantId, tenantId)
            ))
            .limit(1);
          return vendor || null;

        case 'account':
          const [account] = await db
            .select()
            .from(schema.accounts)
            .where(and(
              eq(schema.accounts.id, entityId),
              eq(schema.accounts.tenantId, tenantId)
            ))
            .limit(1);
          return account || null;

        case 'tax':
          const [tax] = await db
            .select()
            .from(schema.taxes)
            .where(and(
              eq(schema.taxes.id, entityId),
              eq(schema.taxes.tenantId, tenantId)
            ))
            .limit(1);
          return tax || null;

        case 'currency':
          const [currency] = await db
            .select()
            .from(schema.currencies)
            .where(and(
              eq(schema.currencies.id, entityId),
              eq(schema.currencies.tenantId, tenantId)
            ))
            .limit(1);
          return currency || null;

        case 'exchange_rate':
          const [exchangeRate] = await db
            .select()
            .from(schema.exchangeRates)
            .where(and(
              eq(schema.exchangeRates.id, entityId),
              eq(schema.exchangeRates.tenantId, tenantId)
            ))
            .limit(1);
          return exchangeRate || null;

        case 'bank_reconciliation':
          const [reconciliation] = await db
            .select()
            .from(schema.bankReconciliations)
            .where(and(
              eq(schema.bankReconciliations.id, entityId),
              eq(schema.bankReconciliations.tenantId, tenantId)
            ))
            .limit(1);
          return reconciliation || null;

        case 'item':
          const [item] = await db
            .select()
            .from(schema.items)
            .where(and(
              eq(schema.items.id, entityId),
              eq(schema.items.tenantId, tenantId)
            ))
            .limit(1);
          return item || null;

        case 'inventory_adjustment':
          const [adjustment] = await db
            .select()
            .from(schema.inventoryAdjustments)
            .where(and(
              eq(schema.inventoryAdjustments.id, entityId),
              eq(schema.inventoryAdjustments.tenantId, tenantId)
            ))
            .limit(1);
          return adjustment || null;

        case 'user':
          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, entityId))
            .limit(1);
          // Redact sensitive user data
          if (user) {
            const { passwordHash, ...safeUser } = user;
            return safeUser;
          }
          return null;

        case 'role':
          const [role] = await db
            .select()
            .from(schema.roles)
            .where(and(
              eq(schema.roles.id, entityId),
              eq(schema.roles.tenantId, tenantId)
            ))
            .limit(1);
          return role || null;

        case 'tenant_profile':
          const [profile] = await db
            .select()
            .from(schema.tenantCompanyProfiles)
            .where(eq(schema.tenantCompanyProfiles.tenantId, tenantId))
            .limit(1);
          return profile || null;

        default:
          // For unknown entity types, try to fetch from storage
          return null;
      }
    } catch (error) {
      console.error(`Failed to capture state for ${entityType}:${entityId}:`, error);
      return null;
    }
  }

  /**
   * Generate a hash for the audit log entry for tamper detection
   */
  static async generateLogHash(
    operation: string,
    entityType: string,
    entityId: string,
    beforeState: any,
    afterState: any,
    metadata?: any
  ): Promise<string> {
    const dataToHash = {
      operation,
      entityType,
      entityId,
      beforeState,
      afterState,
      metadata,
      timestamp: new Date().toISOString(),
      previousHash: this.previousLogHash,
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataToHash))
      .digest('hex');

    return hash;
  }

  /**
   * Store additional audit metadata for compliance reporting
   */
  static async storeAuditMetadata(
    tenantId: string,
    userId: string,
    operation: string,
    entityType: string,
    entityId: string,
    metadata: any
  ): Promise<void> {
    try {
      // Store in audit_metadata table (if exists) or as JSON in audit_logs
      // This is a placeholder for metadata storage
      // In production, this would write to a dedicated metadata table
      await db.insert(schema.auditLogs).values({
        tenantId,
        userId,
        action: `${operation}_metadata`,
        entityType: 'audit_metadata',
        entityId: `${entityType}_${entityId}`,
        changes: metadata,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        wasSuccessful: true,
      });
    } catch (error) {
      console.error('Failed to store audit metadata:', error);
    }
  }

  /**
   * Log system events (failed logins, permission denials, etc.)
   */
  static async logSystemEvent(
    event: {
      type: 'failed_login' | 'permission_denied' | 'rate_limit' | 'data_export' | 'report_generation' | 'bulk_operation';
      tenantId?: string;
      userId?: string;
      entityType?: string;
      entityId?: string;
      details?: any;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    const action = `system_${event.type}`;
    
    if (event.type === 'failed_login' || event.type === 'permission_denied') {
      // These are user actions
      await auditLogger.logUserAction({
        tenantId: event.tenantId || 'system',
        userId: event.userId || null,
        action,
        entityType: event.entityType || 'system',
        entityId: event.entityId || crypto.randomUUID(),
        changes: {
          before: null,
          after: event.details,
        },
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        wasSuccessful: false,
        errorMessage: event.details?.error || event.type,
      });
    } else {
      // These are data access events
      await auditLogger.logDataAccess({
        tenantId: event.tenantId || 'system',
        userId: event.userId || 'system',
        action,
        entityType: event.entityType || event.type,
        entityId: event.entityId || crypto.randomUUID(),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });
    }

    // Store session tracking
    if (event.sessionId) {
      await this.storeAuditMetadata(
        event.tenantId || 'system',
        event.userId || 'system',
        action,
        event.entityType || 'system',
        event.entityId || crypto.randomUUID(),
        {
          sessionId: event.sessionId,
          ...event.details,
        }
      );
    }
  }

  /**
   * Calculate and store retention policy metrics
   */
  static async enforceRetentionPolicy(): Promise<void> {
    // SOX requires 7-year retention
    // This would be called by a scheduled job
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    // Archive old logs (never delete)
    console.log(`Archiving audit logs older than ${sevenYearsAgo.toISOString()}`);
    // Implementation would move old logs to cold storage
  }

  /**
   * Track segregation of duties violations
   */
  static async checkSegregationOfDuties(
    userId: string,
    operation: string,
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<boolean> {
    // Check if the same user created and approved an entity
    // This is a simplified check - production would have more complex rules
    if (operation === 'approve' && (entityType === 'journal_entry' || entityType === 'invoice' || entityType === 'bill')) {
      // Check if the user created this entity
      const creationLog = await storage.getAuditLogs({
        tenantId,
        userId,
        action: 'create',
        entityType,
        entityId,
      });

      if (creationLog && creationLog.length > 0) {
        // User is trying to approve their own creation - violation
        await this.logSystemEvent({
          type: 'permission_denied',
          tenantId,
          userId,
          entityType,
          entityId,
          details: {
            violation: 'segregation_of_duties',
            reason: 'User cannot approve their own creation',
            originalAction: 'create',
            attemptedAction: 'approve',
          },
        });
        return false; // Deny the operation
      }
    }
    return true; // Allow the operation
  }

  /**
   * Log high-risk operations with additional context
   */
  static async logHighRiskOperation(
    operation: string,
    entityType: string,
    entityId: string,
    tenantId: string,
    userId: string,
    metadata: {
      riskLevel: 'high' | 'critical';
      reason: string;
      justification?: string;
      approvalRequired?: boolean;
      approvers?: string[];
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    // High-risk operations require justification
    if (!metadata.justification && metadata.riskLevel === 'critical') {
      throw new Error('Critical operations require justification');
    }

    await this.auditWrapper(
      `high_risk_${operation}`,
      entityType,
      entityId,
      tenantId,
      userId,
      async () => {
        // Log as high-risk
        return { logged: true };
      },
      {
        ...metadata,
        highRisk: true,
        riskLevel: metadata.riskLevel,
      }
    );
  }
}

// Export singleton instance and base audit logger
export const enhancedAuditLogger = AuditLoggerService;
export { auditLogger };

// Export convenience function for direct use
export const auditWrapper = AuditLoggerService.auditWrapper.bind(AuditLoggerService);
export const logSystemEvent = AuditLoggerService.logSystemEvent.bind(AuditLoggerService);
export const logHighRiskOperation = AuditLoggerService.logHighRiskOperation.bind(AuditLoggerService);
export const checkSegregationOfDuties = AuditLoggerService.checkSegregationOfDuties.bind(AuditLoggerService);