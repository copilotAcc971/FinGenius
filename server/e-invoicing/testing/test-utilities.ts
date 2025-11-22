/**
 * E2E Testing Utilities
 * 
 * Helper functions for testing ASP and FATOORAH integrations
 */

import type { Invoice, Customer, TenantCompanyProfile, InvoiceLineItem } from '@shared/schema';

/**
 * Create sample test invoice for E2E testing
 */
export function createTestInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date();
  return {
    id: `test-invoice-${Date.now()}`,
    tenantId: 'test-tenant',
    invoiceNumber: `TEST-${Date.now()}`,
    customerId: 'test-customer',
    invoiceDate: now,
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
    status: 'draft',
    currencyCode: 'AED',
    subtotal: 1000,
    taxAmount: 150,
    total: 1150,
    notes: 'Test invoice for E2E testing',
    createdAt: now,
    updatedAt: now,
    createdBy: 'test-user',
    lineItems: [],
    isRecurring: false,
    recurringFrequency: null,
    recurringEndDate: null,
    ...overrides
  };
}

/**
 * Create sample test customer for B2B (with TIN) and B2C (without TIN) testing
 */
export function createTestCustomer(
  type: 'B2B' | 'B2C' = 'B2B',
  overrides: Partial<Customer> = {}
): Customer {
  return {
    id: `test-customer-${Date.now()}`,
    tenantId: 'test-tenant',
    displayName: `Test Customer ${Date.now()}`,
    email: `test-customer-${Date.now()}@example.com`,
    phone: '+971501234567',
    companyName: type === 'B2B' ? 'Test Company Ltd.' : undefined,
    taxId: type === 'B2B' ? '3100127812300003' : undefined, // Sample TIN
    billingAddress: {
      street: '123 Test Street',
      city: 'Dubai',
      postalCode: '12345',
      country: 'AE'
    },
    shippingAddress: {
      street: '123 Test Street',
      city: 'Dubai',
      postalCode: '12345',
      country: 'AE'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create sample test company profile for supplier/issuer
 */
export function createTestCompanyProfile(
  overrides: Partial<TenantCompanyProfile> = {}
): TenantCompanyProfile {
  return {
    id: 'test-company-profile',
    tenantId: 'test-tenant',
    name: 'Test Company Name',
    email: 'test-company@example.com',
    phone: '+971501234567',
    address: '456 Company Street',
    city: 'Dubai',
    postalCode: '54321',
    country: 'AE',
    taxId: '3100127812300004', // Sample TIN
    commercialRegistration: 'CR-12345678',
    tradeRegistration: 'TR-87654321',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create sample test invoice line items
 */
export function createTestLineItems(count: number = 2): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `test-line-item-${i}`,
      invoiceId: 'test-invoice',
      tenantId: 'test-tenant',
      description: `Test Item ${i + 1}`,
      quantity: 1 + i,
      unitPrice: 500,
      amount: 500 * (1 + i),
      unit: 'C62', // Each
      taxRate: 15,
      taxAmount: 75 * (1 + i),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  return items;
}

/**
 * Test result formatter
 */
export function formatTestResult(
  testName: string,
  passed: boolean,
  details?: string
): string {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const message = `${status} | ${testName}`;
  return details ? `${message}\n  ${details}` : message;
}

/**
 * Assert function for tests
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

/**
 * Generate mock QR code data for testing
 */
export function generateMockQRData(invoiceNumber: string): string {
  const data = `MOCK-QR:${invoiceNumber}:${Date.now()}`;
  return Buffer.from(data).toString('base64');
}
