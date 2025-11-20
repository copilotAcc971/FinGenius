/**
 * PLAN & CONFIRM PROTOCOL
 * 
 * This module implements the "Entry-Level Employee" persona system prompt and 
 * strict action planning protocol for the AI Copilot assistant.
 * 
 * CORE PRINCIPLES:
 * 1. AI must operate as an Entry-Level Employee seeking approval
 * 2. All mutating actions require explicit numbered planning and Boolean confirmation
 * 3. AI must check user permissions before proposing restricted actions
 * 4. Transparency in what will be done before execution
 * 5. Clear communication of authority boundaries
 * 
 * PROTOCOL FLOW:
 * 
 *  User Request
 *       ↓
 *  AI analyzes intent & checks permissions
 *       ↓
 *  ┌─────────────────────────────────────┐
 *  │   Read-Only Query?                   │
 *  └─────────────────────────────────────┘
 *       │                    │
 *      YES                  NO
 *       │                    │
 *  Execute immediately   Check Authority
 *       ↓                    ↓
 *  Return results    ┌──────────────────┐
 *                    │ User Authorized? │
 *                    └──────────────────┘
 *                         │           │
 *                        YES         NO
 *                         │           │
 *                    Present Plan  Apologize
 *                    (numbered steps) Explain
 *                         ↓         restriction
 *                    Request Approval   ↓
 *                         ↓           Return
 *                    ┌─────────┐
 *                    │ Approved?│
 *                    └─────────┘
 *                       │    │
 *                      YES  NO
 *                       │    │
 *                    Execute Cancel
 *                       ↓    ↓
 *                    Confirm Return
 * 
 * @module plan-confirm-protocol
 * @author Copilot Accountant AI Team
 * @version 2.0.0
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { 
  DEFAULT_AUTHORITY_MATRIX, 
  AccountingRole,
  ModuleIdentifier,
  PermissionLevel,
  permissionLevelIncludes 
} from '../../shared/authority-matrix';

// ====================================
// TYPE DEFINITIONS
// ====================================

/**
 * Classification of function calls by their impact level
 */
export enum ActionImpactLevel {
  /** Read-only operations - no approval needed */
  READ_ONLY = 'READ_ONLY',
  
  /** Creates new records - requires approval */
  CREATE = 'CREATE',
  
  /** Modifies existing records - requires approval */
  MODIFY = 'MODIFY',
  
  /** Deletes or voids records - requires approval + special warning */
  DELETE = 'DELETE',
  
  /** Posts to ledger or executes payments - requires approval + double-check */
  EXECUTE = 'EXECUTE',
  
  /** Critical operations (reversals, large payments) - requires approval + escalation warning */
  CRITICAL = 'CRITICAL'
}

/**
 * Function metadata for permission checking and planning
 */
export interface FunctionMetadata {
  /** Function name as defined in functions.ts */
  name: string;
  
  /** Impact level determines approval requirements */
  impactLevel: ActionImpactLevel;
  
  /** Required permission module (maps to RBAC) */
  requiredModule?: ModuleIdentifier;
  
  /** Required permission level */
  requiredPermission?: PermissionLevel;
  
  /** Additional constraints that must be checked */
  requiresConstraint?: 'canDelete' | 'canPost' | 'canReverse' | 'canApprove' | 'canExecute';
  
  /** Human-readable description of what this function does */
  description: string;
  
  /** Example plan steps for this action */
  examplePlanSteps?: string[];
}

/**
 * Authority check result
 */
export interface AuthorityCheckResult {
  /** Whether user has permission */
  authorized: boolean;
  
  /** User's role */
  userRole?: AccountingRole;
  
  /** Required permission level for this action */
  requiredLevel?: PermissionLevel;
  
  /** User's permission level for this module */
  userLevel?: PermissionLevel;
  
  /** Reason for denial if not authorized */
  denialReason?: string;
  
  /** Suggested escalation role if denied */
  escalationRole?: AccountingRole;
}

/**
 * Action plan structure
 */
export interface ActionPlan {
  /** Numbered steps describing what will happen */
  steps: string[];
  
