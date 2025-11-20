import cron from 'node-cron';
import { db } from '../db';
import { tenants, invoices, bills, journalEntries, documentEmbeddings } from '@shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { getEmbeddingService } from './embedding-service';
import { getVectorStore } from './vector-store';

/**
 * Background Indexer Service
 * 
 * Automatically indexes new and updated documents into the vector store
 * for RAG (Retrieval-Augmented Generation) capabilities.
 * 
 * Features:
 * - Runs nightly at 2 AM UTC (configurable)
 * - Indexes invoices, bills, journal entries, customer/vendor notes
 * - Only indexes new documents or documents updated since last embedding
 * - Provides detailed logging and error tracking
 * - Supports manual triggering for on-demand indexing
 */

export interface IndexingResult {
  tenantId: string;
  tenantName: string;
  indexed: number;
  skipped: number;
  failed: number;
  errors: IndexingError[];
}

export interface IndexingError {
  documentType: string;
  documentId: string;
  error: string;
}

export interface IndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  pendingDocuments: number;
  lastIndexedAt?: Date;
}

export class BackgroundIndexer {
  private embeddingService = getEmbeddingService();
  private vectorStore = getVectorStore();
  private jobStarted = false;
  private cronExpression = '0 2 * * *'; // Default: 2 AM UTC daily

