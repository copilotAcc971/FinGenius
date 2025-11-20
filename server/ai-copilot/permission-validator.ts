/**
 * FUNCTION PERMISSION VALIDATOR
 * 
 * This module provides centralized permission validation for all AI Copilot functions.
 * It maps each accounting function to its required permissions and validates
 * user authority before execution.
 * 
 * INTEGRATION POINTS:
 * - Imports from shared/authority-matrix.ts for role/permission definitions
 * - Used by websocket-server.ts to check permissions before function execution
 * - Works with plan-confirm-protocol.ts for action planning
 * 
 * VALIDATION FLOW:
 * 1. Function call requested by AI
 * 2. Lookup function metadata to get required permissions
 * 3. Check user's role-based permissions from authority matrix
 * 4. Verify special constraints (canPost, canApprove, canExecute, etc.)
 * 5. Return validation result with detailed reason if denied
 * 
 * @module permission-validator
 * @version 1.0.0
 */

import type { UserAuthorityContext } from './authority-context';
import { 
  AccountingRole, 
  ModuleIdentifier, 
  PermissionLevel, 
  permissionLevelIncludes,
  DEFAULT_AUTHORITY_MATRIX,
  getEscalationRole 
} from '../../shared/authority-matrix';

// ====================================
// FUNCTION METADATA DEFINITIONS
// ====================================

/**
 * Impact classification for functions
 */
export enum FunctionImpact {
  /** Read-only operations - no approval needed */
  READ_ONLY = 'READ_ONLY',
  
  /** Creates new records - requires approval */
  CREATE_DRAFT = 'CREATE_DRAFT',
  
  /** Posts/executes transactions - high impact */
  POST_EXECUTE = 'POST_EXECUTE',
  
  /** Critical operations - requires escalation */
  CRITICAL = 'CRITICAL',
}

/**
 * Function permission metadata
 */
export interface FunctionPermissionMetadata {
  /** Function name as defined in functions.ts */
  functionName: string;
  
  /** Impact level for user confirmation requirements */
  impact: FunctionImpact;
  
  /** Required RBAC module */
  requiredModule: ModuleIdentifier;
  
  /** Required permission level */
  requiredPermission: PermissionLevel;
  
  /** Additional constraints */
  constraints?: {
    requiresPost?: boolean;      // Needs canPost constraint
    requiresApprove?: boolean;   // Needs canApprove constraint
    requiresReverse?: boolean;   // Needs canReverse constraint
    requiresExecute?: boolean;   // Needs canExecute constraint
  };
  
  /** Human-readable description */
  description: string;
}

/**
 * Permission validation result
 */
export interface PermissionValidationResult {
  /** Whether user has permission */
  allowed: boolean;
  
  /** Reason for denial if not allowed */
  reason?: string;
  
  /** Suggested role for escalation */
  escalationRole?: AccountingRole;
  
  /** User's current role */
  userRole?: AccountingRole;
  
  /** Required permission level */
  requiredPermission?: PermissionLevel;
  
  /** User's permission level for module */
  userPermission?: PermissionLevel;
}

// ====================================
// FUNCTION PERMISSION CATALOG
// ====================================

/**
 * Complete catalog mapping all 19 accounting functions to their permission requirements
 */