  /** Function to be called */
  functionName: string;
  
  /** Arguments for the function */
  args: Record<string, any>;
  
  /** Impact level of this action */
  impactLevel: ActionImpactLevel;
  
  /** Risk warnings for the user */
  warnings?: string[];
  
  /** Expected outcome after execution */
  expectedOutcome: string;
}

// ====================================
// FUNCTION METADATA CATALOG
// ====================================

/**
 * Complete catalog of all accounting functions with their metadata
 * This maps each function to its authorization requirements and impact level
 */
export const FUNCTION_METADATA_CATALOG: Record<string, FunctionMetadata> = {
  // READ-ONLY FUNCTIONS (No approval needed)
  show_outstanding_invoices: {
    name: 'show_outstanding_invoices',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.READ,
    description: 'Retrieve and display unpaid invoices',
  },
  
  show_overdue_invoices: {
    name: 'show_overdue_invoices',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.READ,
    description: 'Retrieve and display overdue invoices',
  },
  
  get_customer_balance: {
    name: 'get_customer_balance',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'customers',
    requiredPermission: PermissionLevel.READ,
    description: 'Get current outstanding balance for a customer',
  },
  
  list_customers: {
    name: 'list_customers',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'customers',
    requiredPermission: PermissionLevel.READ,
    description: 'List all customers in the system',
  },
  
  generate_profit_loss_report: {
    name: 'generate_profit_loss_report',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Generate Profit & Loss statement for a date range',
  },
  
  generate_balance_sheet: {
    name: 'generate_balance_sheet',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Generate Balance Sheet as of a specific date',
  },
  
  show_recent_transactions: {
    name: 'show_recent_transactions',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.READ,
    description: 'Show recent journal entries',
  },
  
  get_cash_flow_summary: {
    name: 'get_cash_flow_summary',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'reports',
    requiredPermission: PermissionLevel.READ,
    description: 'Get cash flow summary for a date range',
  },
  
  list_bills: {
    name: 'list_bills',
    impactLevel: ActionImpactLevel.READ_ONLY,
    requiredModule: 'bills',
    requiredPermission: PermissionLevel.READ,
    description: 'List bills filtered by status',
  },
  
  // MUTATING FUNCTIONS (Require approval)
  create_invoice: {
    name: 'create_invoice',
    impactLevel: ActionImpactLevel.CREATE,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create a new customer invoice',
    examplePlanSteps: [
      'Create invoice for [Customer Name]',
      'Add line items: [Item descriptions with quantities and rates]',
      'Set due date to [Date]',
      'Calculate total amount: [Amount]',
      'Save invoice with status "Draft"'
    ]
  },
  
  record_payment: {
    name: 'record_payment',
    impactLevel: ActionImpactLevel.EXECUTE,
    requiredModule: 'customer_payments',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Record a payment received from customer',
    examplePlanSteps: [
      'Record payment of [Amount] for Invoice #[Number]',
      'Set payment date to [Date]',
      'Record payment method as [Method]',
      'Update invoice status to "Paid" or "Partial"',
      'Post payment to accounts receivable'
    ]
  },
  
  // DRAFT FUNCTIONS (Safe - no financial impact until posted)
  draft_journal_entry: {
    name: 'draft_journal_entry',
    impactLevel: ActionImpactLevel.CREATE,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create a draft journal entry for review',
    examplePlanSteps: [
      'Validate that debits and credits balance',
      'Create draft journal entry with description: [Description]',
      'Add journal entry legs (debits and credits)',
      'Save with status "Draft" (no financial impact)',
      'Entry can be reviewed and posted later by authorized personnel'
    ]
  },
  
  draft_invoice: {
    name: 'draft_invoice',
    impactLevel: ActionImpactLevel.CREATE,
    requiredModule: 'invoices',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create a draft invoice for review',
    examplePlanSteps: [
      'Create invoice for customer: [Customer Name]',
      'Add line items with quantities and rates',
      'Calculate total amount: [Amount]',
      'Set due date to [Date]',
      'Save with status "Draft" (no journal entries created)',
      'Invoice can be reviewed and posted later'
    ]
  },
  
  draft_bill: {
    name: 'draft_bill',
    impactLevel: ActionImpactLevel.CREATE,
    requiredModule: 'bills',
    requiredPermission: PermissionLevel.WRITE,
    description: 'Create a draft bill (vendor invoice) for review',
    examplePlanSteps: [
      'Create bill for vendor: [Vendor Name]',
      'Add line items with quantities and unit prices',
      'Calculate total amount: [Amount]',
      'Set due date to [Date]',
      'Save with status "Draft" (no journal entries created)',
      'Bill can be reviewed and posted later'
    ]
  },
  
  // POST FUNCTIONS (Financial impact - requires posting authority)
  post_journal_entry: {
    name: 'post_journal_entry',
    impactLevel: ActionImpactLevel.EXECUTE,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.WRITE,
    requiresConstraint: 'canPost',
    description: 'Post a draft journal entry to the general ledger',
    examplePlanSteps: [
      'Retrieve draft journal entry #[Number]',
      'Validate entry is balanced and complete',
      'Update status from "Draft" to "Posted"',
      'Update account balances in general ledger',
      'Record posting timestamp and user',
      'This action creates a permanent financial record'
    ]
  },
  
  post_invoice: {
    name: 'post_invoice',
    impactLevel: ActionImpactLevel.EXECUTE,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.WRITE,
    requiresConstraint: 'canPost',
    description: 'Post a draft invoice to the ledger',
    examplePlanSteps: [
      'Retrieve draft invoice #[Number]',
      'Create journal entries:',
      '  - Debit: Accounts Receivable [Amount]',
      '  - Credit: Revenue [Amount]',
      'Update invoice status to "Sent"',
      'Update account balances in general ledger',
      'This action creates permanent financial records'
    ]
  },
  
  post_bill: {
    name: 'post_bill',
    impactLevel: ActionImpactLevel.EXECUTE,
    requiredModule: 'journal_entries',
    requiredPermission: PermissionLevel.WRITE,
    requiresConstraint: 'canPost',
    description: 'Post a draft bill to the ledger',
    examplePlanSteps: [
      'Retrieve draft bill #[Number]',
      'Create journal entries:',
      '  - Debit: Expense [Amount]',
      '  - Credit: Accounts Payable [Amount]',
      'Update bill status to "Unpaid"',
      'Update account balances in general ledger',
      'This action creates permanent financial records'
    ]
  },
};

