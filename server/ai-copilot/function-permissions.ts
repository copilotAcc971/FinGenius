/**
 * FUNCTION PERMISSION MAPPING LAYER
 * 
 * This module provides RBAC-based permission validation for all AI Copilot accounting functions.
 * It maps each function to the specific RBAC permissions required to execute it.
 * 
 * DESIGN PRINCIPLES:
 * - Each function maps to one or more RBAC permissions (e.g., 'invoices.create', 'journal_entries.post')
 * - Permission checks happen BEFORE function execution
 * - Professional denial messages guide users on what permissions they need
 * - Integrates with the standard RBAC system in server/rbac/
 * 
 * INTEGRATION POINTS:
 * - Uses RBAC permissions from server/rbac/permissions.ts
 * - Works with server/rbac/service.ts for permission checking
 * - Called by function-handlers.ts before executing any function
 * 
 * @module function-permissions
 * @version 1.0.0
 */

import { getUserPermissions } from '../rbac/service';

// ====================================
// PERMISSION REQUIREMENT DEFINITIONS
// ====================================

/**
 * Defines the permission requirements for a single function
 */
export interface FunctionPermissionRequirement {
  /** Function name from functions.ts */
  functionName: string;
  
  /** Required RBAC permissions (user must have ALL of these) */
  requiredPermissions: string[];
  
  /** Human-readable description of what the function does */
  description: string;
  
  /** Professional denial message shown when user lacks permissions */
  denialMessage: string;
  
  /** Whether this is a read-only function (for informational purposes) */
  isReadOnly: boolean;
  
  /** Whether this function modifies financial records */
  isFinanciallyImpactful: boolean;
}

/**
 * Complete permission mapping for all accounting functions
 * 
 * PERMISSION NAMING CONVENTION:
 * - Format: {module}.{action}
 * - Examples: invoices.create, journal_entries.post, reports.read
 * - See server/rbac/permissions.ts for full permission catalog
 */