export const FUNCTION_PERMISSION_CATALOG: Record<string, FunctionPermissionMetadata> = {
  // ========== READ-ONLY FUNCTIONS (9 functions) ==========
  
  show_outstanding_invoices: {
    functionName: 'show_outstanding_invoices',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.READ,
    description: 'View outstanding invoices',
  },
  
  show_overdue_invoices: {
    functionName: 'show_overdue_invoices',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.READ,
    description: 'View overdue invoices',
  },
  
  get_customer_balance: {
    functionName: 'get_customer_balance',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'customers',
    requiredPermission: PermissionLevel.READ,
    description: 'Get customer balance',
  },
  
  list_customers: {
    functionName: 'list_customers',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'customers',
    requiredPermission: PermissionLevel.READ,
    description: 'List all customers',
  },
  
  generate_profit_loss_report: {
    functionName: 'generate_profit_loss_report',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Generate Profit & Loss report',
  },
  
  generate_balance_sheet: {
    functionName: 'generate_balance_sheet',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Generate Balance Sheet',
  },
  
  show_recent_transactions: {
    functionName: 'show_recent_transactions',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.READ,
    description: 'View recent transactions',
  },
  
  get_cash_flow_summary: {
    functionName: 'get_cash_flow_summary',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Get cash flow summary',
  },
  
  list_bills: {
    functionName: 'list_bills',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'bills',
    requiredPermission: PermissionLevel.READ,
    description: 'List bills/payables',
  },
  
  // ========== DRAFT CREATION FUNCTIONS (3 functions) ==========
  
  draft_journal_entry: {
    functionName: 'draft_journal_entry',
    impact: FunctionImpact.CREATE_DRAFT,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create draft journal entry',
  },
  
  draft_invoice: {
    functionName: 'draft_invoice',
    impact: FunctionImpact.CREATE_DRAFT,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create draft invoice',
  },
  
  draft_bill: {
    functionName: 'draft_bill',
    impact: FunctionImpact.CREATE_DRAFT,
    requiredModule: 'bills',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create draft bill',
  },
  
  // ========== POST/EXECUTE FUNCTIONS (3 functions) ==========
  
  post_journal_entry: {
    functionName: 'post_journal_entry',
    impact: FunctionImpact.POST_EXECUTE,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.POST,
    constraints: {
      requiresPost: true,
    },
    description: 'Post journal entry to ledger',
  },
  
  post_invoice: {
    functionName: 'post_invoice',
    impact: FunctionImpact.POST_EXECUTE,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.POST,
    constraints: {
      requiresPost: true, // Posting invoice creates journal entries
    },
    description: 'Post invoice to ledger',
  },
  
  post_bill: {
    functionName: 'post_bill',
    impact: FunctionImpact.POST_EXECUTE,
    requiredModule: 'bills',
    requiredPermission: PermissionLevel.POST,
    constraints: {
      requiresPost: true, // Posting bill creates journal entries
    },
    description: 'Post bill to ledger',
  },
  
  // ========== UTILITY/EXTERNAL FUNCTIONS (4 functions) ==========
  
  web_search: {
    functionName: 'web_search',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'reports', // Using reports as a proxy for general access
    requiredPermission: PermissionLevel.READ,
    description: 'Search the web for information',
  },
  
  web_fetch: {
    functionName: 'web_fetch',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Fetch content from a URL',
  },
  
  process_document: {
    functionName: 'process_document',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'documents',
    requiredPermission: PermissionLevel.READ,
    description: 'Extract data from document using AI vision',
  },
  
  search_knowledge_base: {
    functionName: 'search_knowledge_base',
    impact: FunctionImpact.READ_ONLY,
    requiredModule: 'documents',
    requiredPermission: PermissionLevel.READ,
    description: 'Search knowledge base semantically',
  },
};

// ====================================
// PERMISSION VALIDATION FUNCTIONS
// ====================================

/**
 * Validate if a user has permission to execute a specific function
 * 
 * This is the main entry point for permission checking used by the websocket server
 * 
 * @param functionName - The function to execute
 * @param authorityContext - User's authority context
 * @returns Validation result with detailed reason if denied
 */
