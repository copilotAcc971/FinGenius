import type { IStorage } from '../storage';
import type { InsertAuditLog } from '@shared/schema';

/**
 * AuditLogger - Centralized service for SOX-compliant audit logging
 * 
 * Implements SOX Section 802 requirements for maintaining immutable audit trails
 * of all financial transactions, user actions, and data access for 7 years.
 * 
 * CRITICAL COMPLIANCE RULES:
 * 1. All audit logs are immutable (no delete/update operations)
 * 2. Sensitive data (passwords, card numbers, SSNs) MUST be redacted
 * 3. Log both successful and failed operations
 * 4. Capture IP address and user agent for all actions
 * 5. Include before/after states for all modifications
 */
export class AuditLogger {
  constructor(private storage: IStorage) {}

  /**
   * Log a financial transaction (create, update, delete, approve, post, reverse)
   * 
   * @example
   * await auditLogger.logFinancialTransaction({
   *   tenantId: 'tenant_123',
   *   userId: 'user_456',
   *   action: 'create',
   *   entityType: 'invoice',
   *   entityId: 'inv_789',
   *   changes: { before: null, after: invoice },
   *   ipAddress: req.ip,
   *   userAgent: req.get('user-agent'),
   *   wasSuccessful: true,
   * });
   */
  async logFinancialTransaction(params: {
    tenantId: string;
    userId: string | null;
    action: string; // create, update, delete, approve, post, reverse
    entityType: string; // invoice, bill, payment, journal_entry, etc.
    entityId: string;
    changes?: { before: any; after: any };
    ipAddress?: string;
    userAgent?: string;
    wasSuccessful?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const log: InsertAuditLog = {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes ? this.redactSensitiveData(params.changes) : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      wasSuccessful: params.wasSuccessful ?? true,
      errorMessage: params.errorMessage,
    };

    try {
      await this.storage.createAuditLog(log);
    } catch (error) {
      // Never fail the main operation due to audit log failure
      // But log the error for monitoring
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Log user actions (login, logout, password_change, permission_change, etc.)
   * 
   * @example
   * await auditLogger.logUserAction({
   *   tenantId: 'tenant_123',
   *   userId: 'user_456',
   *   action: 'login',
   *   entityType: 'session',
   *   entityId: 'session_789',
   *   ipAddress: req.ip,
   *   userAgent: req.get('user-agent'),
   *   wasSuccessful: true,
   * });
   */
  async logUserAction(params: {
    tenantId: string;
    userId: string | null;
    action: string; // login, logout, password_change, permission_change, role_assignment
    entityType: string; // user, role, session, permission
    entityId: string;
    changes?: { before: any; after: any };
    ipAddress?: string;
    userAgent?: string;
    wasSuccessful?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    // Ensure entityType is user-action specific, don't reuse financial transaction types
    const log: InsertAuditLog = {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType, // Will be 'user', 'role', 'session', NOT 'invoice', 'bill'
      entityId: params.entityId,
      changes: params.changes ? this.redactSensitiveData(params.changes) : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      wasSuccessful: params.wasSuccessful ?? true,
      errorMessage: params.errorMessage,
    };

    try {
      await this.storage.createAuditLog(log);
    } catch (error) {
      // Never fail the main operation due to audit log failure
      // But log the error for monitoring
      console.error('[AuditLogger] Failed to log user action:', error);
    }
  }

  /**
   * Log data access events (report generation, exports, downloads)
   * 
   * @example
   * await auditLogger.logDataAccess({
   *   tenantId: 'tenant_123',
   *   userId: 'user_456',
   *   action: 'export',
   *   entityType: 'profit_loss_report',
   *   entityId: 'report_2024_q4',
   *   ipAddress: req.ip,
   *   userAgent: req.get('user-agent'),
   * });
   */
  async logDataAccess(params: {
    tenantId: string;
    userId: string;
    action: string; // read, export, download
    entityType: string; // report, invoice_list, customer_data
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.logFinancialTransaction({
      ...params,
      wasSuccessful: true,
    });
  }

  /**
   * Redact sensitive data from changes object (SOX compliance requirement)
   * 
   * Redacts:
   * - Passwords (any field containing 'password')
   * - Credit card numbers (card_number, cardNumber, etc.)
   * - SSNs (ssn, socialSecurityNumber, etc.)
   * - Bank account numbers (account_number, accountNumber, etc.)
   * 
   * @private
   */
  private redactSensitiveData(changes: { before: any; after: any }): { before: any; after: any } {
    const sensitiveFields = [
      'password',
      'passwordHash',
      'card_number',
      'cardNumber',
      'cvv',
      'cvc',
      'ssn',
      'socialSecurityNumber',
      'account_number',
      'accountNumber',
      'routingNumber',
      'routing_number',
      'pin',
    ];

    const redact = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(redact);

      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        if (sensitiveFields.some(field => keyLower.includes(field.toLowerCase()))) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = redact(value);
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    };

    return {
      before: redact(changes.before),
      after: redact(changes.after),
    };
  }
}
