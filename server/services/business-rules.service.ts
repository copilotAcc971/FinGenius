/**
 * Business Rules Service
 * Enforces critical business constraints to prevent data corruption
 * and ensure compliance with accounting standards and best practices
 */

import { db } from '../db';
import { 
  invoices, 
  bills, 
  customers, 
  journalEntries, 
  payments,
  items,
  stockMovements,
  customerPayments,
  tenantCompanyProfiles,
  type Invoice,
  type Bill,
  type JournalEntry
} from '@shared/schema';
import { eq, and, sql, inArray, lt, gte } from 'drizzle-orm';

export class BusinessRulesError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BusinessRulesError';
  }
}

export class BusinessRulesService {
  
  /**
   * Check if an invoice can be edited
   * Invoices with status 'sent' or 'paid' cannot be modified
   */
  static canEditInvoice(invoice: Invoice): boolean {
    if (!invoice) return false;
    
    const protectedStatuses = ['sent', 'paid'];
    return !protectedStatuses.includes(invoice.status);
  }

  /**
   * Check if an invoice can be deleted
   * Only draft invoices can be deleted
   */
  static canDeleteInvoice(invoice: Invoice): boolean {
    if (!invoice) return false;
    return invoice.status === 'draft';
  }

  /**
   * Check if a bill can be edited
   * Bills with paymentStatus 'paid' cannot be modified
   */
  static canEditBill(bill: Bill): boolean {
    if (!bill) return false;
    return bill.paymentStatus !== 'paid';
  }

  /**
   * Check if a bill can be deleted
   * Bills with associated payments cannot be deleted
   */
  static async canDeleteBill(billId: string, tenantId: string): Promise<boolean> {
    // Check if bill has any payments
    const billPayments = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(
        and(
          eq(payments.billId, billId),
          eq(payments.tenantId, tenantId)
        )
      );

    const paymentCount = Number(billPayments[0]?.count || 0);
    return paymentCount === 0;
  }

