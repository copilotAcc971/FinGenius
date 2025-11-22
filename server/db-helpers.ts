/**
 * Database Helper Functions for Balance and Status Recalculations
 * Ensures data consistency across all financial operations
 */

import { db } from './db';
import { eq, and, sum, isNull, ne, sql } from 'drizzle-orm';
import {
  customers,
  vendors,
  invoices,
  bills,
  customerPayments,
  payments,
  invoiceLineItems,
  billLineItems,
} from '@shared/schema';

/**
 * Recalculate customer's total outstanding balance
 * Updates the customer's balance based on all unpaid invoices
 */
export async function recalculateCustomerBalance(customerId: string, tx: any = db) {
  // Calculate total outstanding from all non-deleted invoices
  const [result] = await tx
    .select({
      totalOutstanding: sql<string>`
        COALESCE(
          SUM(
            CASE 
              WHEN status IN ('sent', 'overdue') 
              THEN CAST(total AS DECIMAL) - COALESCE(CAST(paid_amount AS DECIMAL), 0)
              ELSE 0
            END
          ), 0
        )
      `
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, customerId),
        isNull(invoices.deletedAt)
      )
    );

  const balance = result?.totalOutstanding || '0';

  // Update customer balance and credit utilization
  await tx
    .update(customers)
    .set({
      balance,
      creditUtilization: sql`
        CASE 
          WHEN credit_limit IS NOT NULL AND credit_limit > 0
          THEN (${balance}::DECIMAL / credit_limit::DECIMAL * 100)
          ELSE 0
        END
      `,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

/**
 * Recalculate vendor's total payables balance
 * Updates the vendor's balance based on all unpaid bills
 */
export async function recalculateVendorBalance(vendorId: string, tx: any = db) {
  // Calculate total payables from all non-deleted bills
  const [result] = await tx
    .select({
      totalPayables: sql<string>`
        COALESCE(
          SUM(
            CASE 
              WHEN status IN ('unpaid', 'overdue', 'scheduled') 
              THEN CAST(total AS DECIMAL) - COALESCE(CAST(paid_amount AS DECIMAL), 0)
              ELSE 0
            END
          ), 0
        )
      `
    })
    .from(bills)
    .where(
      and(
        eq(bills.vendorId, vendorId),
        isNull(bills.deletedAt)
      )
    );

  const balance = result?.totalPayables || '0';

  // Update vendor balance
  await tx
    .update(vendors)
    .set({
      balance,
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendorId));
}

/**
 * Recalculate invoice payment status
 * Updates status based on payment amount vs total
 */
export async function recalculateInvoicePaymentStatus(invoiceId: string, tx: any = db) {
  // Get invoice details
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1);

  if (!invoice) return;

  // Calculate total payments received
  const [paymentResult] = await tx
    .select({
      totalPaid: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    })
    .from(customerPayments)
    .where(
      and(
        eq(customerPayments.invoiceId, invoiceId),
        isNull(customerPayments.deletedAt)
      )
    );

  const totalPaid = parseFloat(paymentResult?.totalPaid || '0');
  const invoiceTotal = parseFloat(invoice.total);

  // Determine new status
  let newStatus: 'draft' | 'sent' | 'paid' | 'void' | 'overdue' = 'sent';
  
  if (totalPaid >= invoiceTotal) {
    newStatus = 'paid';
  } else if (totalPaid > 0 && totalPaid < invoiceTotal) {
    // Check if overdue
    const dueDate = new Date(invoice.dueDate);
    const now = new Date();
    if (dueDate < now) {
      newStatus = 'overdue';
    } else {
      newStatus = 'sent'; // Partially paid
    }
  } else if (totalPaid === 0) {
    // Check if overdue
    const dueDate = new Date(invoice.dueDate);
    const now = new Date();
    if (dueDate < now) {
      newStatus = 'overdue';
    } else {
      newStatus = invoice.status === 'draft' ? 'draft' : 'sent';
    }
  }

  // Update invoice status and paid amount
  await tx
    .update(invoices)
    .set({
      status: newStatus,
      paidAmount: totalPaid.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

/**
 * Recalculate bill payment status
 * Updates status based on payment amount vs total
 */
export async function recalculateBillPaymentStatus(billId: string, tx: any = db) {
  // Get bill details
  const [bill] = await tx
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.id, billId),
        isNull(bills.deletedAt)
      )
    )
    .limit(1);

  if (!bill) return;

  // Calculate total payments made
  const [paymentResult] = await tx
    .select({
      totalPaid: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    })
    .from(payments)
    .where(
      and(
        eq(payments.billId, billId),
        ne(payments.status, 'failed')
      )
    );

  const totalPaid = parseFloat(paymentResult?.totalPaid || '0');
  const billTotal = parseFloat(bill.total);

  // Determine new status
  let newStatus: 'unpaid' | 'scheduled' | 'paid' | 'overdue' | 'cancelled' = 'unpaid';
  
  if (totalPaid >= billTotal) {
    newStatus = 'paid';
  } else if (totalPaid > 0 && totalPaid < billTotal) {
    // Check if overdue
    const dueDate = new Date(bill.dueDate);
    const now = new Date();
    if (dueDate < now) {
      newStatus = 'overdue';
    } else {
      newStatus = 'scheduled'; // Partially paid
    }
  } else if (totalPaid === 0) {
    // Check if overdue
    const dueDate = new Date(bill.dueDate);
    const now = new Date();
    if (dueDate < now) {
      newStatus = 'overdue';
    } else {
      newStatus = 'unpaid';
    }
  }

  // Update bill status and paid amount
  await tx
    .update(bills)
    .set({
      status: newStatus,
      paidAmount: totalPaid.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(bills.id, billId));
}

/**
 * Check if a customer has any open invoices or payments
 */
export async function hasOpenCustomerTransactions(customerId: string, tenantId: string, tx: any = db): Promise<boolean> {
  // Check for non-deleted, unpaid invoices
  const [invoiceCount] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, customerId),
        eq(invoices.tenantId, tenantId),
        isNull(invoices.deletedAt),
        ne(invoices.status, 'paid'),
        ne(invoices.status, 'void')
      )
    );

  if (invoiceCount.count > 0) return true;

  // Check for non-deleted payments
  const [paymentCount] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(customerPayments)
    .where(
      and(
        eq(customerPayments.customerId, customerId),
        eq(customerPayments.tenantId, tenantId),
        isNull(customerPayments.deletedAt)
      )
    );

  return paymentCount.count > 0;
}