// ====================================
// ENTRY-LEVEL EMPLOYEE PERSONA
// ====================================

/**
 * Core persona definition for the AI assistant
 * This establishes the fundamental behavioral framework
 */
export const ENTRY_LEVEL_EMPLOYEE_PERSONA = `
You are an Entry-Level Employee at an accounting firm, working as an AI Accounting Assistant.

**Your Core Identity:**
- You are helpful, eager to learn, and professional
- You have technical accounting knowledge but limited authority
- You ALWAYS seek approval before taking actions that change data
- You respect the chain of command and authority boundaries
- You communicate clearly and transparently about what you can and cannot do

**Your Authority Level:**
- You can READ and REPORT on financial data without approval
- You CANNOT create, modify, delete, or execute transactions without explicit approval
- You understand that your role is to prepare and recommend, not to execute unilaterally
- When you lack authority, you acknowledge it professionally and explain why

**Your Communication Style:**
- Professional but conversational (you're a helpful colleague, not a robot)
- Clear and concise - respect the user's time
- Transparent about limitations and next steps
- Use natural language, avoid over-explaining unless asked

**Critical Rules You MUST Follow:**
1. Never execute mutating actions without presenting a plan and getting Boolean confirmation
2. Always check if the user has permission before proposing restricted actions
3. Present plans as numbered steps showing exactly what will happen
4. Be honest when you don't have authority or information
5. When denied permission, apologize professionally and suggest escalation if appropriate
`.trim();

// ====================================
// ACTION PLANNING FORMAT
// ====================================

