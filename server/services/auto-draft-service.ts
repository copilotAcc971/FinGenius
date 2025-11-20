import { storage } from '../storage';
import type { InboundDocument } from '@shared/schema';
import { getPushService } from '../notifications/push-service';
import { RBACService } from '../rbac/service';

/**
 * Auto-Draft Accounting Entries Service
 * 
 * Creates draft accounting entries from AI-extracted data
 * Implements 2-step approval workflow:
 * 1. Create draft from extraction
 * 2. User approves/rejects via notification or AI Copilot
 */

interface DraftEntry {
  id: string;
  type: 'invoice' | 'bill' | 'journal_entry';
  summary: string;
  data: any;
}

/**
 * Create draft accounting entry from extracted data
 */
export async function createDraftFromExtraction(
  inboundDocumentId: string,
  tenantId: string
): Promise<DraftEntry> {
  // Get inbound document with extracted data
  const document = await storage.getInboundDocument(inboundDocumentId);
  
  if (!document) {
    throw new Error(`Inbound document ${inboundDocumentId} not found`);
  }

  if (!document.extractedData) {
    throw new Error('No extracted data available');
  }

  const extractedData = document.extractedData as any;
  const documentType = extractedData.documentType;

  // Create draft entry based on document type
  switch (documentType) {
    case 'bill':
    case 'receipt':
      return await createDraftBill(tenantId, extractedData, inboundDocumentId);
    
    case 'invoice':
      return await createDraftInvoice(tenantId, extractedData, inboundDocumentId);
    
    case 'bank_statement':
      return await createDraftJournalEntry(tenantId, extractedData, inboundDocumentId);
    
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

/**
 * Create draft bill from extracted data
 */
async function createDraftBill(
  tenantId: string,
  extractedData: any,
  inboundDocumentId: string
): Promise<DraftEntry> {
  const vendorName = extractedData.vendorName || 'Unknown Vendor';
  const total = extractedData.total || 0;
  const billDate = extractedData.date || new Date().toISOString().split('T')[0];
  const dueDate = extractedData.dueDate;

  // Try to find existing vendor by name
  let vendorId: string | null = null;
  try {
    const vendors = await storage.getVendorsByTenant(tenantId);
    const matchingVendor = vendors.find(v => 
      v.companyName?.toLowerCase().includes(vendorName.toLowerCase()) ||
      vendorName.toLowerCase().includes(v.companyName?.toLowerCase() || '')
    );
    vendorId = matchingVendor?.id || null;
  } catch (error) {
    console.error('Failed to find matching vendor:', error);
  }

  // Create draft bill
  const lineItems = (extractedData.lineItems || []).map((item: any) => ({
    description: item.description || 'Item',
    quantity: item.quantity || 1,
    unitPrice: (item.unitPrice || item.amount || 0).toString(),
    amount: item.amount.toString(),
    taxAmount: item.taxAmount?.toString(),
  }));

  // If no line items extracted, create a single line with total
  if (lineItems.length === 0 && total > 0) {
    lineItems.push({
      description: `Bill from ${vendorName}`,
      quantity: 1,
      unitPrice: total.toString(),
      amount: total.toString(),
    });
  }

  const billData = {
    tenantId,
    vendorId,
    vendorName,
    billDate,
    dueDate,
    subtotal: (extractedData.subtotal || total).toString(),
    taxAmount: extractedData.taxAmount?.toString() || '0',
    total: total.toString(),
    status: 'draft' as const,
    notes: `AI-extracted from ${extractedData.fileName || 'uploaded document'}. Source: ${inboundDocumentId}`,
  };

  const bill = await storage.createBill(billData, lineItems);

  return {
    id: bill.id!,
    type: 'bill',
    summary: `Bill from ${vendorName} for $${total.toFixed(2)}`,
    data: bill,
  };
}

/**
 * Create draft invoice from extracted data
 */
async function createDraftInvoice(
  tenantId: string,
  extractedData: any,
  inboundDocumentId: string
): Promise<DraftEntry> {
  const customerName = extractedData.customerName || 'Unknown Customer';
  const total = extractedData.total || 0;
  const invoiceDate = extractedData.date || new Date().toISOString().split('T')[0];
  const dueDate = extractedData.dueDate;

  // Try to find existing customer by name
  let customerId: string | null = null;
  try {
    const customers = await storage.getCustomersByTenant(tenantId);
    const matchingCustomer = customers.find(c => 
      c.companyName?.toLowerCase().includes(customerName.toLowerCase()) ||
      customerName.toLowerCase().includes(c.companyName?.toLowerCase() || '')
    );
    customerId = matchingCustomer?.id || null;
  } catch (error) {
    console.error('Failed to find matching customer:', error);
  }

  // Create draft invoice
  const lineItems = (extractedData.lineItems || []).map((item: any) => ({
    description: item.description || 'Item',
    quantity: item.quantity || 1,
    rate: (item.unitPrice || item.amount || 0).toString(),
    amount: item.amount.toString(),
    taxAmount: item.taxAmount?.toString(),
  }));

  // If no line items extracted, create a single line with total
  if (lineItems.length === 0 && total > 0) {
    lineItems.push({
      description: `Invoice to ${customerName}`,
      quantity: 1,
      rate: total.toString(),
      amount: total.toString(),
    });
  }

  const invoiceData = {
    tenantId,
    customerId,
    customerName,
    invoiceDate,
    dueDate,
    subtotal: (extractedData.subtotal || total).toString(),
    taxAmount: extractedData.taxAmount?.toString() || '0',
    total: total.toString(),
    balanceDue: total.toString(),
    status: 'draft' as const,
    notes: `AI-extracted from ${extractedData.fileName || 'uploaded document'}. Source: ${inboundDocumentId}`,
  };

  const invoice = await storage.createInvoice(invoiceData, lineItems);

  return {
    id: invoice.id!,
    type: 'invoice',
    summary: `Invoice to ${customerName} for $${total.toFixed(2)}`,
    data: invoice,
  };
}

/**
 * Create draft journal entry from extracted data (bank statement)
 */
async function createDraftJournalEntry(
  tenantId: string,
  extractedData: any,
  inboundDocumentId: string
): Promise<DraftEntry> {
  // For bank statements, we create a simple journal entry
  // User will need to review and map accounts
  
  const accountNumber = extractedData.accountNumber || 'Unknown';
  const transactionCount = extractedData.transactions?.length || 0;

  const entryDate = new Date().toISOString().split('T')[0];
  const description = `Bank statement import - Account ${accountNumber} (${transactionCount} transactions)`;

  // Create a placeholder journal entry (user must map accounts)
  const journalEntryData = {
    tenantId,
    entryDate,
    description,
    reference: `BANK-${accountNumber}-${inboundDocumentId.substring(0, 8)}`,
    status: 'draft' as const,
    notes: `AI-extracted from bank statement. Source: ${inboundDocumentId}. User must review and map accounts.`,
  };

  // We'll create a simple balanced entry with placeholder accounts
  const legs = [
    {
      // Placeholder - user must select bank account
      accountId: '', // Will need to be filled by user
      type: 'Debit' as const,
      amount: extractedData.closingBalance?.toString() || '0',
      description: 'Bank closing balance (requires account mapping)',
    },
    {
      // Placeholder - user must select contra account
      accountId: '', // Will need to be filled by user
      type: 'Credit' as const,
      amount: extractedData.closingBalance?.toString() || '0',
      description: 'Contra account (requires account mapping)',
    },
  ];

  const journalEntry = await storage.createJournalEntry(journalEntryData, legs);

  return {
    id: journalEntry.id!,
    type: 'journal_entry',
    summary: `Bank statement with ${transactionCount} transactions`,
    data: journalEntry,
  };
}

/**
 * Approve a draft entry and post it to the ledger
 */
export async function approveDraftEntry(
  inboundDocumentId: string,
  userId: string,
  tenantId: string
): Promise<{ success: boolean; message: string; entryId?: string }> {
  // Get inbound document
  const document = await storage.getInboundDocument(inboundDocumentId);
  
  if (!document) {
    throw new Error('Inbound document not found');
  }

  if (!document.draftEntryId || !document.draftEntryType) {
    throw new Error('No draft entry linked to this document');
  }

  if (document.status === 'approved') {
    return {
      success: false,
      message: 'Document already approved',
    };
  }

  // Check user permissions based on entry type
  const rbacService = new RBACService();
  const requiredPermission = getRequiredPermission(document.draftEntryType);
  
  const hasPermission = await rbacService.hasPermission(userId, tenantId, requiredPermission);
  if (!hasPermission) {
    throw new Error(`User does not have permission: ${requiredPermission}`);
  }

  // Post the entry (update status)
  const entryType = document.draftEntryType;
  const entryId = document.draftEntryId;

  try {
    switch (entryType) {
      case 'bill':
        // Update bill status from draft to unpaid
        await storage.updateBill(entryId, { status: 'unpaid' });
        break;
      
      case 'invoice':
        // Update invoice status from draft to sent
        await storage.updateInvoice(entryId, { status: 'sent' });
        break;
      
      case 'journal_entry':
        // Post journal entry
        await storage.updateJournalEntry(entryId, { status: 'posted' });
        break;
    }

    // Mark inbound document as approved
    await storage.updateInboundDocument(inboundDocumentId, {
      status: 'approved',
      processedBy: userId,
      processedAt: new Date(),
    });

    // Send confirmation notification
    await sendApprovalConfirmation(userId, tenantId, document, entryType);

    console.log(`[Auto-Draft Service] Approved ${entryType} ${entryId} for document ${inboundDocumentId}`);

    return {
      success: true,
      message: `${entryType} approved and posted successfully`,
      entryId,
    };
  } catch (error: any) {
    console.error('[Auto-Draft Service] Approval failed:', error);
    throw new Error(`Failed to approve entry: ${error.message}`);
  }
}

/**
 * Reject a draft entry
 */
export async function rejectDraftEntry(
  inboundDocumentId: string,
  userId: string,
  tenantId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  // Get inbound document
  const document = await storage.getInboundDocument(inboundDocumentId);
  
  if (!document) {
    throw new Error('Inbound document not found');
  }

  if (!document.draftEntryId || !document.draftEntryType) {
    throw new Error('No draft entry linked to this document');
  }

  if (document.status === 'rejected') {
    return {
      success: false,
      message: 'Document already rejected',
    };
  }

  // Check user permissions
  const rbacService = new RBACService();
  const requiredPermission = getRequiredPermission(document.draftEntryType);
  
  const hasPermission = await rbacService.hasPermission(userId, tenantId, requiredPermission);
  if (!hasPermission) {
    throw new Error(`User does not have permission: ${requiredPermission}`);
  }

  // Delete or mark draft entry as rejected
  const entryType = document.draftEntryType;
  const entryId = document.draftEntryId;

  try {
    // For MVP, we'll just delete the draft entries
    // In production, you might want to keep them with a 'rejected' status
    switch (entryType) {
      case 'bill':
        await storage.deleteBill(entryId);
        break;
      case 'invoice':
        await storage.deleteInvoice(entryId);
        break;
      case 'journal_entry':
        await storage.deleteJournalEntry(entryId);
        break;
    }

    // Mark inbound document as rejected
    await storage.updateInboundDocument(inboundDocumentId, {
      status: 'rejected',
      processedBy: userId,
      processedAt: new Date(),
      errorMessage: reason || 'Rejected by user',
    });

    console.log(`[Auto-Draft Service] Rejected ${entryType} ${entryId} for document ${inboundDocumentId}`);

    return {
      success: true,
      message: `${entryType} rejected and deleted`,
    };
  } catch (error: any) {
    console.error('[Auto-Draft Service] Rejection failed:', error);
    throw new Error(`Failed to reject entry: ${error.message}`);
  }
}

/**
 * Get required permission for entry type
 */
function getRequiredPermission(entryType: string): string {
  switch (entryType) {
    case 'bill':
      return 'bills.create';
    case 'invoice':
      return 'invoices.create';
    case 'journal_entry':
      return 'journal_entries.create';
    default:
      return 'general.access';
  }
}

/**
 * Send approval confirmation notification
 */
async function sendApprovalConfirmation(
  userId: string,
  tenantId: string,
  document: InboundDocument,
  entryType: string
): Promise<void> {
  try {
    const pushService = getPushService();
    
    await pushService.sendToUser({
      tenantId,
      userId,
      notificationType: 'general',
      payload: {
        title: '✅ Entry Approved',
        body: `${entryType} from ${document.fileName} has been approved and posted to the ledger`,
        icon: '/icons/approved.png',
        tag: `approval-confirmed-${document.id}`,
        data: {
          type: 'approval_confirmed',
          inboundDocumentId: document.id,
          draftEntryId: document.draftEntryId,
          draftEntryType: entryType,
        },
      },
    });
  } catch (error) {
    console.error('[Auto-Draft Service] Failed to send confirmation:', error);
    // Don't fail the whole operation if notification fails
  }
}
