// RBAC Permission Catalog
// Defines all permissions available in the multi-tenant accounting platform

export const PERMISSION_MODULES = {
  CUSTOMERS: 'customers',
  VENDORS: 'vendors',
  ITEMS: 'items',
  TAXES: 'taxes',
  INVOICES: 'invoices',
  BILLS: 'bills',
  QUOTES: 'quotes',
  SALES_ORDERS: 'sales_orders',
  PURCHASE_ORDERS: 'purchase_orders',
  CREDIT_NOTES: 'credit_notes',
  CUSTOMER_PAYMENTS: 'customer_payments',
  RECURRING_INVOICES: 'recurring_invoices',
  RETAINER_INVOICES: 'retainer_invoices',
  ACCOUNTS: 'accounts',
  JOURNAL_ENTRIES: 'journal_entries',
  ASSETS: 'assets',
  BANK_RECONCILIATIONS: 'bank_reconciliations',
  EXPENSES: 'expenses',
  PAYMENTS: 'payments',
  DOCUMENTS: 'documents',
  REPORTS: 'reports',
  COMPANY_PROFILE: 'company_profile',
  USERS: 'users',
  BILLING: 'billing',
  SETTINGS: 'settings',
} as const;

export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  VOID: 'void',
  SEND: 'send',
  EXPORT: 'export',
  IMPORT: 'import',
  RECONCILE: 'reconcile',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_BILLING: 'manage_billing',
} as const;

