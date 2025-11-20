import { getEmbeddingService } from './embedding-service';
import { getVectorStore } from './vector-store';
import { db } from '../db';
import { invoices, bills, journalEntries, customers, vendors } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * RAG Retrieval Service
 * 
 * Provides semantic search over the knowledge base with source citations.
 * Retrieves relevant context from invoices, bills, journal entries, and entity notes.
 */

export interface RetrievalResult {
  documentType: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: {
    documentNumber?: string;
    entityName?: string;
    date?: string;
    amount?: string;
    status?: string;
    [key: string]: any;
  };
}

export interface RetrievalResponse {
  results: RetrievalResult[];
  contextString: string;
  sources: SourceCitation[];
}

export interface SourceCitation {
  index: number;
  documentType: string;
  documentId: string;
  documentNumber?: string;
  entityName?: string;
  date?: string;
  similarity: number;
  url?: string;
}

export class RetrievalService {
  private embeddingService = getEmbeddingService();
  private vectorStore = getVectorStore();

  /**
   * Perform semantic search over the knowledge base
   * 
   * @param tenantId - Tenant ID to scope the search
   * @param query - Natural language query
   * @param options - Search options
   * @returns Retrieval results with source citations
   */
  async search(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      documentTypes?: string[];
      minSimilarity?: number;
      includeContext?: boolean;
    } = {}
  ): Promise<RetrievalResponse> {
    const {
      limit = 5,
      documentTypes,
      minSimilarity = 0.7,
      includeContext = true,
    } = options;

    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Search vector store
    const searchResults = await this.vectorStore.searchSimilar({
      tenantId,
      queryEmbedding,
      limit,
      documentTypes,
      minSimilarity,
    });

    // Enrich results with document metadata
    const enrichedResults = await this.enrichResults(tenantId, searchResults);

    // Generate source citations
    const sources = this.generateCitations(enrichedResults);

    // Generate context string for AI prompt (if requested)
    const contextString = includeContext
      ? this.generateContextString(enrichedResults, sources)
      : '';

    return {
      results: enrichedResults,
      contextString,
      sources,
    };
  }

  /**
   * Retrieve relevant context for RAG-enhanced AI responses
   * 
   * This is the main method used by AI Copilot for knowledge retrieval.
   */
  async retrieveContext(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      documentTypes?: string[];
      minSimilarity?: number;
    } = {}
  ): Promise<{
    contextString: string;
    sources: SourceCitation[];
  }> {
    const response = await this.search(tenantId, query, {
      ...options,
      includeContext: true,
    });

    return {
      contextString: response.contextString,
      sources: response.sources,
    };
  }

  /**
   * Search specific document types
   */
  async searchInvoices(tenantId: string, query: string, limit = 5): Promise<RetrievalResponse> {
    return this.search(tenantId, query, {
      limit,
      documentTypes: ['invoice'],
    });
  }

  async searchBills(tenantId: string, query: string, limit = 5): Promise<RetrievalResponse> {
    return this.search(tenantId, query, {
      limit,
      documentTypes: ['bill'],
    });
  }

  async searchJournalEntries(tenantId: string, query: string, limit = 5): Promise<RetrievalResponse> {
    return this.search(tenantId, query, {
      limit,
      documentTypes: ['journal_entry'],
    });
  }

  async searchCustomers(tenantId: string, query: string, limit = 5): Promise<RetrievalResponse> {
    return this.search(tenantId, query, {
      limit,
      documentTypes: ['customer'],
    });
  }

  async searchVendors(tenantId: string, query: string, limit = 5): Promise<RetrievalResponse> {
    return this.search(tenantId, query, {
      limit,
      documentTypes: ['vendor'],
    });
  }

  /**
   * Enrich search results with full document metadata
   */
  private async enrichResults(
    tenantId: string,
    searchResults: Array<any>
  ): Promise<RetrievalResult[]> {
    const enriched: RetrievalResult[] = [];

    for (const result of searchResults) {
      try {
        const metadata = await this.fetchDocumentMetadata(
          tenantId,
          result.documentType,
          result.documentId
        );

        enriched.push({
          documentType: result.documentType,
          documentId: result.documentId,
          content: result.content,
          similarity: result.similarity,
          metadata: {
            ...result.metadata,
            ...metadata,
          },
        });
      } catch (error) {
        console.error(
          `Failed to enrich document ${result.documentType}:${result.documentId}`,
          error
        );
        // Include result even if enrichment fails
        enriched.push({
          documentType: result.documentType,
          documentId: result.documentId,
          content: result.content,
          similarity: result.similarity,
          metadata: result.metadata || {},
        });
      }
    }

    return enriched;
  }

  /**
   * Fetch full metadata for a document from the database
   */
  private async fetchDocumentMetadata(
    tenantId: string,
    documentType: string,
    documentId: string
  ): Promise<Record<string, any>> {
    switch (documentType) {
      case 'invoice': {
        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.id, documentId), eq(invoices.tenantId, tenantId)),
        });
        if (!invoice) return {};
        return {
          documentNumber: invoice.invoiceNumber,
          entityName: invoice.customerName,
          date: invoice.invoiceDate,
          amount: `${invoice.total} ${invoice.currencyCode || 'USD'}`,
          status: invoice.status,
        };
      }

      case 'bill': {
        const bill = await db.query.bills.findFirst({
          where: and(eq(bills.id, documentId), eq(bills.tenantId, tenantId)),
        });
        if (!bill) return {};
        return {
          documentNumber: bill.billNumber,
          entityName: bill.vendorName,
          date: bill.billDate,
          amount: `${bill.total} ${bill.currencyCode || 'USD'}`,
          status: bill.status,
        };
      }

      case 'journal_entry': {
        const entry = await db.query.journalEntries.findFirst({
          where: and(eq(journalEntries.id, documentId), eq(journalEntries.tenantId, tenantId)),
        });
        if (!entry) return {};
        return {
          documentNumber: entry.entryNumber,
          date: entry.entryDate,
          amount: entry.totalDebit || entry.totalCredit,
          status: entry.status,
        };
      }

      case 'customer': {
        const customer = await db.query.customers.findFirst({
          where: and(eq(customers.id, documentId), eq(customers.tenantId, tenantId)),
        });
        if (!customer) return {};
        return {
          entityName: customer.companyName || customer.contactName,
        };
      }

      case 'vendor': {
        const vendor = await db.query.vendors.findFirst({
          where: and(eq(vendors.id, documentId), eq(vendors.tenantId, tenantId)),
        });
        if (!vendor) return {};
        return {
          entityName: vendor.companyName || vendor.contactName,
        };
      }

      default:
        return {};
    }
  }

  /**
   * Generate source citations from retrieval results
   */
  private generateCitations(results: RetrievalResult[]): SourceCitation[] {
    return results.map((result, index) => ({
      index: index + 1,
      documentType: result.documentType,
      documentId: result.documentId,
      documentNumber: result.metadata.documentNumber,
      entityName: result.metadata.entityName,
      date: result.metadata.date,
      similarity: result.similarity,
      url: this.generateDocumentUrl(result.documentType, result.documentId),
    }));
  }

  /**
   * Generate a frontend URL for a document (for citation links)
   */
  private generateDocumentUrl(documentType: string, documentId: string): string | undefined {
    const urlMap: Record<string, string> = {
      invoice: `/invoices/${documentId}`,
      bill: `/bills/${documentId}`,
      journal_entry: `/journal-entries/${documentId}`,
      customer: `/customers/${documentId}`,
      vendor: `/vendors/${documentId}`,
    };

    return urlMap[documentType];
  }

  /**
   * Generate a formatted context string for AI prompts
   * 
   * This string includes retrieved documents with proper citations
   * that the AI can reference in its responses.
   */
  private generateContextString(
    results: RetrievalResult[],
    sources: SourceCitation[]
  ): string {
    if (results.length === 0) {
      return '';
    }

    let context = '## Knowledge Base Context\n\n';
    context += 'The following information was retrieved from the knowledge base to help answer your question:\n\n';

    results.forEach((result, index) => {
      const source = sources[index];
      const typeLabel = this.formatDocumentType(result.documentType);

      // Header with source number and document info
      context += `### [Source ${source.index}] ${typeLabel}`;
      if (source.documentNumber) {
        context += ` #${source.documentNumber}`;
      }
      if (source.entityName) {
        context += ` - ${source.entityName}`;
      }
      if (source.date) {
        context += ` (${source.date})`;
      }
      context += '\n\n';

      // Document content
      context += `${result.content}\n\n`;

      // Metadata
      context += `**Relevance:** ${(result.similarity * 100).toFixed(1)}%`;
      if (result.metadata.amount) {
        context += ` | **Amount:** ${result.metadata.amount}`;
      }
      if (result.metadata.status) {
        context += ` | **Status:** ${result.metadata.status}`;
      }
      context += '\n\n';

      context += '---\n\n';
    });

    // Instructions for AI on how to cite sources
    context += '## Citation Instructions\n\n';
    context += 'When referencing information from the knowledge base, cite sources using the format:\n';
    context += '- "According to [Source N]..." or "[Source N] shows that..."\n';
    context += '- Include the document type and number when relevant\n';
    context += '- Combine multiple sources when appropriate: "[Sources 1, 2]"\n\n';

    return context;
  }

  /**
   * Format document type for display
   */
  private formatDocumentType(documentType: string): string {
    const labels: Record<string, string> = {
      invoice: 'Invoice',
      bill: 'Bill',
      journal_entry: 'Journal Entry',
      customer: 'Customer',
      vendor: 'Vendor',
      account: 'Account',
    };

    return labels[documentType] || documentType;
  }

  /**
   * Get retrieval statistics for a tenant
   */
  async getStats(tenantId: string): Promise<{
    totalEmbeddings: number;
    embeddingsByType: Record<string, number>;
  }> {
    const totalEmbeddings = await this.vectorStore.countEmbeddings(tenantId);

    const documentTypes = ['invoice', 'bill', 'journal_entry', 'customer', 'vendor'];
    const embeddingsByType: Record<string, number> = {};

    for (const docType of documentTypes) {
      embeddingsByType[docType] = await this.vectorStore.countEmbeddings(tenantId, docType);
    }

    return {
      totalEmbeddings,
      embeddingsByType,
    };
  }
}

// Singleton instance
let retrievalServiceInstance: RetrievalService | null = null;

export function getRetrievalService(): RetrievalService {
  if (!retrievalServiceInstance) {
    retrievalServiceInstance = new RetrievalService();
  }
  return retrievalServiceInstance;
}
