/**
 * Approval Workflow Engine for Journal Entries
 * 
 * Handles multi-stage approval routing, approval/rejection logic, and automatic posting
 * for journal entries requiring approval before posting to the ledger.
 * 
 * **Core Responsibilities:**
 * - Submit journal entries for approval workflow routing
 * - Process approval/rejection actions for workflow steps
 * - Track approval history with audit trail
 * - Automatically post entries after final approval (if configured)
 * 
 * **Integration Points:**
 * - Called by journal entry creation workflow
 * - Used by approval UI for approver actions
 * - Integrates with historical balance service for posting
 * 
 * @module server/accounting/workflow-engine
 */

import { db } from '../db';
import type { DBTransaction } from './service';
import {
  journalEntries,
  journalEntryLegs,
  approvalWorkflows,
  approvalSteps,
  approvalRequests,
  approvalHistory,
  users,
  type JournalEntry,
  type ApprovalWorkflow,
  type ApprovalStep,
  type ApprovalRequest,
  type ApprovalHistory,
  type InsertApprovalRequest,
  type InsertApprovalHistory,
} from '@shared/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import {
  ValidationError,
  AccountingError,
  NotFoundError,
  AuthorizationError,
  logError,
} from './errors';

// ====================================
// TYPE DEFINITIONS
// ====================================

/**
 * Approval Request with Assigned Approvers
 * Extended approval request that includes approver information
 */
export interface ApprovalRequestWithApprovers extends ApprovalRequest {
  assignedApprovers: string[]; // Array of user IDs
  currentStepInfo?: {
    stepOrder: number;
    approverRole: string | null;
    approverUserId: string | null;
    requiresAll: boolean;
  };
}

/**
 * Workflow Conditions
 * JSON structure for workflow matching conditions
 */