/**
 * Template for presenting action plans to users
 */
export const ACTION_PLAN_TEMPLATE = `
Before I proceed, let me confirm what I'll do:

**Action Plan:**
{NUMBERED_STEPS}

**Expected Outcome:**
{EXPECTED_OUTCOME}

{WARNINGS}

**May I proceed with this action?** (Please confirm Yes/No)
`.trim();

/**
 * Generates a formatted action plan for user approval
 */
export function formatActionPlan(plan: ActionPlan): string {
  const numberedSteps = plan.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
  
  let template = ACTION_PLAN_TEMPLATE
    .replace('{NUMBERED_STEPS}', numberedSteps)
    .replace('{EXPECTED_OUTCOME}', plan.expectedOutcome);
  
  if (plan.warnings && plan.warnings.length > 0) {
    const warningText = plan.warnings
      .map(w => `⚠️  ${w}`)
      .join('\n');
    template = template.replace('{WARNINGS}', `\n**Warnings:**\n${warningText}\n`);
  } else {
    template = template.replace('{WARNINGS}', '');
  }
  
  return template;
}

// ====================================
// AUTHORITY AWARENESS
// ====================================

/**
 * Checks if a user has authority to perform an action
 * This integrates with the RBAC authority matrix
 * 
 * @param userRole - The user's accounting role
 * @param functionName - The function they want to execute
 * @returns Authorization check result
 */
export function checkUserAuthority(
  userRole: AccountingRole,
  functionName: string
): AuthorityCheckResult {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  if (!metadata) {
    return {
      authorized: false,
      denialReason: `Unknown function: ${functionName}`,
    };
  }
  
  // Read-only functions are always allowed
  if (metadata.impactLevel === ActionImpactLevel.READ_ONLY) {
    return { authorized: true, userRole };
  }
  
  // Check if module and permission are defined
  if (!metadata.requiredModule || !metadata.requiredPermission) {
    // If not defined, assume it needs approval but don't block
    return { 
      authorized: true, 
      userRole,
      requiredLevel: metadata.requiredPermission 
    };
  }
  
  // Get user's permissions for this module from authority matrix
  const rolePermissions = DEFAULT_AUTHORITY_MATRIX[userRole];
  const modulePermission = rolePermissions.find(
    p => p.module === metadata.requiredModule
  );
  
  if (!modulePermission) {
    return {
      authorized: false,
      userRole,
      denialReason: `Your role (${userRole}) does not have access to ${metadata.requiredModule}`,
      escalationRole: getHigherRole(userRole),
    };
  }
  
  // Check if user's permission level is sufficient
  const hasPermission = permissionLevelIncludes(
    modulePermission.level,
    metadata.requiredPermission
  );
  
  if (!hasPermission) {
    return {
      authorized: false,
      userRole,
      requiredLevel: metadata.requiredPermission,
      userLevel: modulePermission.level,
      denialReason: `This action requires ${metadata.requiredPermission} permission, but you have ${modulePermission.level}`,
      escalationRole: getHigherRole(userRole),
    };
  }
  
  // Check for special constraints if required
  if (metadata.requiresConstraint && modulePermission.constraints) {
    const hasConstraint = modulePermission.constraints[metadata.requiresConstraint];
    
    if (!hasConstraint) {
      return {
        authorized: false,
        userRole,
        denialReason: `This action requires special permission (${metadata.requiresConstraint}) that your role doesn't have`,
        escalationRole: getHigherRole(userRole),
      };
    }
  }
  
  return {
    authorized: true,
    userRole,
    userLevel: modulePermission.level,
    requiredLevel: metadata.requiredPermission,
  };
}

/**
 * Gets the next higher role in the hierarchy for escalation suggestions
 */
function getHigherRole(currentRole: AccountingRole): AccountingRole | undefined {
  const hierarchy = [
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
  ];
  
  const currentIndex = hierarchy.indexOf(currentRole);
  if (currentIndex > 0) {
    return hierarchy[currentIndex - 1];
  }
  
  return undefined;
}

// ====================================
// RESPONSE TEMPLATES
// ====================================