export const FUNCTION_PERMISSION_MAP: Record<string, FunctionPermissionRequirement> = {
  
  // ========== READ-ONLY QUERY FUNCTIONS ==========
  
  show_outstanding_invoices: {
    functionName: 'show_outstanding_invoices',
    requiredPermissions: ['invoices.read'],
    description: 'View outstanding (unpaid) invoices',
    denialMessage: 'You do not have permission to view invoices. Please contact your administrator to request the "View Invoices" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  show_overdue_invoices: {
    functionName: 'show_overdue_invoices',
    requiredPermissions: ['invoices.read'],
    description: 'View overdue invoices',
    denialMessage: 'You do not have permission to view invoices. Please contact your administrator to request the "View Invoices" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  get_customer_balance: {
    functionName: 'get_customer_balance',
    requiredPermissions: ['customers.read'],
    description: 'View customer account balance',
    denialMessage: 'You do not have permission to view customer information. Please contact your administrator to request the "View Customers" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  list_customers: {
    functionName: 'list_customers',
    requiredPermissions: ['customers.read'],
    description: 'List all customers',
    denialMessage: 'You do not have permission to view customer information. Please contact your administrator to request the "View Customers" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  generate_profit_loss_report: {
    functionName: 'generate_profit_loss_report',
    requiredPermissions: ['reports.read'],
    description: 'Generate Profit & Loss report',
    denialMessage: 'You do not have permission to view financial reports. Please contact your administrator to request the "View Reports" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  generate_balance_sheet: {
    functionName: 'generate_balance_sheet',
    requiredPermissions: ['reports.read'],
    description: 'Generate Balance Sheet',
    denialMessage: 'You do not have permission to view financial reports. Please contact your administrator to request the "View Reports" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  show_recent_transactions: {
    functionName: 'show_recent_transactions',
    requiredPermissions: ['journal_entries.read'],
    description: 'View recent accounting transactions',
    denialMessage: 'You do not have permission to view journal entries. Please contact your administrator to request the "View Journal Entries" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  get_cash_flow_summary: {
    functionName: 'get_cash_flow_summary',
    requiredPermissions: ['reports.read'],
    description: 'View cash flow summary',
    denialMessage: 'You do not have permission to view financial reports. Please contact your administrator to request the "View Reports" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  list_bills: {
    functionName: 'list_bills',
    requiredPermissions: ['bills.read'],
    description: 'List bills (accounts payable)',
    denialMessage: 'You do not have permission to view bills. Please contact your administrator to request the "View Bills" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  // ========== DRAFT CREATION FUNCTIONS ==========
  
  draft_journal_entry: {
    functionName: 'draft_journal_entry',
    requiredPermissions: ['journal_entries.create'],
    description: 'Create draft journal entry (no financial impact until posted)',
    denialMessage: 'You do not have permission to create journal entries. Please contact your administrator to request the "Create Journal Entries" permission.',
    isReadOnly: false,
    isFinanciallyImpactful: false, // Drafts don't affect ledger
  },
  
  draft_invoice: {
    functionName: 'draft_invoice',
    requiredPermissions: ['invoices.create'],
    description: 'Create draft invoice (no financial impact until posted)',
    denialMessage: 'You do not have permission to create invoices. Please contact your administrator to request the "Create Invoices" permission.',
    isReadOnly: false,
    isFinanciallyImpactful: false, // Drafts don't affect ledger
  },
  
  draft_bill: {
    functionName: 'draft_bill',
    requiredPermissions: ['bills.create'],
    description: 'Create draft bill (no financial impact until posted)',
    denialMessage: 'You do not have permission to create bills. Please contact your administrator to request the "Create Bills" permission.',
    isReadOnly: false,
    isFinanciallyImpactful: false, // Drafts don't affect ledger
  },
  
  // ========== POSTING FUNCTIONS (HIGH IMPACT) ==========
  
  post_journal_entry: {
    functionName: 'post_journal_entry',
    requiredPermissions: ['journal_entries.post'],
    description: 'Post journal entry to ledger (creates permanent financial record)',
    denialMessage: 'You do not have permission to post journal entries to the ledger. This action requires the "Post Journal Entries" permission, which is typically restricted to accountants and financial controllers. Please contact your administrator for access.',
    isReadOnly: false,
    isFinanciallyImpactful: true, // Affects account balances
  },
  
  post_invoice: {
    functionName: 'post_invoice',
    requiredPermissions: ['journal_entries.post'],
    description: 'Post invoice to ledger (creates A/R and revenue journal entries)',
    denialMessage: 'You do not have permission to post invoices to the ledger. This action requires the "Post Journal Entries" permission, which is typically restricted to accountants and financial controllers. Posting an invoice creates permanent journal entries affecting Accounts Receivable and Revenue accounts. Please contact your administrator for access.',
    isReadOnly: false,
    isFinanciallyImpactful: true, // Creates journal entries
  },
  
  post_bill: {
    functionName: 'post_bill',
    requiredPermissions: ['journal_entries.post'],
    description: 'Post bill to ledger (creates A/P and expense journal entries)',
    denialMessage: 'You do not have permission to post bills to the ledger. This action requires the "Post Journal Entries" permission, which is typically restricted to accountants and financial controllers. Posting a bill creates permanent journal entries affecting Accounts Payable and Expense accounts. Please contact your administrator for access.',
    isReadOnly: false,
    isFinanciallyImpactful: true, // Creates journal entries
  },
  
  // ========== UTILITY FUNCTIONS ==========
  
  web_search: {
    functionName: 'web_search',
    requiredPermissions: [], // No permissions required - available to all users
    description: 'Search the web for accounting information',
    denialMessage: '', // Not used since no permissions required
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  web_fetch: {
    functionName: 'web_fetch',
    requiredPermissions: [], // No permissions required - available to all users
    description: 'Fetch content from a web URL',
    denialMessage: '', // Not used since no permissions required
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  process_document: {
    functionName: 'process_document',
    requiredPermissions: ['documents.read'],
    description: 'Extract data from document images using AI',
    denialMessage: 'You do not have permission to process documents. Please contact your administrator to request the "View Documents" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
  
  search_knowledge_base: {
    functionName: 'search_knowledge_base',
    requiredPermissions: ['documents.read'],
    description: 'Search knowledge base using semantic search',
    denialMessage: 'You do not have permission to search the knowledge base. Please contact your administrator to request the "View Documents" permission.',
    isReadOnly: true,
    isFinanciallyImpactful: false,
  },
};

// ====================================
// PERMISSION VALIDATION FUNCTIONS
// ====================================

/**
 * Result of permission validation check
 */
export interface PermissionValidationResult {
  /** Whether the user has permission to execute the function */
  allowed: boolean;
  
  /** Professional message explaining why permission was denied (if denied) */
  message?: string;
  
  /** The permissions that were required */
  requiredPermissions?: string[];
  
  /** The permissions the user actually has */
  userPermissions?: string[];
  
  /** Function metadata */
  functionMetadata?: FunctionPermissionRequirement;
}

/**
 * Validate if a user has permission to execute a specific function
 * 
 * This is the main entry point for permission checking. Call this BEFORE
 * executing any accounting function.
 * 
 * @param functionName - The name of the function to execute
 * @param userId - The user requesting execution
 * @param tenantId - The tenant context
 * @returns Validation result with allowed status and denial message if denied
 * 
 * @example
 * ```typescript
 * const validation = await validateFunctionPermission('post_journal_entry', userId, tenantId);
 * if (!validation.allowed) {
 *   return { error: validation.message };
 * }
 * // Proceed with function execution...
 * ```
 */
export async function validateFunctionPermission(
  functionName: string,
  userId: string,
  tenantId: string
): Promise<PermissionValidationResult> {
  // Get function metadata
  const metadata = FUNCTION_PERMISSION_MAP[functionName];
  
  // Unknown function - deny by default
  if (!metadata) {
    return {
      allowed: false,
      message: `Unknown function: ${functionName}. This function is not recognized by the permission system.`,
    };
  }
  
  // Functions with no required permissions are always allowed
  if (metadata.requiredPermissions.length === 0) {
    return {
      allowed: true,
      functionMetadata: metadata,
      requiredPermissions: [],
    };
  }
  
  // Get user's actual permissions from RBAC system
  const userPermissions = await getUserPermissions(userId, tenantId);
  
  // Check if user has all required permissions
  const missingPermissions = metadata.requiredPermissions.filter(
    required => !userPermissions.includes(required)
  );
  
  if (missingPermissions.length > 0) {
    // User is missing one or more required permissions
    return {
      allowed: false,
      message: metadata.denialMessage,
      requiredPermissions: metadata.requiredPermissions,
      userPermissions,
      functionMetadata: metadata,
    };
  }
  
  // User has all required permissions
  return {
    allowed: true,
    requiredPermissions: metadata.requiredPermissions,
    userPermissions,
    functionMetadata: metadata,
  };
}

/**
 * Check if a function requires any permissions
 * 
 * @param functionName - Function to check
 * @returns True if function requires permissions, false if open to all users
 */
export function requiresPermissions(functionName: string): boolean {
  const metadata = FUNCTION_PERMISSION_MAP[functionName];
  return metadata ? metadata.requiredPermissions.length > 0 : true;
}

/**
 * Check if a function is read-only (no modifications)
 * 
 * @param functionName - Function to check
 * @returns True if function only reads data
 */
export function isReadOnlyFunction(functionName: string): boolean {
  const metadata = FUNCTION_PERMISSION_MAP[functionName];
  return metadata ? metadata.isReadOnly : false;
}

/**
 * Check if a function has financial impact (affects ledger/balances)
 * 
 * @param functionName - Function to check
 * @returns True if function modifies financial records
 */
export function isFinanciallyImpactful(functionName: string): boolean {
  const metadata = FUNCTION_PERMISSION_MAP[functionName];
  return metadata ? metadata.isFinanciallyImpactful : true; // Assume impactful if unknown
}

/**
 * Get all functions available to a user based on their permissions
 * 
 * @param userId - User to check
 * @param tenantId - Tenant context
 * @returns Array of function names the user can execute
 */
export async function getAvailableFunctions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const userPermissions = await getUserPermissions(userId, tenantId);
  const availableFunctions: string[] = [];
  
  for (const [functionName, metadata] of Object.entries(FUNCTION_PERMISSION_MAP)) {
    // Functions with no requirements are available to everyone
    if (metadata.requiredPermissions.length === 0) {
      availableFunctions.push(functionName);
      continue;
    }
    
    // Check if user has all required permissions
    const hasAllPermissions = metadata.requiredPermissions.every(
      required => userPermissions.includes(required)
    );
    
    if (hasAllPermissions) {
      availableFunctions.push(functionName);
    }
  }
  
  return availableFunctions;
}

/**
 * Get function metadata
 * 
 * @param functionName - Function to lookup
 * @returns Function metadata or undefined if not found
 */
export function getFunctionMetadata(
  functionName: string
): FunctionPermissionRequirement | undefined {
  return FUNCTION_PERMISSION_MAP[functionName];
}

/**
 * Get a summary of permission requirements for all functions
 * Useful for documentation or admin interfaces
 * 
 * @returns Map of function names to their permission requirements
 */
export function getPermissionSummary(): Record<string, {
  permissions: string[];
  description: string;
  isReadOnly: boolean;
  isFinanciallyImpactful: boolean;
}> {
  const summary: Record<string, any> = {};
  
  for (const [functionName, metadata] of Object.entries(FUNCTION_PERMISSION_MAP)) {
    summary[functionName] = {
      permissions: metadata.requiredPermissions,
      description: metadata.description,
      isReadOnly: metadata.isReadOnly,
      isFinanciallyImpactful: metadata.isFinanciallyImpactful,
    };
  }
  
  return summary;
}

// ====================================
// PERMISSION CATEGORIES
// ====================================

/**
 * Get all functions that require a specific permission
 * 
 * @param permission - Permission to check (e.g., 'invoices.create')
 * @returns Array of function names that require this permission
 */
export function getFunctionsRequiringPermission(permission: string): string[] {
  const functions: string[] = [];
  
  for (const [functionName, metadata] of Object.entries(FUNCTION_PERMISSION_MAP)) {
    if (metadata.requiredPermissions.includes(permission)) {
      functions.push(functionName);
    }
  }
  
  return functions;
}

/**
 * Get all posting functions (functions that modify the ledger)
 * These require special 'post' permissions
 * 
 * @returns Array of posting function names
 */
export function getPostingFunctions(): string[] {
  return Object.entries(FUNCTION_PERMISSION_MAP)
    .filter(([_, metadata]) => metadata.isFinanciallyImpactful)
    .map(([functionName]) => functionName);
}

/**
 * Get all read-only functions (safe for any user)
 * 
 * @returns Array of read-only function names
 */
export function getReadOnlyFunctions(): string[] {
  return Object.entries(FUNCTION_PERMISSION_MAP)
    .filter(([_, metadata]) => metadata.isReadOnly)
    .map(([functionName]) => functionName);
}
