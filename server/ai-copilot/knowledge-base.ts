import OpenAI from 'openai';
import { db } from '../db';
import { 
  documentEmbeddings, 
  type InsertDocumentEmbedding,
  type DocumentEmbedding,
  invoices,
  bills,
  journalEntries,
  journalEntryLegs,
  customers,
  vendors,
  accounts
} from '@shared/schema';
import { eq, sql, and, desc } from 'drizzle-orm';

export interface DocumentChunk {
  documentType: string;
  documentId: string;
  content: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  documentType: string;
  documentId: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

/**
 * Knowledge Base Service for RAG (Retrieval-Augmented Generation)
 * Handles document embedding generation and semantic search using OpenAI text-embedding-3-small
 */
export class KnowledgeBaseService {
  private openai: OpenAI;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly EMBEDDING_DIMENSIONS = 1536;
  private readonly CHUNK_SIZE = 800; // characters per chunk
  private readonly CHUNK_OVERLAP = 200; // overlap between chunks

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Convert an invoice to text chunks for embedding
   */
  async extractInvoiceText(tenantId: string, invoiceId: string): Promise<DocumentChunk[]> {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.tenantId, tenantId)
      ),
      with: {
        customer: true,
        lineItems: true,
      }
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const content = `
Invoice Number: ${invoice.invoiceNumber || 'N/A'}
Customer: ${invoice.customerName || 'Unknown'}
Date: ${invoice.invoiceDate || 'N/A'}
Due Date: ${invoice.dueDate || 'N/A'}
Status: ${invoice.status}
Total Amount: ${invoice.total || '0.00'} ${invoice.currency || ''}
Balance Due: ${invoice.balanceDue || '0.00'}

Line Items:
${invoice.lineItems?.map((item: any) => 
  `- ${item.description}: Qty ${item.quantity} x ${item.rate} = ${item.amount}`
).join('\n') || 'No line items'}

Notes: ${invoice.notes || 'None'}
Terms: ${invoice.terms || 'None'}
    `.trim();

