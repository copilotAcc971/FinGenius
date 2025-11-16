import { db } from '../db';
import { bankTransactions, journalEntries, accountTransactionHistory } from '@shared/schema';
import { eq, and, isNull, sql, between, gte, lte } from 'drizzle-orm';
import OpenAI from 'openai';

interface ReconciliationMatch {
  transactionId: string;
  journalEntryId: string;
  confidence: number; // 0-100
  matchType: 'exact' | 'amount' | 'date_amount' | 'ai_suggested';
  reason: string;
}

export class ReconciliationService {
  private openai: OpenAI | null = null;
  
  constructor(private tenantId: string) {
    // Only instantiate OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      console.warn('[ReconciliationService] OpenAI API key not found - AI matching disabled');
    }
  }

  /**
   * Get suggested matches for a bank transaction using AI
   */
  async getSuggestedMatches(transactionId: string): Promise<ReconciliationMatch[]> {
    // Get the bank transaction
    const [transaction] = await db.select()
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.id, transactionId),
        eq(bankTransactions.tenantId, this.tenantId),
        isNull(bankTransactions.matchedJournalEntryId)
      ))
      .limit(1);

    if (!transaction) {
      throw new Error('Transaction not found or already matched');
    }

    // Get unmatched journal entries within ±7 days of transaction date
    const dateBuffer = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const startDate = new Date(new Date(transaction.date).getTime() - dateBuffer);
    const endDate = new Date(new Date(transaction.date).getTime() + dateBuffer);

    const candidateJournalEntries = await db.select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.tenantId, this.tenantId),
        between(journalEntries.transactionDate, startDate, endDate),
        eq(journalEntries.status, 'posted')
      ))
      .limit(50);

    const matches: ReconciliationMatch[] = [];

    // Rule 1: Exact amount match on same date
    candidateJournalEntries.forEach(entry => {
      if (
        Math.abs(parseFloat(entry.totalAmount) - parseFloat(transaction.amount)) < 0.01 &&
        entry.transactionDate.toDateString() === transaction.date.toDateString()
      ) {
        matches.push({
          transactionId: transaction.id,
          journalEntryId: entry.id,
          confidence: 95,
          matchType: 'exact',
          reason: 'Exact amount and date match',
        });
      }
    });

    // Rule 2: Exact amount match within date range
    candidateJournalEntries.forEach(entry => {
      if (
        Math.abs(parseFloat(entry.totalAmount) - parseFloat(transaction.amount)) < 0.01 &&
        !matches.find(m => m.journalEntryId === entry.id)
      ) {
        const daysDiff = Math.abs(
          (new Date(entry.transactionDate).getTime() - new Date(transaction.date).getTime()) / 
          (24 * 60 * 60 * 1000)
        );
        matches.push({
          transactionId: transaction.id,
          journalEntryId: entry.id,
          confidence: Math.max(70 - daysDiff * 5, 50),
          matchType: 'amount',
          reason: `Exact amount match (${daysDiff} days apart)`,
        });
      }
    });

    // Rule 3: AI-powered fuzzy matching (ONLY if OpenAI available)
    if (this.openai && matches.length < 3 && candidateJournalEntries.length > 0) {
      try {
        const aiMatches = await this.getAIMatches(transaction, candidateJournalEntries);
        matches.push(...aiMatches.filter(m => !matches.find(em => em.journalEntryId === m.journalEntryId)));
      } catch (error) {
        console.error('[ReconciliationService] AI matching error (non-critical):', error);
        // Gracefully continue with rule-based matches only
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  /**
   * Use OpenAI to suggest matches based on descriptions and context
   */
  private async getAIMatches(
    transaction: any,
    journalEntries: any[]
  ): Promise<ReconciliationMatch[]> {
    // Guard: Return empty if OpenAI not available
    if (!this.openai) {
      return [];
    }
    
    try {
      const prompt = `
You are a bank reconciliation assistant. Match this bank transaction with the most likely journal entry.

Bank Transaction:
- Date: ${transaction.date}
- Amount: ${transaction.amount} ${transaction.currency}
- Description: ${transaction.description || 'N/A'}
- Type: ${transaction.type}

Candidate Journal Entries:
${journalEntries.map((entry, idx) => `
${idx + 1}. ID: ${entry.id}
   Date: ${entry.transactionDate}
   Amount: ${entry.totalAmount}
   Reference: ${entry.referenceNumber || 'N/A'}
   Notes: ${entry.notes || 'N/A'}
`).join('\n')}

Respond with a JSON array of matches (up to 3), each with:
- journalEntryId: string
- confidence: number (0-100)
- reason: string (brief explanation)

Only include matches with confidence >= 40.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"matches":[]}');
      
      return (result.matches || []).map((match: any) => ({
        transactionId: transaction.id,
        journalEntryId: match.journalEntryId,
        confidence: match.confidence,
        matchType: 'ai_suggested' as const,
        reason: match.reason,
      }));
    } catch (error) {
      console.error('[ReconciliationService] OpenAI API error:', error);
      // Gracefully return empty array if OpenAI fails
      return [];
    }
  }

  /**
   * Manually match a transaction with a journal entry
   */
  async matchTransaction(transactionId: string, journalEntryId: string): Promise<void> {
    // Start a transaction for atomicity
    await db.transaction(async (tx) => {
      // Verify journal entry exists and belongs to tenant
      const [journalEntry] = await tx.select()
        .from(journalEntries)
        .where(and(
          eq(journalEntries.id, journalEntryId),
          eq(journalEntries.tenantId, this.tenantId)
        ))
        .limit(1);

      if (!journalEntry) {
        throw new Error('Journal entry not found or access denied');
      }

      // CRITICAL: Update bank transaction with matched journal entry ID
      const result = await tx.update(bankTransactions)
        .set({ 
          matchedJournalEntryId: journalEntryId,
          // Also update sync timestamp
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.tenantId, this.tenantId),
          // Prevent overwriting existing matches (idempotency)
          isNull(bankTransactions.matchedJournalEntryId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Transaction not found, already matched, or access denied');
      }

      console.log('[ReconciliationService] Matched transaction', {
        transactionId,
        journalEntryId,
        tenantId: this.tenantId,
      });
    });
  }

  /**
   * Unmatch a transaction
   */
  async unmatchTransaction(transactionId: string): Promise<void> {
    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      await tx.update(bankTransactions)
        .set({ 
          matchedJournalEntryId: null,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.tenantId, this.tenantId)
        ));
    });

    console.log('[ReconciliationService] Unmatched transaction', {
      transactionId,
      tenantId: this.tenantId,
    });
  }

  /**
   * Get reconciliation summary for an account
   */
  async getReconciliationSummary(accountId: string): Promise<{
    matched: number;
    unmatched: number;
    totalTransactions: number;
    matchedAmount: string;
    unmatchedAmount: string;
  }> {
    const [summary] = await db.select({
      matched: sql<number>`COUNT(CASE WHEN matched_journal_entry_id IS NOT NULL THEN 1 END)::int`,
      unmatched: sql<number>`COUNT(CASE WHEN matched_journal_entry_id IS NULL THEN 1 END)::int`,
      totalTransactions: sql<number>`COUNT(*)::int`,
      matchedAmount: sql<string>`COALESCE(SUM(CASE WHEN matched_journal_entry_id IS NOT NULL THEN amount ELSE 0 END), 0)`,
      unmatchedAmount: sql<string>`COALESCE(SUM(CASE WHEN matched_journal_entry_id IS NULL THEN amount ELSE 0 END), 0)`,
    })
    .from(bankTransactions)
    .where(and(
      eq(bankTransactions.accountId, accountId),
      eq(bankTransactions.tenantId, this.tenantId)
    ));

    return summary;
  }
}
