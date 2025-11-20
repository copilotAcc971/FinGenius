/**
 * AUTHORITY MATRIX FOR ROLE-BASED ACCESS CONTROL (RBAC)
 * 
 * This module defines the authority matrix for the multi-tenant accounting platform,
 * mapping accounting roles to permission levels across all modules.
 * 
 * PERMISSION LEVELS (Hierarchical):
 * - READ: View data only
 * - WRITE: Create new records
 * - EDIT: Modify existing records (implies READ)
 * - POST: Post transactions to ledger (implies EDIT, WRITE, READ)
 * - DELETE: Remove records (requires higher authority)
 * - APPROVE: Approve transactions for posting/execution (segregation of duties)
 * 
 * ACCOUNTING ROLE HIERARCHY (Highest to Lowest Authority):
 * 1. Owner - Full system access including billing and user management
 * 2. CFO - Strategic financial oversight, payment execution authority, reversals
 * 3. Controller - Financial operations management, supervision
 * 4. Senior Accountant - Full accounting operations, approvals
 * 5. Accountant - Standard accounting tasks, limited approvals
 * 6. Junior Accountant - Basic data entry, no approvals
 * 7. Bookkeeper - Transaction recording, no posting authority
 * 8. Specialist Roles (Sales, Purchase) - Domain-specific access
 * 9. Viewer - Read-only access
 * 
 * SEGREGATION OF DUTIES PRINCIPLES:
 * - Payment creators cannot approve payments (Accountant vs Admin/CFO)
 * - Journal entry creators cannot always post (Junior Accountant vs Accountant)
 * - Deletions require supervisory authority (Senior Accountant+)
 * - Reversals require executive authority (Controller/CFO only)
 * - Payment execution separate from approval (CFO executes, Admin approves)
 */

// ====================================
// PERMISSION LEVEL DEFINITIONS
// ====================================

/**
 * Permission levels define the hierarchical access rights.
 * Higher levels inherit all lower level permissions.
 */
export enum PermissionLevel {
  READ = 'READ',           // View data
  WRITE = 'WRITE',         // Create new records
  EDIT = 'EDIT',           // Modify records (implies READ)
  POST = 'POST',           // Post to ledger (implies EDIT, WRITE, READ)
  DELETE = 'DELETE',       // Remove records
  APPROVE = 'APPROVE',     // Approve for execution/posting
}

/**
 * Permission level hierarchy for inheritance resolution
 * Higher index = higher authority level
 */
export const PERMISSION_LEVEL_HIERARCHY = [
  PermissionLevel.READ,
  PermissionLevel.WRITE,
  PermissionLevel.EDIT,
  PermissionLevel.POST,
  PermissionLevel.DELETE,
  PermissionLevel.APPROVE,
] as const;

/**
 * Check if a permission level includes another level (hierarchical check)
 * @param granted - The permission level granted to the user
 * @param required - The permission level required for the action
 * @returns true if granted level includes required level
 */
export function permissionLevelIncludes(
  granted: PermissionLevel,
  required: PermissionLevel
): boolean {
  const grantedIndex = PERMISSION_LEVEL_HIERARCHY.indexOf(granted);
  const requiredIndex = PERMISSION_LEVEL_HIERARCHY.indexOf(required);
  return grantedIndex >= requiredIndex;
}

// ====================================
// ACCOUNTING ROLE DEFINITIONS
// ====================================

/**
 * Standard accounting roles following industry best practices
 * Aligns with typical accounting department hierarchies
 */
export enum AccountingRole {
  OWNER = 'Owner',
  CFO = 'CFO',
  CONTROLLER = 'Controller',
  SENIOR_ACCOUNTANT = 'Senior Accountant',
  ACCOUNTANT = 'Accountant',
  JUNIOR_ACCOUNTANT = 'Junior Accountant',
  ADMIN = 'Admin',
  BOOKKEEPER = 'Bookkeeper',
  SALES = 'Sales',
  PURCHASE = 'Purchase',
  VIEWER = 'Viewer',
}

/**
 * Role hierarchy for escalation paths (highest to lowest authority)
 * Used for approval workflows and permission inheritance
 */
export const ROLE_HIERARCHY = [
  AccountingRole.OWNER,
  AccountingRole.CFO,
  AccountingRole.CONTROLLER,
  AccountingRole.ADMIN,
  AccountingRole.SENIOR_ACCOUNTANT,
  AccountingRole.ACCOUNTANT,
  AccountingRole.JUNIOR_ACCOUNTANT,
  AccountingRole.BOOKKEEPER,
  AccountingRole.SALES,
  AccountingRole.PURCHASE,
  AccountingRole.VIEWER,
] as const;

/**
 * Get the next higher role in the hierarchy for escalation
 * @param currentRole - The current role
 * @returns The next higher role or null if already at top
 */
export function getEscalationRole(currentRole: AccountingRole): AccountingRole | null {
  const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
  if (currentIndex === 0 || currentIndex === -1) {
    return null; // Already at top or role not found
  }
  return ROLE_HIERARCHY[currentIndex - 1];
}

/**
 * Check if a role has higher authority than another role
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @returns true if role1 has higher authority than role2
 */
export function roleHasHigherAuthority(role1: AccountingRole, role2: AccountingRole): boolean {
  const index1 = ROLE_HIERARCHY.indexOf(role1);
  const index2 = ROLE_HIERARCHY.indexOf(role2);
  return index1 < index2; // Lower index = higher authority
}

// ====================================
// AUTHORITY MATRIX TYPE DEFINITIONS
// ====================================

/**
 * Module identifier for permission mapping
 * Aligns with PERMISSION_MODULES in server/rbac/permissions.ts
 */