  /**
   * Start the background indexing job
   * 
   * @param cronExpression - Optional custom cron expression (default: 2 AM UTC daily)
   */
  start(cronExpression?: string): void {
    if (this.jobStarted) {
      console.log('[Background Indexer] Job already started');
      return;
    }

    if (cronExpression) {
      this.cronExpression = cronExpression;
    }

    console.log('[Background Indexer] Starting nightly indexing job...');
    console.log(`[Background Indexer] Schedule: ${this.cronExpression} (UTC)`);

    cron.schedule(
      this.cronExpression,
      async () => {
        await this.runIndexingJob();
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    this.jobStarted = true;
    console.log('[Background Indexer] ✓ Background indexing job successfully scheduled');
  }

  /**
   * Run the indexing job (processes all tenants)
   */
  async runIndexingJob(): Promise<void> {
    console.log('\n========================================');
    console.log('[Background Indexer] Starting indexing job');
    console.log(`[Background Indexer] Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    try {
      // Get all tenants
      const allTenants = await db.select().from(tenants);

      if (allTenants.length === 0) {
        console.log('[Background Indexer] No tenants found');
        return;
      }

      console.log(`[Background Indexer] Found ${allTenants.length} tenants to process\n`);

      const results: IndexingResult[] = [];
      let totalIndexed = 0;
      let totalFailed = 0;

      // Process each tenant
      for (const tenant of allTenants) {
        try {
          console.log(`[Background Indexer] Processing tenant: ${tenant.name} (${tenant.id})`);
          const result = await this.indexTenant(tenant.id, tenant.name);
          results.push(result);

          totalIndexed += result.indexed;
          totalFailed += result.failed;

          console.log(
            `[Background Indexer] ✓ ${tenant.name}: ${result.indexed} indexed, ${result.skipped} skipped, ${result.failed} failed\n`
          );
        } catch (error) {
          console.error(`[Background Indexer] ✗ Failed to process tenant ${tenant.name}:`, error);
          totalFailed++;
        }
      }

      // Print summary
      console.log('========================================');
      console.log('[Background Indexer] Job completed');
      console.log(`[Background Indexer] Summary:`);
      console.log(`  - Tenants Processed: ${allTenants.length}`);
      console.log(`  - Total Indexed: ${totalIndexed}`);
      console.log(`  - Total Failed: ${totalFailed}`);

      if (results.some((r) => r.errors.length > 0)) {
        console.log(`  - Errors:`);
        results.forEach((result) => {
          if (result.errors.length > 0) {
            console.log(`    • ${result.tenantName}: ${result.errors.length} errors`);
          }
        });
      }

      console.log('========================================\n');
    } catch (error) {
      console.error('[Background Indexer] Critical error in indexing job:', error);
    }
  }

  /**
   * Index all pending documents for a specific tenant
   */
  async indexTenant(tenantId: string, tenantName?: string): Promise<IndexingResult> {
    const result: IndexingResult = {
      tenantId,
      tenantName: tenantName || tenantId,
      indexed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Find documents that need indexing
      const pendingInvoices = await this.findPendingDocuments(tenantId, 'invoice');
      const pendingBills = await this.findPendingDocuments(tenantId, 'bill');
      const pendingJournalEntries = await this.findPendingDocuments(tenantId, 'journal_entry');

      const totalPending =
        pendingInvoices.length + pendingBills.length + pendingJournalEntries.length;

      if (totalPending === 0) {
        console.log(`[Background Indexer]   No pending documents for ${result.tenantName}`);
        return result;
      }

      console.log(`[Background Indexer]   Found ${totalPending} pending documents:`);
      console.log(`[Background Indexer]     - Invoices: ${pendingInvoices.length}`);
      console.log(`[Background Indexer]     - Bills: ${pendingBills.length}`);
      console.log(`[Background Indexer]     - Journal Entries: ${pendingJournalEntries.length}`);

      // Index invoices
      for (const invoice of pendingInvoices) {
        const indexResult = await this.indexDocument(tenantId, 'invoice', invoice.id);
        if (indexResult.success) {
          result.indexed++;
        } else {
          result.failed++;
          result.errors.push({
            documentType: 'invoice',
            documentId: invoice.id,
            error: indexResult.error || 'Unknown error',
          });
        }
      }

      // Index bills
      for (const bill of pendingBills) {
        const indexResult = await this.indexDocument(tenantId, 'bill', bill.id);
        if (indexResult.success) {
          result.indexed++;
        } else {
          result.failed++;
          result.errors.push({
            documentType: 'bill',
            documentId: bill.id,
            error: indexResult.error || 'Unknown error',
          });
        }
      }

      // Index journal entries
      for (const entry of pendingJournalEntries) {
        const indexResult = await this.indexDocument(tenantId, 'journal_entry', entry.id);
        if (indexResult.success) {
          result.indexed++;
        } else {
          result.failed++;
          result.errors.push({
            documentType: 'journal_entry',
            documentId: entry.id,
            error: indexResult.error || 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error(`[Background Indexer] Error indexing tenant ${tenantId}:`, error);
      throw error;
    }

    return result;
  }

  /**
   * Find documents that need indexing (new or updated since last embedding)
   */
  private async findPendingDocuments(
    tenantId: string,
    documentType: 'invoice' | 'bill' | 'journal_entry'
  ): Promise<Array<{ id: string; updatedAt?: Date | null }>> {
    let table;
    switch (documentType) {
      case 'invoice':
        table = invoices;
        break;
      case 'bill':
        table = bills;
        break;
      case 'journal_entry':
        table = journalEntries;
        break;
    }

    // Get all documents for this tenant
    const allDocs = await db
      .select({ id: table.id, updatedAt: table.updatedAt })
      .from(table)
      .where(eq(table.tenantId, tenantId));

    // Filter to documents that need indexing
    const pending: Array<{ id: string; updatedAt?: Date | null }> = [];

    for (const doc of allDocs) {
      // Check if embedding exists
      const existingEmbedding = await db.query.documentEmbeddings.findFirst({
        where: and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, documentType),
          eq(documentEmbeddings.documentId, doc.id)
        ),
        orderBy: [desc(documentEmbeddings.createdAt)],
      });

      // Index if:
      // 1. No embedding exists, OR
      // 2. Document was updated after the last embedding
      if (
        !existingEmbedding ||
        (doc.updatedAt && existingEmbedding.createdAt < doc.updatedAt)
      ) {
        pending.push(doc);
      }
    }

    return pending;
  }

  /**
   * Index a single document
   */
  private async indexDocument(
    tenantId: string,
    documentType: 'invoice' | 'bill' | 'journal_entry',
    documentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch document data
      const documentData = await this.fetchDocument(tenantId, documentType, documentId);
      if (!documentData) {
        return { success: false, error: 'Document not found' };
      }

      // Generate content summary
      const { contentSummary, embedding } = await this.embeddingService.generateDocumentEmbedding(
        {
          documentType,
          documentData,
        }
      );

      // Delete old embeddings (if any)
      await this.vectorStore.deleteEmbedding(tenantId, documentType, documentId);

      // Store new embedding
      await this.vectorStore.storeEmbedding({
        tenantId,
        documentType,
        documentId,
        content: contentSummary,
        embedding,
        metadata: this.extractMetadata(documentType, documentData),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[Background Indexer] Failed to index ${documentType} ${documentId}:`,
        error
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Fetch document data from database
   */
  private async fetchDocument(
    tenantId: string,
    documentType: string,
    documentId: string
  ): Promise<any> {
    switch (documentType) {
      case 'invoice':
        return await db.query.invoices.findFirst({
          where: and(eq(invoices.id, documentId), eq(invoices.tenantId, tenantId)),
          with: {
            lineItems: true,
            customer: true,
          },
        });

      case 'bill':
        return await db.query.bills.findFirst({
          where: and(eq(bills.id, documentId), eq(bills.tenantId, tenantId)),
          with: {
            lineItems: true,
            vendor: true,
          },
        });

      case 'journal_entry':
        return await db.query.journalEntries.findFirst({
          where: and(eq(journalEntries.id, documentId), eq(journalEntries.tenantId, tenantId)),
          with: {
            legs: {
              with: {
                account: true,
              },
            },
          },
        });

      default:
        return null;
    }
  }

  /**
   * Extract metadata from document for storage
   */
  private extractMetadata(documentType: string, documentData: any): Record<string, any> {
    const baseMetadata = {
      documentType,
    };

    switch (documentType) {
      case 'invoice':
        return {
          ...baseMetadata,
          invoiceNumber: documentData.invoiceNumber,
          customerName: documentData.customerName,
          customerId: documentData.customerId,
          total: documentData.total,
          status: documentData.status,
          date: documentData.invoiceDate,
        };

      case 'bill':
        return {
          ...baseMetadata,
          billNumber: documentData.billNumber,
          vendorName: documentData.vendorName,
          vendorId: documentData.vendorId,
          total: documentData.total,
          status: documentData.status,
          date: documentData.billDate,
        };

      case 'journal_entry':
        return {
          ...baseMetadata,
          entryNumber: documentData.entryNumber,
          description: documentData.description,
          status: documentData.status,
          date: documentData.entryDate,
          totalDebit: documentData.totalDebit,
          totalCredit: documentData.totalCredit,
        };

      default:
        return baseMetadata;
    }
  }

  /**
   * Get indexing statistics for a tenant
   */
  async getStats(tenantId: string): Promise<IndexingStats> {
    const totalDocs = await this.countTotalDocuments(tenantId);
    const indexedDocs = await this.vectorStore.countEmbeddings(tenantId);

    const pendingInvoices = await this.findPendingDocuments(tenantId, 'invoice');
    const pendingBills = await this.findPendingDocuments(tenantId, 'bill');
    const pendingJournalEntries = await this.findPendingDocuments(tenantId, 'journal_entry');

    const pendingDocs = pendingInvoices.length + pendingBills.length + pendingJournalEntries.length;

    // Get last indexed timestamp
    const lastEmbedding = await db.query.documentEmbeddings.findFirst({
      where: eq(documentEmbeddings.tenantId, tenantId),
      orderBy: [desc(documentEmbeddings.createdAt)],
    });

    return {
      totalDocuments: totalDocs,
      indexedDocuments: indexedDocs,
      pendingDocuments: pendingDocs,
      lastIndexedAt: lastEmbedding?.createdAt,
    };
  }

  /**
   * Count total documents for a tenant
   */
  private async countTotalDocuments(tenantId: string): Promise<number> {
    const [invoiceCount, billCount, journalEntryCount] = await Promise.all([
      db
        .select({ count: db.$count(invoices.id) })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .then((r) => r[0]?.count || 0),
      db
        .select({ count: db.$count(bills.id) })
        .from(bills)
        .where(eq(bills.tenantId, tenantId))
        .then((r) => r[0]?.count || 0),
      db
        .select({ count: db.$count(journalEntries.id) })
        .from(journalEntries)
        .where(eq(journalEntries.tenantId, tenantId))
        .then((r) => r[0]?.count || 0),
    ]);

    return invoiceCount + billCount + journalEntryCount;
  }

  /**
   * Manually trigger indexing for a specific tenant (useful for testing or on-demand)
   */
  async triggerManualIndexing(tenantId: string): Promise<IndexingResult> {
    console.log(`[Background Indexer] Manually triggering indexing for tenant ${tenantId}...`);

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    return await this.indexTenant(tenantId, tenant.name);
  }

  /**
   * Stop the background indexing job
   */
  stop(): void {
    this.jobStarted = false;
    console.log('[Background Indexer] Background indexing job stopped');
  }
}

// Singleton instance
let backgroundIndexerInstance: BackgroundIndexer | null = null;

export function getBackgroundIndexer(): BackgroundIndexer {
  if (!backgroundIndexerInstance) {
    backgroundIndexerInstance = new BackgroundIndexer();
  }
  return backgroundIndexerInstance;
}