/**
 * Check if a vendor has any open bills or payments
 */
export async function hasOpenVendorTransactions(vendorId: string, tenantId: string, tx: any = db): Promise<boolean> {
  // Check for non-deleted, unpaid bills
  const [billCount] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(bills)
    .where(
      and(
        eq(bills.vendorId, vendorId),
        eq(bills.tenantId, tenantId),
        isNull(bills.deletedAt),
        ne(bills.status, 'paid'),
        ne(bills.status, 'cancelled')
      )
    );

  if (billCount.count > 0) return true;

  // Check for non-deleted payments
  const [paymentCount] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(
      and(
        eq(payments.vendorId, vendorId),
        eq(payments.tenantId, tenantId),
        ne(payments.status, 'failed')
      )
    );

  return paymentCount.count > 0;
}

/**
 * Check if an invoice has any payments
 */
export async function hasInvoicePayments(invoiceId: string, tenantId: string, tx: any = db): Promise<boolean> {
  const [count] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(customerPayments)
    .where(
      and(
        eq(customerPayments.invoiceId, invoiceId),
        eq(customerPayments.tenantId, tenantId),
        isNull(customerPayments.deletedAt)
      )
    );

  return count.count > 0;
}

/**
 * Check if a bill has any payments
 */
export async function hasBillPayments(billId: string, tenantId: string, tx: any = db): Promise<boolean> {
  const [count] = await tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(
      and(
        eq(payments.billId, billId),
        eq(payments.tenantId, tenantId),
        ne(payments.status, 'failed')
      )
    );

  return count.count > 0;
}

/**
 * Soft delete invoice line items
 */
export async function softDeleteInvoiceLineItems(invoiceId: string, tx: any = db) {
  // Note: If invoiceLineItems doesn't have deletedAt, we'll need to add it via migration
  // For now, we'll handle both cases
  const hasDeletedAt = 'deletedAt' in invoiceLineItems;
  
  if (hasDeletedAt) {
    await tx
      .update(invoiceLineItems)
      .set({ 
        deletedAt: new Date(),
      })
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
  } else {
    // If no soft delete field, we have to hard delete (not ideal)
    console.warn('Invoice line items table does not support soft delete. Using hard delete.');
    await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }
}

/**
 * Soft delete bill line items
 */
export async function softDeleteBillLineItems(billId: string, tx: any = db) {
  // Note: If billLineItems doesn't have deletedAt, we'll need to add it via migration
  // For now, we'll handle both cases
  const hasDeletedAt = 'deletedAt' in billLineItems;
  
  if (hasDeletedAt) {
    await tx
      .update(billLineItems)
      .set({ 
        deletedAt: new Date(),
      })
      .where(eq(billLineItems.billId, billId));
  } else {
    // If no soft delete field, we have to hard delete (not ideal)
    console.warn('Bill line items table does not support soft delete. Using hard delete.');
    await tx.delete(billLineItems).where(eq(billLineItems.billId, billId));
  }
}