export type ModuleIdentifier =
  | 'customers'
  | 'vendors'
  | 'items'
  | 'taxes'
  | 'invoices'
  | 'bills'
  | 'quotes'
  | 'sales_orders'
  | 'purchase_orders'
  | 'credit_notes'
  | 'debit_notes'
  | 'customer_payments'
  | 'vendor_payments'
  | 'recurring_invoices'
  | 'retainer_invoices'
  | 'accounts'
  | 'journal_entries'
  | 'assets'
  | 'bank_reconciliations'
  | 'expenses'
  | 'employee_expenses'
  | 'payments'
  | 'documents'
  | 'reports'
  | 'company_profile'
  | 'users'
  | 'settings'
  | 'workflows'
  | 'approvals'
  | 'audit'
  | 'encumbrances'
  | 'inventory'
  | 'scheduled_reports'
  | 'open_banking'
  | 'projects'
  | 'time_entries'
  | 'project_budgets'
  | 'project_reports'
  | 'compliance'
  | 'fx';

/**
 * Permission grant for a specific module
 * Defines what actions a role can perform
 */
export interface ModulePermission {
  module: ModuleIdentifier;
  level: PermissionLevel;
  /** Additional constraints or special permissions */
  constraints?: {
    canDelete?: boolean;      // Explicit delete permission
    canApprove?: boolean;     // Explicit approve permission
    canPost?: boolean;        // Explicit post permission
    canReverse?: boolean;     // Explicit reverse permission (journal entries)
    canExecute?: boolean;     // Explicit execute permission (payments)
    canAuthorize?: boolean;   // Explicit authorize permission (payments)
    readOnly?: boolean;       // Override to make read-only
  };
}

/**
 * Authority Matrix - Complete permission mapping for a role
 * Maps each accounting role to their module permissions
 */
export type AuthorityMatrix = {
  [role in AccountingRole]: ModulePermission[];
};

// ====================================
// DEFAULT AUTHORITY MATRIX
// ====================================

/**
 * DEFAULT_AUTHORITY_MATRIX defines the standard permission matrix
 * for all accounting roles across all modules.
 * 
 * This serves as the baseline for role permissions.
 * Tenant-specific overrides can be applied via rolePermissionOverrides table.
 */