/**
 * Response template when user is authorized and action needs approval
 */
export function generateAuthorizedPlanResponse(
  functionName: string,
  args: Record<string, any>,
  context: { userRole: AccountingRole }
): string {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  if (!metadata) {
    return "I'm not sure how to proceed with this action. Could you provide more details?";
  }
  
  // Build action plan
  const plan: ActionPlan = {
    steps: metadata.examplePlanSteps || [
      `Execute ${metadata.description}`,
      'Update system records',
      'Confirm completion'
    ],
    functionName,
    args,
    impactLevel: metadata.impactLevel,
    expectedOutcome: `The ${metadata.description.toLowerCase()} will be completed successfully.`,
  };
  
  // Add warnings based on impact level
  if (metadata.impactLevel === ActionImpactLevel.CRITICAL) {
    plan.warnings = [
      'This is a critical operation that affects posted financial records',
      'This action may require review by senior accounting staff',
    ];
  } else if (metadata.impactLevel === ActionImpactLevel.EXECUTE) {
    plan.warnings = [
      'This will post transactions to the general ledger',
      'This action cannot be easily undone',
    ];
  } else if (metadata.impactLevel === ActionImpactLevel.DELETE) {
    plan.warnings = [
      'This will permanently remove data from the system',
      'Please ensure you have a backup if needed',
    ];
  }
  
  return formatActionPlan(plan);
}

/**
 * Response template when user is NOT authorized
 */
export function generateUnauthorizedResponse(
  functionName: string,
  checkResult: AuthorityCheckResult
): string {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  if (!metadata) {
    return "I apologize, but I cannot perform that action as it's not recognized in my capabilities.";
  }
  
  let response = `I understand you'd like me to ${metadata.description.toLowerCase()}, but I need to let you know about a permission issue.\n\n`;
  
  response += `**Permission Issue:**\n`;
  response += `${checkResult.denialReason}\n\n`;
  
  if (checkResult.escalationRole) {
    response += `**Next Steps:**\n`;
    response += `This action requires a ${checkResult.escalationRole} or higher. `;
    response += `Please contact someone with that role to complete this task.\n\n`;
  }
  
  response += `**What I Can Help With:**\n`;
  response += `I can still help you prepare information, run reports, or answer questions about this topic. `;
  response += `Would you like me to do that instead?`;
  
  return response;
}

/**
 * Formats an authority denial message when user lacks permission
 */
export function formatAuthorityDenial(
  functionName: string,
  userRole: string,
  reason: string,
  escalationRole?: string
): string {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  let response = `I apologize, but I cannot proceed with this action due to permission restrictions.\n\n`;
  
  response += `**Issue:**\n${reason}\n\n`;
  
  if (escalationRole) {
    response += `**Next Steps:**\n`;
    response += `This action requires ${escalationRole} authority or higher. `;
    response += `Please contact someone with that role to complete this task.\n\n`;
  }
  
  response += `**What I Can Help With:**\n`;
  response += `I can still assist you with information, reports, or other tasks within your current permissions. `;
  response += `Would you like me to help with something else?`;
  
  return response;
}

/**
 * Response template when request needs clarification
 */
export function generateClarificationResponse(
  missingInfo: string[]
): string {
  let response = "I'd be happy to help with that! To proceed, I need a bit more information:\n\n";
  
  missingInfo.forEach((info, index) => {
    response += `${index + 1}. ${info}\n`;
  });
  
  response += `\nCould you provide these details?`;
  
  return response;
}

/**
 * Response template for successful completion
 */
export function generateCompletionResponse(
  functionName: string,
  result: any
): string {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  if (!metadata) {
    return "The action has been completed successfully.";
  }
  
  let response = `✅ **Action Completed Successfully**\n\n`;
  response += `I've ${metadata.description.toLowerCase()}.\n\n`;
  
  // Add context-specific summary based on result
  if (result.id) {
    response += `**Reference:** ${result.id}\n`;
  }
  
  if (result.amount || result.total) {
    response += `**Amount:** $${(result.amount || result.total).toFixed(2)}\n`;
  }
  
  response += `\nIs there anything else you'd like me to help with?`;
  
  return response;
}

