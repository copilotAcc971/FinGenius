import OpenAI from 'openai';

/**
 * Embedding Service
 * Generates vector embeddings using OpenAI's text-embedding-3-small model
 * for semantic search in the AI Copilot knowledge base
 */

export class EmbeddingService {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
  }

  /**
   * Generate embedding for a single text
   * @param text - Text to embed
   * @returns Vector embedding (1536 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to embed
   * @returns Array of vector embeddings
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      // OpenAI API supports batch embeddings (up to 2048 inputs per request)
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error('Failed to generate batch embeddings');
    }
  }

  /**
   * Generate embedding for a financial document
   * Creates a structured summary optimized for semantic search
   */
  async generateDocumentEmbedding(params: {
    documentType: string;
    documentData: any;
  }): Promise<{ contentSummary: string; embedding: number[] }> {
    const contentSummary = this.createContentSummary(params.documentType, params.documentData);
    const embedding = await this.generateEmbedding(contentSummary);

    return { contentSummary, embedding };
  }

  /**
   * Create a structured text summary of a document for embedding
   * This summary is optimized for semantic search by including key searchable terms
   */
  private createContentSummary(documentType: string, data: any): string {
    switch (documentType) {
      case 'invoice':
        return this.summarizeInvoice(data);
      case 'bill':
        return this.summarizeBill(data);
      case 'journal_entry':
        return this.summarizeJournalEntry(data);
      case 'customer':
        return this.summarizeCustomer(data);
      case 'vendor':
        return this.summarizeVendor(data);
      case 'account':
        return this.summarizeAccount(data);
      default:
        return JSON.stringify(data).substring(0, 1000);
    }
  }

  private summarizeInvoice(invoice: any): string {
    const parts = [
      `Invoice ${invoice.invoiceNumber || 'Draft'}`,
      `Customer: ${invoice.customerName || 'Unknown'}`,
      `Date: ${invoice.invoiceDate || 'N/A'}`,
      `Amount: ${invoice.total || 0} ${invoice.currencyCode || 'USD'}`,
      `Status: ${invoice.status || 'draft'}`,
    ];

    if (invoice.items && Array.isArray(invoice.items)) {
      parts.push(`Items: ${invoice.items.map((item: any) => item.description || item.name).join(', ')}`);
    }

    if (invoice.notes) {
      parts.push(`Notes: ${invoice.notes}`);
    }

    return parts.join('. ');
  }

  private summarizeBill(bill: any): string {
    const parts = [
      `Bill ${bill.billNumber || 'Draft'}`,
      `Vendor: ${bill.vendorName || 'Unknown'}`,
      `Date: ${bill.billDate || 'N/A'}`,
      `Amount: ${bill.total || 0} ${bill.currencyCode || 'USD'}`,
      `Status: ${bill.status || 'unpaid'}`,
      `Due Date: ${bill.dueDate || 'N/A'}`,
    ];

    if (bill.items && Array.isArray(bill.items)) {
      parts.push(`Items: ${bill.items.map((item: any) => item.description || item.name).join(', ')}`);
    }

    if (bill.notes) {
      parts.push(`Notes: ${bill.notes}`);
    }

    return parts.join('. ');
  }

  private summarizeJournalEntry(entry: any): string {
    const parts = [
      `Journal Entry ${entry.entryNumber || 'Draft'}`,
      `Date: ${entry.entryDate || 'N/A'}`,
      `Description: ${entry.description || 'N/A'}`,
      `Amount: ${entry.totalDebit || entry.totalCredit || 0}`,
      `Status: ${entry.status || 'draft'}`,
    ];

    if (entry.reference) {
      parts.push(`Reference: ${entry.reference}`);
    }

    if (entry.legs && Array.isArray(entry.legs)) {
      const accountNames = entry.legs.map((leg: any) => leg.accountName || 'Unknown Account');
      parts.push(`Accounts: ${accountNames.join(', ')}`);
    }

    return parts.join('. ');
  }

  private summarizeCustomer(customer: any): string {
    const parts = [
      `Customer: ${customer.name || customer.companyName || 'Unknown'}`,
      `Type: ${customer.customerType || 'business'}`,
    ];

    if (customer.email) {
      parts.push(`Email: ${customer.email}`);
    }

    if (customer.phone) {
      parts.push(`Phone: ${customer.phone}`);
    }

    if (customer.billingAddress) {
      const addr = customer.billingAddress;
      parts.push(`Address: ${[addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ')}`);
    }

    if (customer.notes) {
      parts.push(`Notes: ${customer.notes}`);
    }

    return parts.join('. ');
  }

  private summarizeVendor(vendor: any): string {
    const parts = [
      `Vendor: ${vendor.name || vendor.companyName || 'Unknown'}`,
      `Type: ${vendor.customerType || 'business'}`,
    ];

    if (vendor.email) {
      parts.push(`Email: ${vendor.email}`);
    }

    if (vendor.phone) {
      parts.push(`Phone: ${vendor.phone}`);
    }

    if (vendor.billingAddress) {
      const addr = vendor.billingAddress;
      parts.push(`Address: ${[addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ')}`);
    }

    if (vendor.notes) {
      parts.push(`Notes: ${vendor.notes}`);
    }

    return parts.join('. ');
  }

  private summarizeAccount(account: any): string {
    const parts = [
      `Account: ${account.name || 'Unknown'}`,
      `Code: ${account.accountCode || 'N/A'}`,
      `Type: ${account.accountType || 'N/A'}`,
      `Category: ${account.category || 'N/A'}`,
    ];

    if (account.description) {
      parts.push(`Description: ${account.description}`);
    }

    if (account.balance !== undefined) {
      parts.push(`Balance: ${account.balance} ${account.currencyCode || 'USD'}`);
    }

    return parts.join('. ');
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(apiKey?: string): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService(apiKey);
  }
  return embeddingServiceInstance;
}
