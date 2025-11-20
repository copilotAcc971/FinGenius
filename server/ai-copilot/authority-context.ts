/**
 * AUTHORITY-AWARE CONTEXT INJECTION
 * 
 * This module creates dynamic system prompts that inject the user's role,
 * permissions, and authority level into the AI's context window.
 * 
 * This ensures the AI is "aware" of who it's talking to and what they can do.
 * 
 * @module authority-context
 * @version 2.0.0
 */

import { RBACService } from '../rbac/service';
import { 
  DEFAULT_AUTHORITY_MATRIX, 
  AccountingRole,
  getEscalationRole 
} from '../../shared/authority-matrix';
import { ENTRY_LEVEL_EMPLOYEE_PERSONA, PLAN_CONFIRM_PROTOCOL_INSTRUCTIONS } from './plan-confirm-protocol';
import { storage } from '../storage';

/**
 * User authority context for AI
 */
export interface UserAuthorityContext {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  userRole: AccountingRole;
  permissions: string[];
  canPost: boolean;
  canApprove: boolean;
  canReverse: boolean;
  canExecutePayments: boolean;
  escalationRole?: AccountingRole;
}

/**
 * Get the user's accounting role from RBAC system
 * Maps database roles to AccountingRole enum
 */
async function getUserAccountingRole(
  userId: string, 
  tenantId: string
): Promise<AccountingRole> {
  const rbacService = new RBACService(tenantId);
  const roles = await rbacService.getUserRoles(userId);
  
  // Check for matching accounting role
  for (const role of roles) {
    if (role.name in AccountingRole) {
      return role.name as AccountingRole;
    }
  }
  
  // Default to Viewer if no accounting role assigned
  return AccountingRole.VIEWER;
}

/**
 * Analyze user's permissions to determine authority level
 */
function analyzeAuthorityLevel(permissions: string[]): {
  canPost: boolean;
  canApprove: boolean;
  canReverse: boolean;
  canExecutePayments: boolean;
} {
  return {
    canPost: permissions.some(p => 
      p === 'journal_entries.post' || 
      p === 'journal_entries.*' ||
      p === '*'
    ),
    canApprove: permissions.some(p => 
      p === 'journal_entries.approve' || 
      p === 'bills.approve' ||
      p === 'vendor_payments.approve' ||
      p.endsWith('.approve') ||
      p === '*'
    ),
    canReverse: permissions.some(p => 
      p === 'journal_entries.reverse' || 
      p === '*'
    ),
    canExecutePayments: permissions.some(p => 
      p === 'vendor_payments.execute' || 
      p === 'vendor_payments.authorize' ||
      p === '*'
    ),
  };
}

/**
 * Build complete user authority context
 * This includes all information the AI needs to understand user permissions
 */
