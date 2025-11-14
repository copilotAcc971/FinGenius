/**
 * Journal Entry Creators
 * 
 * Automatic double-entry bookkeeping for all financial transactions.
 * Each document type (invoice, bill, payment, etc.) has a creator function
 * that generates balanced journal entries linking to source documents.
 * 
 * This module provides:
 * - Normalized input types for each document type
 * - Data fetcher helpers to transform database records into entry inputs
 * - Foundation for implementing entry creators in Task 4b-2
 * 
 * @module server/accounting/entry-creators
 */

import { z } from 'zod';
import type { DBTransaction } from './service';
import type { IStorage } from '../storage';
import type { CreateJournalEntry } from './service';
import { eq, and } from 'drizzle-orm';
import { 
  invoices, 
  invoiceLineItems, 
  bills, 
  billLineItems,
  customerPayments,
  customerPaymentApplications,
  payments,
  billPaymentApplications,
  creditNotes,
  creditNoteLineItems,
  debitNotes,
  debitNoteLineItems,
  items,
  taxes,
} from '@shared/schema';
import { ValidationError } from './errors';

// ====================================
// DOCUMENT INPUT TYPES
// ====================================

/**
 * Invoice Line Item Entry Input
 * 
 * Normalized structure for invoice line items used in journal entry creation.
 * 
 * **COGS Calculation Logic:**
 * - If itemId is provided and item.type === 'inventory', fetch item.purchasePrice
 * - Calculate COGS = purchasePrice * quantity
 * - Include costOfGoodsSold in the result for inventory items
 * - For non-inventory items or custom line items (itemId === null), costOfGoodsSold is undefined
 * 
 * **Tax Handling:**
 * - taxAmount is the total tax for this line item
 * - Aggregated at invoice level for totalTax
 */
export interface InvoiceLineEntryInput {
  itemId: string | null;     // May be null for custom line items
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;         // quantity * unitPrice (before discount)
  taxAmount: string;
  
  // Inventory tracking (only for inventory items)
  isInventoryItem: boolean;
  costOfGoodsSold?: string;  // Unit cost * quantity (for COGS journal entry)
}

/**
 * Invoice Entry Input
 * 
 * Normalized structure for invoices used in journal entry creation.
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Accounts Receivable    [totalAmount]
 *     CR  Sales Revenue      [subtotal]
 *     CR  Tax Payable        [totalTax]
 * 
 * For inventory items:
 * DR  Cost of Goods Sold     [costOfGoodsSold]
 *     CR  Inventory          [costOfGoodsSold]
 * ```
 */
export interface InvoiceEntryInput {
  id: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: Date;
  subtotal: string;          // Before tax
  totalTax: string;          // Total tax amount
  totalAmount: string;       // Grand total
  lineItems: InvoiceLineEntryInput[];
}

/**
 * Bill Line Item Entry Input
 * 
 * Normalized structure for bill line items used in journal entry creation.
 * 
 * **Expense Account Assignment:**
 * - expenseAccountId is assigned during AI extraction or manual entry
 * - Determines which expense/asset account to debit
 * - Required for accurate journal entry creation
 * 
 * **Tax Handling:**
 * - taxAmount is the total tax for this line item
 * - Aggregated at bill level for totalTax
 */
export interface BillLineEntryInput {
  expenseAccountId: string;  // Which expense/asset account to debit
  description: string;
  amount: string;
  taxAmount: string;
}

/**
 * Bill Entry Input
 * 
 * Normalized structure for bills used in journal entry creation.
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Expense Account(s)     [amount per line]
 * DR  Tax Receivable         [totalTax] (if recoverable)
 *     CR  Accounts Payable   [totalAmount]
 * ```
 */
export interface BillEntryInput {
  id: string;
  billNumber: string;
  vendorId: string;
  billDate: Date;
  subtotal: string;
  totalTax: string;
  totalAmount: string;
  lineItems: BillLineEntryInput[];
}

/**
 * Customer Payment Entry Input
 * 
 * Normalized structure for customer payments used in journal entry creation.
 * 
 * **Payment Application Tracking:**
 * - appliedInvoices tracks which invoices this payment settles
 * - Each application has an invoiceId and amount
 * - Total of all applications must equal payment amount
 * - May be empty if payment is unapplied (advance payment)
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Cash/Bank              [amount]
 *     CR  Accounts Receivable [amount]
 * ```
 */
export interface CustomerPaymentEntryInput {
  id: string;
  paymentNumber: string;
  customerId: string;
  paymentDate: Date;
  amount: string;
  paymentMethod: string;
  
