import OpenAI from 'openai';

export interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  taxAmount?: number;
}

export interface ExtractedDocumentData {
  documentType: 'receipt' | 'invoice' | 'bill' | 'bank_statement' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  
  // Common fields
  documentNumber?: string;
  date?: string;
  dueDate?: string;
  
  // Vendor/Customer info
  vendorName?: string;
  vendorAddress?: string;
  vendorTaxId?: string;
  customerName?: string;
  customerAddress?: string;
  
  // Financial details
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  currency?: string;
  
  // Line items
  lineItems?: ExtractedLineItem[];
  
  // Bank statement specific
  accountNumber?: string;
  statementPeriod?: { startDate: string; endDate: string };
  openingBalance?: number;
  closingBalance?: number;
  transactions?: Array<{
    date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance?: number;
  }>;
  
  // Additional metadata
  notes?: string;
  rawText?: string;
  warnings?: string[];
}

export interface DocumentExtractionResult {
  success: boolean;
  data?: ExtractedDocumentData;
  error?: string;
  processingTime: number;
}

/**
 * Document Processing Pipeline using OpenAI Vision (GPT-4o)
 * Extracts structured data from receipts, invoices, bills, and bank statements
 */
export class DocumentProcessor {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Extract structured data from a document image using GPT-4o Vision
   */
  async extractDocumentData(
    imageData: string,
    documentType?: 'receipt' | 'invoice' | 'bill' | 'bank_statement'
  ): Promise<DocumentExtractionResult> {
    const startTime = Date.now();

    try {
      // Remove data URL prefix if present
      const base64Image = imageData.includes('base64,')
        ? imageData.split('base64,')[1]
        : imageData;

      const prompt = this.buildExtractionPrompt(documentType);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const content = response.choices[0].message.content;
      
      if (!content) {
        throw new Error('No response from vision model');
      }

      // Parse JSON response
      const extractedData = this.parseExtractionResponse(content);
      
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: extractedData,
        processingTime
      };

    } catch (error: any) {
      console.error('[DocumentProcessor] Extraction error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to extract document data',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build the extraction prompt based on document type
   */
  private buildExtractionPrompt(documentType?: string): string {
    const basePrompt = `You are a document data extraction AI. Analyze this image and extract structured financial data.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown, no explanations, no code blocks
2. Use the exact JSON structure specified below
3. Extract all visible financial information accurately
4. For amounts, use numbers without currency symbols (e.g., 150.50 not "$150.50")
5. For dates, use YYYY-MM-DD format
6. If a field is not visible or unclear, omit it from the JSON

`;

    const documentSpecificInstructions = {
      receipt: `RECEIPT EXTRACTION:
Focus on: vendor name, date, line items, subtotal, tax, total.
Look for: store logo, receipt number, item descriptions with prices.`,
      
      invoice: `INVOICE EXTRACTION:
Focus on: invoice number, invoice date, due date, vendor info, customer info, line items, subtotal, tax, total.
Look for: "Invoice", "Bill To", "Ship To", itemized charges, payment terms.`,
      
      bill: `BILL EXTRACTION:
Focus on: bill number, bill date, due date, vendor info, line items, subtotal, tax, total.
Look for: "Bill", "Statement", vendor details, amount due, payment instructions.`,
      
      bank_statement: `BANK STATEMENT EXTRACTION:
Focus on: account number, statement period, opening balance, closing balance, transactions.
Look for: bank name, account holder, transaction dates, debits, credits, running balance.`,
    };

    const instruction = documentType && documentType in documentSpecificInstructions
      ? documentSpecificInstructions[documentType as keyof typeof documentSpecificInstructions]
      : `GENERAL DOCUMENT EXTRACTION:
Identify the document type (receipt, invoice, bill, or bank statement) and extract all relevant financial data.`;

    const jsonStructure = `
REQUIRED JSON STRUCTURE:
{
  "documentType": "receipt|invoice|bill|bank_statement|unknown",
  "confidence": "high|medium|low",
  "documentNumber": "string (optional)",
  "date": "YYYY-MM-DD (optional)",
  "dueDate": "YYYY-MM-DD (optional)",
  "vendorName": "string (optional)",
  "vendorAddress": "string (optional)",
  "vendorTaxId": "string (optional)",
  "customerName": "string (optional)",
  "customerAddress": "string (optional)",
  "subtotal": number (optional),
  "taxAmount": number (optional),
  "total": number (optional),
  "currency": "USD|EUR|AED|etc (optional, default USD)",
  "lineItems": [
    {
      "description": "string",
      "quantity": number (optional),
      "unitPrice": number (optional),
      "amount": number,
      "taxAmount": number (optional)
    }
  ] (optional),
  "accountNumber": "string (optional, for bank statements)",
  "statementPeriod": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  } (optional, for bank statements),
  "openingBalance": number (optional, for bank statements),
  "closingBalance": number (optional, for bank statements),
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "debit": number (optional),
      "credit": number (optional),
      "balance": number (optional)
    }
  ] (optional, for bank statements),
  "notes": "string (optional)",
  "warnings": ["string"] (optional - use for any ambiguities or issues)
}

EXAMPLE for a receipt:
{
  "documentType": "receipt",
  "confidence": "high",
  "date": "2024-01-15",
  "vendorName": "Acme Coffee Shop",
  "subtotal": 12.50,
  "taxAmount": 1.25,
  "total": 13.75,
  "currency": "USD",
  "lineItems": [
    {"description": "Latte", "quantity": 2, "unitPrice": 5.00, "amount": 10.00},
    {"description": "Croissant", "quantity": 1, "unitPrice": 2.50, "amount": 2.50}
  ]
}`;

    return basePrompt + instruction + jsonStructure;
  }

  /**
   * Parse the extraction response from the AI
   */
  private parseExtractionResponse(content: string): ExtractedDocumentData {
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the data
      return this.validateAndNormalizeData(parsed);
    } catch (error) {
      console.error('[DocumentProcessor] Parse error:', error);
      throw new Error('Failed to parse extraction results. The AI response was not valid JSON.');
    }
  }

  /**
   * Validate and normalize extracted data
   */
  private validateAndNormalizeData(data: any): ExtractedDocumentData {
    const warnings: string[] = [];

    // Ensure documentType is valid
    const validTypes = ['receipt', 'invoice', 'bill', 'bank_statement', 'unknown'];
    if (!validTypes.includes(data.documentType)) {
      data.documentType = 'unknown';
      warnings.push('Document type could not be determined');
    }

    // Ensure confidence is valid
    const validConfidence = ['high', 'medium', 'low'];
    if (!validConfidence.includes(data.confidence)) {
      data.confidence = 'low';
    }

    // Validate amounts are numbers
    const numericFields = ['subtotal', 'taxAmount', 'total', 'openingBalance', 'closingBalance'];
    for (const field of numericFields) {
      if (data[field] !== undefined && typeof data[field] !== 'number') {
        const parsed = parseFloat(data[field]);
        if (!isNaN(parsed)) {
          data[field] = parsed;
        } else {
          warnings.push(`Invalid ${field} value: ${data[field]}`);
          delete data[field];
        }
      }
    }

    // Validate line items
    if (data.lineItems && Array.isArray(data.lineItems)) {
      data.lineItems = data.lineItems.map((item: any) => {
        const validItem: ExtractedLineItem = {
          description: item.description || 'Unknown item',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0
        };

        if (item.quantity !== undefined) validItem.quantity = parseFloat(item.quantity);
        if (item.unitPrice !== undefined) validItem.unitPrice = parseFloat(item.unitPrice);
        if (item.taxAmount !== undefined) validItem.taxAmount = parseFloat(item.taxAmount);

        return validItem;
      });
    }

    // Validate transactions for bank statements
    if (data.transactions && Array.isArray(data.transactions)) {
      data.transactions = data.transactions.map((txn: any) => ({
        date: txn.date || '',
        description: txn.description || '',
        debit: txn.debit !== undefined ? parseFloat(txn.debit) : undefined,
        credit: txn.credit !== undefined ? parseFloat(txn.credit) : undefined,
        balance: txn.balance !== undefined ? parseFloat(txn.balance) : undefined,
      }));
    }

    // Add warnings if any
    if (warnings.length > 0) {
      data.warnings = [...(data.warnings || []), ...warnings];
    }

    return data;
  }

  /**
   * Convert extracted data to draft invoice
   */
  convertToInvoiceDraft(data: ExtractedDocumentData): any {
    if (data.documentType !== 'invoice' && data.documentType !== 'receipt') {
      throw new Error('Document is not an invoice or receipt');
    }

    return {
      // Customer would need to be looked up or created
      customerId: null, // To be filled by user
      invoiceDate: data.date || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      notes: data.notes,
      items: (data.lineItems || []).map(item => ({
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.unitPrice || item.amount,
        taxAmount: item.taxAmount
      })),
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      total: data.total,
      currency: data.currency || 'USD',
      extractedFrom: 'document',
      warnings: data.warnings
    };
  }

  /**
   * Convert extracted data to draft bill
   */
  convertToBillDraft(data: ExtractedDocumentData): any {
    if (data.documentType !== 'bill' && data.documentType !== 'invoice' && data.documentType !== 'receipt') {
      throw new Error('Document is not a bill, invoice, or receipt');
    }

    return {
      // Vendor would need to be looked up or created
      vendorId: null, // To be filled by user
      vendorName: data.vendorName,
      billDate: data.date || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      notes: data.notes,
      items: (data.lineItems || []).map(item => ({
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.amount,
        taxAmount: item.taxAmount
      })),
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      total: data.total,
      currency: data.currency || 'USD',
      extractedFrom: 'document',
      warnings: data.warnings
    };
  }

  /**
   * Convert extracted bank transactions to journal entry format
   */
  convertToJournalEntries(data: ExtractedDocumentData): any[] {
    if (data.documentType !== 'bank_statement') {
      throw new Error('Document is not a bank statement');
    }

    if (!data.transactions || data.transactions.length === 0) {
      throw new Error('No transactions found in bank statement');
    }

    // Group transactions by date and create journal entries
    return data.transactions.map((txn, index) => ({
      entryDate: txn.date,
      description: txn.description,
      reference: `${data.accountNumber || 'BANK'}-${index + 1}`,
      legs: [
        // Bank account leg
        {
          accountId: null, // To be filled - user's bank account
          type: txn.debit ? 'Credit' : 'Debit',
          amount: txn.debit || txn.credit || 0,
          description: txn.description
        },
        // Contra account leg (to be determined based on transaction description)
        {
          accountId: null, // To be filled based on transaction type
          type: txn.debit ? 'Debit' : 'Credit',
          amount: txn.debit || txn.credit || 0,
          description: txn.description
        }
      ]
    }));
  }
}