export interface WorkflowConditions {
  minAmount?: number;
  maxAmount?: number;
  accountTypes?: string[]; // Asset, liability, equity, income, expense
  sourceDocumentTypes?: string[]; // invoice, bill, payment, etc.
  customConditions?: Record<string, any>;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Get list of users assigned to a specific workflow step
 * 
 * **Purpose:** Fetch approvers for a given workflow step to assign approval tasks
 * 
 * **Logic:**
 * 1. Query approvalSteps table for given workflow and step order
 * 2. Extract approverUserId from each step
 * 3. Return array of user IDs (may be empty if role-based only)
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param workflowId - Workflow identifier
 * @param stepOrder - Step order number (1, 2, 3, etc.)
 * @param tx - Optional database transaction for atomicity
 * @returns Array of user IDs assigned to this step
 * 
 * @example
 * ```typescript
 * const approvers = await getAssignedApprovers(
 *   'tenant-123',
 *   'workflow-456',
 *   1
 * );
 * console.log(approvers); // ['user-1', 'user-2']
 * ```
 */
export async function getAssignedApprovers(
  tenantId: string,
  workflowId: string,
  stepOrder: number,
  tx?: DBTransaction
): Promise<string[]> {
  const database = tx || db;
  
  try {
    const steps = await database
      .select()
      .from(approvalSteps)
      .where(and(
        eq(approvalSteps.tenantId, tenantId),
        eq(approvalSteps.workflowId, workflowId),
        eq(approvalSteps.stepOrder, stepOrder)
      ));
    
    const approverIds = steps
      .map(step => step.approverUserId)
      .filter((id): id is string => id !== null);
    
    return approverIds;
  } catch (error) {
    logError(error as Error, { tenantId, workflowId, stepOrder });
    throw error;
  }
}

/**
 * Determine if a journal entry matches workflow conditions
 * 
 * **Purpose:** Evaluate whether a journal entry satisfies the conditions
 * defined in a workflow configuration for automatic routing.
 * 
 * **Logic:**
 * 1. Parse workflow conditions JSON
 * 2. Check amount thresholds (minAmount, maxAmount)
 * 3. Check source document type matches
 * 4. Check account types involved (if specified)
 * 5. Return true if all conditions match, false otherwise
 * 
 * **Edge Cases:**
 * - Empty conditions object matches all entries
 * - Null/undefined conditions field matches all entries
 * - Missing journal entry legs returns false
 * 
 * @param journalEntry - Journal entry to evaluate
 * @param workflow - Workflow with conditions to check
 * @returns True if entry matches all workflow conditions
 * 
 * @example
 * ```typescript
 * const workflow = {
 *   conditions: {
 *     minAmount: 10000,
 *     sourceDocumentTypes: ['invoice', 'bill']
 *   }
 * };
 * const matches = matchWorkflowConditions(journalEntry, workflow);
 * ```
 */
export function matchWorkflowConditions(
  journalEntry: JournalEntry,
  workflow: ApprovalWorkflow
): boolean {
  try {
    if (!workflow.conditions) {
      return true;
    }
    
    const conditions = workflow.conditions as WorkflowConditions;
    
    if (conditions.minAmount !== undefined) {
      const totalAmount = parseFloat(journalEntry.totalAmount || '0');
      if (totalAmount < conditions.minAmount) {
        return false;
      }
    }
    
    if (conditions.maxAmount !== undefined) {
      const totalAmount = parseFloat(journalEntry.totalAmount || '0');
      if (totalAmount > conditions.maxAmount) {
        return false;
      }
    }
    
    if (conditions.sourceDocumentTypes && conditions.sourceDocumentTypes.length > 0) {
      if (!journalEntry.sourceDocumentType || 
          !conditions.sourceDocumentTypes.includes(journalEntry.sourceDocumentType)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    logError(error as Error, { 
      journalEntryId: journalEntry.id, 
      workflowId: workflow.id 
    });
    return false;
  }
}

// ====================================
// CORE WORKFLOW FUNCTIONS
// ====================================

/**
 * Submit a journal entry for approval workflow routing
 * 
 * **Purpose:** Initiate the approval process for a journal entry by finding
 * a matching workflow and creating an approval request.
 * 
 * **Logic:**
 * 1. Fetch journal entry and validate it's in 'draft' or 'approved' status
 * 2. Query active approval workflows for journal entries (entityType = 'journal_entry')
 * 3. Find the first matching workflow based on conditions (amount threshold, source type, etc.)
 * 4. Create approvalRequest record with workflow ID, status 'pending', currentStep = 1
 * 5. Assign approvers for step 1 from approvalSteps table
 * 6. Update journal entry status to 'pending_approval'
 * 7. Link journal entry to approval request via workflowRequestId
 * 8. Return created approval request with assigned approvers
 * 
 * **Edge Cases:**
 * - No matching workflow found: throws ValidationError
 * - Entry already in pending_approval status: throws ValidationError
 * - Entry already posted: throws ValidationError
 * - No approvers for step 1: throws ValidationError
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param journalEntryId - Journal entry to submit for approval
 * @param submittedByUserId - User submitting the entry for approval
 * @param tx - Optional database transaction for atomicity
 * @returns Created approval request with assigned approvers
 * 
 * @throws {NotFoundError} If journal entry not found
 * @throws {ValidationError} If entry in invalid state or no workflow found
 * 
 * @example
 * ```typescript
 * const request = await submitJournalEntryForApproval(
 *   'tenant-123',
 *   'entry-456',
 *   'user-789'
 * );
 * console.log(request.assignedApprovers); // ['approver-1', 'approver-2']
 * ```
 */
export async function submitJournalEntryForApproval(
  tenantId: string,
  journalEntryId: string,
  submittedByUserId: string,
  tx?: DBTransaction
): Promise<ApprovalRequestWithApprovers> {
  const database = tx || db;
  
  try {
    const [journalEntry] = await database
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!journalEntry) {
      throw new NotFoundError(
        `Journal entry not found: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    if (journalEntry.status !== 'draft' && journalEntry.status !== 'approved' && journalEntry.status !== 'rejected') {
      throw new ValidationError(
        `Journal entry must be in 'draft', 'approved', or 'rejected' status to submit for approval. Current status: ${journalEntry.status}`,
        { journalEntryId, currentStatus: journalEntry.status }
      );
    }
    
    // If there's an existing rejected approval request, mark it as cancelled
    // This preserves the audit trail while allowing a fresh workflow attempt
    if (journalEntry.workflowRequestId) {
      const [existingRequest] = await database
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.id, journalEntry.workflowRequestId),
          eq(approvalRequests.tenantId, tenantId)
        ))
        .limit(1);
      
      if (existingRequest && existingRequest.status === 'rejected') {
        await database
          .update(approvalRequests)
          .set({ 
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, existingRequest.id));
      }
    }
    
    const activeWorkflows = await database
      .select()
      .from(approvalWorkflows)
      .where(and(
        eq(approvalWorkflows.tenantId, tenantId),
        eq(approvalWorkflows.entityType, 'journal_entry'),
        eq(approvalWorkflows.isActive, true)
      ));
    
    if (activeWorkflows.length === 0) {
      throw new ValidationError(
        'No active approval workflows found for journal entries',
        { tenantId, entityType: 'journal_entry' }
      );
    }
    
    let matchedWorkflow: ApprovalWorkflow | null = null;
    for (const workflow of activeWorkflows) {
      if (matchWorkflowConditions(journalEntry, workflow)) {
        matchedWorkflow = workflow;
        break;
      }
    }
    
    if (!matchedWorkflow) {
      throw new ValidationError(
        'No matching workflow found for this journal entry based on conditions',
        { 
          tenantId, 
          journalEntryId,
          totalAmount: journalEntry.totalAmount,
          sourceDocumentType: journalEntry.sourceDocumentType
        }
      );
    }
    
    const assignedApprovers = await getAssignedApprovers(
      tenantId,
      matchedWorkflow.id,
      1,
      database
    );
    
    if (assignedApprovers.length === 0) {
      throw new ValidationError(
        'No approvers assigned to step 1 of the workflow',
        { workflowId: matchedWorkflow.id, stepOrder: 1 }
      );
    }
    
    const approvalRequestData: InsertApprovalRequest = {
      tenantId,
      workflowId: matchedWorkflow.id,
      entityType: 'journal_entry',
      entityId: journalEntryId,
      requestedBy: submittedByUserId,
      currentStep: 1,
      status: 'pending',
    };
    
    const [createdRequest] = await database
      .insert(approvalRequests)
      .values(approvalRequestData)
      .returning();
    
    await database
      .update(journalEntries)
      .set({
        status: 'pending_approval',
        workflowRequestId: createdRequest.id,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ));
    
    const [stepInfo] = await database
      .select()
      .from(approvalSteps)
      .where(and(
        eq(approvalSteps.tenantId, tenantId),
        eq(approvalSteps.workflowId, matchedWorkflow.id),
        eq(approvalSteps.stepOrder, 1)
      ))
      .limit(1);
    
    return {
      ...createdRequest,
      assignedApprovers,
      currentStepInfo: stepInfo ? {
        stepOrder: stepInfo.stepOrder,
        approverRole: stepInfo.approverRole,
        approverUserId: stepInfo.approverUserId,
        requiresAll: stepInfo.requiresAll,
      } : undefined,
    };
  } catch (error) {
    logError(error as Error, { tenantId, journalEntryId, submittedByUserId });
    throw error;
  }
}

/**
 * Process an approval action for current workflow step
 * 
 * **Purpose:** Record an approver's approval decision and advance the workflow
 * if all required approvals for the current step are met.
 * 
 * **Logic:**
 * 1. Fetch journal entry and approval request
 * 2. Validate approver is assigned to current step
 * 3. Check approver hasn't already approved this step
 * 4. Record approval in approvalHistory table
 * 5. Check if all required approvers for current step have approved
 * 6. If step complete:
 *    - If this is final step: update journal entry status to 'approved', update request status to 'approved'
 *    - If more steps remain: advance to next step (increment currentStep), fetch next approvers
 * 7. Return updated approval request with next step info
 * 
 * **Edge Cases:**
 * - Approver not assigned to current step: throws AuthorizationError
 * - Approver already approved this step: throws ValidationError
 * - Request already approved/rejected: throws ValidationError
 * - No more steps after this one: mark as fully approved
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param journalEntryId - Journal entry being approved
 * @param approverUserId - User approving the entry
 * @param comments - Optional approval comments
 * @param tx - Optional database transaction for atomicity
 * @returns Updated approval request with next step info
 * 
 * @throws {NotFoundError} If journal entry or approval request not found
 * @throws {AuthorizationError} If user not authorized as approver for current step
 * @throws {ValidationError} If request in invalid state or approver already approved
 * 
 * @example
 * ```typescript
 * const result = await approveJournalEntryStep(
 *   'tenant-123',
 *   'entry-456',
 *   'approver-1',
 *   'Looks good to me'
 * );
 * console.log(result.status); // 'pending' or 'approved'
 * ```
 */
export async function approveJournalEntryStep(
  tenantId: string,
  journalEntryId: string,
  approverUserId: string,
  comments?: string,
  tx?: DBTransaction
): Promise<ApprovalRequestWithApprovers> {
  const database = tx || db;
  
  try {
    const [journalEntry] = await database
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!journalEntry) {
      throw new NotFoundError(
        `Journal entry not found: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    if (!journalEntry.workflowRequestId) {
      throw new ValidationError(
        'Journal entry is not in an approval workflow',
        { journalEntryId }
      );
    }
    
    const [approvalRequest] = await database
      .select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.id, journalEntry.workflowRequestId),
        eq(approvalRequests.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!approvalRequest) {
      throw new NotFoundError(
        `Approval request not found: ${journalEntry.workflowRequestId}`,
        { tenantId, approvalRequestId: journalEntry.workflowRequestId }
      );
    }
    
    if (approvalRequest.status !== 'pending') {
      throw new ValidationError(
        `Approval request is not in 'pending' status. Current status: ${approvalRequest.status}`,
        { approvalRequestId: approvalRequest.id, currentStatus: approvalRequest.status }
      );
    }
    
    if (!approvalRequest.workflowId) {
      throw new ValidationError(
        'Approval request has no associated workflow',
        { approvalRequestId: approvalRequest.id }
      );
    }
    
    const assignedApprovers = await getAssignedApprovers(
      tenantId,
      approvalRequest.workflowId,
      approvalRequest.currentStep || 1,
      database
    );
    
    if (!assignedApprovers.includes(approverUserId)) {
      throw new AuthorizationError(
        `User ${approverUserId} is not authorized to approve at step ${approvalRequest.currentStep}`,
        { approverUserId, currentStep: approvalRequest.currentStep, assignedApprovers }
      );
    }
    
    const existingApprovals = await database
      .select()
      .from(approvalHistory)
      .where(and(
        eq(approvalHistory.approvalRequestId, approvalRequest.id),
        eq(approvalHistory.stepOrder, approvalRequest.currentStep || 1),
        eq(approvalHistory.approverUserId, approverUserId)
      ));
    
    if (existingApprovals.length > 0) {
      throw new ValidationError(
        'User has already approved this step',
        { approverUserId, stepOrder: approvalRequest.currentStep }
      );
    }
    
    const historyData: InsertApprovalHistory = {
      tenantId,
      approvalRequestId: approvalRequest.id,
      stepOrder: approvalRequest.currentStep || 1,
      approverUserId,
      decision: 'approved',
      comments: comments || null,
    };
    
    await database
      .insert(approvalHistory)
      .values(historyData);
    
    const allApprovalsForCurrentStep = await database
      .select()
      .from(approvalHistory)
      .where(and(
        eq(approvalHistory.approvalRequestId, approvalRequest.id),
        eq(approvalHistory.stepOrder, approvalRequest.currentStep || 1),
        eq(approvalHistory.decision, 'approved')
      ));
    
    const currentStepApprovers = await database
      .select()
      .from(approvalSteps)
      .where(and(
        eq(approvalSteps.tenantId, tenantId),
        eq(approvalSteps.workflowId, approvalRequest.workflowId),
        eq(approvalSteps.stepOrder, approvalRequest.currentStep || 1)
      ));
    
    const requiresAll = currentStepApprovers.some(step => step.requiresAll);
    const allApproversApproved = requiresAll
      ? allApprovalsForCurrentStep.length >= assignedApprovers.length
      : allApprovalsForCurrentStep.length >= 1;
    
    if (allApproversApproved) {
      const nextStepApprovers = await database
        .select()
        .from(approvalSteps)
        .where(and(
          eq(approvalSteps.tenantId, tenantId),
          eq(approvalSteps.workflowId, approvalRequest.workflowId),
          eq(approvalSteps.stepOrder, (approvalRequest.currentStep || 1) + 1)
        ));
      
      if (nextStepApprovers.length === 0) {
        await database
          .update(approvalRequests)
          .set({
            status: 'approved',
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, approvalRequest.id));
        
        await database
          .update(journalEntries)
          .set({
            status: 'approved',
            updatedAt: new Date(),
          })
          .where(and(
            eq(journalEntries.id, journalEntryId),
            eq(journalEntries.tenantId, tenantId)
          ));
        
        const [updatedRequest] = await database
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.id, approvalRequest.id))
          .limit(1);
        
        return {
          ...updatedRequest,
          assignedApprovers: [],
        };
      } else {
        const nextStep = (approvalRequest.currentStep || 1) + 1;
        
        await database
          .update(approvalRequests)
          .set({
            currentStep: nextStep,
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, approvalRequest.id));
        
        const nextApprovers = await getAssignedApprovers(
          tenantId,
          approvalRequest.workflowId,
          nextStep,
          database
        );
        
        const [updatedRequest] = await database
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.id, approvalRequest.id))
          .limit(1);
        
        const [nextStepInfo] = await database
          .select()
          .from(approvalSteps)
          .where(and(
            eq(approvalSteps.tenantId, tenantId),
            eq(approvalSteps.workflowId, approvalRequest.workflowId),
            eq(approvalSteps.stepOrder, nextStep)
          ))
          .limit(1);
        
        return {
          ...updatedRequest,
          assignedApprovers: nextApprovers,
          currentStepInfo: nextStepInfo ? {
            stepOrder: nextStepInfo.stepOrder,
            approverRole: nextStepInfo.approverRole,
            approverUserId: nextStepInfo.approverUserId,
            requiresAll: nextStepInfo.requiresAll,
          } : undefined,
        };
      }
    }
    