// Permission definitions (~70 permissions covering all modules)
export const PERMISSION_DEFINITIONS = [
  // Customers
  { module: 'customers', action: 'create', name: 'customers.create', description: 'Create new customers' },
  { module: 'customers', action: 'read', name: 'customers.read', description: 'View customers' },
  { module: 'customers', action: 'update', name: 'customers.update', description: 'Edit customers' },
  { module: 'customers', action: 'delete', name: 'customers.delete', description: 'Delete customers' },
  { module: 'customers', action: 'export', name: 'customers.export', description: 'Export customer data' },

  // Vendors
  { module: 'vendors', action: 'create', name: 'vendors.create', description: 'Create new vendors' },
  { module: 'vendors', action: 'read', name: 'vendors.read', description: 'View vendors' },
  { module: 'vendors', action: 'update', name: 'vendors.update', description: 'Edit vendors' },
  { module: 'vendors', action: 'delete', name: 'vendors.delete', description: 'Delete vendors' },
  { module: 'vendors', action: 'export', name: 'vendors.export', description: 'Export vendor data' },

  // Items
  { module: 'items', action: 'create', name: 'items.create', description: 'Create new items' },
  { module: 'items', action: 'read', name: 'items.read', description: 'View items catalog' },
  { module: 'items', action: 'update', name: 'items.update', description: 'Edit items' },
  { module: 'items', action: 'delete', name: 'items.delete', description: 'Delete items' },

  // Taxes
  { module: 'taxes', action: 'create', name: 'taxes.create', description: 'Create tax rates' },
  { module: 'taxes', action: 'read', name: 'taxes.read', description: 'View tax rates' },
  { module: 'taxes', action: 'update', name: 'taxes.update', description: 'Edit tax rates' },
  { module: 'taxes', action: 'delete', name: 'taxes.delete', description: 'Delete tax rates' },

  // Invoices
  { module: 'invoices', action: 'create', name: 'invoices.create', description: 'Create invoices' },
  { module: 'invoices', action: 'read', name: 'invoices.read', description: 'View invoices' },
  { module: 'invoices', action: 'update', name: 'invoices.update', description: 'Edit invoices' },
  { module: 'invoices', action: 'delete', name: 'invoices.delete', description: 'Delete invoices' },
  { module: 'invoices', action: 'send', name: 'invoices.send', description: 'Send invoices to customers' },
  { module: 'invoices', action: 'void', name: 'invoices.void', description: 'Void invoices' },
  { module: 'invoices', action: 'export', name: 'invoices.export', description: 'Export invoice data' },

  // Bills
  { module: 'bills', action: 'create', name: 'bills.create', description: 'Create bills' },
  { module: 'bills', action: 'read', name: 'bills.read', description: 'View bills' },
  { module: 'bills', action: 'update', name: 'bills.update', description: 'Edit bills' },
  { module: 'bills', action: 'delete', name: 'bills.delete', description: 'Delete bills' },
  { module: 'bills', action: 'approve', name: 'bills.approve', description: 'Approve bills for payment' },
  { module: 'bills', action: 'export', name: 'bills.export', description: 'Export bill data' },

  // Quotes
  { module: 'quotes', action: 'create', name: 'quotes.create', description: 'Create quotes' },
  { module: 'quotes', action: 'read', name: 'quotes.read', description: 'View quotes' },
  { module: 'quotes', action: 'update', name: 'quotes.update', description: 'Edit quotes' },
  { module: 'quotes', action: 'delete', name: 'quotes.delete', description: 'Delete quotes' },
  { module: 'quotes', action: 'send', name: 'quotes.send', description: 'Send quotes to customers' },

  // Sales Orders
  { module: 'sales_orders', action: 'create', name: 'sales_orders.create', description: 'Create sales orders' },
  { module: 'sales_orders', action: 'read', name: 'sales_orders.read', description: 'View sales orders' },
  { module: 'sales_orders', action: 'update', name: 'sales_orders.update', description: 'Edit sales orders' },
  { module: 'sales_orders', action: 'delete', name: 'sales_orders.delete', description: 'Delete sales orders' },

  // Purchase Orders
  { module: 'purchase_orders', action: 'create', name: 'purchase_orders.create', description: 'Create purchase orders' },
  { module: 'purchase_orders', action: 'read', name: 'purchase_orders.read', description: 'View purchase orders' },
  { module: 'purchase_orders', action: 'update', name: 'purchase_orders.update', description: 'Edit purchase orders' },
  { module: 'purchase_orders', action: 'delete', name: 'purchase_orders.delete', description: 'Delete purchase orders' },
  { module: 'purchase_orders', action: 'approve', name: 'purchase_orders.approve', description: 'Approve purchase orders' },

  // Credit Notes
  { module: 'credit_notes', action: 'create', name: 'credit_notes.create', description: 'Create credit notes' },
  { module: 'credit_notes', action: 'read', name: 'credit_notes.read', description: 'View credit notes' },
  { module: 'credit_notes', action: 'update', name: 'credit_notes.update', description: 'Edit credit notes' },
  { module: 'credit_notes', action: 'delete', name: 'credit_notes.delete', description: 'Delete credit notes' },

  // Customer Payments
  { module: 'customer_payments', action: 'create', name: 'customer_payments.create', description: 'Record customer payments' },
  { module: 'customer_payments', action: 'read', name: 'customer_payments.read', description: 'View customer payments' },
  { module: 'customer_payments', action: 'update', name: 'customer_payments.update', description: 'Edit customer payments' },
  { module: 'customer_payments', action: 'delete', name: 'customer_payments.delete', description: 'Delete customer payments' },

  // Recurring Invoices
  { module: 'recurring_invoices', action: 'create', name: 'recurring_invoices.create', description: 'Create recurring invoices' },
  { module: 'recurring_invoices', action: 'read', name: 'recurring_invoices.read', description: 'View recurring invoices' },
  { module: 'recurring_invoices', action: 'update', name: 'recurring_invoices.update', description: 'Edit recurring invoices' },
  { module: 'recurring_invoices', action: 'delete', name: 'recurring_invoices.delete', description: 'Delete recurring invoices' },

  // Retainer Invoices
  { module: 'retainer_invoices', action: 'create', name: 'retainer_invoices.create', description: 'Create retainer invoices' },
  { module: 'retainer_invoices', action: 'read', name: 'retainer_invoices.read', description: 'View retainer invoices' },
  { module: 'retainer_invoices', action: 'update', name: 'retainer_invoices.update', description: 'Edit retainer invoices' },
  { module: 'retainer_invoices', action: 'delete', name: 'retainer_invoices.delete', description: 'Delete retainer invoices' },

  // Chart of Accounts
  { module: 'accounts', action: 'create', name: 'accounts.create', description: 'Create accounts' },
  { module: 'accounts', action: 'read', name: 'accounts.read', description: 'View chart of accounts' },
  { module: 'accounts', action: 'update', name: 'accounts.update', description: 'Edit accounts' },
  { module: 'accounts', action: 'delete', name: 'accounts.delete', description: 'Delete accounts' },

  // Journal Entries
  { module: 'journal_entries', action: 'create', name: 'journal_entries.create', description: 'Create journal entries' },
  { module: 'journal_entries', action: 'read', name: 'journal_entries.read', description: 'View journal entries' },
  { module: 'journal_entries', action: 'update', name: 'journal_entries.update', description: 'Edit journal entries' },
  { module: 'journal_entries', action: 'delete', name: 'journal_entries.delete', description: 'Delete journal entries' },
  { module: 'journal_entries', action: 'approve', name: 'journal_entries.approve', description: 'Approve journal entries' },

  // Fixed Assets
  { module: 'assets', action: 'create', name: 'assets.create', description: 'Create fixed assets' },
  { module: 'assets', action: 'read', name: 'assets.read', description: 'View fixed assets' },
  { module: 'assets', action: 'update', name: 'assets.update', description: 'Edit fixed assets' },
  { module: 'assets', action: 'delete', name: 'assets.delete', description: 'Delete fixed assets' },

  // Bank Reconciliations
  { module: 'bank_reconciliations', action: 'create', name: 'bank_reconciliations.create', description: 'Create bank reconciliations' },
  { module: 'bank_reconciliations', action: 'read', name: 'bank_reconciliations.read', description: 'View bank reconciliations' },
  { module: 'bank_reconciliations', action: 'reconcile', name: 'bank_reconciliations.reconcile', description: 'Reconcile bank transactions' },

  // Expenses
  { module: 'expenses', action: 'create', name: 'expenses.create', description: 'Create expenses' },
  { module: 'expenses', action: 'read', name: 'expenses.read', description: 'View expenses' },
  { module: 'expenses', action: 'update', name: 'expenses.update', description: 'Edit expenses' },
  { module: 'expenses', action: 'delete', name: 'expenses.delete', description: 'Delete expenses' },

  // Payments (vendor payments)
  { module: 'payments', action: 'create', name: 'payments.create', description: 'Create vendor payments' },
  { module: 'payments', action: 'read', name: 'payments.read', description: 'View vendor payments' },
  { module: 'payments', action: 'approve', name: 'payments.approve', description: 'Approve vendor payments' },

  // Documents
  { module: 'documents', action: 'create', name: 'documents.create', description: 'Upload documents' },
  { module: 'documents', action: 'read', name: 'documents.read', description: 'View documents' },
  { module: 'documents', action: 'delete', name: 'documents.delete', description: 'Delete documents' },

  // Reports
  { module: 'reports', action: 'read', name: 'reports.read', description: 'View financial reports' },
  { module: 'reports', action: 'export', name: 'reports.export', description: 'Export financial reports' },

  // Company Profile
  { module: 'company_profile', action: 'read', name: 'company_profile.read', description: 'View company profile' },
  { module: 'company_profile', action: 'update', name: 'company_profile.update', description: 'Edit company profile' },

  // User Management
  { module: 'users', action: 'read', name: 'users.read', description: 'View team members' },
  { module: 'users', action: 'create', name: 'users.create', description: 'Invite team members' },
  { module: 'users', action: 'update', name: 'users.update', description: 'Edit team member details' },
  { module: 'users', action: 'delete', name: 'users.delete', description: 'Remove team members' },
  { module: 'users', action: 'manage_roles', name: 'users.manage_roles', description: 'Assign and manage user roles' },

  // Billing (tenant billing settings)
  { module: 'billing', action: 'read', name: 'billing.read', description: 'View billing information' },
  { module: 'billing', action: 'manage_billing', name: 'billing.manage', description: 'Manage billing and subscription' },

  // Settings
  { module: 'settings', action: 'read', name: 'settings.read', description: 'View settings' },
  { module: 'settings', action: 'update', name: 'settings.update', description: 'Update settings' },
];