// ====================================
// PROTOCOL INSTRUCTIONS FOR SYSTEM PROMPT
// ====================================

/**
 * Complete system instructions implementing Plan & Confirm protocol
 * This is used as the system prompt for the AI Copilot
 */
export const PLAN_CONFIRM_PROTOCOL_INSTRUCTIONS = `
${ENTRY_LEVEL_EMPLOYEE_PERSONA}

**Your Operating Protocol - CRITICAL RULES:**

**RULE 1: Classification of Actions**
Every request falls into one of these categories:
- READ-ONLY: Show data, generate reports, answer questions → Execute immediately
- MUTATING: Create, modify, delete, or execute transactions → Require approval

**RULE 2: For READ-ONLY Requests**
1. Execute the function immediately
2. Present results clearly and concisely
3. Offer related insights if helpful

**RULE 3: For MUTATING Requests - THE PLAN & CONFIRM PROTOCOL**
You MUST follow this exact sequence:

Step 1: Check Authority
- Verify the user has permission for this action
- If NO permission → Use the "Unauthorized Response" format
- If YES permission → Proceed to Step 2

Step 2: Present Numbered Plan
- List EXACTLY what will happen in numbered steps (1., 2., 3., etc.)
- Include specific details (amounts, dates, names)
- State the expected outcome
- Add warnings if this is risky (deletes, posts to ledger, etc.)

Step 3: Request Explicit Approval
- End with: "May I proceed with this action? (Please confirm Yes/No)"
- STOP and WAIT for user response
- Do NOT proceed without clear confirmation

Step 4: Execute Only After Confirmation
- If user confirms (Yes/Approved/Go ahead) → Execute function
- If user declines (No/Cancel/Wait) → Acknowledge and ask what they'd like instead
- If unclear → Ask for clarification

**RULE 4: When You Lack Information**
If the user's request is missing details you need:
1. List what information you need (numbered list)
2. Ask the user to provide it
3. Wait for their response

**RULE 5: When You Don't Know Something**
Be honest. Say:
"I don't have that information, but I can [suggest alternative]" or
"That's outside my current capabilities, but someone with [role] access could help with that"

**Examples of Correct Behavior:**

**Example 1 - Read-Only Request:**
User: "Show me overdue invoices"
You: "I'll pull up your overdue invoices. [executes immediately]
You have 3 overdue invoices totaling $8,450. The oldest is Invoice #1234 from Acme Corp, due 15 days ago for $3,200."

**Example 2 - Mutating Request (Authorized):**
User: "Create an invoice for Acme Corp"
You: "I can help create that invoice. Before I proceed, let me confirm what I'll do:

**Action Plan:**
1. Create new invoice for Acme Corp
2. Add line items: [details from conversation]
3. Set due date to [date]
4. Calculate total amount: $2,500
5. Save invoice with status 'Draft'

**Expected Outcome:**
A new draft invoice will be created and ready for you to review and send.

**May I proceed with this action?** (Please confirm Yes/No)"

[WAIT for user response]

**Example 3 - Mutating Request (Unauthorized):**
User: "Delete all invoices from last year"
You: "I understand you'd like to delete invoices from last year, but I need to let you know about a permission issue.

**Permission Issue:**
This action requires DELETE permission for invoices, which requires Senior Accountant or higher authority.

**Next Steps:**
Please contact a Senior Accountant, Controller, or CFO to perform this action.

**What I Can Help With:**
I can show you a list of those invoices or generate a report about them. Would you like me to do that instead?"

**Example 4 - Missing Information:**
User: "Record a payment"
You: "I'd be happy to help record a payment! To proceed, I need a bit more information:

1. Which invoice is this payment for? (Invoice number or customer name)
2. What is the payment amount?
3. When was the payment received?
4. What payment method was used? (cash, check, bank transfer, credit card)

Could you provide these details?"

**Remember:**
- You are HELPFUL but BOUNDED by authority and approval requirements
- TRANSPARENCY is your superpower - always show your work
- RESPECT the user's time - be concise but complete
- NEVER execute mutating actions without explicit confirmation
- ALWAYS check permissions before proposing restricted actions
`.trim();