export const DEFAULT_AUTHORITY_MATRIX: AuthorityMatrix = {
  // ============================================================
  // OWNER - Full system access including billing and user management
  // ============================================================
  [AccountingRole.OWNER]: [
    { module: 'customers', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'taxes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'quotes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'debit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'customer_payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'vendor_payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true, canExecute: true, canAuthorize: true } },
    { module: 'recurring_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'journal_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canPost: true, canReverse: true, canApprove: true } },
    { module: 'assets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bank_reconciliations', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'documents', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'reports', level: PermissionLevel.APPROVE },
    { module: 'company_profile', level: PermissionLevel.APPROVE },
    { module: 'users', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'settings', level: PermissionLevel.APPROVE },
    { module: 'workflows', level: PermissionLevel.APPROVE },
    { module: 'approvals', level: PermissionLevel.APPROVE },
    { module: 'audit', level: PermissionLevel.APPROVE },
    { module: 'encumbrances', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'inventory', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'scheduled_reports', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'open_banking', level: PermissionLevel.APPROVE },
    { module: 'projects', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'time_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'fx', level: PermissionLevel.APPROVE },
  ],

  // ============================================================
  // CFO - Strategic financial oversight and payment execution authority
  // ============================================================
  [AccountingRole.CFO]: [
    { module: 'customers', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'taxes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'quotes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'debit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'customer_payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // CFO: Execute and authorize payments (segregated from approval)
    { module: 'vendor_payments', level: PermissionLevel.READ, constraints: { canExecute: true, canAuthorize: true } },
    { module: 'recurring_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // CFO: Can reverse journal entries (critical authority)
    { module: 'journal_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canPost: true, canReverse: true, canApprove: true } },
    { module: 'assets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bank_reconciliations', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'documents', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'reports', level: PermissionLevel.APPROVE },
    { module: 'company_profile', level: PermissionLevel.APPROVE },
    { module: 'users', level: PermissionLevel.EDIT },
    { module: 'settings', level: PermissionLevel.APPROVE },
    { module: 'workflows', level: PermissionLevel.APPROVE },
    { module: 'approvals', level: PermissionLevel.APPROVE },
    { module: 'audit', level: PermissionLevel.APPROVE },
    { module: 'encumbrances', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'inventory', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'scheduled_reports', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'open_banking', level: PermissionLevel.APPROVE },
    { module: 'projects', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'time_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'fx', level: PermissionLevel.APPROVE },
  ],

  // ============================================================
  // CONTROLLER - Financial operations management and supervision
  // ============================================================
  [AccountingRole.CONTROLLER]: [
    { module: 'customers', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'taxes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'quotes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'debit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'customer_payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // Controller: Approve payments but cannot execute (segregation of duties)
    { module: 'vendor_payments', level: PermissionLevel.APPROVE, constraints: { canApprove: true } },
    { module: 'recurring_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // Controller: Can reverse journal entries (supervisory authority)
    { module: 'journal_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canPost: true, canReverse: true, canApprove: true } },
    { module: 'assets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bank_reconciliations', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'documents', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'reports', level: PermissionLevel.APPROVE },
    { module: 'company_profile', level: PermissionLevel.EDIT },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.EDIT },
    { module: 'workflows', level: PermissionLevel.EDIT },
    { module: 'approvals', level: PermissionLevel.APPROVE },
    { module: 'audit', level: PermissionLevel.APPROVE },
    { module: 'encumbrances', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'inventory', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'scheduled_reports', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'open_banking', level: PermissionLevel.APPROVE },
    { module: 'projects', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'time_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'fx', level: PermissionLevel.APPROVE },
  ],

  // ============================================================
  // ADMIN - Accounting operations and approvals (no payment execution)
  // ============================================================
  [AccountingRole.ADMIN]: [
    { module: 'customers', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'taxes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'quotes', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'debit_notes', level: PermissionLevel.EDIT }, // Cannot approve (segregation)
    { module: 'customer_payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // Admin: Approve payments only, NOT execute (segregation of duties)
    { module: 'vendor_payments', level: PermissionLevel.READ, constraints: { canApprove: true } },
    { module: 'recurring_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    // Admin: Can post but NOT reverse (requires CFO/Controller)
    { module: 'journal_entries', level: PermissionLevel.POST, constraints: { canDelete: true, canPost: true, canApprove: true } },
    { module: 'assets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'bank_reconciliations', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'payments', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'documents', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'reports', level: PermissionLevel.APPROVE },
    { module: 'company_profile', level: PermissionLevel.EDIT },
    { module: 'users', level: PermissionLevel.EDIT },
    { module: 'settings', level: PermissionLevel.EDIT },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.APPROVE },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'inventory', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'scheduled_reports', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'open_banking', level: PermissionLevel.APPROVE },
    { module: 'projects', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'time_entries', level: PermissionLevel.APPROVE, constraints: { canDelete: true, canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.APPROVE, constraints: { canDelete: true } },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.EDIT },
    { module: 'fx', level: PermissionLevel.EDIT },
  ],

  // ============================================================
  // SENIOR ACCOUNTANT - Full accounting operations with approvals
  // ============================================================
  [AccountingRole.SENIOR_ACCOUNTANT]: [
    { module: 'customers', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'taxes', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'quotes', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'debit_notes', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'customer_payments', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'vendor_payments', level: PermissionLevel.WRITE }, // Create only (segregation)
    { module: 'recurring_invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'journal_entries', level: PermissionLevel.POST, constraints: { canPost: true, canApprove: true } },
    { module: 'assets', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'bank_reconciliations', level: PermissionLevel.POST },
    { module: 'expenses', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'payments', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'documents', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'reports', level: PermissionLevel.POST },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.EDIT },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.POST },
    { module: 'inventory', level: PermissionLevel.EDIT },
    { module: 'scheduled_reports', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'open_banking', level: PermissionLevel.EDIT },
    { module: 'projects', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'time_entries', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.EDIT },
    { module: 'fx', level: PermissionLevel.EDIT },
  ],

  // ============================================================
  // ACCOUNTANT - Standard accounting tasks with limited approvals
  // ============================================================
  [AccountingRole.ACCOUNTANT]: [
    { module: 'customers', level: PermissionLevel.POST },
    { module: 'vendors', level: PermissionLevel.POST },
    { module: 'items', level: PermissionLevel.POST },
    { module: 'taxes', level: PermissionLevel.POST },
    { module: 'invoices', level: PermissionLevel.POST },
    { module: 'bills', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'quotes', level: PermissionLevel.POST },
    { module: 'sales_orders', level: PermissionLevel.POST },
    { module: 'purchase_orders', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'credit_notes', level: PermissionLevel.POST },
    { module: 'debit_notes', level: PermissionLevel.EDIT }, // Cannot approve
    { module: 'customer_payments', level: PermissionLevel.POST },
    { module: 'vendor_payments', level: PermissionLevel.WRITE }, // Create only (segregation)
    { module: 'recurring_invoices', level: PermissionLevel.POST },
    { module: 'retainer_invoices', level: PermissionLevel.POST },
    { module: 'accounts', level: PermissionLevel.POST },
    { module: 'journal_entries', level: PermissionLevel.POST, constraints: { canPost: true } }, // Can post
    { module: 'assets', level: PermissionLevel.POST },
    { module: 'bank_reconciliations', level: PermissionLevel.POST },
    { module: 'expenses', level: PermissionLevel.POST },
    { module: 'employee_expenses', level: PermissionLevel.EDIT }, // Cannot approve
    { module: 'payments', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'documents', level: PermissionLevel.POST },
    { module: 'reports', level: PermissionLevel.POST },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.EDIT },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.EDIT },
    { module: 'open_banking', level: PermissionLevel.EDIT },
    { module: 'projects', level: PermissionLevel.EDIT },
    { module: 'time_entries', level: PermissionLevel.POST, constraints: { canApprove: true } },
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],

  // ============================================================
  // JUNIOR ACCOUNTANT - Basic accounting with no approvals or posting
  // ============================================================
  [AccountingRole.JUNIOR_ACCOUNTANT]: [
    { module: 'customers', level: PermissionLevel.EDIT },
    { module: 'vendors', level: PermissionLevel.EDIT },
    { module: 'items', level: PermissionLevel.EDIT },
    { module: 'taxes', level: PermissionLevel.READ },
    { module: 'invoices', level: PermissionLevel.EDIT },
    { module: 'bills', level: PermissionLevel.EDIT },
    { module: 'quotes', level: PermissionLevel.EDIT },
    { module: 'sales_orders', level: PermissionLevel.EDIT },
    { module: 'purchase_orders', level: PermissionLevel.EDIT },
    { module: 'credit_notes', level: PermissionLevel.EDIT },
    { module: 'debit_notes', level: PermissionLevel.EDIT },
    { module: 'customer_payments', level: PermissionLevel.EDIT },
    { module: 'vendor_payments', level: PermissionLevel.READ }, // Read only
    { module: 'recurring_invoices', level: PermissionLevel.EDIT },
    { module: 'retainer_invoices', level: PermissionLevel.EDIT },
    { module: 'accounts', level: PermissionLevel.READ },
    { module: 'journal_entries', level: PermissionLevel.WRITE }, // Create drafts only, cannot post
    { module: 'assets', level: PermissionLevel.EDIT },
    { module: 'bank_reconciliations', level: PermissionLevel.EDIT },
    { module: 'expenses', level: PermissionLevel.EDIT },
    { module: 'employee_expenses', level: PermissionLevel.EDIT },
    { module: 'payments', level: PermissionLevel.EDIT },
    { module: 'documents', level: PermissionLevel.EDIT },
    { module: 'reports', level: PermissionLevel.READ },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.READ },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.READ },
    { module: 'open_banking', level: PermissionLevel.READ },
    { module: 'projects', level: PermissionLevel.EDIT },
    { module: 'time_entries', level: PermissionLevel.WRITE }, // Create only, cannot approve
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],

  // ============================================================
  // BOOKKEEPER - Transaction recording, no posting or deletion
  // ============================================================
  [AccountingRole.BOOKKEEPER]: [
    { module: 'customers', level: PermissionLevel.EDIT },
    { module: 'vendors', level: PermissionLevel.EDIT },
    { module: 'items', level: PermissionLevel.READ },
    { module: 'taxes', level: PermissionLevel.READ },
    { module: 'invoices', level: PermissionLevel.EDIT },
    { module: 'bills', level: PermissionLevel.EDIT },
    { module: 'quotes', level: PermissionLevel.EDIT },
    { module: 'sales_orders', level: PermissionLevel.EDIT },
    { module: 'purchase_orders', level: PermissionLevel.EDIT },
    { module: 'credit_notes', level: PermissionLevel.EDIT },
    { module: 'debit_notes', level: PermissionLevel.WRITE },
    { module: 'customer_payments', level: PermissionLevel.EDIT },
    { module: 'vendor_payments', level: PermissionLevel.WRITE }, // Create only
    { module: 'recurring_invoices', level: PermissionLevel.EDIT },
    { module: 'retainer_invoices', level: PermissionLevel.EDIT },
    { module: 'accounts', level: PermissionLevel.READ },
    { module: 'journal_entries', level: PermissionLevel.WRITE }, // Create drafts only
    { module: 'assets', level: PermissionLevel.EDIT },
    { module: 'bank_reconciliations', level: PermissionLevel.EDIT },
    { module: 'expenses', level: PermissionLevel.EDIT },
    { module: 'employee_expenses', level: PermissionLevel.READ },
    { module: 'payments', level: PermissionLevel.WRITE },
    { module: 'documents', level: PermissionLevel.EDIT },
    { module: 'reports', level: PermissionLevel.READ },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.READ },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.READ },
    { module: 'open_banking', level: PermissionLevel.READ },
    { module: 'projects', level: PermissionLevel.READ },
    { module: 'time_entries', level: PermissionLevel.READ },
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],

  // ============================================================
  // SALES - Customer and sales document management
  // ============================================================
  [AccountingRole.SALES]: [
    { module: 'customers', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'vendors', level: PermissionLevel.READ },
    { module: 'items', level: PermissionLevel.READ },
    { module: 'taxes', level: PermissionLevel.READ },
    { module: 'invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'bills', level: PermissionLevel.READ },
    { module: 'quotes', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'sales_orders', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'purchase_orders', level: PermissionLevel.READ },
    { module: 'credit_notes', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'debit_notes', level: PermissionLevel.READ },
    { module: 'customer_payments', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'vendor_payments', level: PermissionLevel.READ },
    { module: 'recurring_invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'retainer_invoices', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'accounts', level: PermissionLevel.READ },
    { module: 'journal_entries', level: PermissionLevel.READ },
    { module: 'assets', level: PermissionLevel.READ },
    { module: 'bank_reconciliations', level: PermissionLevel.READ },
    { module: 'expenses', level: PermissionLevel.READ },
    { module: 'employee_expenses', level: PermissionLevel.READ },
    { module: 'payments', level: PermissionLevel.READ },
    { module: 'documents', level: PermissionLevel.EDIT },
    { module: 'reports', level: PermissionLevel.READ },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.READ },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.READ },
    { module: 'open_banking', level: PermissionLevel.READ },
    { module: 'projects', level: PermissionLevel.READ },
    { module: 'time_entries', level: PermissionLevel.READ },
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],

  // ============================================================
  // PURCHASE - Vendor and purchase document management
  // ============================================================
  [AccountingRole.PURCHASE]: [
    { module: 'customers', level: PermissionLevel.READ },
    { module: 'vendors', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'items', level: PermissionLevel.READ },
    { module: 'taxes', level: PermissionLevel.READ },
    { module: 'invoices', level: PermissionLevel.READ },
    { module: 'bills', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'quotes', level: PermissionLevel.READ },
    { module: 'sales_orders', level: PermissionLevel.READ },
    { module: 'purchase_orders', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'credit_notes', level: PermissionLevel.READ },
    { module: 'debit_notes', level: PermissionLevel.READ },
    { module: 'customer_payments', level: PermissionLevel.READ },
    { module: 'vendor_payments', level: PermissionLevel.READ },
    { module: 'recurring_invoices', level: PermissionLevel.READ },
    { module: 'retainer_invoices', level: PermissionLevel.READ },
    { module: 'accounts', level: PermissionLevel.READ },
    { module: 'journal_entries', level: PermissionLevel.READ },
    { module: 'assets', level: PermissionLevel.READ },
    { module: 'bank_reconciliations', level: PermissionLevel.READ },
    { module: 'expenses', level: PermissionLevel.POST, constraints: { canDelete: true } },
    { module: 'employee_expenses', level: PermissionLevel.READ },
    { module: 'payments', level: PermissionLevel.READ },
    { module: 'documents', level: PermissionLevel.EDIT },
    { module: 'reports', level: PermissionLevel.READ },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.READ },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.READ },
    { module: 'open_banking', level: PermissionLevel.READ },
    { module: 'projects', level: PermissionLevel.READ },
    { module: 'time_entries', level: PermissionLevel.READ },
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],

  // ============================================================
  // VIEWER - Read-only access to all data
  // ============================================================
  [AccountingRole.VIEWER]: [
    { module: 'customers', level: PermissionLevel.READ },
    { module: 'vendors', level: PermissionLevel.READ },
    { module: 'items', level: PermissionLevel.READ },
    { module: 'taxes', level: PermissionLevel.READ },
    { module: 'invoices', level: PermissionLevel.READ },
    { module: 'bills', level: PermissionLevel.READ },
    { module: 'quotes', level: PermissionLevel.READ },
    { module: 'sales_orders', level: PermissionLevel.READ },
    { module: 'purchase_orders', level: PermissionLevel.READ },
    { module: 'credit_notes', level: PermissionLevel.READ },
    { module: 'debit_notes', level: PermissionLevel.READ },
    { module: 'customer_payments', level: PermissionLevel.READ },
    { module: 'vendor_payments', level: PermissionLevel.READ },
    { module: 'recurring_invoices', level: PermissionLevel.READ },
    { module: 'retainer_invoices', level: PermissionLevel.READ },
    { module: 'accounts', level: PermissionLevel.READ },
    { module: 'journal_entries', level: PermissionLevel.READ },
    { module: 'assets', level: PermissionLevel.READ },
    { module: 'bank_reconciliations', level: PermissionLevel.READ },
    { module: 'expenses', level: PermissionLevel.READ },
    { module: 'employee_expenses', level: PermissionLevel.READ },
    { module: 'payments', level: PermissionLevel.READ },
    { module: 'documents', level: PermissionLevel.READ },
    { module: 'reports', level: PermissionLevel.READ },
    { module: 'company_profile', level: PermissionLevel.READ },
    { module: 'users', level: PermissionLevel.READ },
    { module: 'settings', level: PermissionLevel.READ },
    { module: 'workflows', level: PermissionLevel.READ },
    { module: 'approvals', level: PermissionLevel.READ },
    { module: 'audit', level: PermissionLevel.READ },
    { module: 'encumbrances', level: PermissionLevel.READ },
    { module: 'inventory', level: PermissionLevel.READ },
    { module: 'scheduled_reports', level: PermissionLevel.READ },
    { module: 'open_banking', level: PermissionLevel.READ },
    { module: 'projects', level: PermissionLevel.READ },
    { module: 'time_entries', level: PermissionLevel.READ },
    { module: 'project_budgets', level: PermissionLevel.READ },
    { module: 'project_reports', level: PermissionLevel.READ },
    { module: 'compliance', level: PermissionLevel.READ },
    { module: 'fx', level: PermissionLevel.READ },
  ],
};

// ====================================
// ESCALATION PATH DOCUMENTATION
// ====================================

/**
 * ESCALATION PATHS FOR APPROVAL WORKFLOWS
 * 
 * When a user needs approval for an action they don't have permission for,
 * the system should escalate to the next higher role in the hierarchy.
 * 
 * Example Escalation Scenarios:
 * 
 * 1. Journal Entry Reversal:
 *    - Junior Accountant creates entry → Accountant posts → CFO/Controller reverses
 *    - Escalation: Junior Accountant → Accountant → Senior Accountant → Controller → CFO
 * 
 * 2. Payment Approval & Execution (Segregation of Duties):
 *    - Bookkeeper creates payment → Admin approves → CFO executes
 *    - Escalation: Bookkeeper → Accountant → Admin → CFO
 * 
 * 3. Deletion Authority:
 *    - Junior Accountant cannot delete → Escalates to Senior Accountant or higher
 *    - Escalation: Junior Accountant → Accountant → Senior Accountant
 * 
 * 4. Debit Note Approval:
 *    - Accountant creates debit note → Controller/CFO approves
 *    - Escalation: Accountant → Senior Accountant → Controller → CFO
 * 
 * Implementation:
 * - Use getEscalationRole() to find next approver
 * - Check roleHasHigherAuthority() to validate escalation path
 * - Create approval request with escalation chain
 */

/**
 * Get the required authority level for a specific action
 * @param module - Module identifier
 * @param action - Action being performed (create, read, update, delete, post, approve)
 * @returns Minimum permission level required
 */
export function getRequiredPermissionLevel(
  module: ModuleIdentifier,
  action: 'create' | 'read' | 'update' | 'delete' | 'post' | 'approve' | 'reverse' | 'execute' | 'authorize'
): PermissionLevel {
  const mapping: Record<string, PermissionLevel> = {
    'create': PermissionLevel.WRITE,
    'read': PermissionLevel.READ,
    'update': PermissionLevel.EDIT,
    'delete': PermissionLevel.DELETE,
    'post': PermissionLevel.POST,
    'approve': PermissionLevel.APPROVE,
    'reverse': PermissionLevel.APPROVE, // Requires highest authority
    'execute': PermissionLevel.APPROVE, // Payment execution
    'authorize': PermissionLevel.APPROVE, // Payment authorization
  };
  
  return mapping[action] || PermissionLevel.READ;
}

/**
 * Check if a role has permission for a specific module action
 * @param role - User's accounting role
 * @param module - Module identifier
 * @param action - Action being performed
 * @returns true if role has permission for the action
 */
export function roleHasModulePermission(
  role: AccountingRole,
  module: ModuleIdentifier,
  action: 'create' | 'read' | 'update' | 'delete' | 'post' | 'approve' | 'reverse' | 'execute' | 'authorize'
): boolean {
  const rolePermissions = DEFAULT_AUTHORITY_MATRIX[role];
  const modulePermission = rolePermissions.find(p => p.module === module);
  
  if (!modulePermission) {
    return false;
  }
  
  const requiredLevel = getRequiredPermissionLevel(module, action);
  
  // Check hierarchical permission level
  const hasLevelPermission = permissionLevelIncludes(modulePermission.level, requiredLevel);
  
  // Check explicit constraints
  const constraints = modulePermission.constraints;
  if (action === 'delete' && constraints?.canDelete === false) {
    return false;
  }
  if (action === 'approve' && constraints?.canApprove === false) {
    return false;
  }
  if (action === 'post' && constraints?.canPost === false) {
    return false;
  }
  if (action === 'reverse' && constraints?.canReverse === false) {
    return false;
  }
  if (action === 'execute' && constraints?.canExecute === false) {
    return false;
  }
  if (action === 'authorize' && constraints?.canAuthorize === false) {
    return false;
  }
  if (constraints?.readOnly && action !== 'read') {
    return false;
  }
  
  return hasLevelPermission;
}

// ====================================
// ACTION IMPACT LEVELS (For AI Copilot Context)
// ====================================

/**
 * Impact levels define the criticality and scope of an action
 * Used by AI Copilot to understand the severity of operations
 */
export enum ImpactLevel {
  READ_ONLY = 'READ_ONLY',       // View-only access, no data changes
  CREATE = 'CREATE',              // Create new draft records
  MODIFY = 'MODIFY',              // Edit existing records  
  DELETE = 'DELETE',              // Remove records
  EXECUTE = 'EXECUTE',            // Execute critical operations (posting, payments)
  CRITICAL = 'CRITICAL',          // Highest level - system-wide impacts (reversals, closures)
}

/**
 * Impact level hierarchy (lower to higher criticality)
 */
export const IMPACT_LEVEL_HIERARCHY = [
  ImpactLevel.READ_ONLY,
  ImpactLevel.CREATE,
  ImpactLevel.MODIFY,
  ImpactLevel.DELETE,
  ImpactLevel.EXECUTE,
  ImpactLevel.CRITICAL,
] as const;

/**
 * Map permission levels to impact levels
 * This helps the AI understand the severity of different permission levels
 */
export function permissionLevelToImpactLevel(level: PermissionLevel): ImpactLevel {
  switch (level) {
    case PermissionLevel.READ:
      return ImpactLevel.READ_ONLY;
    case PermissionLevel.WRITE:
      return ImpactLevel.CREATE;
    case PermissionLevel.EDIT:
      return ImpactLevel.MODIFY;
    case PermissionLevel.DELETE:
      return ImpactLevel.DELETE;
    case PermissionLevel.POST:
    case PermissionLevel.APPROVE:
      return ImpactLevel.EXECUTE;
    default:
      return ImpactLevel.READ_ONLY;
  }
}

/**
 * Get maximum impact level for a role
 */
export function getMaxImpactLevelForRole(role: AccountingRole): ImpactLevel {
  const roleMatrix = DEFAULT_AUTHORITY_MATRIX[role];
  let maxImpact = ImpactLevel.READ_ONLY;
  
  for (const permission of roleMatrix) {
    const impact = permissionLevelToImpactLevel(permission.level);
    const impactIndex = IMPACT_LEVEL_HIERARCHY.indexOf(impact);
    const maxIndex = IMPACT_LEVEL_HIERARCHY.indexOf(maxImpact);
    
    if (impactIndex > maxIndex) {
      maxImpact = impact;
    }
    
    // Check for critical operations
    if (permission.constraints?.canReverse || permission.constraints?.canExecute) {
      maxImpact = ImpactLevel.CRITICAL;
    }
  }
  
  return maxImpact;
}

/**
 * Check if a role can perform actions at a given impact level
 */
export function canPerformAtImpactLevel(
  role: AccountingRole,
  impactLevel: ImpactLevel
): boolean {
  const maxImpact = getMaxImpactLevelForRole(role);
  const maxIndex = IMPACT_LEVEL_HIERARCHY.indexOf(maxImpact);
  const requestedIndex = IMPACT_LEVEL_HIERARCHY.indexOf(impactLevel);
  
  return requestedIndex <= maxIndex;
}

// ====================================
// FUNCTION PERMISSIONS (AI Copilot Functions)
// ====================================

/**
 * Categories of functions the AI Copilot can perform
 */
export enum FunctionCategory {
  DATA_RETRIEVAL = 'data_retrieval',
  DATA_CREATION = 'data_creation',
  DATA_MODIFICATION = 'data_modification',
  DATA_DELETION = 'data_deletion',
  TRANSACTION_POSTING = 'transaction_posting',
  APPROVAL_WORKFLOW = 'approval_workflow',
  PAYMENT_EXECUTION = 'payment_execution',
  FINANCIAL_ANALYSIS = 'financial_analysis',
  REPORTING = 'reporting',
  SYSTEM_CONFIGURATION = 'system_configuration',
}

/**
 * Function permission definition for AI Copilot
 * Defines what permissions are required to execute a function
 */
export interface FunctionPermission {
  functionName: string;
  displayName: string;
  category: FunctionCategory;
  module: ModuleIdentifier;
  requiredPermissionLevel: PermissionLevel;
  requiredImpactLevel: ImpactLevel;
  requiresApproval: boolean; // Whether AI must get user confirmation
  requiresSecondaryApproval: boolean; // Whether action needs separate approver
  description: string;
  examples?: string[];
  specialConstraints?: {
    requiresReversalAuthority?: boolean;
    requiresPaymentExecutionAuthority?: boolean;
    requiresDeleteAuthority?: boolean;
  };
}

/**
 * Default function permissions for AI Copilot
 * This defines what the AI can do and what authority is required
 */
export const AI_FUNCTION_PERMISSIONS: Record<string, FunctionPermission> = {
  // Data Retrieval Functions
  get_invoices: {
    functionName: 'get_invoices',
    displayName: 'Get Invoices',
    category: FunctionCategory.DATA_RETRIEVAL,
    module: 'invoices',
    requiredPermissionLevel: PermissionLevel.READ,
    requiredImpactLevel: ImpactLevel.READ_ONLY,
    requiresApproval: false,
    requiresSecondaryApproval: false,
    description: 'Retrieve invoice data for viewing',
    examples: ['Show me all unpaid invoices', 'Get invoice #12345'],
  },
  
  get_bills: {
    functionName: 'get_bills',
    displayName: 'Get Bills',
    category: FunctionCategory.DATA_RETRIEVAL,
    module: 'bills',
    requiredPermissionLevel: PermissionLevel.READ,
    requiredImpactLevel: ImpactLevel.READ_ONLY,
    requiresApproval: false,
    requiresSecondaryApproval: false,
    description: 'Retrieve bill data for viewing',
    examples: ['Show me pending bills', 'Get bill #5678'],
  },
  
  get_financial_reports: {
    functionName: 'get_financial_reports',
    displayName: 'Get Financial Reports',
    category: FunctionCategory.REPORTING,
    module: 'reports',
    requiredPermissionLevel: PermissionLevel.READ,
    requiredImpactLevel: ImpactLevel.READ_ONLY,
    requiresApproval: false,
    requiresSecondaryApproval: false,
    description: 'Generate and view financial reports',
    examples: ['Show me the P&L for Q4', 'Generate balance sheet'],
  },
  
  // Data Creation Functions
  create_invoice: {
    functionName: 'create_invoice',
    displayName: 'Create Invoice',
    category: FunctionCategory.DATA_CREATION,
    module: 'invoices',
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredImpactLevel: ImpactLevel.CREATE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Create a new invoice in draft status',
    examples: ['Create an invoice for customer ABC for $5,000'],
  },
  
  create_bill: {
    functionName: 'create_bill',
    displayName: 'Create Bill',
    category: FunctionCategory.DATA_CREATION,
    module: 'bills',
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredImpactLevel: ImpactLevel.CREATE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Create a new bill in draft status',
    examples: ['Create a bill from vendor XYZ for $3,000'],
  },
  
  create_journal_entry: {
    functionName: 'create_journal_entry',
    displayName: 'Create Journal Entry',
    category: FunctionCategory.DATA_CREATION,
    module: 'journal_entries',
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredImpactLevel: ImpactLevel.CREATE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Create a new journal entry in draft status',
    examples: ['Create a journal entry to record depreciation'],
  },
  
  // Data Modification Functions
  update_invoice: {
    functionName: 'update_invoice',
    displayName: 'Update Invoice',
    category: FunctionCategory.DATA_MODIFICATION,
    module: 'invoices',
    requiredPermissionLevel: PermissionLevel.EDIT,
    requiredImpactLevel: ImpactLevel.MODIFY,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Modify an existing invoice',
    examples: ['Update invoice #12345 amount to $6,000'],
  },
  
  update_bill: {
    functionName: 'update_bill',
    displayName: 'Update Bill',
    category: FunctionCategory.DATA_MODIFICATION,
    module: 'bills',
    requiredPermissionLevel: PermissionLevel.EDIT,
    requiredImpactLevel: ImpactLevel.MODIFY,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Modify an existing bill',
    examples: ['Update bill #5678 to correct the amount'],
  },
  
  // Data Deletion Functions
  delete_invoice: {
    functionName: 'delete_invoice',
    displayName: 'Delete Invoice',
    category: FunctionCategory.DATA_DELETION,
    module: 'invoices',
    requiredPermissionLevel: PermissionLevel.DELETE,
    requiredImpactLevel: ImpactLevel.DELETE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Delete an invoice',
    examples: ['Delete draft invoice #12345'],
    specialConstraints: {
      requiresDeleteAuthority: true,
    },
  },
  
  delete_bill: {
    functionName: 'delete_bill',
    displayName: 'Delete Bill',
    category: FunctionCategory.DATA_DELETION,
    module: 'bills',
    requiredPermissionLevel: PermissionLevel.DELETE,
    requiredImpactLevel: ImpactLevel.DELETE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Delete a bill',
    examples: ['Delete bill #5678'],
    specialConstraints: {
      requiresDeleteAuthority: true,
    },
  },
  
  // Transaction Posting Functions
  post_journal_entry: {
    functionName: 'post_journal_entry',
    displayName: 'Post Journal Entry',
    category: FunctionCategory.TRANSACTION_POSTING,
    module: 'journal_entries',
    requiredPermissionLevel: PermissionLevel.POST,
    requiredImpactLevel: ImpactLevel.EXECUTE,
    requiresApproval: true,
    requiresSecondaryApproval: true,
    description: 'Post a journal entry to the general ledger',
    examples: ['Post journal entry #100'],
  },
  
  post_invoice: {
    functionName: 'post_invoice',
    displayName: 'Post Invoice',
    category: FunctionCategory.TRANSACTION_POSTING,
    module: 'invoices',
    requiredPermissionLevel: PermissionLevel.POST,
    requiredImpactLevel: ImpactLevel.EXECUTE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Post an invoice to accounts receivable',
    examples: ['Post invoice #12345'],
  },
  
  // Approval Workflow Functions
  approve_bill: {
    functionName: 'approve_bill',
    displayName: 'Approve Bill',
    category: FunctionCategory.APPROVAL_WORKFLOW,
    module: 'bills',
    requiredPermissionLevel: PermissionLevel.APPROVE,
    requiredImpactLevel: ImpactLevel.EXECUTE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Approve a bill for payment',
    examples: ['Approve bill #5678 for payment'],
  },
  
  approve_purchase_order: {
    functionName: 'approve_purchase_order',
    displayName: 'Approve Purchase Order',
    category: FunctionCategory.APPROVAL_WORKFLOW,
    module: 'purchase_orders',
    requiredPermissionLevel: PermissionLevel.APPROVE,
    requiredImpactLevel: ImpactLevel.EXECUTE,
    requiresApproval: true,
    requiresSecondaryApproval: false,
    description: 'Approve a purchase order',
    examples: ['Approve PO #1234'],
  },
  
  // Payment Execution Functions
  execute_vendor_payment: {
    functionName: 'execute_vendor_payment',
    displayName: 'Execute Vendor Payment',
    category: FunctionCategory.PAYMENT_EXECUTION,
    module: 'vendor_payments',
    requiredPermissionLevel: PermissionLevel.APPROVE,
    requiredImpactLevel: ImpactLevel.EXECUTE,
    requiresApproval: true,
    requiresSecondaryApproval: true,
    description: 'Execute an approved vendor payment',
    examples: ['Execute payment to vendor XYZ for $10,000'],
    specialConstraints: {
      requiresPaymentExecutionAuthority: true,
    },
  },
  
  // Critical Functions
  reverse_journal_entry: {
    functionName: 'reverse_journal_entry',
    displayName: 'Reverse Journal Entry',
    category: FunctionCategory.TRANSACTION_POSTING,
    module: 'journal_entries',
    requiredPermissionLevel: PermissionLevel.APPROVE,
    requiredImpactLevel: ImpactLevel.CRITICAL,
    requiresApproval: true,
    requiresSecondaryApproval: true,
    description: 'Reverse a posted journal entry',
    examples: ['Reverse journal entry #100'],
    specialConstraints: {
      requiresReversalAuthority: true,
    },
  },
};

/**
 * Check if a role can execute a specific AI function
 */
export function canExecuteFunction(
  role: AccountingRole,
  functionName: string
): { allowed: boolean; reason?: string; requiresApproval?: boolean } {
  const functionDef = AI_FUNCTION_PERMISSIONS[functionName];
  
  if (!functionDef) {
    return {
      allowed: false,
      reason: `Function '${functionName}' not found in permission matrix`,
    };
  }
  
  const roleMatrix = DEFAULT_AUTHORITY_MATRIX[role];
  const modulePermission = roleMatrix.find(p => p.module === functionDef.module);
  
  if (!modulePermission) {
    return {
      allowed: false,
      reason: `Role ${role} does not have access to module '${functionDef.module}'`,
    };
  }
  
  // Check permission level
  const hasPermission = permissionLevelIncludes(
    modulePermission.level,
    functionDef.requiredPermissionLevel
  );
  
  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Role ${role} has ${modulePermission.level} permission for ${functionDef.module}, but ${functionDef.requiredPermissionLevel} is required`,
    };
  }
  
  // Check special constraints
  if (functionDef.specialConstraints?.requiresReversalAuthority) {
    if (!modulePermission.constraints?.canReverse) {
      return {
        allowed: false,
        reason: `Role ${role} does not have reversal authority`,
      };
    }
  }
  
  if (functionDef.specialConstraints?.requiresPaymentExecutionAuthority) {
    if (!modulePermission.constraints?.canExecute) {
      return {
        allowed: false,
        reason: `Role ${role} does not have payment execution authority`,
      };
    }
  }
  
  if (functionDef.specialConstraints?.requiresDeleteAuthority) {
    if (modulePermission.constraints?.canDelete === false) {
      return {
        allowed: false,
        reason: `Role ${role} does not have delete authority`,
      };
    }
  }
  
  return {
    allowed: true,
    requiresApproval: functionDef.requiresApproval,
  };
}

/**
 * Get authority context for AI Copilot
 * This generates a human-readable description of what the user can/cannot do
 */
export function getAuthorityContextForAI(
  role: AccountingRole,
  userId: string,
  userName?: string
): string {
  const maxImpact = getMaxImpactLevelForRole(role);
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  
  let context = `USER AUTHORITY CONTEXT\n`;
  context += `======================\n\n`;
  context += `User: ${userName || userId}\n`;
  context += `Role: ${role}\n`;
  context += `Authority Level: ${11 - roleIndex}/11\n`;
  context += `Maximum Impact Level: ${maxImpact}\n\n`;
  
  context += `IMPORTANT OPERATING RULES:\n`;
  context += `1. You MUST propose a plan before executing ANY action\n`;
  context += `2. You MUST wait for explicit user approval before proceeding\n`;
  context += `3. You MUST respect the user's authority limitations\n`;
  context += `4. You CANNOT escalate your own privileges\n\n`;
  
  // Get available functions
  const availableFunctions: string[] = [];
  const restrictedFunctions: string[] = [];
  
  for (const [funcName, funcDef] of Object.entries(AI_FUNCTION_PERMISSIONS)) {
    const check = canExecuteFunction(role, funcName);
    if (check.allowed) {
      availableFunctions.push(`  ✓ ${funcDef.displayName} (${funcDef.category})`);
    } else {
      restrictedFunctions.push(`  ✗ ${funcDef.displayName}: ${check.reason}`);
    }
  }
  
  context += `ALLOWED FUNCTIONS (${availableFunctions.length}):\n`;
  context += availableFunctions.join('\n') + '\n\n';
  
  if (restrictedFunctions.length > 0) {
    context += `RESTRICTED FUNCTIONS (${restrictedFunctions.length}):\n`;
    context += restrictedFunctions.join('\n') + '\n\n';
  }
  
  // Add escalation path
  const escalationRole = getEscalationRole(role);
  if (escalationRole) {
    context += `For restricted actions, you may suggest: "This requires ${escalationRole} authority. Would you like me to notify them?"\n`;
  }
  
  return context;
}