export async function buildUserAuthorityContext(
  userId: string,
  tenantId: string
): Promise<UserAuthorityContext> {
  const rbacService = new RBACService(tenantId);
  
  // Get user information from database
  const user = await storage.getUser(userId);
  
  // Build user display name (firstName lastName or email fallback)
  let userName = 'Unknown User';
  let userEmail = '';
  
  if (user) {
    userEmail = user.email || '';
    
    if (user.firstName && user.lastName) {
      userName = `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      userName = user.firstName;
    } else if (user.email) {
      userName = user.email.split('@')[0]; // Use email prefix as fallback
    }
  }
  
  // Get user's accounting role
  const userRole = await getUserAccountingRole(userId, tenantId);
  
  // Get all permissions
  const permissions = await rbacService.getUserPermissions(userId);
  
  // Analyze authority level
  const authorityLevel = analyzeAuthorityLevel(permissions);
  
  // Get escalation role
  const escalationRole = getEscalationRole(userRole) || undefined;
  
  return {
    userId,
    userName,
    userEmail,
    tenantId,
    userRole,
    permissions,
    ...authorityLevel,
    escalationRole,
  };
}

/**
 * Generate authority-aware system prompt
 * This is injected into the AI's system instructions to make it aware of user permissions
 */
export function generateAuthorityAwareSystemPrompt(context: UserAuthorityContext): string {
  let prompt = PLAN_CONFIRM_PROTOCOL_INSTRUCTIONS;
  
  // Add user context section with personalized information
  prompt += `\n\n**YOUR CURRENT USER CONTEXT:**\n`;
  prompt += `**User:** ${context.userName}`;
  if (context.userEmail) {
    prompt += ` (${context.userEmail})`;
  }
  prompt += `\n`;
  prompt += `**User Role:** ${context.userRole}\n`;
  prompt += `**Authority Level:** `;
  
  // Describe authority level in natural language
  if (context.userRole === AccountingRole.OWNER || context.userRole === AccountingRole.CFO) {
    prompt += `Executive - You have full authority to execute all financial operations.\n`;
  } else if (context.userRole === AccountingRole.CONTROLLER || context.userRole === AccountingRole.ADMIN) {
    prompt += `Supervisory - You can approve and manage most financial operations.\n`;
  } else if (context.userRole === AccountingRole.SENIOR_ACCOUNTANT) {
    prompt += `Senior Level - You can post transactions and approve certain operations.\n`;
  } else if (context.userRole === AccountingRole.ACCOUNTANT) {
    prompt += `Standard Level - You can create and post transactions but need approval for sensitive operations.\n`;
  } else if (context.userRole === AccountingRole.JUNIOR_ACCOUNTANT) {
    prompt += `Junior Level - You can create draft transactions that must be reviewed and posted by senior staff.\n`;
  } else if (context.userRole === AccountingRole.BOOKKEEPER) {
    prompt += `Entry Level - You can create and edit transactions but cannot post or approve.\n`;
  } else {
    prompt += `Limited - You have read-only or domain-specific access.\n`;
  }
  
  // Add specific authority flags
  prompt += `\n**What You Can Do:**\n`;
  prompt += `- Create draft transactions: YES (all roles)\n`;
  prompt += `- Post to ledger: ${context.canPost ? 'YES' : 'NO (requires approval from ' + (context.escalationRole || 'senior staff') + ')'}\n`;
  prompt += `- Approve transactions: ${context.canApprove ? 'YES' : 'NO'}\n`;
  prompt += `- Reverse posted entries: ${context.canReverse ? 'YES' : 'NO (CFO/Controller only)'}\n`;
  prompt += `- Execute payments: ${context.canExecutePayments ? 'YES' : 'NO (CFO only)'}\n`;
  
  if (context.escalationRole) {
    prompt += `\n**Escalation Path:** When you lack authority, suggest escalating to ${context.escalationRole}.\n`;
  }
  
  // Add permission awareness instructions
  prompt += `\n**CRITICAL PERMISSION RULES:**\n`;
  prompt += `1. When a user requests an action that requires permissions you don't have:\n`;
  prompt += `   - Acknowledge the request professionally\n`;
  prompt += `   - Explain the permission issue clearly\n`;
  prompt += `   - Suggest the appropriate escalation role\n`;
  prompt += `   - Offer to prepare a draft that can be reviewed by authorized personnel\n\n`;
  prompt += `2. For draft vs. post operations:\n`;
  prompt += `   - ALWAYS create drafts first for Junior Accountants and Bookkeepers\n`;
  prompt += `   - Explain that drafts have no financial impact until posted\n`;
  prompt += `   - Make it clear who can post the draft (based on user role)\n\n`;
  prompt += `3. Never apologize excessively - be professional and solution-oriented:\n`;
  prompt += `   - GOOD: "I can prepare a draft journal entry for review, but posting requires Accountant authority or higher."\n`;
  prompt += `   - BAD: "I'm so sorry, but I cannot post this. I apologize for the inconvenience..."\n`;
  
  return prompt;
}

/**
 * Generate permission summary for logging/debugging
 * Format: "User: {name} | Role: {role} | Permissions: {list}"
 */
export function generatePermissionSummary(context: UserAuthorityContext): string {
  return `User: ${context.userName} | Role: ${context.userRole} | ` +
         `Post: ${context.canPost} | Approve: ${context.canApprove} | ` +
         `Reverse: ${context.canReverse} | Execute: ${context.canExecutePayments} | ` +
         `Permissions: ${context.permissions.length} total`;
}