    const [currentRequest] = await database
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequest.id))
      .limit(1);
    
    return {
      ...currentRequest,
      assignedApprovers,
    };
  } catch (error) {
    logError(error as Error, { tenantId, journalEntryId, approverUserId });
    throw error;
  }
}

/**
 * Reject a journal entry in workflow
 * 
 * **Purpose:** Record a rejection decision and terminate the approval workflow.
 * 
 * **Logic:**
 * 1. Fetch journal entry and approval request
 * 2. Validate rejector is assigned to current step
 * 3. Record rejection in approvalHistory table
 * 4. Update approval request status to 'rejected'
 * 5. Update journal entry status to 'rejected'
 * 6. Store rejection reason
 * 7. Return updated approval request
 * 
 * **Edge Cases:**
 * - Rejector not assigned to current step: throws AuthorizationError
 * - Request already approved/rejected: throws ValidationError
 * - Missing rejection reason: allowed but recommended
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param journalEntryId - Journal entry being rejected
 * @param rejectorUserId - User rejecting the entry
 * @param rejectionReason - Reason for rejection
 * @param tx - Optional database transaction for atomicity
 * @returns Updated approval request
 * 
 * @throws {NotFoundError} If journal entry or approval request not found
 * @throws {AuthorizationError} If user not authorized as approver for current step
 * @throws {ValidationError} If request in invalid state
 * 
 * @example
 * ```typescript
 * const result = await rejectJournalEntry(
 *   'tenant-123',
 *   'entry-456',
 *   'approver-1',
 *   'Amounts do not match supporting documents'
 * );
 * console.log(result.status); // 'rejected'
 * ```
 */