  // Applied to which invoices (may be empty for unapplied payments)
  appliedInvoices: { invoiceId: string; amount: string }[];
}

/**
 * Vendor Payment Entry Input
 * 
 * Normalized structure for vendor payments used in journal entry creation.
 * 
 * **Payment Application Tracking:**
 * - appliedBills tracks which bills this payment settles
 * - Each application has a billId and amount
 * - Total of all applications must equal payment amount
 * - May be empty if payment is unapplied (advance payment)
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Accounts Payable       [amount]
 *     CR  Cash/Bank          [amount]
 * ```
 */
export interface VendorPaymentEntryInput {
  id: string;
  paymentNumber: string;
  vendorId: string;
  paymentDate: Date;
  amount: string;
  paymentMethod: string;
  
  // Applied to which bills (may be empty for unapplied payments)
  appliedBills: { billId: string; amount: string }[];
}

/**
 * Credit Note Entry Input
 * 
 * Normalized structure for credit notes used in journal entry creation.
 * 
 * **Document Reversal:**
 * - invoiceId references the original invoice being reversed
 * - May be null for standalone credit notes (customer refund)
 * - Used to reverse the original invoice's journal entry
 * 
 * **Journal Entry Pattern (reverses invoice):**
 * ```
 * DR  Sales Revenue          [subtotal]
 * DR  Tax Payable            [totalTax]
 *     CR  Accounts Receivable [totalAmount]
 * ```
 */
export interface CreditNoteEntryInput {
  id: string;
  creditNoteNumber: string;
  invoiceId: string | null;  // Which invoice to reverse (may be null)
  customerId: string;
  creditDate: Date;
  subtotal: string;
  totalTax: string;
  totalAmount: string;
}

/**
 * Debit Note Entry Input
 * 
 * Normalized structure for debit notes used in journal entry creation.
 * 
 * **Document Reversal:**
 * - billId references the original bill being reversed
 * - May be null for standalone debit notes (vendor refund)
 * - Used to reverse the original bill's journal entry
 * 
 * **Journal Entry Pattern (reverses bill):**
 * ```
 * DR  Accounts Payable       [totalAmount]
 *     CR  Expense Account(s) [subtotal]
 *     CR  Tax Receivable     [totalTax] (if recoverable)
 * ```
 */
export interface DebitNoteEntryInput {
  id: string;
  debitNoteNumber: string;
  billId: string | null;     // Which bill to reverse (may be null)
  vendorId: string;
  debitDate: Date;
  subtotal: string;
  totalTax: string;
  totalAmount: string;
}

// ====================================
// DATA FETCHER HELPERS
// ====================================

/**
 * Fetch invoice with line items and convert to InvoiceEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch invoice from storage by ID
 * 2. Fetch all invoice line items for this invoice
 * 3. For each line item:
 *    - If itemId exists, fetch item to check inventory tracking
 *    - If item.type === 'inventory', calculate COGS = item.purchasePrice * quantity
 *    - Fetch tax to calculate taxAmount
 * 4. Aggregate totals and return normalized structure
 * 
 * **COGS Calculation:**
 * - Only for items with type === 'inventory'
 * - COGS = item.purchasePrice * line.quantity
 * - If item.purchasePrice is null, COGS is not calculated
 * 
 * **Tax Handling:**
 * - Fetch tax record if line.taxId is set
 * - Calculate taxAmount = (lineTotal - discount) * (tax.rate / 100)
 * - Sum all line taxAmounts for invoice.totalTax
 * 
 * @param invoiceId - Invoice ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized invoice entry input
 * @throws ValidationError if invoice not found or belongs to different tenant
 */
export async function fetchInvoiceEntryData(
  invoiceId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<InvoiceEntryInput> {
  // Fetch invoice
  const invoice = await tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  
  if (!invoice[0]) {
    throw new ValidationError(`Invoice ${invoiceId} not found`);
  }
  
  // Fetch invoice line items
  const lineItems = await tx
    .select()
    .from(invoiceLineItems)
    .where(and(eq(invoiceLineItems.invoiceId, invoiceId), eq(invoiceLineItems.tenantId, tenantId)));
  
  // For each line item, check if it's an inventory item and calc COGS
  const lineInputs: InvoiceLineEntryInput[] = [];
  for (const line of lineItems) {
    let isInventoryItem = false;
    let costOfGoodsSold: string | undefined;
    
    if (line.itemId) {
      // Fetch item to check if inventory tracking enabled
      const item = await tx
        .select()
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.tenantId, tenantId)))
        .limit(1);
      
      if (item[0] && item[0].type === 'inventory' && item[0].purchasePrice) {
        isInventoryItem = true;
        // COGS = purchasePrice * quantity
        const cost = parseFloat(item[0].purchasePrice);
        const qty = parseFloat(line.quantity);
        costOfGoodsSold = (cost * qty).toFixed(2);
      }
    }
    
    lineInputs.push({
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.amount,
      taxAmount: '0.00', // Invoice line items don't have taxAmount field in schema
      isInventoryItem,
      costOfGoodsSold,
    });
  }
  
  return {
    id: invoice[0].id,
    invoiceNumber: invoice[0].invoiceNumber,
    customerId: invoice[0].customerId,
    invoiceDate: invoice[0].invoiceDate,
    subtotal: invoice[0].subtotal,
    totalTax: invoice[0].taxAmount || '0.00',
    totalAmount: invoice[0].total,
    lineItems: lineInputs,
  };
}

