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
  
  ADMIN: {
    name: 'Admin',
    description: 'Full accounting features and user management (no billing)',
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
      'customer_payments.*',
      'recurring_invoices.*',
      'retainer_invoices.*',
      'accounts.*',
      'journal_entries.*',
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'payments.*',
      'documents.*',
      'reports.*',
      'company_profile.*',
      'settings.*',
      
      // User management but not billing
      'users.*',
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
      
      'purchase_orders.create',
      'purchase_orders.read',
      'purchase_orders.update',
      'purchase_orders.approve',
      
      'payments.create',
      'payments.read',
      'payments.approve',
      
      // Full access to accounting
      'accounts.*',
      'journal_entries.*',
      'assets.*',
      'bank_reconciliations.*',
      'expenses.*',
      'taxes.*',
      
      // Items and documents
      'items.*',
      'documents.*',
      
      // Reports
      'reports.*',
      
      // Read company profile
      'company_profile.read',
      
      // Read users
      'users.read',
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
      
      // Bills: no approve or delete
      'bills.create',
      'bills.read',
      'bills.update',
      'bills.export',
      
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
      
      // Payments: no approve
      'customer_payments.create',
      'customer_payments.read',
      'customer_payments.update',
      
      'payments.create',
      'payments.read',
      
      // Recurring and retainer invoices
      'recurring_invoices.create',
      'recurring_invoices.read',
      'recurring_invoices.update',
      
      'retainer_invoices.create',
      'retainer_invoices.read',
      'retainer_invoices.update',
      
      // Accounts: read only
      'accounts.read',
      
      // Journal entries: no delete or approve
      'journal_entries.create',
      'journal_entries.read',
      'journal_entries.update',
      
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
      'customer_payments.read',
      'recurring_invoices.read',
      'retainer_invoices.read',
      'accounts.read',
      'journal_entries.read',
      'assets.read',
      'bank_reconciliations.read',
      'expenses.read',
      'payments.read',
      'documents.read',
      
      // Full reports access
      'reports.*',
      
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
  'Admin',
  'Accountant',
  'Bookkeeper',
  'Sales',
  'Purchase',
  'Viewer',
];
