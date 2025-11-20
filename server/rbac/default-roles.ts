// Default system roles for RBAC
// These roles are created automatically for each tenant

export interface DefaultRole {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string | string[]; // '*' for all, or array of permission patterns
}

export const DEFAULT_ROLES: Record<string, DefaultRole> = {
  OWNER: {
    name: 'Owner',
    description: 'Full platform access including billing and user management',
    isSystem: true,
    permissions: '*', // Special: all permissions
  },
  
  CFO: {
    name: 'CFO',
    description: 'Chief Financial Officer - financial oversight and critical payment execution authority',
    isSystem: true,
    permissions: [
      // All accounting modules
      'customers.*',
      'vendors.*',
      'items.*',
      'taxes.*',
      'invoices.*',
      'bills.*',
      'quotes.*',
      'sales_orders.*',
      'purchase_orders.*',
      'credit_notes.*',
      
      // Debit notes: full access including approve
      'debit_notes.create',
      'debit_notes.read',
      'debit_notes.update',
      'debit_notes.delete',
      'debit_notes.approve',
      
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      'accounts.*',
      
      // Journal entries: full access including reverse
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      'journal_entries.delete',
      'journal_entries.approve',
      'journal_entries.post',
      'journal_entries.reverse',
      
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'payments.*',
      
      // Vendor payments: EXECUTE and AUTHORIZE authority ONLY (segregated from approval)
      'vendor_payments.read',
      'vendor_payments.execute',
      'vendor_payments.authorize',
      'vendor_payments.create_batch',
      'vendor_payments.refund',
      'vendor_payments.view_sensitive',
      
      'documents.*',
      'reports.*',
      'company_profile.*',
      'settings.*',
      
      // Approvals: full access
      'approvals.*',
      
      // Workflows: configure authority
      'workflows.read',
      'workflows.configure',
      
      // Audit: full access including export
      'audit.view',
      'audit.export',
      
      // Encumbrances
      'encumbrances.*',
      
      // Inventory
      'inventory.*',
      
      // Open Banking: full access
      'open_banking.connect',
      'open_banking.disconnect',
      'open_banking.view_connections',
      'open_banking.view_transactions',
      'open_banking.sync_transactions',
      'open_banking.reconcile',
      'open_banking.initiate_payment',
      'open_banking.view_payments',
      
      // User management but not billing
      'users.*',

      // Projects & Time Tracking: full access
      'projects.*',
      'time_entries.*',
      'project_budgets.*',
      'project_reports.read',
    ],
  },

  CONTROLLER: {
    name: 'Controller',
    description: 'Financial operations management and supervision (including reversal authority)',
    isSystem: true,
    permissions: [
      // All accounting modules with full access
      'customers.*',
      'vendors.*',
      'items.*',
      'taxes.*',
      'invoices.*',
      'bills.*',
      'quotes.*',
      'sales_orders.*',
      'purchase_orders.*',
      'credit_notes.*',
      
      // Debit notes: full access including approve
      'debit_notes.create',
      'debit_notes.read',
      'debit_notes.update',
      'debit_notes.delete',
      'debit_notes.approve',
      
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      'accounts.*',
      
      // Journal entries: full access including reverse (supervisory authority)
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      'journal_entries.delete',
      'journal_entries.approve',
      'journal_entries.post',
      'journal_entries.reverse',
      
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'payments.*',
      
      // Vendor payments: APPROVE but NOT execute (segregation of duties)
      'vendor_payments.read',
      'vendor_payments.approve',
      'vendor_payments.view_sensitive',
      
      'documents.*',
      'reports.*',
      'company_profile.*',
      'settings.*',
      
      // Approvals: full access
      'approvals.*',
      
      // Workflows: configure authority
      'workflows.read',
      'workflows.configure',
      
      // Audit: full access including export
      'audit.view',
      'audit.export',
      
      // Encumbrances
      'encumbrances.*',
      
      // Inventory
      'inventory.*',
      
      // Open Banking: full access
      'open_banking.connect',
      'open_banking.disconnect',
      'open_banking.view_connections',
      'open_banking.view_transactions',
      'open_banking.sync_transactions',
      'open_banking.reconcile',
      'open_banking.initiate_payment',
      'open_banking.view_payments',
      
      // User management but not billing
      'users.read',
      'users.create',
      'users.update',

      // Projects & Time Tracking: full access
      'projects.*',
      'time_entries.*',
      'project_budgets.*',
      'project_reports.read',
      
      // Compliance
      'compliance.*',
      
      // FX
      'fx.*',
    ],
  },

  ADMIN: {
    name: 'Admin',
    description: 'Accounting operations and approvals (no payment execution or critical financial controls)',
    isSystem: true,
    permissions: [
      // All accounting modules
      'customers.*',
      'vendors.*',
      'items.*',
      'taxes.*',
      'invoices.*',
      'bills.*',
      'quotes.*',
      'sales_orders.*',
      'purchase_orders.*',
      'credit_notes.*',
      
      // Debit notes: create and update only, NOT approve (segregation of duties)
      'debit_notes.read',
      'debit_notes.create',
      'debit_notes.update',
      
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      'accounts.*',
      
      // Journal entries: all except reverse (requires CFO authority)
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      'journal_entries.delete',
      'journal_entries.approve',
      'journal_entries.post',
      
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'payments.*',
      
      // Vendor payments: APPROVE only, NOT create or execute (segregation of duties)
      'vendor_payments.read',
      'vendor_payments.approve',
      'vendor_payments.view_sensitive',
      
      'documents.*',
      'reports.*',
      'company_profile.*',
      'settings.*',
      
      // Approvals
      'approvals.*',
      
      // Workflows: read only (configure is CFO only)
      'workflows.read',
      
      // Audit: view only (export is CFO/Auditor only)
      'audit.view',
      
      // Encumbrances
      'encumbrances.*',
      
      // Inventory
      'inventory.*',
      
      // Open Banking: full access
      'open_banking.connect',
      'open_banking.disconnect',
      'open_banking.view_connections',
      'open_banking.view_transactions',
      'open_banking.sync_transactions',
      'open_banking.reconcile',
      'open_banking.initiate_payment',
      'open_banking.view_payments',
      
      // User management but not billing
      'users.*',

      // Projects & Time Tracking: full access
      'projects.*',
      'time_entries.*',
      'project_budgets.*',
      'project_reports.read',
    ],
  },
  
  SENIOR_ACCOUNTANT: {
    name: 'Senior Accountant',
    description: 'Full accounting operations with approvals and deletion authority',
    isSystem: true,
    permissions: [
      // Full customer and vendor access including delete
      'customers.*',
      'vendors.*',
      
      // Full invoice and sales access
      'invoices.*',
      'quotes.*',
      'sales_orders.*',
      'credit_notes.*',
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      
      // Can approve bills and payments
      'bills.create',
      'bills.read',
      'bills.update',
      'bills.delete',
      'bills.approve',
      'bills.export',
      'bills.review_ai_extraction',
      'bills.approve_posting',
      'bills.approve_override',
      
      'purchase_orders.create',
      'purchase_orders.read',
      'purchase_orders.update',
      'purchase_orders.delete',
      'purchase_orders.approve',
      
      'payments.create',
      'payments.read',
      'payments.update',
      'payments.delete',
      'payments.approve',
      
      // Full access to accounting
      'accounts.*',
      
      // Journal entries: can post and approve but NOT reverse (requires Controller/CFO)
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      'journal_entries.delete',
      'journal_entries.post',
      'journal_entries.approve',
      
      // Debit notes: full access including approve
      'debit_notes.create',
      'debit_notes.read',
      'debit_notes.update',
      'debit_notes.delete',
      'debit_notes.approve',
      
      // Vendor payments: create and read (segregation of duties)
      'vendor_payments.create',
      'vendor_payments.read',
      
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'taxes.*',
      
      // Items and documents
      'items.*',
      'documents.*',
      
      // Reports
      'reports.*',
      
      // Approvals
      'approvals.read',
      'approvals.create',
      'approvals.update',
      
      // Audit: view only
      'audit.view',
      
      // Encumbrances
      'encumbrances.create',
      'encumbrances.view',
      'encumbrances.update',
      'encumbrances.delete',
      
      // Inventory
      'inventory.read',
      'inventory.create',
      'inventory.update',
      
      // Read company profile
      'company_profile.read',
      
      // Open Banking: view and sync
      'open_banking.view_connections',
      'open_banking.view_transactions',
      'open_banking.sync_transactions',
      'open_banking.reconcile',
      
      // Read users
      'users.read',

      // Projects & Time Tracking
      'projects.*',
      'time_entries.read',
      'time_entries.create',
      'time_entries.update',
      'time_entries.delete',
      'time_entries.approve',
      'project_budgets.*',
      'project_reports.read',
      
      // Compliance
      'compliance.read',
      'compliance.create',
      'compliance.update',
      
      // FX
      'fx.read',
      'fx.create',
      'fx.update',
    ],
  },
  
  ACCOUNTANT: {
    name: 'Accountant',
    description: 'Manage all financial records, approve transactions',
    isSystem: true,
    permissions: [
      // Full customer and vendor access
      'customers.*',
      'vendors.*',
      
      // Full invoice and sales access
      'invoices.*',
      'quotes.*',
      'sales_orders.*',
      'credit_notes.*',
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      
      // Can approve bills and payments
      'bills.create',
      'bills.read',
      'bills.update',
      'bills.approve',
      'bills.export',
      'bills.review_ai_extraction',
      'bills.approve_posting',
      
      'purchase_orders.create',
      'purchase_orders.read',
      'purchase_orders.update',
      'purchase_orders.approve',
      
      'payments.create',
      'payments.read',
      'payments.approve',
      
      // Full access to accounting
      'accounts.*',
      
      // Journal entries: can post but NOT reverse (requires higher authority)
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      'journal_entries.post',
      
      // Debit notes: can create/update but NOT approve (segregation of duties)
      'debit_notes.create',
      'debit_notes.read',
      'debit_notes.update',
      
      // Vendor payments: create and read (segregation of duties - no approve or execute)
      'vendor_payments.create',
      'vendor_payments.read',
      
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'taxes.*',
      
      // Items and documents
      'items.*',
      'documents.*',
      
      // Reports
      'reports.*',
      
      // Approvals
      'approvals.read',
      
      // Audit: view only
      'audit.view',
      
      // Encumbrances
      'encumbrances.create',
      'encumbrances.view',
      
      // Inventory: read only
      'inventory.read',
      
      // Read company profile
      'company_profile.read',
      
      // Open Banking: view and sync only (no connect/disconnect or payments)
      'open_banking.view_connections',
      'open_banking.view_transactions',
      'open_banking.sync_transactions',
      'open_banking.reconcile',
      
      // Read users
      'users.read',

      // Projects & Time Tracking: limited access
      'projects.read',
      'time_entries.read',
      'time_entries.approve',
      'project_budgets.read',
      'project_reports.read',
    ],
  },
  
  JUNIOR_ACCOUNTANT: {
    name: 'Junior Accountant',
    description: 'Basic accounting tasks with no approvals or posting authority',
    isSystem: true,
    permissions: [
      // Customers and vendors: create and edit only
      'customers.create',
      'customers.read',
      'customers.update',
      'customers.export',
      
      'vendors.create',
      'vendors.read',
      'vendors.update',
      'vendors.export',
      
      // Invoices and sales: create and edit
      'invoices.create',
      'invoices.read',
      'invoices.update',
      'invoices.send',
      'invoices.export',
      
      'quotes.create',
      'quotes.read',
      'quotes.update',
      'quotes.send',
      
      'sales_orders.create',
      'sales_orders.read',
      'sales_orders.update',
      
      'credit_notes.create',
      'credit_notes.read',
      'credit_notes.update',
      
      'customer_payments.create',
      'customer_payments.read',
      'customer_payments.update',
      
      'recurring_invoices.create',
      'recurring_invoices.read',
      'recurring_invoices.update',
      
      'retainer_invoices.create',
      'retainer_invoices.read',
      'retainer_invoices.update',
      
      // Bills and purchases: create and edit, can review AI extraction
      'bills.create',
      'bills.read',
      'bills.update',
      'bills.export',
      'bills.review_ai_extraction',
      
      'purchase_orders.create',
      'purchase_orders.read',
      'purchase_orders.update',
      
      // Debit notes: create and edit only
      'debit_notes.create',
      'debit_notes.read',
      'debit_notes.update',
      
      // Vendor payments: read only
      'vendor_payments.read',
      
      'payments.create',
      'payments.read',
      'payments.update',
      
      // Accounts: read only
      'accounts.read',
      
      // Journal entries: create drafts only, cannot post
      'journal_entries.create',
      'journal_entries.read',
      
      // Assets: create and edit
      'assets.create',
      'assets.read',
      'assets.update',
      
      // Bank reconciliations: create and edit
      'bank_reconciliations.create',
      'bank_reconciliations.read',
      
      // Expenses: create and edit
      'expenses.create',
      'expenses.read',
      'expenses.update',
      
      'employee_expenses.create',
      'employee_expenses.read',
      'employee_expenses.update',
      
      // Items and taxes: read
      'items.read',
      'taxes.read',
      
      // Inventory: read only
      'inventory.read',
      
      // Documents
      'documents.create',
      'documents.read',
      
      // Reports: read only
      'reports.read',
      
      // Company profile: read only
      'company_profile.read',
      
      // Encumbrances: read only
      'encumbrances.view',
      
      // Open Banking: read only
      'open_banking.view_connections',
      'open_banking.view_transactions',
      
      // Users: read only
      'users.read',
      
      // Projects & Time Tracking: create time entries only
      'projects.read',
      'time_entries.create',
      'time_entries.read',
      'time_entries.update',
      'project_budgets.read',
      'project_reports.read',
      
      // Compliance: read only
      'compliance.read',
      
      // FX: read only
      'fx.read',
    ],
  },
  
  BOOKKEEPER: {
    name: 'Bookkeeper',
    description: 'Create and edit transactions, cannot delete or approve',
    isSystem: true,
    permissions: [
      // Customers: no delete
      'customers.create',
      'customers.read',
      'customers.update',
      'customers.export',
      
      // Vendors: no delete
      'vendors.create',
      'vendors.read',
      'vendors.update',
      'vendors.export',
      
      // Invoices: no delete
      'invoices.create',
      'invoices.read',
      'invoices.update',
      'invoices.send',
      'invoices.export',
      
      // Bills: no approve or delete, can review AI extraction
      'bills.create',
      'bills.read',
      'bills.update',
      'bills.export',
      'bills.review_ai_extraction',
      
      // Quotes and Sales Orders: no delete
      'quotes.create',
      'quotes.read',
      'quotes.update',
      'quotes.send',
      
      'sales_orders.create',
      'sales_orders.read',
      'sales_orders.update',
      
      'purchase_orders.create',
      'purchase_orders.read',
      'purchase_orders.update',
      
      // Credit notes: no delete
      'credit_notes.create',
      'credit_notes.read',
      'credit_notes.update',
      
      // Debit notes: draft only (no approve)
      'debit_notes.create',
      'debit_notes.read',
      
      // Payments: no approve
      'customer_payments.create',
      'customer_payments.read',
      'customer_payments.update',
      
      'payments.create',
      'payments.read',
      
      // Vendor payments: create and read (segregation of duties - no approve or execute)
      'vendor_payments.create',
      'vendor_payments.read',
      
      // Recurring and retainer invoices
      'recurring_invoices.create',
      'recurring_invoices.read',
      'recurring_invoices.update',
      
      'retainer_invoices.create',
      'retainer_invoices.read',
      'retainer_invoices.update',
      
      // Accounts: read only
      'accounts.read',
      
      // Journal entries: create only, NOT post or reverse
      'journal_entries.create',
      'journal_entries.read',
      
      // Assets: no delete
      'assets.create',
      'assets.read',
      'assets.update',
      
      // Bank reconciliations
      'bank_reconciliations.create',
      'bank_reconciliations.read',
      'bank_reconciliations.reconcile',
      
      // Expenses: no delete
      'expenses.create',
      'expenses.read',
      'expenses.update',
      
      // Items and taxes: read
      'items.read',
      'taxes.read',
      
      // Inventory: read only
      'inventory.read',
      
      // Documents
      'documents.create',
      'documents.read',
      
      // Reports
      'reports.read',
      'reports.export',
      
      // Company profile: read only
      'company_profile.read',
    ],
  },
  
  SALES: {
    name: 'Sales',
    description: 'Manage customers, quotes, invoices, and sales orders',
    isSystem: true,
    permissions: [
      // Full customer access
      'customers.*',
      
      // Full sales document access
      'quotes.*',
      'invoices.*',
      'sales_orders.*',
      'credit_notes.*',
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      
      // Read items
      'items.read',
      
      // Read taxes
      'taxes.read',
      
      // Documents
      'documents.create',
      'documents.read',
      
      // Sales reports
      'reports.read',
      'reports.export',
      
      // Company profile: read only
      'company_profile.read',
    ],
  },
  
  PURCHASE: {
    name: 'Purchase',
    description: 'Manage vendors, bills, and purchase orders',
    isSystem: true,
    permissions: [
      // Full vendor access
      'vendors.*',
      
      // Full purchase document access
      'bills.*',
      'purchase_orders.*',
      'expenses.*',
      
      // Debit notes: read only
      'debit_notes.read',
      
      // Vendor payments: read only
      'vendor_payments.read',
      
      // Encumbrances: read only
      'encumbrances.view',
      
      // Read items
      'items.read',
      
      // Read taxes
      'taxes.read',
      
      // Documents
      'documents.create',
      'documents.read',
      
      // Purchase reports
      'reports.read',
      'reports.export',
      
      // Company profile: read only
      'company_profile.read',
    ],
  },
  
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to all data and reports',
    isSystem: true,
    permissions: [
      // Read-only access to all modules
      'customers.read',
      'vendors.read',
      'items.read',
      'taxes.read',
      'invoices.read',
      'bills.read',
      'quotes.read',
      'sales_orders.read',
      'purchase_orders.read',
      'credit_notes.read',
      'debit_notes.read',
      'customer_payments.read',
      'recurring_invoices.read',
      'retainer_invoices.read',
      'accounts.read',
      'journal_entries.read',
      'assets.read',
      'bank_reconciliations.read',
      'expenses.read',
      'payments.read',
      'vendor_payments.read',
      'documents.read',
      
      // Full reports access
      'reports.*',
      
      // Approvals: read only
      'approvals.read',
      
      // Audit: view only
      'audit.view',
      
      // Company profile: read only
      'company_profile.read',
      
      // Settings: read only
      'settings.read',
    ],
  },
};

// Helper to get role names in order of privilege (highest to lowest)
export const ROLE_HIERARCHY = [
  'Owner',
  'CFO',
  'Controller',
  'Admin',
  'Senior Accountant',
  'Accountant',
  'Junior Accountant',
  'Bookkeeper',
  'Sales',
  'Purchase',
  'Viewer',
];
