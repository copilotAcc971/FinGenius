import cron from 'node-cron';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { getKnowledgeBaseService } from '../ai-copilot/knowledge-base';

let jobStarted = false;

/**
 * Background Embedding Indexer - Nightly at 2 AM UTC
 * 
 * This job automatically indexes new and updated documents into the vector store
 * for RAG (Retrieval-Augmented Generation) capabilities.
 * 
 * Features:
 * - Runs nightly at 2 AM UTC to minimize impact on business hours
 * - Tracks last indexed timestamp per document via documentEmbeddings.createdAt
 * - Only indexes documents that:
 *   1. Have no embeddings (new documents)
 *   2. Were updated after their last embedding (modified documents)
 * - Provides detailed logging and error handling
 */
export function startEmbeddingIndexerJob(): void {
  if (jobStarted) {
    console.log('[Embedding Indexer] Job already started');
    return;
  }

  console.log('[Embedding Indexer] Initializing nightly indexing job (runs at 2 AM UTC)...');

  // Schedule job to run daily at 2 AM UTC
  // Cron format: minute hour day month weekday
  // '0 2 * * *' = At 02:00 (2 AM) every day
  cron.schedule('0 2 * * *', async () => {
    console.log('==============================================');
    console.log('[Embedding Indexer] Starting nightly indexing job...');
    console.log(`[Embedding Indexer] Execution time: ${new Date().toISOString()}`);
    console.log('==============================================');

    try {
      // Get all tenants
      const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

      if (allTenants.length === 0) {
        console.log('[Embedding Indexer] No tenants found');
        return;
      }

      console.log(`[Embedding Indexer] Found ${allTenants.length} tenants to process`);

      let totalIndexed = 0;
      let totalFailed = 0;
      let totalErrors: Array<{ tenant: string; error: string }> = [];

      // Process each tenant
      for (const tenant of allTenants) {
        try {
          console.log(`\n[Embedding Indexer] Processing tenant: ${tenant.name} (${tenant.id})...`);
          
          const result = await indexTenantDocuments(tenant.id, tenant.name);
          
          totalIndexed += result.indexed;
          totalFailed += result.failed;
          
          if (result.errors.length > 0) {
            totalErrors.push({
              tenant: tenant.name,
              error: `${result.failed} documents failed to index`
            });
          }

          console.log(`[Embedding Indexer] ✓ Tenant ${tenant.name}: ${result.indexed} indexed, ${result.failed} failed`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Embedding Indexer] ✗ Failed to process tenant ${tenant.name}:`, error);
          totalErrors.push({
            tenant: tenant.name,
            error: errorMessage
          });
        }
      }

      console.log('\n==============================================');
      console.log('[Embedding Indexer] Nightly indexing job completed');
      console.log(`[Embedding Indexer] Summary:`);
      console.log(`  - Total Documents Indexed: ${totalIndexed}`);
      console.log(`  - Total Failed: ${totalFailed}`);
      console.log(`  - Tenants Processed: ${allTenants.length}`);
      if (totalErrors.length > 0) {
        console.log(`  - Errors:`);
        totalErrors.forEach(err => {
          console.log(`    • ${err.tenant}: ${err.error}`);
        });
      }
      console.log('==============================================\n');

    } catch (error) {
      console.error('[Embedding Indexer] Critical error in nightly job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  jobStarted = true;
  console.log('[Embedding Indexer] ✓ Nightly indexing job successfully scheduled');
}

/**
 * Index all documents needing indexing for a specific tenant
 */
async function indexTenantDocuments(
  tenantId: string,
  tenantName: string
): Promise<{
  indexed: number;
  failed: number;
  errors: Array<{ docType: string; docId: string; error: string }>;
}> {
  try {
    const knowledgeBase = getKnowledgeBaseService();

    // Get all documents that need indexing
    console.log(`[Embedding Indexer] Finding documents that need indexing for ${tenantName}...`);
    const documentsToIndex = await knowledgeBase.getDocumentsNeedingIndexing(tenantId);

    const total = 
      documentsToIndex.invoices.length +
      documentsToIndex.bills.length +
      documentsToIndex.journalEntries.length;

    if (total === 0) {
      console.log(`[Embedding Indexer] No documents need indexing for ${tenantName}`);
      return { indexed: 0, failed: 0, errors: [] };
    }

    console.log(`[Embedding Indexer] Found ${total} documents to index for ${tenantName}:`);
    console.log(`  - Invoices: ${documentsToIndex.invoices.length}`);
    console.log(`  - Bills: ${documentsToIndex.bills.length}`);
    console.log(`  - Journal Entries: ${documentsToIndex.journalEntries.length}`);

    // Batch index with progress logging
    const result = await knowledgeBase.batchIndexDocuments(
      tenantId,
      documentsToIndex,
      (current, total, docType, docId) => {
        if (current % 10 === 0 || current === total) {
          console.log(`[Embedding Indexer] Progress: ${current}/${total} - Indexing ${docType} ${docId}`);
        }
      }
    );

    return result;
  } catch (error) {
    console.error(`[Embedding Indexer] Error indexing documents for tenant ${tenantName}:`, error);
    throw error;
  }
}

/**
 * Manually trigger indexing for a specific tenant (useful for testing or on-demand indexing)
 */
export async function triggerManualIndexing(
  tenantId: string
): Promise<{
  success: boolean;
  indexed: number;
  failed: number;
  errors: Array<{ docType: string; docId: string; error: string }>;
}> {
  console.log(`[Embedding Indexer] Manually triggering indexing for tenant ${tenantId}...`);

  try {
    const tenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const result = await indexTenantDocuments(tenantId, tenant.name);

    return {
      success: result.failed === 0,
      indexed: result.indexed,
      failed: result.failed,
      errors: result.errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Embedding Indexer] Manual indexing failed for tenant ${tenantId}:`, error);
    
    return {
      success: false,
      indexed: 0,
      failed: 0,
      errors: [{ docType: 'system', docId: tenantId, error: errorMessage }],
    };
  }
}

/**
 * Get indexing statistics for a tenant
 */
export async function getIndexingStats(tenantId: string): Promise<{
  totalEmbeddings: number;
  documentsToIndex: {
    invoices: number;
    bills: number;
    journalEntries: number;
  };
}> {
  try {
    const knowledgeBase = getKnowledgeBaseService();

    // Get total embeddings count
    const totalEmbeddings = await knowledgeBase.getEmbeddingCount(tenantId);

    // Get documents that need indexing
    const documentsToIndex = await knowledgeBase.getDocumentsNeedingIndexing(tenantId);

    return {
      totalEmbeddings,
      documentsToIndex: {
        invoices: documentsToIndex.invoices.length,
        bills: documentsToIndex.bills.length,
        journalEntries: documentsToIndex.journalEntries.length,
      },
    };
  } catch (error) {
    console.error(`[Embedding Indexer] Error getting indexing stats for tenant ${tenantId}:`, error);
    throw error;
  }
}
