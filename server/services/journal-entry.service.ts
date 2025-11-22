/**
 * Journal Entry Service
 * 
 * CRITICAL: Double-entry accounting validation service
 * Ensures all journal entries maintain accounting equation integrity
 * 
 * Core Rules:
 * 1. Total debits MUST equal total credits (no exceptions)
 * 2. Minimum 2 lines per entry (at least one debit and one credit)
 * 3. Posted entries are immutable (cannot be edited or deleted)
 * 4. All calculations use Decimal.js to prevent rounding errors
 * 5. Auto-numbering follows JE-YYYY-00001 format
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import { 
  journalEntries, 
  journalEntryLegs,
  journalEntrySequences,
  accounts,
  type JournalEntry,
  type JournalEntryLeg,
  type InsertJournalEntry,
  type InsertJournalEntryLeg,
  type JournalEntryPayload
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, inArray, or } from 'drizzle-orm';
import { BusinessRulesError } from './business-rules.service';
import { withTransaction } from '../accounting/service';
import { enhancedAuditLogger } from './audit-logger.service';

// Configure Decimal.js for financial precision
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface JournalEntryLine {
  accountId: string;
  debit?: string | number | null;
  credit?: string | number | null;
  description?: string;
  lineNumber?: number;
}

export interface JournalEntryValidation {
  isValid: boolean;
  totalDebits: string;
  totalCredits: string;
  imbalance: string;
  errors: string[];
}

export interface ReversalOptions {
  reversalDate?: Date;
  description?: string;
  reason?: string;
}

export class JournalEntryService {
  /**
   * Validate that debits equal credits (fundamental accounting equation)
   * Returns detailed validation result
   */
  static validateDoubleEntry(lines: JournalEntryLine[]): JournalEntryValidation {
    const errors: string[] = [];
    
    // Minimum line requirement
    if (!lines || lines.length < 2) {
      errors.push('Journal entry must have at least 2 lines (minimum one debit and one credit)');
    }

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    let hasDebit = false;
    let hasCredit = false;

    // Calculate totals and validate each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Validate account selection
      if (!line.accountId) {
        errors.push(`Line ${i + 1}: Account must be selected`);
        continue;
      }

      // Parse amounts
      const debit = line.debit ? new Decimal(line.debit) : new Decimal(0);
      const credit = line.credit ? new Decimal(line.credit) : new Decimal(0);

      // Validate that line has either debit or credit (not both, not neither)
      if (debit.isZero() && credit.isZero()) {
        errors.push(`Line ${i + 1}: Must have either a debit or credit amount`);
      } else if (!debit.isZero() && !credit.isZero()) {
        errors.push(`Line ${i + 1}: Cannot have both debit and credit on same line`);
      }

      // Validate positive amounts
      if (debit.isNegative()) {
        errors.push(`Line ${i + 1}: Debit amount cannot be negative`);
      }
      if (credit.isNegative()) {
        errors.push(`Line ${i + 1}: Credit amount cannot be negative`);
      }

      // Track totals and presence
      if (!debit.isZero()) {
        totalDebits = totalDebits.add(debit);
        hasDebit = true;
      }
      if (!credit.isZero()) {
        totalCredits = totalCredits.add(credit);
        hasCredit = true;
      }
    }

    // Validate presence of both debits and credits
    if (!hasDebit) {
      errors.push('Journal entry must have at least one debit');
    }
    if (!hasCredit) {
      errors.push('Journal entry must have at least one credit');
    }

    // Calculate imbalance
    const imbalance = totalDebits.sub(totalCredits).abs();
    
    // Check if balanced (allowing for tiny rounding differences < 0.01)
    const isBalanced = imbalance.lessThan(0.01);
    if (!isBalanced) {
      errors.push(`Entry is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Imbalance: ${imbalance.toFixed(2)}`);
    }

    return {
      isValid: errors.length === 0,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      imbalance: imbalance.toFixed(2),
      errors
    };
  }

  /**
   * Generate next journal entry number
   * Format: JE-YYYY-00001
   */
  static async generateEntryNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}`;

    // Get the last sequence number for this year
    const [sequence] = await db
      .select()
      .from(journalEntrySequences)
      .where(
        and(
          eq(journalEntrySequences.tenantId, tenantId),
          eq(journalEntrySequences.prefix, prefix)
        )
      )
      .limit(1);

    let nextNumber = 1;
    
    if (sequence) {
      // Update existing sequence
      nextNumber = sequence.lastSequence + 1;
      await db
        .update(journalEntrySequences)
        .set({ 
          lastSequence: nextNumber,
          updatedAt: new Date()
        })
        .where(eq(journalEntrySequences.id, sequence.id));
    } else {
      // Create new sequence for this year
      await db
        .insert(journalEntrySequences)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          prefix,
          lastSequence: nextNumber,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }

    // Format with leading zeros (5 digits)
    const formattedNumber = String(nextNumber).padStart(5, '0');
    return `${prefix}-${formattedNumber}`;
  }

  /**
   * Validate all accounts exist and are active
   */
  static async validateAccounts(
    lines: JournalEntryLine[],
    tenantId: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const accountIds = lines.map(l => l.accountId).filter(Boolean);

    if (accountIds.length === 0) {
      return { isValid: false, errors: ['No accounts specified'] };
    }

    // Fetch all accounts in one query
    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          inArray(accounts.id, accountIds)
        )
      );

    const existingAccountIds = new Set(existingAccounts.map(a => a.id));
    const accountMap = new Map(existingAccounts.map(a => [a.id, a]));

    // Check each account
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.accountId) continue;

      if (!existingAccountIds.has(line.accountId)) {
        errors.push(`Line ${i + 1}: Account not found`);
      } else {
        const account = accountMap.get(line.accountId);
        if (account && !account.active) {
          errors.push(`Line ${i + 1}: Account "${account.name}" is inactive`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a journal entry can be edited
   * Posted entries cannot be modified
   */
  static canEditJournalEntry(entry: JournalEntry): boolean {
    if (!entry) return false;
    
    const immutableStatuses = ['posted', 'approved'];
    return !immutableStatuses.includes(entry.status);
  }

  /**
   * Check if a journal entry can be deleted
   * Only draft entries can be deleted
   */
  static canDeleteJournalEntry(entry: JournalEntry): boolean {
    if (!entry) return false;
    return entry.status === 'draft';
  }

  /**
   * Create a journal entry with atomic transaction
   */
  static async createJournalEntry(
    payload: JournalEntryPayload,
    userId: string
  ): Promise<JournalEntry> {
    // Validate double-entry
    const validation = this.validateDoubleEntry(payload.legs);
    if (!validation.isValid) {
      throw new BusinessRulesError(
        `Journal entry validation failed: ${validation.errors.join(', ')}`,
        'JOURNAL_ENTRY_VALIDATION_FAILED'
      );
    }

    // Validate accounts exist
    const accountValidation = await this.validateAccounts(payload.legs, payload.journalEntry.tenantId);
    if (!accountValidation.isValid) {
      throw new BusinessRulesError(
        `Account validation failed: ${accountValidation.errors.join(', ')}`,
        'ACCOUNT_VALIDATION_FAILED'
      );
    }

    // Generate entry number if not provided
    if (!payload.journalEntry.entryNumber) {
      payload.journalEntry.entryNumber = await this.generateEntryNumber(payload.journalEntry.tenantId);
    }

    // Use database transaction for atomicity
    return await withTransaction(async (trx) => {
      // Create journal entry
      const [entry] = await trx
        .insert(journalEntries)
        .values({
          ...payload.journalEntry,
          id: crypto.randomUUID(),
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: payload.journalEntry.status || 'draft',
          totalDebits: validation.totalDebits,
          totalCredits: validation.totalCredits
        })
        .returning();

      // Create journal entry legs (lines)
      const legsToInsert = payload.legs.map((leg, index) => ({
        id: crypto.randomUUID(),
        journalEntryId: entry.id,
        tenantId: entry.tenantId,
        accountId: leg.accountId,
        debit: leg.debit || leg.type === 'Debit' ? (leg.amount || leg.debit || '0') : null,
        credit: leg.credit || leg.type === 'Credit' ? (leg.amount || leg.credit || '0') : null,
        description: leg.description,
        lineNumber: leg.lineNumber || index + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await trx.insert(journalEntryLegs).values(legsToInsert);

      // Log audit trail
      await enhancedAuditLogger.logFinancialTransaction({
        tenantId: entry.tenantId,
        userId,
        action: 'create_journal_entry',
        entityType: 'journal_entry',
        entityId: entry.id,
        changes: {
          before: null,
          after: {
            ...entry,
            legs: legsToInsert
          }
        },
        wasSuccessful: true
      });

      return entry;
    });
  }

  /**
   * Update a journal entry (only if draft)
   */
  static async updateJournalEntry(
    id: string,
    tenantId: string,
    payload: JournalEntryPayload,
    userId: string
  ): Promise<JournalEntry> {
    // Fetch existing entry
    const [existingEntry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existingEntry) {
      throw new BusinessRulesError('Journal entry not found', 'JOURNAL_ENTRY_NOT_FOUND');
    }

    // Check if can be edited
    if (!this.canEditJournalEntry(existingEntry)) {
      throw new BusinessRulesError(
        `Cannot edit journal entry with status: ${existingEntry.status}`,
        'JOURNAL_ENTRY_NOT_EDITABLE'
      );
    }

    // Validate double-entry
    const validation = this.validateDoubleEntry(payload.legs);
    if (!validation.isValid) {
      throw new BusinessRulesError(
        `Journal entry validation failed: ${validation.errors.join(', ')}`,
        'JOURNAL_ENTRY_VALIDATION_FAILED'
      );
    }

    // Validate accounts
    const accountValidation = await this.validateAccounts(payload.legs, tenantId);
    if (!accountValidation.isValid) {
      throw new BusinessRulesError(
        `Account validation failed: ${accountValidation.errors.join(', ')}`,
        'ACCOUNT_VALIDATION_FAILED'
      );
    }

    return await withTransaction(async (trx) => {
      // Update journal entry
      const [updatedEntry] = await trx
        .update(journalEntries)
        .set({
          ...payload.journalEntry,
          updatedAt: new Date(),
          totalDebits: validation.totalDebits,
          totalCredits: validation.totalCredits
        })
        .where(
          and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          )
        )
        .returning();

      // Delete existing legs
      await trx
        .delete(journalEntryLegs)
        .where(eq(journalEntryLegs.journalEntryId, id));

      // Insert new legs
      const legsToInsert = payload.legs.map((leg, index) => ({
        id: crypto.randomUUID(),
        journalEntryId: id,
        tenantId,
        accountId: leg.accountId,
        debit: leg.debit || leg.type === 'Debit' ? (leg.amount || leg.debit || '0') : null,
        credit: leg.credit || leg.type === 'Credit' ? (leg.amount || leg.credit || '0') : null,
        description: leg.description,
        lineNumber: leg.lineNumber || index + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await trx.insert(journalEntryLegs).values(legsToInsert);

      // Log audit trail
      await enhancedAuditLogger.logFinancialTransaction({
        tenantId,
        userId,
        action: 'update_journal_entry',
        entityType: 'journal_entry',
        entityId: id,
        changes: {
          before: existingEntry,
          after: updatedEntry
        },
        wasSuccessful: true
      });

      return updatedEntry;
    });
  }

  /**
   * Post a journal entry (make it permanent)
   */
  static async postJournalEntry(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<JournalEntry> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!entry) {
      throw new BusinessRulesError('Journal entry not found', 'JOURNAL_ENTRY_NOT_FOUND');
    }

    if (entry.status === 'posted') {
      throw new BusinessRulesError('Journal entry is already posted', 'JOURNAL_ENTRY_ALREADY_POSTED');
    }

    // Fetch legs to validate before posting
    const legs = await db
      .select()
      .from(journalEntryLegs)
      .where(eq(journalEntryLegs.journalEntryId, id));

    // Convert legs to validation format
    const linesForValidation = legs.map(leg => ({
      accountId: leg.accountId,
      debit: leg.debit,
      credit: leg.credit,
      description: leg.description || undefined
    }));

    // Final validation before posting
    const validation = this.validateDoubleEntry(linesForValidation);
    if (!validation.isValid) {
      throw new BusinessRulesError(
        `Cannot post unbalanced entry: ${validation.errors.join(', ')}`,
        'JOURNAL_ENTRY_UNBALANCED'
      );
    }

    // Update status to posted
    const [postedEntry] = await db
      .update(journalEntries)
      .set({
        status: 'posted',
        postedAt: new Date(),
        postedBy: userId,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .returning();

    // Log audit trail
    await enhancedAuditLogger.logFinancialTransaction({
      tenantId,
      userId,
      action: 'post_journal_entry',
      entityType: 'journal_entry',
      entityId: id,
      changes: {
        before: { status: entry.status },
        after: { status: 'posted' }
      },
      wasSuccessful: true
    });

    return postedEntry;
  }

  /**
   * Create a reversal journal entry
   * Swaps all debits and credits from the original entry
   */
  static async createReversalEntry(
    originalEntryId: string,
    tenantId: string,
    userId: string,
    options: ReversalOptions = {}
  ): Promise<JournalEntry> {
    // Fetch original entry
    const [originalEntry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, originalEntryId),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!originalEntry) {
      throw new BusinessRulesError('Original journal entry not found', 'JOURNAL_ENTRY_NOT_FOUND');
    }

    // Fetch original legs
    const originalLegs = await db
      .select()
      .from(journalEntryLegs)
      .where(eq(journalEntryLegs.journalEntryId, originalEntryId));

    if (originalLegs.length === 0) {
      throw new BusinessRulesError('Original journal entry has no lines', 'JOURNAL_ENTRY_NO_LINES');
    }

    // Create reversal legs (swap debits and credits)
    const reversalLegs = originalLegs.map(leg => ({
      accountId: leg.accountId,
      debit: leg.credit, // Swap credit to debit
      credit: leg.debit, // Swap debit to credit
      description: `Reversal of: ${leg.description || originalEntry.description || ''}`,
      type: leg.debit ? 'Credit' : 'Debit' // Swap type
    }));

    // Generate entry number for reversal
    const entryNumber = await this.generateEntryNumber(tenantId);

    // Create reversal payload
    const reversalPayload: JournalEntryPayload = {
      journalEntry: {
        tenantId,
        entryNumber,
        entryDate: options.reversalDate ? options.reversalDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: options.description || `Reversal of ${originalEntry.entryNumber}: ${originalEntry.description || ''}`,
        notes: options.reason ? `Reversal reason: ${options.reason}` : `Reversal of journal entry ${originalEntry.entryNumber}`,
        status: 'draft',
        reversalOfId: originalEntryId, // Link to original entry
        sourceType: 'reversal',
        sourceId: originalEntryId
      },
      legs: reversalLegs
    };

    // Create the reversal entry
    const reversalEntry = await this.createJournalEntry(reversalPayload, userId);

    // Update original entry to mark it as reversed
    await db
      .update(journalEntries)
      .set({
        reversedById: reversalEntry.id,
        reversedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(journalEntries.id, originalEntryId));

    // Log audit trail
    await enhancedAuditLogger.logFinancialTransaction({
      tenantId,
      userId,
      action: 'create_reversal_journal_entry',
      entityType: 'journal_entry',
      entityId: reversalEntry.id,
      changes: {
        before: null,
        after: {
          reversalEntry,
          originalEntryId,
          reason: options.reason
        }
      },
      wasSuccessful: true
    });

    return reversalEntry;
  }

  /**
   * Get journal entries with filtering
   */
  static async getJournalEntries(
    tenantId: string,
    filters: {
      status?: string;
      startDate?: string;
      endDate?: string;
      accountId?: string;
      search?: string;
    } = {}
  ): Promise<JournalEntry[]> {
    let query = db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.tenantId, tenantId));

    // Apply filters
    const conditions = [eq(journalEntries.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(journalEntries.status, filters.status));
    }

    if (filters.startDate) {
      conditions.push(gte(journalEntries.entryDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(journalEntries.entryDate, filters.endDate));
    }

    if (filters.search) {
      conditions.push(
        or(
          sql`${journalEntries.entryNumber} ILIKE ${`%${filters.search}%`}`,
          sql`${journalEntries.description} ILIKE ${`%${filters.search}%`}`,
          sql`${journalEntries.notes} ILIKE ${`%${filters.search}%`}`
        )
      );
    }

    const entries = await db
      .select()
      .from(journalEntries)
      .where(and(...conditions))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));

    // If filtering by account, we need to join with legs
    if (filters.accountId) {
      const entryIds = await db
        .select({ journalEntryId: journalEntryLegs.journalEntryId })
        .from(journalEntryLegs)
        .where(
          and(
            eq(journalEntryLegs.tenantId, tenantId),
            eq(journalEntryLegs.accountId, filters.accountId)
          )
        )
        .groupBy(journalEntryLegs.journalEntryId);

      const filteredEntryIds = entryIds.map(e => e.journalEntryId);
      return entries.filter(e => filteredEntryIds.includes(e.id));
    }

    return entries;
  }

  /**
   * Get a single journal entry with its legs
   */
  static async getJournalEntryWithLegs(
    id: string,
    tenantId: string
  ): Promise<{ entry: JournalEntry; legs: JournalEntryLeg[] } | null> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!entry) {
      return null;
    }

    const legs = await db
      .select()
      .from(journalEntryLegs)
      .where(eq(journalEntryLegs.journalEntryId, id))
      .orderBy(journalEntryLegs.lineNumber);

    return { entry, legs };
  }
}

// Export for use in other modules
export default JournalEntryService;