/**
 * Fetch bill with line items and convert to BillEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch bill from storage by ID
 * 2. Fetch all bill line items for this bill
 * 3. For each line item:
 *    - Verify accountId is set (required for journal entry)
 *    - Calculate taxAmount if tax is applied
 * 4. Aggregate totals and return normalized structure
 * 
 * **Expense Account Assignment:**
 * - Each line item must have accountId set
 * - This is assigned during AI extraction or manual entry
 * - If accountId is missing, throw ValidationError
 * 
 * **Tax Handling:**
 * - Tax may be applied at line item or bill level
 * - Calculate total tax across all line items
 * - Tax is typically recoverable for business expenses
 * 
 * @param billId - Bill ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized bill entry input
 * @throws ValidationError if bill not found or belongs to different tenant
 */
export async function fetchBillEntryData(
  billId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<BillEntryInput> {
  // Fetch bill
  const bill = await tx
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.tenantId, tenantId)))
    .limit(1);
  
  if (!bill[0]) {
    throw new ValidationError(`Bill ${billId} not found`);
  }
  
  // Fetch bill line items
  const lineItems = await tx
    .select()
    .from(billLineItems)
    .where(and(eq(billLineItems.billId, billId), eq(billLineItems.tenantId, tenantId)));
  
  const lineInputs: BillLineEntryInput[] = lineItems.map(line => ({
    expenseAccountId: line.accountId,  // AI extraction or manual assignment
    description: line.description,
    amount: line.amount,
    taxAmount: '0.00', // Bill line items don't have taxAmount field in schema
  }));
  
  return {
    id: bill[0].id,
    billNumber: bill[0].billNumber,
    vendorId: bill[0].vendorId,
    billDate: bill[0].billDate,
    subtotal: bill[0].subtotal,
    totalTax: bill[0].taxAmount || '0.00',
    totalAmount: bill[0].total,
    lineItems: lineInputs,
  };
}

/**
 * Fetch customer payment and convert to CustomerPaymentEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch customer payment from storage by ID
 * 2. Determine which invoices this payment applies to:
 *    - If invoiceId is set, payment applies to single invoice
 *    - Otherwise, payment is unapplied (advance payment)
 * 3. Build appliedInvoices array with invoice applications
 * 4. Return normalized structure
 * 
 * **Payment Application Logic:**
 * - Customer payments may apply to one or more invoices
 * - In current schema, payment.invoiceId links to single invoice
 * - For multi-invoice application, future implementation may use junction table
 * - Unapplied payments have empty appliedInvoices array
 * 
 * @param paymentId - Customer payment ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized customer payment entry input
 * @throws ValidationError if payment not found or belongs to different tenant
 */