  /**
   * Check if a customer's credit limit allows a new transaction
   * @throws BusinessRulesError if credit limit would be exceeded
   */
  static async checkCreditLimit(
    customerId: string, 
    amount: string | number, 
    tenantId: string
  ): Promise<void> {
    // Get customer with credit limit
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!customer) {
      throw new BusinessRulesError('Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const creditLimit = parseFloat(customer.creditLimit || '50000');
    const transactionAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Calculate outstanding balance
    const outstandingBalance = await this.getCustomerOutstandingBalance(customerId, tenantId);
    
    const totalExposure = outstandingBalance + transactionAmount;
    
    if (totalExposure > creditLimit) {
      throw new BusinessRulesError(
        `Credit limit exceeded. Limit: ${creditLimit}, Current outstanding: ${outstandingBalance}, Transaction amount: ${transactionAmount}`,
        'CREDIT_LIMIT_EXCEEDED'
      );
    }
  }

  /**
   * Get customer's outstanding balance (unpaid invoices)
   */
  static async getCustomerOutstandingBalance(
    customerId: string,
    tenantId: string
  ): Promise<number> {
    const result = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(CAST(${invoices.total} AS DECIMAL) - CAST(${invoices.amountPaid} AS DECIMAL)), 0)`
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.customerId, customerId),
          eq(invoices.tenantId, tenantId),
          inArray(invoices.status, ['draft', 'sent', 'partial'])
        )
      );

    return parseFloat(result[0]?.total?.toString() || '0');
  }

  /**
   * Check stock availability for items
   * @throws BusinessRulesError if stock is insufficient
   */
  static async checkStockAvailability(
    itemsToCheck: Array<{ itemId: string; quantity: number }>,
    tenantId: string,
    allowNegativeStock: boolean = false
  ): Promise<void> {
    if (!itemsToCheck || itemsToCheck.length === 0) return;

    // Get settings to check if negative stock is allowed
    const [companyProfile] = await db
      .select()
      .from(tenantCompanyProfiles)
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .limit(1);

    // Use parameter or company setting for negative stock allowance
    const isNegativeStockAllowed = allowNegativeStock || 
      (companyProfile?.settings as any)?.allowNegativeStock || false;

    for (const itemToCheck of itemsToCheck) {
      // Get item details
      const [item] = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.id, itemToCheck.itemId),
            eq(items.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!item) continue;

      // Skip non-inventory items
      if (item.type !== 'inventory') continue;

      // Calculate current stock from stock movements
      const stockResult = await db
        .select({
          totalIn: sql<number>`COALESCE(SUM(CASE WHEN ${stockMovements.type} = 'in' THEN ${stockMovements.quantity} ELSE 0 END), 0)`,
          totalOut: sql<number>`COALESCE(SUM(CASE WHEN ${stockMovements.type} = 'out' THEN ${stockMovements.quantity} ELSE 0 END), 0)`
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.itemId, itemToCheck.itemId),
            eq(stockMovements.tenantId, tenantId)
          )
        );

      const currentStock = (stockResult[0]?.totalIn || 0) - (stockResult[0]?.totalOut || 0);
      const availableStock = currentStock;

      if (!isNegativeStockAllowed && availableStock < itemToCheck.quantity) {
        throw new BusinessRulesError(
          `Insufficient stock for item ${item.name}. Available: ${availableStock}, Required: ${itemToCheck.quantity}`,
          'INSUFFICIENT_STOCK'
        );
      }
    }
  }

  /**
   * Check if a journal entry can be edited
   * Posted journal entries cannot be modified
   */
  static canEditJournalEntry(entry: JournalEntry): boolean {
    if (!entry) return false;
    return entry.status !== 'posted';
  }

  /**
   * Check if a journal entry can be deleted
   * Posted journal entries cannot be deleted
   */
  static canDeleteJournalEntry(entry: JournalEntry): boolean {
    if (!entry) return false;
    return entry.status !== 'posted';
  }

  /**
   * Validate payment amount doesn't exceed invoice/bill balance
   * @throws BusinessRulesError if payment amount exceeds balance
   */
  static async validatePaymentAmount(
    entityType: 'invoice' | 'bill',
    entityId: string,
    paymentAmount: string | number,
    tenantId: string
  ): Promise<void> {
    const amount = typeof paymentAmount === 'string' ? parseFloat(paymentAmount) : paymentAmount;

    if (entityType === 'invoice') {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, entityId),
            eq(invoices.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!invoice) {
        throw new BusinessRulesError('Invoice not found', 'INVOICE_NOT_FOUND');
      }

      const total = parseFloat(invoice.total);
      const paid = parseFloat(invoice.amountPaid);
      const balance = total - paid;

      if (amount > balance) {
        throw new BusinessRulesError(
          `Payment amount (${amount}) exceeds invoice balance (${balance})`,
          'PAYMENT_EXCEEDS_BALANCE'
        );
      }
    } else {
      const [bill] = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, entityId),
            eq(bills.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!bill) {
        throw new BusinessRulesError('Bill not found', 'BILL_NOT_FOUND');
      }

      const total = parseFloat(bill.total);
      const paid = parseFloat(bill.amountPaid);
      const balance = total - paid;

      if (amount > balance) {
        throw new BusinessRulesError(
          `Payment amount (${amount}) exceeds bill balance (${balance})`,
          'PAYMENT_EXCEEDS_BALANCE'
        );
      }
    }
  }

  /**
   * Check for duplicate payments on the same invoice
   * @throws BusinessRulesError if duplicate payment detected
   */
  static async checkDuplicatePayment(
    invoiceId: string,
    paymentAmount: string | number,
    paymentDate: Date | string,
    tenantId: string,
    excludePaymentId?: string
  ): Promise<void> {
    const amount = typeof paymentAmount === 'string' ? parseFloat(paymentAmount) : paymentAmount;
    const date = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;

    // Check for existing payments with same amount and date
    let query = db
      .select()
      .from(customerPayments)
      .where(
        and(
          eq(customerPayments.invoiceId, invoiceId),
          eq(customerPayments.tenantId, tenantId),
          eq(customerPayments.amount, amount.toString()),
          eq(customerPayments.paymentDate, date)
        )
      );

    const existingPayments = await query;

    // Filter out the current payment if updating
    const duplicates = excludePaymentId 
      ? existingPayments.filter(p => p.id !== excludePaymentId)
      : existingPayments;

    if (duplicates.length > 0) {
      throw new BusinessRulesError(
        'Duplicate payment detected for the same invoice with the same amount and date',
        'DUPLICATE_PAYMENT'
      );
    }
  }

  /**
   * Validate payment date is not before invoice date
   * @throws BusinessRulesError if payment date is invalid
   */
  static async validatePaymentDate(
    invoiceId: string,
    paymentDate: Date | string,
    tenantId: string
  ): Promise<void> {
    const date = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!invoice) {
      throw new BusinessRulesError('Invoice not found', 'INVOICE_NOT_FOUND');
    }

    const invoiceDate = new Date(invoice.date);
    
    if (date < invoiceDate) {
      throw new BusinessRulesError(
        `Payment date cannot be before invoice date (${invoiceDate.toISOString().split('T')[0]})`,
        'INVALID_PAYMENT_DATE'
      );
    }
  }

  /**
   * Check if manual journal entries can be posted to system accounts
   * @throws BusinessRulesError if trying to post to restricted system accounts
   */
  static async validateJournalEntryAccounts(
    accountIds: string[],
    tenantId: string,
    isManualEntry: boolean = true
  ): Promise<void> {
    if (!isManualEntry) return; // System entries can use any account

    // List of system account codes that cannot be used in manual entries
    const restrictedAccountCodes = [
      'SYSTEM_CLEARING',
      'SYSTEM_SUSPENSE',
      'SYSTEM_ROUNDING',
      'SYSTEM_FX_GAIN',
      'SYSTEM_FX_LOSS'
    ];

    // Check if any of the accounts are system accounts
    const accounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          inArray(accounts.id, accountIds),
          eq(accounts.tenantId, tenantId)
        )
      );

    for (const account of accounts) {
      if (restrictedAccountCodes.includes(account.code || '')) {
        throw new BusinessRulesError(
          `Cannot create manual journal entries to system account: ${account.name}`,
          'SYSTEM_ACCOUNT_RESTRICTED'
        );
      }
    }
  }

  /**
   * Check if operations are allowed within the accounting period
   * @throws BusinessRulesError if period is locked
   */
  static async checkAccountingPeriodLock(
    transactionDate: Date | string,
    tenantId: string
  ): Promise<void> {
    const date = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate;

    // Get company profile to check for period locks
    const [companyProfile] = await db
      .select()
      .from(tenantCompanyProfiles)
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .limit(1);

    if (!companyProfile) return;

    const settings = companyProfile.settings as any;
    const lockDate = settings?.accountingLockDate;

    if (lockDate) {
      const lockDateObj = new Date(lockDate);
      
      if (date <= lockDateObj) {
        throw new BusinessRulesError(
          `Cannot create or modify transactions before the accounting lock date (${lockDateObj.toISOString().split('T')[0]})`,
          'PERIOD_LOCKED'
        );
      }
    }
  }

  /**
   * Update stock movements when invoices/bills affect inventory
   */
  static async updateStockMovements(
    entityType: 'invoice' | 'bill',
    entityId: string,
    lineItems: Array<{ itemId: string; quantity: number }>,
    tenantId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    // Implementation would create/update/delete stock movement records
    // This is a placeholder for the actual implementation
    // which would integrate with the inventory management system
    
    for (const item of lineItems) {
      const movementType = entityType === 'invoice' ? 'out' : 'in';
      
      if (operation === 'create') {
        // Create stock movement record
        await db.insert(stockMovements).values({
          tenantId,
          itemId: item.itemId,
          type: movementType,
          quantity: item.quantity,
          referenceType: entityType,
          referenceId: entityId,
          date: new Date(),
        });
      } else if (operation === 'delete') {
        // Delete related stock movements
        await db
          .delete(stockMovements)
          .where(
            and(
              eq(stockMovements.referenceId, entityId),
              eq(stockMovements.referenceType, entityType),
              eq(stockMovements.tenantId, tenantId)
            )
          );
      }
      // Update operation would delete old and create new movements
    }
  }
}

export default BusinessRulesService;