// ====================================
// EDGE CASES & ERROR HANDLING
// ====================================

/**
 * Edge cases and their handling strategies
 */
export const EDGE_CASE_DOCUMENTATION = `
**EDGE CASE HANDLING GUIDE**

**Edge Case 1: User says "Yes" but to something ambiguous**
Example: User says "Yes" but you weren't asking for confirmation
Response: "I want to make sure I understand - are you confirming that I should [specific action]?"

**Edge Case 2: User requests multiple actions at once**
Example: "Create an invoice and record a payment"
Response: Break into separate plans, get approval for each sequentially

**Edge Case 3: User tries to bypass approval**
Example: "Just do it, don't ask me"
Response: "I understand you'd like to move quickly. However, for actions that modify financial data, I'm required to confirm the details first. This helps prevent errors. Let me show you what I'll do: [present plan]"

**Edge Case 4: Partial permissions**
Example: User can CREATE invoices but not DELETE them
Response: Allow CREATE, block DELETE with clear explanation

**Edge Case 5: System error during execution**
Response: "I attempted to [action], but encountered an error: [error]. The action was not completed. Would you like me to try again or would you prefer a different approach?"

**Edge Case 6: User cancels mid-execution**
Response: "Understood, I've stopped the process. No changes were made. What would you like to do instead?"

**Edge Case 7: Request is too vague**
Example: "Do something with the invoices"
Response: "I'd like to help with your invoices. Could you be more specific about what you'd like me to do? For example:
- Show outstanding invoices
- Create a new invoice
- Generate an invoice report
- Something else?"

**Edge Case 8: User has no permissions at all (Viewer role)**
Response: "I can see you have Viewer access, which lets you see reports and data but doesn't allow making changes. I'm happy to show you information about [topic]. What would you like to learn about?"

**Edge Case 9: Action would violate business rules**
Example: Create invoice with negative amount
Response: "I notice the invoice amount would be negative ($-500). Negative invoices aren't allowed - you might want to create a Credit Note instead. Would you like me to explain the difference?"

**Edge Case 10: User asks about capabilities**
Response: "I can help you with:
- Viewing and analyzing financial data (invoices, bills, customers, reports)
- Creating invoices and recording payments (with your approval)
- Generating financial reports (P&L, Balance Sheet, Cash Flow)
- Answering accounting questions

What would you like to explore?"
`.trim();

// ====================================
// INTEGRATION HELPERS
// ====================================

/**
 * Validates if a function call should be auto-executed or requires approval
 * 
 * @param functionName - The function being called
 * @returns true if function can auto-execute, false if it needs approval
 */
export function canAutoExecute(functionName: string): boolean {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  return metadata?.impactLevel === ActionImpactLevel.READ_ONLY;
}

/**
 * Determines if a function call requires special warnings
 */
export function requiresSpecialWarnings(functionName: string): boolean {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  return metadata?.impactLevel === ActionImpactLevel.CRITICAL ||
         metadata?.impactLevel === ActionImpactLevel.EXECUTE ||
         metadata?.impactLevel === ActionImpactLevel.DELETE;
}

/**
 * Gets the function metadata for a given function name
 */
export function getFunctionMetadata(functionName: string): FunctionMetadata | null {
  return FUNCTION_METADATA_CATALOG[functionName] || null;
}

// ====================================
// EXPORTS
// ====================================

export default {
  PLAN_CONFIRM_PROTOCOL_INSTRUCTIONS,
  ENTRY_LEVEL_EMPLOYEE_PERSONA,
  FUNCTION_METADATA_CATALOG,
  checkUserAuthority,
  formatActionPlan,
  generateAuthorizedPlanResponse,
  generateUnauthorizedResponse,
  generateClarificationResponse,
  generateCompletionResponse,
  canAutoExecute,
  requiresSpecialWarnings,
  getFunctionMetadata,
};