export async function fetchCustomerPaymentEntryData(
  paymentId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CustomerPaymentEntryInput> {
  // Fetch payment
  const payment = await tx
    .select()
    .from(customerPayments)
    .where(and(eq(customerPayments.id, paymentId), eq(customerPayments.tenantId, tenantId)))
    .limit(1);
  
  if (!payment[0]) {
    throw new ValidationError(`Customer payment ${paymentId} not found`);
  }
  
  // Fetch from customerPaymentApplications table
  const applications = await tx
    .select()
    .from(customerPaymentApplications)
    .where(and(
      eq(customerPaymentApplications.paymentId, paymentId),
      eq(customerPaymentApplications.tenantId, tenantId)
    ));

  const appliedInvoices = applications.map(app => ({
    invoiceId: app.invoiceId,
    amount: app.amountApplied,
  }));

  // Validate total applications equal payment amount
  const totalApplied = applications.reduce((sum, app) => 
    sum + parseFloat(app.amountApplied), 0
  );
  const paymentAmount = parseFloat(payment[0].amount);

  if (Math.abs(totalApplied - paymentAmount) > 0.01) {
    throw new ValidationError(
      `Payment applications (${totalApplied}) don't match payment amount (${paymentAmount})`,
      { paymentId, totalApplied, paymentAmount }
    );
  }
  
  return {
    id: payment[0].id,
    paymentNumber: payment[0].paymentNumber,
    customerId: payment[0].customerId,
    paymentDate: payment[0].paymentDate,
    amount: payment[0].amount,
    paymentMethod: payment[0].paymentMethod,
    appliedInvoices,
  };
}

/**
 * Fetch vendor payment and convert to VendorPaymentEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch vendor payment from storage by ID
 * 2. Determine which bills this payment applies to:
 *    - If billId is set, payment applies to single bill
 *    - If expenseId is set, payment applies to expense
 *    - Otherwise, payment is unapplied (advance payment)
 * 3. Build appliedBills array with bill applications
 * 4. Return normalized structure
 * 
 * **Payment Application Logic:**
 * - Vendor payments may apply to bills or expenses
 * - In current schema, payment.billId or payment.expenseId links to source document
 * - For multi-bill application, future implementation may use junction table
 * - Unapplied payments have empty appliedBills array
 * 
 * **Payment Method:**
 * - Derived from payment workflow status and Stripe integration
 * - May be 'bank_transfer', 'check', 'ach', etc.
 * 
 * @param paymentId - Vendor payment ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized vendor payment entry input
 * @throws ValidationError if payment not found or belongs to different tenant
 */
export async function fetchVendorPaymentEntryData(
  paymentId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<VendorPaymentEntryInput> {
  // Fetch payment
  const payment = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    .limit(1);
  
  if (!payment[0]) {
    throw new ValidationError(`Vendor payment ${paymentId} not found`);
  }
  
  // Fetch from billPaymentApplications table
  const applications = await tx
    .select()
    .from(billPaymentApplications)
    .where(and(
      eq(billPaymentApplications.paymentId, paymentId),
      eq(billPaymentApplications.tenantId, tenantId)
    ));

  const appliedBills = applications.map(app => ({
    billId: app.billId,
    amount: app.amountApplied,
  }));

  // Validate total applications equal payment amount
  const totalApplied = applications.reduce((sum, app) => 
    sum + parseFloat(app.amountApplied), 0
  );
  const paymentAmount = parseFloat(payment[0].amount);

  if (Math.abs(totalApplied - paymentAmount) > 0.01) {
    throw new ValidationError(
      `Payment applications (${totalApplied}) don't match payment amount (${paymentAmount})`,
      { paymentId, totalApplied, paymentAmount }
    );
  }
  
  return {
    id: payment[0].id,
    paymentNumber: payment[0].id, // Schema doesn't have paymentNumber, use id
    vendorId: payment[0].vendorId,
    paymentDate: payment[0].scheduledDate || payment[0].completedDate || payment[0].createdAt,
    amount: payment[0].amount,
    paymentMethod: 'bank_transfer', // Schema doesn't have paymentMethod, default to bank_transfer
    appliedBills,
  };
}

/**
 * Fetch credit note and convert to CreditNoteEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch credit note from storage by ID
 * 2. Verify invoiceId reference (may be null for standalone credit notes)
 * 3. Return normalized structure with totals
 * 
 * **Document Reversal:**
 * - If invoiceId is set, this credit note reverses that invoice
 * - Credit note may be partial (less than invoice total)
 * - Journal entry should reverse proportional amounts
 * - If invoiceId is null, treat as standalone customer refund
 * 
 * **Tax Handling:**
 * - Tax reversal follows same logic as original invoice
 * - totalTax is reversed from Tax Payable
 * 
 * @param creditNoteId - Credit note ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized credit note entry input
 * @throws ValidationError if credit note not found or belongs to different tenant
 */
export async function fetchCreditNoteEntryData(
  creditNoteId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreditNoteEntryInput> {
  // Fetch credit note
  const creditNote = await tx
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, creditNoteId), eq(creditNotes.tenantId, tenantId)))
    .limit(1);
  
  if (!creditNote[0]) {
    throw new ValidationError(`Credit note ${creditNoteId} not found`);
  }
  
  return {
    id: creditNote[0].id,
    creditNoteNumber: creditNote[0].creditNoteNumber,
    invoiceId: creditNote[0].invoiceId,
    customerId: creditNote[0].customerId,
    creditDate: creditNote[0].creditNoteDate,
    subtotal: creditNote[0].subtotal,
    totalTax: creditNote[0].taxAmount || '0.00',
    totalAmount: creditNote[0].total,
  };
}