export function validateFunctionPermission(
  functionName: string,
  authorityContext: UserAuthorityContext
): PermissionValidationResult {
  // Get function metadata
  const metadata = FUNCTION_PERMISSION_CATALOG[functionName];
  
  if (!metadata) {
    return {
      allowed: false,
      reason: `Unknown function: ${functionName}`,
      userRole: authorityContext.userRole,
    };
  }
  
  // READ-ONLY functions are always allowed
  if (metadata.impact === FunctionImpact.READ_ONLY) {
    return {
      allowed: true,
      userRole: authorityContext.userRole,
    };
  }
  
  // Get user's permissions for the required module
  const rolePermissions = DEFAULT_AUTHORITY_MATRIX[authorityContext.userRole];
  const modulePermission = rolePermissions.find(
    p => p.module === metadata.requiredModule
  );
  
  if (!modulePermission) {
    return {
      allowed: false,
      reason: `Your role (${authorityContext.userRole}) does not have access to ${metadata.requiredModule}`,
      userRole: authorityContext.userRole,
      escalationRole: getEscalationRole(authorityContext.userRole) || undefined,
    };
  }
  
  // Check if user's permission level is sufficient
  const hasRequiredLevel = permissionLevelIncludes(
    modulePermission.level,
    metadata.requiredPermission
  );
  
  if (!hasRequiredLevel) {
    return {
      allowed: false,
      reason: `Requires '${metadata.requiredPermission}' permission for ${metadata.requiredModule}, but you have '${modulePermission.level}'`,
      userRole: authorityContext.userRole,
      userPermission: modulePermission.level,
      requiredPermission: metadata.requiredPermission,
      escalationRole: getEscalationRole(authorityContext.userRole) || undefined,
    };
  }
  
  // Check special constraints if required
  if (metadata.constraints) {
    // Check canPost constraint
    if (metadata.constraints.requiresPost && !authorityContext.canPost) {
      return {
        allowed: false,
        reason: 'Posting to ledger requires Accountant authority or higher',
        userRole: authorityContext.userRole,
        escalationRole: AccountingRole.ACCOUNTANT,
      };
    }
    
    // Check canApprove constraint
    if (metadata.constraints.requiresApprove && !authorityContext.canApprove) {
      return {
        allowed: false,
        reason: 'Approval requires Senior Accountant authority or higher',
        userRole: authorityContext.userRole,
        escalationRole: AccountingRole.SENIOR_ACCOUNTANT,
      };
    }
    
    // Check canReverse constraint
    if (metadata.constraints.requiresReverse && !authorityContext.canReverse) {
      return {
        allowed: false,
        reason: 'Reversing entries requires Controller or CFO authority',
        userRole: authorityContext.userRole,
        escalationRole: AccountingRole.CONTROLLER,
      };
    }
    
    // Check canExecute constraint
    if (metadata.constraints.requiresExecute && !authorityContext.canExecutePayments) {
      return {
        allowed: false,
        reason: 'Executing payments requires CFO authority',
        userRole: authorityContext.userRole,
        escalationRole: AccountingRole.CFO,
      };
    }
  }
  
  // All checks passed
  return {
    allowed: true,
    userRole: authorityContext.userRole,
    userPermission: modulePermission.level,
    requiredPermission: metadata.requiredPermission,
  };
}

/**
 * Get function metadata by name
 * 
 * @param functionName - Function to lookup
 * @returns Function metadata or undefined if not found
 */
export function getFunctionMetadata(functionName: string): FunctionPermissionMetadata | undefined {
  return FUNCTION_PERMISSION_CATALOG[functionName];
}

/**
 * Check if a function is read-only (no approval needed)
 * 
 * @param functionName - Function to check
 * @returns True if function is read-only
 */
export function isReadOnlyFunction(functionName: string): boolean {
  const metadata = FUNCTION_PERMISSION_CATALOG[functionName];
  return metadata?.impact === FunctionImpact.READ_ONLY;
}

/**
 * Get all functions available to a specific role
 * 
 * @param userRole - User's accounting role
 * @returns Array of function names the user can execute
 */
export function getAvailableFunctions(userRole: AccountingRole): string[] {
  const available: string[] = [];
  
  for (const [functionName, metadata] of Object.entries(FUNCTION_PERMISSION_CATALOG)) {
    // Create a minimal authority context for checking
    const mockContext: UserAuthorityContext = {
      userId: '',
      tenantId: '',
      userRole,
      permissions: [],
      canPost: [AccountingRole.ACCOUNTANT, AccountingRole.SENIOR_ACCOUNTANT, AccountingRole.ADMIN, AccountingRole.CONTROLLER, AccountingRole.CFO, AccountingRole.OWNER].includes(userRole),
      canApprove: [AccountingRole.SENIOR_ACCOUNTANT, AccountingRole.ADMIN, AccountingRole.CONTROLLER, AccountingRole.CFO, AccountingRole.OWNER].includes(userRole),
      canReverse: [AccountingRole.CONTROLLER, AccountingRole.CFO, AccountingRole.OWNER].includes(userRole),
      canExecutePayments: [AccountingRole.CFO, AccountingRole.OWNER].includes(userRole),
    };
    
    const validation = validateFunctionPermission(functionName, mockContext);
    if (validation.allowed) {
      available.push(functionName);
    }
  }
  
  return available;
}

/**
 * Generate a permission summary for debugging/logging
 * 
 * @param validation - Validation result
 * @returns Human-readable summary string
 */
export function formatValidationResult(validation: PermissionValidationResult): string {
  if (validation.allowed) {
    return `✓ Permission granted (${validation.userRole})`;
  }
  
  let summary = `✗ Permission denied: ${validation.reason}`;
  if (validation.escalationRole) {
    summary += ` | Escalate to: ${validation.escalationRole}`;
  }
  
  return summary;
}