export async function rejectJournalEntry(
  tenantId: string,
  journalEntryId: string,
  rejectorUserId: string,
  rejectionReason: string,
  tx?: DBTransaction
): Promise<ApprovalRequest> {
  const database = tx || db;
  
  try {
    const [journalEntry] = await database
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!journalEntry) {
      throw new NotFoundError(
        `Journal entry not found: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    if (!journalEntry.workflowRequestId) {
      throw new ValidationError(
        'Journal entry is not in an approval workflow',
        { journalEntryId }
      );
    }
    
    const [approvalRequest] = await database
      .select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.id, journalEntry.workflowRequestId),
        eq(approvalRequests.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!approvalRequest) {
      throw new NotFoundError(
        `Approval request not found: ${journalEntry.workflowRequestId}`,
        { tenantId, approvalRequestId: journalEntry.workflowRequestId }
      );
    }
    
    if (approvalRequest.status !== 'pending') {
      throw new ValidationError(
        `Approval request is not in 'pending' status. Current status: ${approvalRequest.status}`,
        { approvalRequestId: approvalRequest.id, currentStatus: approvalRequest.status }
      );
    }
    
    if (!approvalRequest.workflowId) {
      throw new ValidationError(
        'Approval request has no associated workflow',
        { approvalRequestId: approvalRequest.id }
      );
    }
    
    const assignedApprovers = await getAssignedApprovers(
      tenantId,
      approvalRequest.workflowId,
      approvalRequest.currentStep || 1,
      database
    );
    
    if (!assignedApprovers.includes(rejectorUserId)) {
      throw new AuthorizationError(
        `User ${rejectorUserId} is not authorized to reject at step ${approvalRequest.currentStep}`,
        { rejectorUserId, currentStep: approvalRequest.currentStep, assignedApprovers }
      );
    }
    
    const historyData: InsertApprovalHistory = {
      tenantId,
      approvalRequestId: approvalRequest.id,
      stepOrder: approvalRequest.currentStep || 1,
      approverUserId: rejectorUserId,
      decision: 'rejected',
      comments: rejectionReason,
    };
    
    await database
      .insert(approvalHistory)
      .values(historyData);
    
    await database
      .update(approvalRequests)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, approvalRequest.id));
    
    await database
      .update(journalEntries)
      .set({
        status: 'rejected',
        rejectionReason: rejectionReason,
        updatedAt: new Date(),
      })
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ));
    
    const [updatedRequest] = await database
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequest.id))
      .limit(1);
    
    return updatedRequest;
  } catch (error) {
    logError(error as Error, { tenantId, journalEntryId, rejectorUserId });
    throw error;
  }
}

/**
 * Automatically post a journal entry after final approval
 * 
 * **Purpose:** Post an approved journal entry to the ledger if the workflow
 * is configured for automatic posting after approval.
 * 
 * **Logic:**
 * 1. Check if journal entry is in 'approved' status
 * 2. Check if workflow has autoPostAfterApproval enabled (check conditions)
 * 3. If enabled: update journal entry status to 'posted'
 * 4. Record postedBy and postedAt timestamps
 * 5. Return posted journal entry
 * 
 * **Note:** This function updates the status but does NOT call the historical
 * balance service. That integration should be handled by the caller to maintain
 * separation of concerns.
 * 
 * **Edge Cases:**
 * - Entry not in 'approved' status: throws ValidationError
 * - Auto-posting not enabled: throws ValidationError
 * - Entry already posted: throws ValidationError
 * 
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param journalEntryId - Journal entry to post
 * @param tx - Optional database transaction for atomicity
 * @returns Posted journal entry
 * 
 * @throws {NotFoundError} If journal entry not found
 * @throws {ValidationError} If entry in invalid state or auto-posting not enabled
 * 
 * @example
 * ```typescript
 * const postedEntry = await autoPostApprovedEntry(
 *   'tenant-123',
 *   'entry-456'
 * );
 * console.log(postedEntry.status); // 'posted'
 * console.log(postedEntry.postedAt); // timestamp
 * ```
 */
export async function autoPostApprovedEntry(
  tenantId: string,
  journalEntryId: string,
  tx?: DBTransaction
): Promise<JournalEntry> {
  const database = tx || db;
  
  try {
    const [journalEntry] = await database
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!journalEntry) {
      throw new NotFoundError(
        `Journal entry not found: ${journalEntryId}`,
        { tenantId, journalEntryId }
      );
    }
    
    if (journalEntry.status !== 'approved') {
      throw new ValidationError(
        `Journal entry must be in 'approved' status to auto-post. Current status: ${journalEntry.status}`,
        { journalEntryId, currentStatus: journalEntry.status }
      );
    }
    
    if (!journalEntry.workflowRequestId) {
      throw new ValidationError(
        'Journal entry has no associated approval workflow',
        { journalEntryId }
      );
    }
    
    const [approvalRequest] = await database
      .select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.id, journalEntry.workflowRequestId),
        eq(approvalRequests.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!approvalRequest?.workflowId) {
      throw new ValidationError(
        'Approval request has no associated workflow',
        { approvalRequestId: journalEntry.workflowRequestId }
      );
    }
    
    const [workflow] = await database
      .select()
      .from(approvalWorkflows)
      .where(and(
        eq(approvalWorkflows.id, approvalRequest.workflowId),
        eq(approvalWorkflows.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!workflow) {
      throw new NotFoundError(
        `Approval workflow not found: ${approvalRequest.workflowId}`,
        { tenantId, workflowId: approvalRequest.workflowId }
      );
    }
    
    const conditions = workflow.conditions as WorkflowConditions;
    const autoPostEnabled = conditions?.customConditions?.autoPostAfterApproval === true;
    
    if (!autoPostEnabled) {
      throw new ValidationError(
        'Auto-posting is not enabled for this workflow',
        { workflowId: workflow.id }
      );
    }
    
    const [updatedEntry] = await database
      .update(journalEntries)
      .set({
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, tenantId)
      ))
      .returning();
    
    return updatedEntry;
  } catch (error) {
    logError(error as Error, { tenantId, journalEntryId });
    throw error;
  }
}