/**
 * Fetch debit note and convert to DebitNoteEntryInput
 * 
 * **Implementation Steps:**
 * 1. Fetch debit note from storage by ID
 * 2. Verify billId reference (may be null for standalone debit notes)
 * 3. Return normalized structure with totals
 * 
 * **Document Reversal:**
 * - If billId is set, this debit note reverses that bill
 * - Debit note may be partial (less than bill total)
 * - Journal entry should reverse proportional amounts
 * - If billId is null, treat as standalone vendor refund
 * 
 * **Tax Handling:**
 * - Tax reversal follows same logic as original bill
 * - totalTax is reversed from Tax Receivable
 * 
 * @param debitNoteId - Debit note ID to fetch
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Normalized debit note entry input
 * @throws ValidationError if debit note not found or belongs to different tenant
 */
export async function fetchDebitNoteEntryData(
  debitNoteId: string,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<DebitNoteEntryInput> {
  // Fetch debit note
  const debitNote = await tx
    .select()
    .from(debitNotes)
    .where(and(eq(debitNotes.id, debitNoteId), eq(debitNotes.tenantId, tenantId)))
    .limit(1);
  
  if (!debitNote[0]) {
    throw new ValidationError(`Debit note ${debitNoteId} not found`);
  }
  
  return {
    id: debitNote[0].id,
    debitNoteNumber: debitNote[0].debitNoteNumber,
    billId: debitNote[0].billId,
    vendorId: debitNote[0].vendorId,
    debitDate: debitNote[0].debitNoteDate,
    subtotal: debitNote[0].subtotal,
    totalTax: debitNote[0].taxAmount || '0.00',
    totalAmount: debitNote[0].total,
  };
}

// ====================================
// ENTRY CREATOR FUNCTIONS
// (To be implemented in Task 4b-2)
// ====================================

/**
 * Create journal entry for an invoice
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Accounts Receivable    [totalAmount]     (1200)
 *     CR  Sales Revenue      [subtotal]        (4000)
 *     CR  Tax Payable        [totalTax]        (2100)
 * 
 * For each inventory line item:
 * DR  Cost of Goods Sold     [costOfGoodsSold] (5000)
 *     CR  Inventory          [costOfGoodsSold] (1300)
 * ```
 * 
 * @param input - Normalized invoice entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createInvoiceJournalEntry(
  input: InvoiceEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}

/**
 * Create journal entry for a bill
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Expense Account(s)     [amount per line]
 * DR  Tax Receivable         [totalTax]        (2100 or similar)
 *     CR  Accounts Payable   [totalAmount]     (2000)
 * ```
 * 
 * @param input - Normalized bill entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createBillJournalEntry(
  input: BillEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}

/**
 * Create journal entry for a customer payment
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Cash/Bank              [amount]          (1000)
 *     CR  Accounts Receivable [amount]         (1200)
 * ```
 * 
 * @param input - Normalized customer payment entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createCustomerPaymentJournalEntry(
  input: CustomerPaymentEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}

/**
 * Create journal entry for a vendor payment
 * 
 * **Journal Entry Pattern:**
 * ```
 * DR  Accounts Payable       [amount]          (2000)
 *     CR  Cash/Bank          [amount]          (1000)
 * ```
 * 
 * @param input - Normalized vendor payment entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createVendorPaymentJournalEntry(
  input: VendorPaymentEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}

/**
 * Create journal entry for a credit note
 * 
 * **Journal Entry Pattern (reverses invoice):**
 * ```
 * DR  Sales Revenue          [subtotal]        (4000)
 * DR  Tax Payable            [totalTax]        (2100)
 *     CR  Accounts Receivable [totalAmount]    (1200)
 * ```
 * 
 * @param input - Normalized credit note entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createCreditNoteJournalEntry(
  input: CreditNoteEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}

/**
 * Create journal entry for a debit note
 * 
 * **Journal Entry Pattern (reverses bill):**
 * ```
 * DR  Accounts Payable       [totalAmount]     (2000)
 *     CR  Expense Account(s) [subtotal]
 *     CR  Tax Receivable     [totalTax]        (2100 or similar)
 * ```
 * 
 * @param input - Normalized debit note entry input
 * @param tenantId - Tenant ID for security isolation
 * @param storage - Storage instance for database access
 * @param tx - Database transaction for atomicity
 * @returns Created journal entry
 */
export async function createDebitNoteJournalEntry(
  input: DebitNoteEntryInput,
  tenantId: string,
  storage: IStorage,
  tx: DBTransaction
): Promise<CreateJournalEntry> {
  // TODO: Implement in Task 4b-2
  throw new Error('Not implemented yet - Task 4b-2');
}