// Permission inheritance rules (higher permissions inherit lower ones)
// Example: delete permission includes update and read
export const PERMISSION_HIERARCHY: Record<string, string[]> = {
  'delete': ['update', 'read'],
  'update': ['read'],
  'approve': ['read'],
  'void': ['read'],
  'send': ['read'],
  'export': ['read'],
  'reconcile': ['read'],
  'manage_roles': ['read'],
  'manage_billing': ['read'],
};

// Helper to expand permissions with inheritance
export function expandPermissions(permissions: string[]): string[] {
  const expanded = new Set(permissions);
  
  permissions.forEach(perm => {
    const [module, action] = perm.split('.');
    
    if (!action) return; // Skip malformed permissions
    
    const inherited = PERMISSION_HIERARCHY[action] || [];
    inherited.forEach(inheritedAction => {
      expanded.add(`${module}.${inheritedAction}`);
    });
  });
  
  return Array.from(expanded);
}

// Helper to check if a permission matches a pattern (supports wildcards)
export function matchesPermissionPattern(permission: string, pattern: string): boolean {
  // Handle exact match
  if (permission === pattern) return true;
  
  // Handle wildcard patterns like 'customers.*'
  if (pattern.endsWith('.*')) {
    const modulePrefix = pattern.slice(0, -2);
    return permission.startsWith(`${modulePrefix}.`);
  }
  
  return false;
}

// Helper to resolve wildcard permissions to actual permissions
export function resolveWildcardPermissions(patterns: string[]): string[] {
  const resolved: string[] = [];
  
  patterns.forEach(pattern => {
    if (pattern === '*') {
      // Grant all permissions
      resolved.push(...PERMISSION_DEFINITIONS.map(p => p.name));
    } else if (pattern.endsWith('.*')) {
      // Grant all permissions for a module
      const module = pattern.slice(0, -2);
      const modulePerms = PERMISSION_DEFINITIONS
        .filter(p => p.module === module)
        .map(p => p.name);
      resolved.push(...modulePerms);
    } else {
      // Regular permission
      resolved.push(pattern);
    }
  });
  
  return Array.from(new Set(resolved));
}
