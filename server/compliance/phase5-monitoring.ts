/**
 * Phase 5: Comprehensive Transaction Monitoring
 * 
 * Wires transaction monitoring to all financial endpoints:
 * - Journal entries (create, post, reverse, delete)
 * - Debit notes (post, delete)
 * - Vendor payments (create, refund, adjust)
 * - Customer/vendor updates (risk recalculation)
 */

import type { JournalEntry, DebitNote, Payment, Customer } from '@shared/schema';
import { TransactionMonitoringService } from './transaction-monitoring';
import { RiskScoringService } from './risk-scoring';
import { SanctionsScreeningService } from './sanctions-screening';

export interface MonitoringContext {
  tenantId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Monitor journal entry operations
 * CRITICAL: Executed after every journal entry change
 */
export async function monitorJournalEntryOperation(
  monitoringService: TransactionMonitoringService,
  context: MonitoringContext,
  operation: 'create' | 'post' | 'reverse' | 'delete',
  journalEntry: JournalEntry,
  amount?: number
): Promise<void> {
  const totalAmount = amount || 0;

  await monitoringService.monitorTransaction(context.tenantId, {
    id: journalEntry.id,
    type: 'journal_entry',
    operation,
    amount: totalAmount,
    date: journalEntry.entryDate || new Date(),
    description: journalEntry.description,
    sourceDocument: journalEntry.sourceDocumentId,
    metadata: {
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      journalEntryNumber: journalEntry.journalEntryNumber,
      status: journalEntry.status,
    },
  }).catch(err => {
    console.error('[TransactionMonitoring] Failed to monitor journal entry:', err);
  });
}

/**
 * Monitor debit note operations
 * CRITICAL: Tracks supply chain and vendor risk
 */
export async function monitorDebitNoteOperation(
  monitoringService: TransactionMonitoringService,
  context: MonitoringContext,
  operation: 'create' | 'post' | 'delete',
  debitNote: DebitNote,
  amount?: number
): Promise<void> {
  const totalAmount = amount || 0;

  await monitoringService.monitorTransaction(context.tenantId, {
    id: debitNote.id,
    type: 'debit_note',
    operation,
    amount: totalAmount,
    date: debitNote.noteDate || new Date(),
    customerId: debitNote.vendorId, // Vendor is the customer party for debit notes
    description: debitNote.reason,
    metadata: {
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      vendorId: debitNote.vendorId,
      status: debitNote.status,
      reason: debitNote.reason,
    },
  }).catch(err => {
    console.error('[TransactionMonitoring] Failed to monitor debit note:', err);
  });
}

/**
 * Monitor vendor payment operations
 * CRITICAL: Tracks payment flows and refunds
 */
export async function monitorPaymentOperation(
  monitoringService: TransactionMonitoringService,
  context: MonitoringContext,
  operation: 'create' | 'refund' | 'adjust' | 'reverse',
  payment: Payment,
  amount: number
): Promise<void> {
  await monitoringService.monitorTransaction(context.tenantId, {
    id: payment.id,
    type: 'payment',
    operation,
    amount,
    date: payment.date ? new Date(payment.date) : new Date(),
    customerId: payment.customerId,
    currency: payment.currency,
    description: `Payment ${operation}: ${payment.referenceNumber || 'N/A'}`,
    metadata: {
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      referenceNumber: payment.referenceNumber,
    },
  }).catch(err => {
    console.error('[TransactionMonitoring] Failed to monitor payment:', err);
  });
}

/**
 * Re-evaluate customer/vendor risk on updates
 * CRITICAL: Runs risk scoring and sanctions screening on every update
 */
export async function reevaluateEntityRisk(
  riskScoringService: RiskScoringService,
  sanctionsScreeningService: SanctionsScreeningService,
  tenantId: string,
  entity: Customer,
  entityType: 'customer' | 'vendor'
): Promise<{
  riskScore: number;
  riskLevel: string;
  sanctionsMatch: boolean;
}> {
  try {
    // 1. Recalculate risk score
    const riskAssessment = riskScoringService.calculateCustomerRiskScore(entity);

    // 2. Re-screen against sanctions
    const sanctionsResult = await sanctionsScreeningService.screenEntity({
      tenantId,
      entityType: entityType === 'customer' ? 'customer' : 'vendor',
      entityId: entity.id,
      name: entity.displayName,
      country: entity.billingAddress?.country,
      taxId: entity.taxId,
    });

    return {
      riskScore: riskAssessment.overallRiskScore,
      riskLevel: riskAssessment.riskLevel,
      sanctionsMatch: sanctionsResult.matched,
    };
  } catch (error) {
    console.error('[RiskScoring] Failed to re-evaluate entity risk:', error);
    return {
      riskScore: 0,
      riskLevel: 'unknown',
      sanctionsMatch: false,
    };
  }
}

/**
 * Comprehensive audit context for financial operations
 */
export function createAuditContext(
  req: any,
  operation: string,
  entityType: string,
  entityId: string
): {
  tenantId: string;
  userId: string;
  operation: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
} {
  return {
    tenantId: req.tenantId,
    userId: req.user?.claims?.sub || 'unknown',
    operation,
    entityType,
    entityId,
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    timestamp: new Date(),
  };
}
