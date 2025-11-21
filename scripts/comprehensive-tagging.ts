/**
 * Comprehensive Tagging System for All Remediation Areas
 * 
 * This documents EVERY area that needs fixing so we can apply uniform fixes later
 */

export interface TagEntry {
  category: string;
  subcategory: string;
  location: string;
  issue: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TAGGED' | 'IN_PROGRESS' | 'FIXED';
  fixApproach: string;
  estimatedComplexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
}

// ============================================================================
// CATEGORY 1: RBAC PROTECTION (49 ENDPOINTS)
// ============================================================================

const rbacTags: TagEntry[] = [
  // CUSTOMERS
  { category: 'RBAC', subcategory: 'Customers', location: 'server/routes.ts:GET /api/customers', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with customers.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Customers', location: 'server/routes.ts:POST /api/customers', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with customers.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Customers', location: 'server/routes.ts:DELETE /api/customers/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with customers.delete permission', estimatedComplexity: 'SIMPLE' },

  // VENDORS
  { category: 'RBAC', subcategory: 'Vendors', location: 'server/routes.ts:GET /api/vendors', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with vendors.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Vendors', location: 'server/routes.ts:POST /api/vendors', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with vendors.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Vendors', location: 'server/routes.ts:DELETE /api/vendors/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with vendors.delete permission', estimatedComplexity: 'SIMPLE' },

  // INVOICES
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:GET /api/invoices', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with invoices.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:POST /api/invoices', issue: 'Missing permission check + needs tax calculation', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory + integrate TaxCalculator', estimatedComplexity: 'MEDIUM' },
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:PATCH /api/invoices/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with invoices.update permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:DELETE /api/invoices/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with invoices.delete permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:POST /api/invoices/:id/send', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with invoices.send permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Invoices', location: 'server/routes.ts:POST /api/invoices/:id/void', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with invoices.void permission', estimatedComplexity: 'SIMPLE' },

  // BILLS
  { category: 'RBAC', subcategory: 'Bills', location: 'server/routes.ts:GET /api/bills', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with bills.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Bills', location: 'server/routes.ts:POST /api/bills', issue: 'Missing permission check + needs tax calculation', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory + integrate TaxCalculator', estimatedComplexity: 'MEDIUM' },
  { category: 'RBAC', subcategory: 'Bills', location: 'server/routes.ts:PATCH /api/bills/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with bills.update permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Bills', location: 'server/routes.ts:DELETE /api/bills/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with bills.delete permission', estimatedComplexity: 'SIMPLE' },

  // PAYMENTS
  { category: 'RBAC', subcategory: 'Payments', location: 'server/routes.ts:GET /api/payments', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with payments.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Payments', location: 'server/routes.ts:POST /api/payments', issue: 'Missing permission check + needs currency conversion', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory + integrate CurrencyConverter', estimatedComplexity: 'MEDIUM' },
  { category: 'RBAC', subcategory: 'Payments', location: 'server/routes.ts:DELETE /api/payments/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with payments.delete permission', estimatedComplexity: 'SIMPLE' },

  // ACCOUNTS
  { category: 'RBAC', subcategory: 'Accounts', location: 'server/routes.ts:GET /api/accounts', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with accounts.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Accounts', location: 'server/routes.ts:POST /api/accounts', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with accounts.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Accounts', location: 'server/routes.ts:DELETE /api/accounts/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with accounts.delete permission', estimatedComplexity: 'SIMPLE' },

  // JOURNAL ENTRIES
  { category: 'RBAC', subcategory: 'Journal Entries', location: 'server/routes.ts:GET /api/journal-entries', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with journal_entries.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Journal Entries', location: 'server/routes.ts:POST /api/journal-entries', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with journal_entries.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Journal Entries', location: 'server/routes.ts:POST /api/journal-entries/:id/approve', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with journal_entries.approve permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Journal Entries', location: 'server/routes.ts:DELETE /api/journal-entries/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with journal_entries.delete permission', estimatedComplexity: 'SIMPLE' },

  // ITEMS
  { category: 'RBAC', subcategory: 'Items', location: 'server/routes.ts:GET /api/items', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with items.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Items', location: 'server/routes.ts:POST /api/items', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with items.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Items', location: 'server/routes.ts:DELETE /api/items/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with items.delete permission', estimatedComplexity: 'SIMPLE' },

  // TAXES
  { category: 'RBAC', subcategory: 'Taxes', location: 'server/routes.ts:GET /api/taxes', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with taxes.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Taxes', location: 'server/routes.ts:POST /api/taxes', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with taxes.create permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Taxes', location: 'server/routes.ts:DELETE /api/taxes/:id', issue: 'Missing permission check', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Apply route-factory with taxes.delete permission', estimatedComplexity: 'SIMPLE' },

  // REPORTS
  { category: 'RBAC', subcategory: 'Reports', location: 'server/routes.ts:GET /api/reports/profit-loss', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with reports.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Reports', location: 'server/routes.ts:GET /api/reports/balance-sheet', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with reports.read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Reports', location: 'server/routes.ts:GET /api/reports/cash-flow', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with reports.read permission', estimatedComplexity: 'SIMPLE' },

  // SETTINGS
  { category: 'RBAC', subcategory: 'Settings', location: 'server/routes.ts:GET /api/company-profile', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with settings:read permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Settings', location: 'server/routes.ts:POST /api/company-profile', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with settings:update permission', estimatedComplexity: 'SIMPLE' },
  { category: 'RBAC', subcategory: 'Settings', location: 'server/routes.ts:PATCH /api/company-profile', issue: 'Missing permission check', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Apply route-factory with settings:update permission', estimatedComplexity: 'SIMPLE' }
];

// ============================================================================
// CATEGORY 2: CONSOLE.LOG REMOVAL (793 INSTANCES)
// ============================================================================

const consoleLogTags: TagEntry[] = [
  { category: 'DEBUG', subcategory: 'Console Logs', location: 'client/src/**/*.ts*', issue: '~400 console.log statements in safe files', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Batch remove all console.* from non-critical files', estimatedComplexity: 'SIMPLE' },
  { category: 'DEBUG', subcategory: 'Console Logs', location: 'server/services/**/*.ts', issue: '~200 console.log statements', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Remove all console.log, keep console.error/warn', estimatedComplexity: 'SIMPLE' },
  { category: 'DEBUG', subcategory: 'Console Logs', location: 'server/routes.ts', issue: '~100+ console.log statements', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Remove all console.log from route handlers', estimatedComplexity: 'SIMPLE' },
  { category: 'DEBUG', subcategory: 'Console Logs', location: 'server/middleware/**/*.ts', issue: '~50 console.log statements', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Keep error/warn, remove log/debug', estimatedComplexity: 'SIMPLE' }
];

// ============================================================================
// CATEGORY 3: TYPE SAFETY (1230 ANY TYPES)
// ============================================================================

const typeSafetyTags: TagEntry[] = [
  { category: 'TYPE_SAFETY', subcategory: 'Any Types', location: 'server/routes.ts', issue: '~300+ "any" type usages', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Replace with proper Zod schemas or explicit types', estimatedComplexity: 'MEDIUM' },
  { category: 'TYPE_SAFETY', subcategory: 'Any Types', location: 'server/middleware/**/*.ts', issue: '~200+ "any" type usages', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Use proper Request/Response types from Express', estimatedComplexity: 'MEDIUM' },
  { category: 'TYPE_SAFETY', subcategory: 'Any Types', location: 'client/src/pages/**/*.tsx', issue: '~400+ "any" type usages', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Use React component types and TanStack Query types', estimatedComplexity: 'MEDIUM' },
  { category: 'TYPE_SAFETY', subcategory: 'Any Types', location: 'server/services/**/*.ts', issue: '~200+ "any" type usages', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Use domain model types from schema.ts', estimatedComplexity: 'MEDIUM' },
  { category: 'TYPE_SAFETY', subcategory: 'Any Types', location: 'server/ai/**/*.ts', issue: '~130+ "any" type usages', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Create AI response types and LLM provider types', estimatedComplexity: 'COMPLEX' }
];

// ============================================================================
// CATEGORY 4: AUDIT LOGGING GAPS (276 MISSING)
// ============================================================================

const auditLoggingTags: TagEntry[] = [
  { category: 'AUDIT', subcategory: 'Invoice Operations', location: 'server/routes.ts', issue: 'Missing audit logs on invoice create/update/delete/send', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Add AuditLogger calls to invoice handlers', estimatedComplexity: 'SIMPLE' },
  { category: 'AUDIT', subcategory: 'Payment Operations', location: 'server/routes.ts', issue: 'Missing audit logs on payment create/update/delete', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Add AuditLogger calls to payment handlers', estimatedComplexity: 'SIMPLE' },
  { category: 'AUDIT', subcategory: 'Journal Entries', location: 'server/routes.ts', issue: 'Missing audit logs on journal entry create/approve/delete', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Add AuditLogger calls with detailed metadata', estimatedComplexity: 'SIMPLE' },
  { category: 'AUDIT', subcategory: 'Account Management', location: 'server/routes.ts', issue: 'Missing audit logs on account create/update/delete', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Add AuditLogger calls to account handlers', estimatedComplexity: 'SIMPLE' },
  { category: 'AUDIT', subcategory: 'Tax Configuration', location: 'server/routes.ts', issue: 'Missing audit logs on tax create/update/delete', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Add AuditLogger calls to tax handlers', estimatedComplexity: 'SIMPLE' }
];

// ============================================================================
// CATEGORY 5: BUSINESS LOGIC INTEGRATION
// ============================================================================

const businessLogicTags: TagEntry[] = [
  { category: 'BUSINESS_LOGIC', subcategory: 'Tax Calculation', location: 'server/routes.ts POST /api/invoices', issue: 'No tax calculation on invoice creation', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Integrate TaxCalculator.calculateInvoiceTax()', estimatedComplexity: 'MEDIUM' },
  { category: 'BUSINESS_LOGIC', subcategory: 'Tax Calculation', location: 'server/routes.ts POST /api/bills', issue: 'No tax calculation on bill creation', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Integrate TaxCalculator.calculateInvoiceTax()', estimatedComplexity: 'MEDIUM' },
  { category: 'BUSINESS_LOGIC', subcategory: 'Currency Conversion', location: 'server/routes.ts POST /api/payments', issue: 'No multi-currency support on payments', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Integrate CurrencyConverter.convert()', estimatedComplexity: 'MEDIUM' },
  { category: 'BUSINESS_LOGIC', subcategory: 'E-Invoicing', location: 'server/e-invoicing/uae-peppol.ts', issue: 'Stub implementation - needs real PINT-AE XML generation', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Implement UBL 2.1 XML with TLV QR codes', estimatedComplexity: 'COMPLEX' },
  { category: 'BUSINESS_LOGIC', subcategory: 'E-Invoicing', location: 'server/e-invoicing/ksa-zatca.ts', issue: 'Stub implementation - needs real ZATCA XML generation', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Implement ZATCA-compliant XML with SHA-256 hashing', estimatedComplexity: 'COMPLEX' },
  { category: 'BUSINESS_LOGIC', subcategory: 'AI Copilot', location: 'server/ai/mcp-orchestrator.ts', issue: 'MCP orchestrator needs real provider integration', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Wire up Kimi, Qwen, DeepSeek, OpenAI providers', estimatedComplexity: 'COMPLEX' }
];

// ============================================================================
// CATEGORY 6: DATA INTEGRITY & VALIDATION
// ============================================================================

const dataIntegrityTags: TagEntry[] = [
  { category: 'DATA_INTEGRITY', subcategory: 'Input Validation', location: 'server/routes.ts', issue: 'No request validation on ~30 endpoints', severity: 'HIGH', status: 'TAGGED', fixApproach: 'Add Zod validation schemas to route-factory', estimatedComplexity: 'MEDIUM' },
  { category: 'DATA_INTEGRITY', subcategory: 'Tenant Isolation', location: 'server/middleware/**/*.ts', issue: 'Not all endpoints verify tenantId from claims', severity: 'CRITICAL', status: 'TAGGED', fixApproach: 'Ensure route-factory applies to all protected routes', estimatedComplexity: 'SIMPLE' },
  { category: 'DATA_INTEGRITY', subcategory: 'Test Data', location: 'database', issue: '47 test tenant records polluting production data', severity: 'MEDIUM', status: 'TAGGED', fixApproach: 'Create cleanup script to remove test data', estimatedComplexity: 'SIMPLE' }
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const allTags: TagEntry[] = [
  ...rbacTags,
  ...consoleLogTags,
  ...typeSafetyTags,
  ...auditLoggingTags,
  ...businessLogicTags,
  ...dataIntegrityTags
];

export const tagsByCategory = {
  RBAC: rbacTags,
  DEBUG: consoleLogTags,
  TYPE_SAFETY: typeSafetyTags,
  AUDIT: auditLoggingTags,
  BUSINESS_LOGIC: businessLogicTags,
  DATA_INTEGRITY: dataIntegrityTags
};

export const summary = {
  total: allTags.length,
  byCategory: {
    RBAC: rbacTags.length,
    DEBUG: consoleLogTags.length,
    TYPE_SAFETY: typeSafetyTags.length,
    AUDIT: auditLoggingTags.length,
    BUSINESS_LOGIC: businessLogicTags.length,
    DATA_INTEGRITY: dataIntegrityTags.length
  },
  bySeverity: {
    CRITICAL: allTags.filter(t => t.severity === 'CRITICAL').length,
    HIGH: allTags.filter(t => t.severity === 'HIGH').length,
    MEDIUM: allTags.filter(t => t.severity === 'MEDIUM').length,
    LOW: allTags.filter(t => t.severity === 'LOW').length
  },
  byComplexity: {
    SIMPLE: allTags.filter(t => t.estimatedComplexity === 'SIMPLE').length,
    MEDIUM: allTags.filter(t => t.estimatedComplexity === 'MEDIUM').length,
    COMPLEX: allTags.filter(t => t.estimatedComplexity === 'COMPLEX').length
  }
};

export default allTags;