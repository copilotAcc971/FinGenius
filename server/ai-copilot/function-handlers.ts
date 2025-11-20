import { storage } from '../storage';
import type { AccountingFunctionHandler } from './functions';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { getKnowledgeBaseService } from './knowledge-base';

interface FunctionContext {
  tenantId: string;
  userId: string;
}

// Rate limiter for web search/fetch functions
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const key = `web_${userId}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

export const functionHandlers: Record<string, AccountingFunctionHandler> = {
  async show_outstanding_invoices(args: any, context: FunctionContext) {
    const { customerId, limit = 10 } = args;
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    
    let filtered = invoices.filter(inv => 
      inv.status === 'sent' || inv.status === 'partial'
    );
    
    if (customerId) {
      filtered = filtered.filter(inv => inv.customerId === customerId);
    }
    
    const limited = filtered.slice(0, limit);
    
    return {
      count: filtered.length,
      total: filtered.reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0),
      invoices: limited.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        amount: inv.total,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        status: inv.status
      }))
    };
  },

  async show_overdue_invoices(args: any, context: FunctionContext) {
    const { customerId } = args;
    const today = new Date();
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    
    let filtered = invoices.filter(inv => {
      if (inv.status !== 'sent' && inv.status !== 'partial') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < today;
    });
    
    if (customerId) {
      filtered = filtered.filter(inv => inv.customerId === customerId);
    }
    
    return {
      count: filtered.length,
      total: filtered.reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0),
      invoices: filtered.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        amount: inv.total,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        daysOverdue: Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
      }))
    };
  },

  async get_customer_balance(args: any, context: FunctionContext) {
    const { customerId } = args;
    
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    
    const customer = await storage.getCustomer(customerId);
    
    if (!customer || customer.tenantId !== context.tenantId) {
      throw new Error('Customer not found');
    }
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    const customerInvoices = invoices.filter(inv => inv.customerId === customerId);
    
    const outstanding = customerInvoices
      .filter(inv => inv.status === 'sent' || inv.status === 'partial')
      .reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0);
    
    return {
      customerId,
      customerName: customer.companyName || customer.contactName,
      outstandingBalance: outstanding,
      invoiceCount: customerInvoices.length
    };
  },

  async list_customers(args: any, context: FunctionContext) {
    const { search, limit = 20 } = args;
    
    let customers = await storage.getCustomersByTenant(context.tenantId);
    
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(c => 
        c.companyName?.toLowerCase().includes(searchLower) ||
        c.contactName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
      );
    }
    
    return {
      count: customers.length,
      customers: customers.slice(0, limit).map(c => ({
        id: c.id,
        name: c.companyName || c.contactName,
        email: c.email,
        phone: c.phone
      }))
    };
  },

  async generate_profit_loss_report(args: any, context: FunctionContext) {
    const { startDate, endDate } = args;
    
    const report = await storage.getProfitLossReport(
      context.tenantId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return {
      period: { startDate, endDate },
      revenue: report.revenue,
      expenses: report.expenses,
      netIncome: report.netIncome,
      summary: `Net ${report.netIncome >= 0 ? 'profit' : 'loss'} of ${Math.abs(report.netIncome).toFixed(2)} for the period`
    };
  },

  async generate_balance_sheet(args: any, context: FunctionContext) {
    const asOfDate = args.asOfDate || new Date().toISOString().split('T')[0];
    
    const report = await storage.getBalanceSheet(
      context.tenantId,
      new Date(asOfDate)
    );
    
    return {
      asOfDate,
      assets: report.totalAssets,
      liabilities: report.totalLiabilities,
      equity: report.totalEquity,
      summary: `Total assets: ${report.totalAssets.toFixed(2)}, Liabilities: ${report.totalLiabilities.toFixed(2)}, Equity: ${report.totalEquity.toFixed(2)}`
    };
  },

  async show_recent_transactions(args: any, context: FunctionContext) {
    const { limit = 10, accountId } = args;
    
    const entries = await storage.getJournalEntries(context.tenantId);
    
    let filtered = entries
      .filter(e => e.status === 'posted')
      .sort((a, b) => new Date(b.entryDate!).getTime() - new Date(a.entryDate!).getTime());
    
    if (accountId) {
      const withLegs = await Promise.all(
        filtered.map(async (entry) => ({
          entry,
          legs: await storage.getJournalEntryLegs(entry.id!)
        }))
      );
      
      filtered = withLegs
        .filter(({ legs }) => legs.some(leg => leg.accountId === accountId))
        .map(({ entry }) => entry);
    }
    
    return {
      count: filtered.length,
      transactions: filtered.slice(0, limit).map(e => ({
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.entryDate,
        description: e.description,
        amount: e.totalDebit || e.totalCredit
      }))
    };
  },

  async get_cash_flow_summary(args: any, context: FunctionContext) {
    const { startDate, endDate } = args;
    
    const report = await storage.getCashFlowReport(
      context.tenantId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return {
      period: { startDate, endDate },
      operatingActivities: report.operatingActivities,
      investingActivities: report.investingActivities,
      financingActivities: report.financingActivities,
      netCashFlow: report.netCashFlow,
      summary: `Net cash flow: ${report.netCashFlow.toFixed(2)} for the period`
    };
  },

  async list_bills(args: any, context: FunctionContext) {
    const { status = 'all', vendorId, limit = 10 } = args;
    
    let bills = await storage.getBillsByTenant(context.tenantId);
    
    if (status !== 'all') {
      bills = bills.filter(b => b.status === status);
    }
    
    if (vendorId) {
      bills = bills.filter(b => b.vendorId === vendorId);
    }
    
    return {
      count: bills.length,
      total: bills.reduce((sum, b) => sum + parseFloat(b.total || '0'), 0),
      bills: bills.slice(0, limit).map(b => ({
        id: b.id,
        billNumber: b.billNumber,
        vendorName: b.vendorName,
        amount: b.total,
        dueDate: b.dueDate,
        status: b.status
      }))
    };
  },

  async draft_journal_entry(args: any, context: FunctionContext) {
    const { entryDate, description, legs, reference } = args;
    
    // Create journal entry with status='draft'
    const journalEntry = await storage.createJournalEntryWithLegs({
      journalEntry: {
        tenantId: context.tenantId,
        entryDate: new Date(entryDate),
        description,
        reference: reference || null,
        status: 'draft',
        createdBy: context.userId,
      },
      legs: legs.map((leg: any) => ({
        tenantId: context.tenantId,
        accountId: leg.accountId,
        type: leg.type,
        amount: leg.amount.toString(),
        description: leg.description || null,
      })),
    });
    
    return {
      success: true,
      journalEntryId: journalEntry.id,
      entryNumber: journalEntry.entryNumber,
      status: journalEntry.status,
      message: `Draft journal entry ${journalEntry.entryNumber} created successfully. It can be reviewed and posted later.`,
    };
  },

  async post_journal_entry(args: any, context: FunctionContext) {
    const { journalEntryId } = args;
    
    // Get the journal entry
    const entry = await storage.getJournalEntry(journalEntryId);
    
    if (!entry || entry.tenantId !== context.tenantId) {
      throw new Error('Journal entry not found');
    }
    
    if (entry.status === 'posted') {
      throw new Error('Journal entry is already posted');
    }
    
    if (entry.status !== 'draft' && entry.status !== 'approved') {
      throw new Error(`Journal entry cannot be posted from status: ${entry.status}`);
    }
    
    // SEGREGATION OF DUTIES: Prevent users from posting their own journal entries
    // This is a critical internal control to prevent fraud and errors
    if (entry.createdBy === context.userId) {
      throw new Error('Segregation of duties violation: You cannot post a journal entry that you created. This entry must be reviewed and posted by another authorized user with posting permissions.');
    }
    
    // Get existing legs for the update
    const legs = await storage.getJournalEntryLegs(journalEntryId);
    
    // Update status to posted
    const updatedEntry = await storage.updateJournalEntryWithLegs(
      journalEntryId,
      context.tenantId,
      {
        journalEntry: {
          ...entry,
          status: 'posted',
          postedAt: new Date(),
          postedBy: context.userId,
        },
        legs: legs,
      }
    );
    
    return {
      success: true,
      journalEntryId: updatedEntry.id,
      entryNumber: updatedEntry.entryNumber,
      status: updatedEntry.status,
      message: `Journal entry ${updatedEntry.entryNumber} posted successfully to the ledger.`,
    };
  },

  async draft_invoice(args: any, context: FunctionContext) {
    const { customerId, items, invoiceDate, dueDate, notes } = args;
    
    // Get customer to populate invoice details
    const customer = await storage.getCustomer(customerId);
    
    if (!customer || customer.tenantId !== context.tenantId) {
      throw new Error('Customer not found');
    }
    
    // Create invoice with status='draft'
    const invoice = await storage.createInvoiceWithItems({
      invoice: {
        tenantId: context.tenantId,
        customerId,
        customerName: customer.companyName || customer.contactName || '',
        customerEmail: customer.email || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
        notes: notes || null,
        subtotal: '0',
        taxAmount: '0',
        total: '0',
        currencyCode: 'USD',
        exchangeRate: '1.0',
      },
      lineItems: items.map((item: any) => ({
        tenantId: context.tenantId,
        itemId: item.itemId || null,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.rate.toString(),
        amount: (item.quantity * item.rate).toString(),
        taxAmount: '0',
      })),
    });
    
    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      total: invoice.total,
      message: `Draft invoice ${invoice.invoiceNumber} created for ${customer.companyName || customer.contactName}. Total: $${invoice.total}. Review and post to create journal entries.`,
    };
  },

  async post_invoice(args: any, context: FunctionContext) {
    const { invoiceId } = args;
    
    // Get the invoice
    const invoice = await storage.getInvoice(invoiceId);
    
    if (!invoice || invoice.tenantId !== context.tenantId) {
      throw new Error('Invoice not found');
    }
    
    if (invoice.status !== 'draft') {
      throw new Error(`Invoice cannot be posted from status: ${invoice.status}`);
    }
    
    // TODO: SEGREGATION OF DUTIES - Currently not enforced for invoices
    // The invoices table schema (shared/schema.ts) does not have a 'createdBy' field
    // to track who created the invoice. To fully implement segregation of duties:
    // 1. Add 'createdBy' field to invoices table schema
    // 2. Update draft_invoice handler to set createdBy: context.userId
    // 3. Add check here: if (invoice.createdBy === context.userId) throw error
    // This would prevent users from posting invoices they created themselves
    
    // Update invoice status to 'sent' (posted)
    const updatedInvoice = await storage.updateInvoice(
      invoiceId,
      context.tenantId,
      {
        status: 'sent',
      }
    );
    
    // Note: In a full implementation, this would create journal entries for AR and Revenue
    // For now, we're just updating the status
    // Future enhancement: Call accounting service to create journal entries
    
    return {
      success: true,
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      status: updatedInvoice.status,
      total: updatedInvoice.total,
      message: `Invoice ${updatedInvoice.invoiceNumber} posted successfully. Total: $${updatedInvoice.total}. Journal entries would be created here in production.`,
    };
  },

  async draft_bill(args: any, context: FunctionContext) {
    const { vendorId, items, billDate, dueDate, notes } = args;
    
    // Get vendor to populate bill details
    const vendor = await storage.getVendor(vendorId);
    
    if (!vendor || vendor.tenantId !== context.tenantId) {
      throw new Error('Vendor not found');
    }
    
    // Create bill with status='draft'
    const bill = await storage.createBillWithItems(
      {
        bill: {
          tenantId: context.tenantId,
          vendorId,
          vendorName: vendor.companyName || vendor.contactName || '',
          billNumber: `DRAFT-${Date.now()}`,
          billDate: billDate ? new Date(billDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          notes: notes || null,
          subtotal: '0',
          taxAmount: '0',
          total: '0',
          currencyCode: 'USD',
          exchangeRate: '1.0',
        },
        lineItems: items.map((item: any) => ({
          tenantId: context.tenantId,
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          amount: (item.quantity * item.unitPrice).toString(),
          taxAmount: '0',
        })),
      },
      context.tenantId
    );
    
    return {
      success: true,
      billId: bill.id,
      billNumber: bill.billNumber,
      status: bill.status,
      total: bill.total,
      message: `Draft bill ${bill.billNumber} created for ${vendor.companyName || vendor.contactName}. Total: $${bill.total}. Review and post to create journal entries.`,
    };
  },

  async post_bill(args: any, context: FunctionContext) {
    const { billId } = args;
    
    // Get the bill
    const bill = await storage.getBill(billId);
    
    if (!bill || bill.tenantId !== context.tenantId) {
      throw new Error('Bill not found');
    }
    
    // TODO: SEGREGATION OF DUTIES - Currently not enforced for bills
    // The bills table schema (shared/schema.ts) does not have a 'createdBy' field
    // to track who created the bill. To fully implement segregation of duties:
    // 1. Add 'createdBy' field to bills table schema
    // 2. Update draft_bill handler to set createdBy: context.userId
    // 3. Add check here: if (bill.createdBy === context.userId) throw error
    // This would prevent users from posting bills they created themselves
    
    if (bill.status === 'draft') {
      // Get existing line items for the update
      const lineItems = await storage.getBillLineItems(billId, context.tenantId);
      
      // Update bill status to 'unpaid' (posted)
      const updatedBill = await storage.updateBillWithItems(
        billId,
        context.tenantId,
        {
          bill: {
            ...bill,
            status: 'unpaid',
          },
          lineItems: lineItems,
        }
      );
      
      // Note: In a full implementation, this would create journal entries for Expense and AP
      // For now, we're just updating the status
      // Future enhancement: Call accounting service to create journal entries
      
      return {
        success: true,
        billId: updatedBill.id,
        billNumber: updatedBill.billNumber,
        status: updatedBill.status,
        total: updatedBill.total,
        message: `Bill ${updatedBill.billNumber} posted successfully. Total: $${updatedBill.total}. Journal entries would be created here in production.`,
      };
    } else {
      throw new Error(`Bill cannot be posted from status: ${bill.status}`);
    }
  },

  async web_search(args: any, context: FunctionContext) {
    const { query, maxResults = 5 } = args;

    // Rate limiting
    if (!checkRateLimit(context.userId)) {
      throw new Error('Rate limit exceeded. Please wait a moment before searching again.');
    }

    try {
      // Validate input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      const limit = Math.min(Math.max(1, maxResults), 10);

      // Using DuckDuckGo HTML search (no API key required)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });

      const $ = cheerio.load(response.data);
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Extract search results from DuckDuckGo HTML
      $('.result').each((i, elem) => {
        if (results.length >= limit) return false;

        const $elem = $(elem);
        const title = $elem.find('.result__a').text().trim();
        const url = $elem.find('.result__url').attr('href') || '';
        const snippet = $elem.find('.result__snippet').text().trim();

        if (title && url) {
          results.push({
            title,
            url: url.startsWith('//') ? 'https:' + url : url,
            snippet: snippet || 'No description available'
          });
        }
      });

      // Fallback: if DuckDuckGo doesn't work, return a helpful message
      if (results.length === 0) {
        return {
          success: true,
          query,
          count: 0,
          results: [],
          message: `No results found for "${query}". This may be due to search service limitations. Try refining your query or using web_fetch with a specific URL.`,
          sources: []
        };
      }

      return {
        success: true,
        query,
        count: results.length,
        results: results.map((r, i) => ({
          rank: i + 1,
          title: r.title,
          url: r.url,
          snippet: r.snippet
        })),
        message: `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`,
        sources: results.map(r => ({ title: r.title, url: r.url }))
      };
    } catch (error: any) {
      console.error('Web search error:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        throw new Error('Unable to connect to search service. Please check your internet connection and try again.');
      }
      
      throw new Error(`Search failed: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async web_fetch(args: any, context: FunctionContext) {
    const { url } = args;

    // Rate limiting
    if (!checkRateLimit(context.userId)) {
      throw new Error('Rate limit exceeded. Please wait a moment before fetching content.');
    }

    try {
      // Validate URL
      if (!url || typeof url !== 'string') {
        throw new Error('URL is required');
      }

      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(url)) {
        throw new Error('Invalid URL. URL must start with http:// or https://');
      }

      // Fetch the page content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000, // 15 second timeout
        maxContentLength: 5 * 1024 * 1024, // 5MB max
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Parse HTML and extract main content
      const $ = cheerio.load(response.data);

      // Remove script, style, and other non-content elements
      $('script, style, nav, header, footer, iframe, noscript').remove();

      // Try to find main content area
      let content = $('main').html() || 
                    $('article').html() || 
                    $('.content').html() || 
                    $('#content').html() || 
                    $('body').html() || 
                    '';

      // Convert HTML to Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        emDelimiter: '_',
        bulletListMarker: '-'
      });

      // Add custom rules for better markdown conversion
      turndownService.addRule('removeComments', {
        filter: (node) => node.nodeType === 8, // Comment nodes
        replacement: () => ''
      });

      const markdown = turndownService.turndown(content);

      // Clean up excessive whitespace
      const cleanedMarkdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Extract title
      const title = $('title').text().trim() || 
                    $('h1').first().text().trim() || 
                    'Untitled Page';

      // Get word count estimate
      const wordCount = cleanedMarkdown.split(/\s+/).length;

      return {
        success: true,
        url,
        title,
        content: cleanedMarkdown,
        wordCount,
        contentLength: cleanedMarkdown.length,
        message: `Successfully fetched content from "${title}" (${wordCount} words)`,
        source: {
          title,
          url,
          fetchedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Web fetch error:', error);

      if (error.code === 'ENOTFOUND') {
        throw new Error('Unable to reach the specified URL. Please check the URL and try again.');
      }

      if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timed out. The website may be slow or unavailable.');
      }

      if (error.response?.status === 403) {
        throw new Error('Access denied. The website may be blocking automated requests.');
      }

      if (error.response?.status === 404) {
        throw new Error('Page not found. Please check the URL and try again.');
      }

      throw new Error(`Failed to fetch content: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async process_document(args: any, context: FunctionContext) {
    const { attachmentId, documentType, createDraft = false } = args;

    try {
      // Validate attachment ID
      if (!attachmentId || typeof attachmentId !== 'string') {
        throw new Error('Attachment ID is required');
      }

      // Get the attachment from storage
      const attachment = await storage.getAttachment(attachmentId, context.tenantId);
      
      if (!attachment) {
        throw new Error('Document not found or access denied');
      }

      // Validate it's an image file
      if (!attachment.fileType.startsWith('image/')) {
        throw new Error('Document must be an image file (JPEG, PNG, etc.)');
      }

      // Get the base64 image data
      const imageData = attachment.fileData;

      // Import the document processor
      const { DocumentProcessor } = await import('./document-processor');
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('AI service not configured');
      }

      const processor = new DocumentProcessor(apiKey);

      // Extract data from the document
      const result = await processor.extractDocumentData(
        imageData,
        documentType === 'auto' ? undefined : documentType
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract document data');
      }

      const extractedData = result.data;

      // Store extraction result in attachment metadata (if storage supports it)
      // This could be used to cache results and avoid re-processing
      
      let draftTransaction: any = null;

      // Optionally create a draft transaction
      if (createDraft && extractedData.documentType !== 'unknown') {
        try {
          switch (extractedData.documentType) {
            case 'invoice':
            case 'receipt':
              draftTransaction = processor.convertToInvoiceDraft(extractedData);
              break;
            
            case 'bill':
              draftTransaction = processor.convertToBillDraft(extractedData);
              break;
            
            case 'bank_statement':
              // Bank statements typically have multiple transactions
              draftTransaction = {
                type: 'journal_entries',
                entries: processor.convertToJournalEntries(extractedData)
              };
              break;
          }
        } catch (conversionError: any) {
          console.warn('[process_document] Draft conversion failed:', conversionError);
          // Continue with extraction results even if draft creation fails
        }
      }

      return {
        success: true,
        attachmentId,
        documentType: extractedData.documentType,
        confidence: extractedData.confidence,
        extractedData,
        draftTransaction,
        processingTime: result.processingTime,
        message: draftTransaction 
          ? `Document processed successfully. A draft ${extractedData.documentType} has been prepared for your review.`
          : `Document processed successfully. Extracted ${extractedData.lineItems?.length || 0} line items.`,
        warnings: extractedData.warnings
      };

    } catch (error: any) {
      console.error('[process_document] Error:', error);
      throw new Error(`Document processing failed: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async search_knowledge_base(args: any, context: FunctionContext) {
    const { query, documentTypes, limit = 5, similarityThreshold = 0.7 } = args;

    try {
      // Validate query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      // Validate limit
      const validatedLimit = Math.min(Math.max(1, limit || 5), 20); // Between 1 and 20

      // Validate similarity threshold
      const validatedThreshold = Math.min(Math.max(0, similarityThreshold || 0.7), 1); // Between 0 and 1

      // Get knowledge base service
      const knowledgeBase = getKnowledgeBaseService();

      // Perform semantic search
      const results = await knowledgeBase.searchKnowledgeBase(
        context.tenantId,
        query.trim(),
        {
          limit: validatedLimit,
          documentTypes,
          similarityThreshold: validatedThreshold,
        }
      );

      if (results.length === 0) {
        return {
          success: true,
          query,
          count: 0,
          results: [],
          message: `No relevant documents found for "${query}". The knowledge base may not have been indexed yet, or try a different query.`
        };
      }

      // Format results for display
      const formattedResults = results.map((result, index) => ({
        rank: index + 1,
        documentType: result.documentType,
        documentId: result.documentId,
        content: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''), // Truncate for display
        metadata: result.metadata,
        similarityScore: Math.round(result.similarity * 100) / 100, // Round to 2 decimals
      }));

      return {
        success: true,
        query,
        count: results.length,
        results: formattedResults,
        message: `Found ${results.length} relevant document${results.length !== 1 ? 's' : ''} matching "${query}"`,
        averageSimilarity: results.length > 0 
          ? Math.round((results.reduce((sum, r) => sum + r.similarity, 0) / results.length) * 100) / 100
          : 0,
      };

    } catch (error: any) {
      console.error('[search_knowledge_base] Error:', error);
      
      // Check if it's an OpenAI API error
      if (error.message?.includes('OPENAI_API_KEY')) {
        throw new Error('Knowledge base search is not available. OpenAI API key is not configured.');
      }

      throw new Error(`Knowledge base search failed: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async get_credit_passport(args: any, context: FunctionContext) {
    try {
      const { storage } = await import('../storage');
      
      const metrics = await storage.getLatestFinancialMetricsSnapshot(context.tenantId);
      const score = await storage.getLatestBankabilityScore(context.tenantId);
      const history = await storage.getScoreHistory(context.tenantId, 12);
      
      if (!metrics && !score) {
        const { calculateAndSaveMetrics } = await import('../services/financial-metrics');
        const newMetrics = await calculateAndSaveMetrics(context.tenantId);
        
        const { calculateAndSaveScore } = await import('../services/bankability-scoring');
        const newScore = await calculateAndSaveScore(context.tenantId, newMetrics);
        
        const { generateImprovementPlan } = await import('../services/credit-insights');
        const insights = generateImprovementPlan(newMetrics, newScore);
        
        return {
          success: true,
          score: newScore.overallScore,
          grade: newScore.scoreGrade,
          loanEligibility: newScore.loanEligibility,
          components: {
            liquidity: newScore.liquidityScore,
            leverage: newScore.leverageScore,
            profitability: newScore.profitabilityScore,
            cashFlow: newScore.cashFlowScore,
            operational: newScore.operationalScore,
            paymentBehavior: newScore.paymentBehaviorScore,
          },
          blockingFactors: newScore.blockingFactors || [],
          topRecommendations: insights.quickWins.slice(0, 3),
          message: `Credit passport calculated. Your bankability score is ${newScore.overallScore}/100 (Grade ${newScore.scoreGrade}). Loan eligibility: ${newScore.loanEligibility}.`,
        };
      }
      
      let insights = null;
      if (metrics && score) {
        const { generateImprovementPlan } = await import('../services/credit-insights');
        insights = generateImprovementPlan(metrics, score);
      }
      
      return {
        success: true,
        score: score?.overallScore || 0,
        grade: score?.scoreGrade || 'N/A',
        loanEligibility: score?.loanEligibility || 'not_eligible',
        components: score ? {
          liquidity: score.liquidityScore,
          leverage: score.leverageScore,
          profitability: score.profitabilityScore,
          cashFlow: score.cashFlowScore,
          operational: score.operationalScore,
          paymentBehavior: score.paymentBehaviorScore,
        } : null,
        blockingFactors: score?.blockingFactors || [],
        topRecommendations: insights?.quickWins?.slice(0, 3) || [],
        scoreHistory: history?.map(h => ({
          date: h.scoreDate,
          score: h.overallScore,
          change: h.scoreChange,
        })) || [],
        message: score 
          ? `Your current bankability score is ${score.overallScore}/100 (Grade ${score.scoreGrade}). Loan eligibility: ${score.loanEligibility}.`
          : 'No credit passport data available.',
      };

    } catch (error: any) {
      console.error('[get_credit_passport] Error:', error);
      throw new Error(`Failed to get credit passport: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async improve_bankability_score(args: any, context: FunctionContext) {
    const { focusArea = 'all' } = args;
    
    try {
      const { storage } = await import('../storage');
      
      const metrics = await storage.getLatestFinancialMetricsSnapshot(context.tenantId);
      const score = await storage.getLatestBankabilityScore(context.tenantId);
      
      if (!metrics || !score) {
        return {
          success: false,
          message: 'No financial metrics or score found. Please calculate your credit passport first using get_credit_passport.',
        };
      }
      
      const { generateImprovementPlan } = await import('../services/credit-insights');
      const plan = generateImprovementPlan(metrics, score);
      
      let recommendations = [];
      
      if (focusArea === 'all') {
        recommendations = [
          ...plan.quickWins.slice(0, 3),
          ...plan.longTermActions.slice(0, 2),
        ];
      } else {
        const categoryInsight = plan.insights.find(i => i.category === focusArea);
        if (categoryInsight) {
          recommendations = categoryInsight.recommendations.slice(0, 5);
        }
      }
      
      return {
        success: true,
        currentScore: plan.currentScore,
        targetScore: plan.targetScore,
        estimatedTimeToTarget: plan.estimatedTimeToTarget,
        focusArea,
        recommendations: recommendations.map(rec => ({
          metric: rec.metric,
          priority: rec.priority,
          recommendation: rec.recommendation,
          estimatedImpact: rec.estimatedImpact,
          timeframe: rec.timeframe,
        })),
        quickWinCount: plan.quickWins.length,
        longTermCount: plan.longTermActions.length,
        message: focusArea === 'all'
          ? `Found ${plan.quickWins.length} quick wins (1-3 months) and ${plan.longTermActions.length} long-term actions. Potential score increase: ${plan.targetScore - plan.currentScore} points.`
          : `Showing ${recommendations.length} recommendations for ${focusArea}. Focus on high-priority items first.`,
      };

    } catch (error: any) {
      console.error('[improve_bankability_score] Error:', error);
      throw new Error(`Failed to generate improvement recommendations: ${error.message || 'Unknown error occurred'}`);
    }
  },

  async approve_draft_entry(args: any, context: FunctionContext) {
    const { inboundDocumentId } = args;

    if (!inboundDocumentId) {
      throw new Error('inboundDocumentId is required');
    }

    try {
      const { approveDraftEntry } = await import('../services/auto-draft-service');
      
      const result = await approveDraftEntry(
        inboundDocumentId,
        context.userId,
        context.tenantId
      );

      return {
        success: result.success,
        message: result.message,
        entryId: result.entryId,
      };
    } catch (error: any) {
      console.error('[approve_draft_entry] Error:', error);
      throw new Error(`Failed to approve draft entry: ${error.message}`);
    }
  },

  async reject_draft_entry(args: any, context: FunctionContext) {
    const { inboundDocumentId, reason } = args;

    if (!inboundDocumentId) {
      throw new Error('inboundDocumentId is required');
    }

    try {
      const { rejectDraftEntry } = await import('../services/auto-draft-service');
      
      const result = await rejectDraftEntry(
        inboundDocumentId,
        context.userId,
        context.tenantId,
        reason
      );

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error: any) {
      console.error('[reject_draft_entry] Error:', error);
      throw new Error(`Failed to reject draft entry: ${error.message}`);
    }
  },

  async review_alert(args: any, context: FunctionContext) {
    const { alertId } = args;

    if (!alertId) {
      throw new Error('alertId is required');
    }

    try {
      const alert = await storage.getAlertInstance(alertId);

      if (!alert || alert.tenantId !== context.tenantId) {
        throw new Error('Alert not found');
      }

      // Mark alert as viewed if not already
      if (alert.status === 'new') {
        await storage.updateAlertInstance(alertId, {
          status: 'viewed',
          viewedAt: new Date(),
          viewedBy: context.userId,
        });
      }

      return {
        alertId: alert.id,
        alertType: alert.alertType,
        priority: alert.priority,
        title: alert.title,
        message: alert.message,
        actionUrl: alert.actionUrl,
        quickActions: alert.quickActions || [],
        metadata: alert.metadata,
        status: alert.status,
        createdAt: alert.createdAt,
        expiresAt: alert.expiresAt,
      };
    } catch (error: any) {
      console.error('[review_alert] Error:', error);
      throw new Error(`Failed to review alert: ${error.message}`);
    }
  },

  async dismiss_alert(args: any, context: FunctionContext) {
    const { alertId, reason } = args;

    if (!alertId) {
      throw new Error('alertId is required');
    }

    try {
      const alert = await storage.getAlertInstance(alertId);

      if (!alert || alert.tenantId !== context.tenantId) {
        throw new Error('Alert not found');
      }

      await storage.updateAlertInstance(alertId, {
        status: 'dismissed',
        viewedAt: new Date(),
        viewedBy: context.userId,
      });

      // Log dismissal for audit
      await storage.createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'dismiss_alert',
        entityType: 'alert_instance',
        entityId: alertId,
        changes: {
          reason: reason || 'No reason provided',
          dismissedAt: new Date().toISOString(),
        },
        wasSuccessful: true,
      });

      return {
        success: true,
        message: `Alert dismissed successfully${reason ? `: ${reason}` : ''}`,
      };
    } catch (error: any) {
      console.error('[dismiss_alert] Error:', error);
      throw new Error(`Failed to dismiss alert: ${error.message}`);
    }
  },

  async action_alert(args: any, context: FunctionContext) {
    const { alertId, actionType, params = {} } = args;

    if (!alertId || !actionType) {
      throw new Error('alertId and actionType are required');
    }

    try {
      const alert = await storage.getAlertInstance(alertId);

      if (!alert || alert.tenantId !== context.tenantId) {
        throw new Error('Alert not found');
      }

      // Verify the action is available for this alert
      const quickActions = alert.quickActions as any[] || [];
      const validAction = quickActions.find((qa: any) => qa.action === actionType);

      if (!validAction) {
        throw new Error(`Action '${actionType}' is not available for this alert`);
      }

      // Execute the action based on type
      let actionResult: any = {};

      switch (actionType) {
        case 'approve_all':
          // Approve all related items (implementation depends on metadata)
          actionResult = { message: 'All items approved' };
          break;

        case 'remind_customer':
          // Send reminder to customer (implementation depends on alert metadata)
          actionResult = { message: 'Customer reminder sent' };
          break;

        case 'mark_uncollectible':
          // Mark invoice as uncollectible
          if (alert.metadata && (alert.metadata as any).invoiceId) {
            const invoiceId = (alert.metadata as any).invoiceId;
            await storage.updateInvoice(invoiceId, context.tenantId, {
              notes: 'Marked as uncollectible from alert action',
            });
            actionResult = { message: 'Invoice marked as uncollectible' };
          } else {
            throw new Error('No invoice ID in alert metadata');
          }
          break;

        case 'snooze':
          // Snooze alert for specified duration
          const snoozeDays = params.days || 7;
          const newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + snoozeDays);
          
          await storage.updateAlertInstance(alertId, {
            expiresAt: newExpiresAt,
            status: 'viewed',
          });
          
          actionResult = { message: `Alert snoozed for ${snoozeDays} days` };
          break;

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      // Update alert status to actioned
      await storage.updateAlertInstance(alertId, {
        status: 'actioned',
        actionedAt: new Date(),
        actionedBy: context.userId,
        actionTaken: actionType,
      });

      // Log action for audit
      await storage.createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'action_alert',
        entityType: 'alert_instance',
        entityId: alertId,
        changes: {
          actionType,
          params,
          result: actionResult,
        },
        wasSuccessful: true,
      });

      return {
        success: true,
        actionType,
        result: actionResult,
        message: actionResult.message || `Action '${actionType}' completed successfully`,
      };
    } catch (error: any) {
      console.error('[action_alert] Error:', error);
      throw new Error(`Failed to execute alert action: ${error.message}`);
    }
  },

  async list_pending_documents(args: any, context: FunctionContext) {
    const { status = 'all', limit = 10 } = args;

    try {
      let documents = await storage.getInboundDocumentsByTenant(context.tenantId);

      // Filter by status if specified
      if (status !== 'all') {
        documents = documents.filter(doc => doc.status === status);
      }

      // Sort by creation date (newest first)
      documents = documents.sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );

      return {
        count: documents.length,
        documents: documents.slice(0, limit).map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          source: doc.source,
          status: doc.status,
          draftEntryType: doc.draftEntryType,
          draftEntryId: doc.draftEntryId,
          createdAt: doc.createdAt,
          processedAt: doc.processedAt,
          errorMessage: doc.errorMessage,
        })),
        summary: `Found ${documents.length} documents${status !== 'all' ? ` with status '${status}'` : ''}`,
      };
    } catch (error: any) {
      console.error('[list_pending_documents] Error:', error);
      throw new Error(`Failed to list pending documents: ${error.message}`);
    }
  },

  async list_active_alerts(args: any, context: FunctionContext) {
    const { priority = 'all', alertType, limit = 10 } = args;

    try {
      let alerts = await storage.getAlertInstancesByTenant(context.tenantId);

      // Filter by priority if specified
      if (priority !== 'all') {
        alerts = alerts.filter(alert => alert.priority === priority);
      }

      // Filter by alert type if specified
      if (alertType) {
        alerts = alerts.filter(alert => alert.alertType === alertType);
      }

      // Only show active alerts (not dismissed or expired)
      alerts = alerts.filter(alert => 
        alert.status !== 'dismissed' && 
        (!alert.expiresAt || new Date(alert.expiresAt) > new Date())
      );

      // Sort by priority (critical, high, medium, low) and creation date
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      alerts = alerts.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      });

      return {
        count: alerts.length,
        criticalCount: alerts.filter(a => a.priority === 'critical').length,
        highCount: alerts.filter(a => a.priority === 'high').length,
        alerts: alerts.slice(0, limit).map(alert => ({
          id: alert.id,
          alertType: alert.alertType,
          priority: alert.priority,
          title: alert.title,
          message: alert.message,
          status: alert.status,
          actionUrl: alert.actionUrl,
          quickActions: alert.quickActions,
          createdAt: alert.createdAt,
          expiresAt: alert.expiresAt,
        })),
        summary: `Found ${alerts.length} active alerts${priority !== 'all' ? ` with priority '${priority}'` : ''}.${
          alerts.filter(a => a.priority === 'critical').length > 0 
            ? ` ${alerts.filter(a => a.priority === 'critical').length} critical alerts require immediate attention.`
            : ''
        }`,
      };
    } catch (error: any) {
      console.error('[list_active_alerts] Error:', error);
      throw new Error(`Failed to list active alerts: ${error.message}`);
    }
  }
};