    return this.chunkText(content, 'invoice', invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerId: invoice.customerId,
      total: invoice.total,
      status: invoice.status,
      date: invoice.invoiceDate,
    });
  }

  /**
   * Convert a bill to text chunks for embedding
   */
  async extractBillText(tenantId: string, billId: string): Promise<DocumentChunk[]> {
    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, billId),
        eq(bills.tenantId, tenantId)
      ),
      with: {
        vendor: true,
        lineItems: true,
      }
    });

    if (!bill) {
      throw new Error(`Bill ${billId} not found`);
    }

    const content = `
Bill Number: ${bill.billNumber || 'N/A'}
Vendor: ${bill.vendorName || 'Unknown'}
Date: ${bill.billDate || 'N/A'}
Due Date: ${bill.dueDate || 'N/A'}
Status: ${bill.status}
Total Amount: ${bill.total || '0.00'} ${bill.currency || ''}

Line Items:
${bill.lineItems?.map((item: any) => 
  `- ${item.description}: Qty ${item.quantity} x ${item.rate} = ${item.amount}`
).join('\n') || 'No line items'}

Notes: ${bill.notes || 'None'}
    `.trim();

    return this.chunkText(content, 'bill', billId, {
      billNumber: bill.billNumber,
      vendorName: bill.vendorName,
      vendorId: bill.vendorId,
      total: bill.total,
      status: bill.status,
      date: bill.billDate,
    });
  }

  /**
   * Convert a journal entry to text chunks for embedding
   */
  async extractJournalEntryText(tenantId: string, journalEntryId: string): Promise<DocumentChunk[]> {
    const journalEntry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ),
      with: {
        legs: {
          with: {
            account: true,
          }
        }
      }
    });

    if (!journalEntry) {
      throw new Error(`Journal Entry ${journalEntryId} not found`);
    }

    const content = `
Journal Entry Number: ${journalEntry.entryNumber || 'N/A'}
Date: ${journalEntry.entryDate || 'N/A'}
Status: ${journalEntry.status}
Description: ${journalEntry.description || 'N/A'}
Reference: ${journalEntry.reference || 'None'}

Entries:
${journalEntry.legs?.map((leg: any) => 
  `- ${leg.account?.name || 'Unknown Account'}: ${leg.type} ${leg.amount} ${leg.currency || ''}`
).join('\n') || 'No entries'}

Notes: ${journalEntry.notes || 'None'}
    `.trim();

    return this.chunkText(content, 'journal_entry', journalEntryId, {
      entryNumber: journalEntry.entryNumber,
      description: journalEntry.description,
      status: journalEntry.status,
      date: journalEntry.entryDate,
      totalDebit: journalEntry.totalDebit,
      totalCredit: journalEntry.totalCredit,
    });
  }


  /**
   * Split text into overlapping chunks for better context preservation
   */
  private chunkText(
    text: string,
    documentType: string,
    documentId: string,
    metadata: Record<string, any>
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // If text is smaller than chunk size, return as single chunk
    if (text.length <= this.CHUNK_SIZE) {
      return [{
        documentType,
        documentId,
        content: text,
        metadata,
      }];
    }

    // Split into overlapping chunks
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      const chunk = text.slice(start, end);
      
      chunks.push({
        documentType,
        documentId,
        content: chunk,
        metadata: {
          ...metadata,
          chunkIndex: chunks.length,
          totalChunks: 0, // Will be updated after loop
        },
      });

      start += this.CHUNK_SIZE - this.CHUNK_OVERLAP;
    }

    // Update total chunks metadata
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Generate embeddings for text using OpenAI text-embedding-3-small
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text,
        dimensions: this.EMBEDDING_DIMENSIONS,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store document embeddings in the database
   */
  async storeEmbeddings(
    tenantId: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk.content);
      
      const embeddingData: InsertDocumentEmbedding = {
        tenantId,
        documentType: chunk.documentType,
        documentId: chunk.documentId,
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
      };

      await db.insert(documentEmbeddings).values(embeddingData);
    }
  }

  /**
   * Index a document by type and ID (extracts text, generates embeddings, stores in DB)
   */
  async indexDocument(
    tenantId: string,
    documentType: 'invoice' | 'bill' | 'journal_entry',
    documentId: string
  ): Promise<void> {
    // Delete existing embeddings for this document
    await db.delete(documentEmbeddings)
      .where(and(
        eq(documentEmbeddings.tenantId, tenantId),
        eq(documentEmbeddings.documentType, documentType),
        eq(documentEmbeddings.documentId, documentId)
      ));

    // Extract text chunks based on document type
    let chunks: DocumentChunk[];
    switch (documentType) {
      case 'invoice':
        chunks = await this.extractInvoiceText(tenantId, documentId);
        break;
      case 'bill':
        chunks = await this.extractBillText(tenantId, documentId);
        break;
      case 'journal_entry':
        chunks = await this.extractJournalEntryText(tenantId, documentId);
        break;
      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }

    // Generate and store embeddings
    await this.storeEmbeddings(tenantId, chunks);
  }

  /**
   * Perform semantic search using cosine similarity
   * Returns top K most relevant document chunks
   */
  async searchKnowledgeBase(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      documentTypes?: string[];
      similarityThreshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 5,
      documentTypes,
      similarityThreshold = 0.7,
    } = options;

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // Build WHERE clause
    let whereClause = eq(documentEmbeddings.tenantId, tenantId);
    
    // Use raw SQL for cosine similarity search with pgvector
    const query_sql = sql`
      SELECT 
        id,
        tenant_id,
        document_type,
        document_id,
        content,
        metadata,
        created_at,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM document_embeddings
      WHERE tenant_id = ${tenantId}
        ${documentTypes && documentTypes.length > 0 ? sql`AND document_type = ANY(${documentTypes})` : sql``}
        AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) >= ${similarityThreshold}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;

    const results = await db.execute(query_sql);

    return (results.rows as any[]).map(row => ({
      id: row.id,
      documentType: row.document_type,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Delete all embeddings for a specific document
   */
  async deleteDocumentEmbeddings(
    tenantId: string,
    documentType: string,
    documentId: string
  ): Promise<void> {
    await db.delete(documentEmbeddings)
      .where(and(
        eq(documentEmbeddings.tenantId, tenantId),
        eq(documentEmbeddings.documentType, documentType),
        eq(documentEmbeddings.documentId, documentId)
      ));
  }

  /**
   * Get total number of embeddings for a tenant
   */
  async getEmbeddingCount(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.tenantId, tenantId));

    return result[0]?.count || 0;
  }

  /**
   * Perform RAG retrieval: search knowledge base and format results with source citations
   * Returns formatted context string to be included in AI prompt
   */
  async retrieveRelevantContext(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      documentTypes?: string[];
      similarityThreshold?: number;
    } = {}
  ): Promise<{
    contextString: string;
    sources: Array<{
      documentType: string;
      documentId: string;
      metadata: Record<string, any>;
      similarity: number;
    }>;
  }> {
    const limit = options.limit || 5;
    
    // Search knowledge base
    const results = await this.searchKnowledgeBase(tenantId, query, {
      ...options,
      limit,
    });

    if (results.length === 0) {
      return {
        contextString: '',
        sources: [],
      };
    }

    // Format results with source citations
    let contextString = '## Relevant Documents from Knowledge Base:\n\n';
    const sources: Array<{
      documentType: string;
      documentId: string;
      metadata: Record<string, any>;
      similarity: number;
    }> = [];

    results.forEach((result, index) => {
      const { documentType, documentId, content, metadata, similarity } = result;
      
      // Format document type for display
      const typeDisplay = documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Extract key metadata
      const docNumber = metadata.invoiceNumber || metadata.billNumber || metadata.entryNumber || metadata.title || documentId;
      const docDate = metadata.date || 'N/A';
      
      // Add to context string with citation
      contextString += `### [${index + 1}] ${typeDisplay} #${docNumber} (${docDate}) [ID: ${documentId}]\n`;
      contextString += `${content}\n`;
      contextString += `*Relevance Score: ${(similarity * 100).toFixed(1)}%*\n\n`;
      
      // Track source
      sources.push({
        documentType,
        documentId,
        metadata,
        similarity,
      });
    });

    contextString += '\n**Instructions**: When answering the user\'s question, cite specific sources using the format [Source #N] where N is the document number shown above. Include document type, number, and date in your citations.\n';

    return {
      contextString,
      sources,
    };
  }

  /**
   * Get all documents that need indexing for a tenant
   * Returns documents that have no embeddings or were updated after last embedding
   */
  async getDocumentsNeedingIndexing(tenantId: string): Promise<{
    invoices: string[];
    bills: string[];
    journalEntries: string[];
  }> {
    const documentsToIndex = {
      invoices: [] as string[],
      bills: [] as string[],
      journalEntries: [] as string[],
    };

    // Get all invoices for tenant
    const allInvoices = await db.query.invoices.findMany({
      where: eq(invoices.tenantId, tenantId),
      columns: {
        id: true,
      },
    });

    // Check which invoices need indexing
    for (const invoice of allInvoices) {
      const existingEmbeddings = await db.query.documentEmbeddings.findFirst({
        where: and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, 'invoice'),
          eq(documentEmbeddings.documentId, invoice.id)
        ),
      });

      if (!existingEmbeddings) {
        documentsToIndex.invoices.push(invoice.id);
      }
    }

    // Get all bills for tenant (with updatedAt tracking)
    const allBills = await db.query.bills.findMany({
      where: eq(bills.tenantId, tenantId),
      columns: {
        id: true,
        updatedAt: true,
      },
    });

    // Check which bills need indexing
    for (const bill of allBills) {
      const existingEmbeddings = await db.query.documentEmbeddings.findFirst({
        where: and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, 'bill'),
          eq(documentEmbeddings.documentId, bill.id)
        ),
        orderBy: [desc(documentEmbeddings.createdAt)],
      });

      // Index if no embeddings exist OR document was updated after embedding
      if (!existingEmbeddings || (bill.updatedAt && bill.updatedAt > existingEmbeddings.createdAt)) {
        documentsToIndex.bills.push(bill.id);
      }
    }

    // Get all journal entries for tenant (with updatedAt tracking)
    const allJournalEntries = await db.query.journalEntries.findMany({
      where: eq(journalEntries.tenantId, tenantId),
      columns: {
        id: true,
        updatedAt: true,
      },
    });

    // Check which journal entries need indexing
    for (const entry of allJournalEntries) {
      const existingEmbeddings = await db.query.documentEmbeddings.findFirst({
        where: and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, 'journal_entry'),
          eq(documentEmbeddings.documentId, entry.id)
        ),
        orderBy: [desc(documentEmbeddings.createdAt)],
      });

      // Index if no embeddings exist OR document was updated after embedding
      if (!existingEmbeddings || (entry.updatedAt && entry.updatedAt > existingEmbeddings.createdAt)) {
        documentsToIndex.journalEntries.push(entry.id);
      }
    }

    return documentsToIndex;
  }

  /**
   * Batch index multiple documents with progress tracking
   */
  async batchIndexDocuments(
    tenantId: string,
    documentsToIndex: {
      invoices: string[];
      bills: string[];
      journalEntries: string[];
    },
    onProgress?: (current: number, total: number, docType: string, docId: string) => void
  ): Promise<{
    indexed: number;
    failed: number;
    errors: Array<{ docType: string; docId: string; error: string }>;
  }> {
    const result = {
      indexed: 0,
      failed: 0,
      errors: [] as Array<{ docType: string; docId: string; error: string }>,
    };

    const total = 
      documentsToIndex.invoices.length +
      documentsToIndex.bills.length +
      documentsToIndex.journalEntries.length;

    let current = 0;

    // Index invoices
    for (const invoiceId of documentsToIndex.invoices) {
      current++;
      try {
        if (onProgress) {
          onProgress(current, total, 'invoice', invoiceId);
        }
        await this.indexDocument(tenantId, 'invoice', invoiceId);
        result.indexed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          docType: 'invoice',
          docId: invoiceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Failed to index invoice ${invoiceId}:`, error);
      }
    }

    // Index bills
    for (const billId of documentsToIndex.bills) {
      current++;
      try {
        if (onProgress) {
          onProgress(current, total, 'bill', billId);
        }
        await this.indexDocument(tenantId, 'bill', billId);
        result.indexed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          docType: 'bill',
          docId: billId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Failed to index bill ${billId}:`, error);
      }
    }

    // Index journal entries
    for (const entryId of documentsToIndex.journalEntries) {
      current++;
      try {
        if (onProgress) {
          onProgress(current, total, 'journal_entry', entryId);
        }
        await this.indexDocument(tenantId, 'journal_entry', entryId);
        result.indexed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          docType: 'journal_entry',
          docId: entryId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Failed to index journal entry ${entryId}:`, error);
      }
    }

    return result;
  }
}

// Export singleton instance (initialized when OPENAI_API_KEY is available)
let knowledgeBaseService: KnowledgeBaseService | null = null;

export function getKnowledgeBaseService(): KnowledgeBaseService {
  if (!knowledgeBaseService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    knowledgeBaseService = new KnowledgeBaseService(apiKey);
  }
  return knowledgeBaseService;
}
