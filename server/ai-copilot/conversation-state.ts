/**
 * CONVERSATION STATE MACHINE
 * 
 * Implements the state machine for AI Copilot conversations:
 * Listening → Planning → Awaiting Confirmation → Executing
 * 
 * This ensures proper Plan & Confirm protocol enforcement.
 * 
 * @module conversation-state
 * @version 2.0.0
 */

import type { ActionPlan } from './plan-confirm-protocol';

/**
 * Conversation states
 */
export enum ConversationState {
  /** Listening to user input, ready to respond */
  LISTENING = 'LISTENING',
  
  /** AI has proposed a plan and is awaiting user confirmation */
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  
  /** AI is executing an approved action */
  EXECUTING = 'EXECUTING',
  
  /** Conversation has an error that needs resolution */
  ERROR = 'ERROR',
}

/**
 * Pending action awaiting confirmation
 */
export interface PendingAction {
  /** The action plan presented to the user */
  plan: ActionPlan;
  
  /** Function to call if approved */
  functionName: string;
  
  /** Arguments to pass to the function */
  args: Record<string, any>;
  
  /** When this action was proposed */
  proposedAt: Date;
  
  /** Call ID from OpenAI (if applicable) */
  callId?: string;
}

/**
 * Conversation state data
 */
export interface ConversationStateData {
  /** Current state */
  state: ConversationState;
  
  /** Pending action (if in AWAITING_CONFIRMATION) */
  pendingAction?: PendingAction;
  
  /** Last state transition timestamp */
  lastTransition: Date;
  
  /** State history for debugging */
  history: Array<{
    state: ConversationState;
    timestamp: Date;
    reason?: string;
  }>;
}

/**
 * Conversation State Manager
 * Tracks conversation state for each WebSocket connection
 */
export class ConversationStateManager {
  private stateData: ConversationStateData;
  
  constructor() {
    this.stateData = {
      state: ConversationState.LISTENING,
      lastTransition: new Date(),
      history: [{
        state: ConversationState.LISTENING,
        timestamp: new Date(),
        reason: 'Initial state'
      }]
    };
  }
  
  /**
   * Get current state
   */
  getCurrentState(): ConversationState {
    return this.stateData.state;
  }
  
  /**
   * Get full state data
   */
  getStateData(): ConversationStateData {
    return this.stateData;
  }
  
  /**
   * Transition to AWAITING_CONFIRMATION state
   * Called when AI presents a plan that needs user approval
   */
  transitionToAwaitingConfirmation(pendingAction: PendingAction): void {
    this.transition(ConversationState.AWAITING_CONFIRMATION, 'Plan presented to user');
    this.stateData.pendingAction = pendingAction;
  }
  
  /**
   * Transition to EXECUTING state
   * Called when user confirms and AI starts executing
   */
  transitionToExecuting(): void {
    this.transition(ConversationState.EXECUTING, 'User confirmed action');
  }
  
  /**
   * Transition back to LISTENING state
   * Called after action completes or user cancels
   */
  transitionToListening(reason: string): void {
    this.stateData.pendingAction = undefined;
    this.transition(ConversationState.LISTENING, reason);
  }
  
  /**
   * Transition to ERROR state
   */
  transitionToError(reason: string): void {
    this.transition(ConversationState.ERROR, reason);
  }
  
  /**
   * Get pending action (if any)
   */
  getPendingAction(): PendingAction | undefined {
    return this.stateData.pendingAction;
  }
  
  /**
   * Clear pending action
   */
  clearPendingAction(): void {
    this.stateData.pendingAction = undefined;
  }
  
  /**
   * Check if currently awaiting confirmation
   */
  isAwaitingConfirmation(): boolean {
    return this.stateData.state === ConversationState.AWAITING_CONFIRMATION;
  }
  
  /**
   * Check if currently executing
   */
  isExecuting(): boolean {
    return this.stateData.state === ConversationState.EXECUTING;
  }
  
  /**
   * Check if action has expired (awaiting confirmation for too long)
   */
  isActionExpired(maxAgeMinutes: number = 5): boolean {
    if (!this.stateData.pendingAction) {
      return false;
    }
    
    const now = new Date();
    const ageMs = now.getTime() - this.stateData.pendingAction.proposedAt.getTime();
    const ageMinutes = ageMs / (1000 * 60);
    
    return ageMinutes > maxAgeMinutes;
  }
  
  /**
   * Internal state transition handler
   */
  private transition(newState: ConversationState, reason?: string): void {
    const oldState = this.stateData.state;
    
    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[ConversationState] Invalid transition: ${oldState} → ${newState}`);
      return;
    }
    
    // Update state
    this.stateData.state = newState;
    this.stateData.lastTransition = new Date();
    
    // Record in history
    this.stateData.history.push({
      state: newState,
      timestamp: new Date(),
      reason
    });
    
    // Keep history limited to last 20 transitions
    if (this.stateData.history.length > 20) {
      this.stateData.history = this.stateData.history.slice(-20);
    }
    
    console.log(`[ConversationState] ${oldState} → ${newState}${reason ? ` (${reason})` : ''}`);
  }
  
  /**
   * Validate state transition
   * Enforces state machine rules
   */
  private isValidTransition(from: ConversationState, to: ConversationState): boolean {
    // Always allow transition to ERROR
    if (to === ConversationState.ERROR) {
      return true;
    }
    
    // Always allow transition to LISTENING (reset)
    if (to === ConversationState.LISTENING) {
      return true;
    }
    
    // Define valid transitions
    const validTransitions: Record<ConversationState, ConversationState[]> = {
      [ConversationState.LISTENING]: [
        ConversationState.AWAITING_CONFIRMATION,
        ConversationState.EXECUTING, // Direct execution for read-only operations
      ],
      [ConversationState.AWAITING_CONFIRMATION]: [
        ConversationState.EXECUTING,
        ConversationState.LISTENING, // Cancel
      ],
      [ConversationState.EXECUTING]: [
        ConversationState.LISTENING, // Complete
      ],
      [ConversationState.ERROR]: [
        ConversationState.LISTENING, // Recover
      ],
    };
    
    return validTransitions[from]?.includes(to) || false;
  }
  
  /**
   * Get state history for debugging
   */
  getHistory(): Array<{ state: ConversationState; timestamp: Date; reason?: string }> {
    return this.stateData.history;
  }
  
  /**
   * Reset state machine
   */
  reset(): void {
    this.stateData = {
      state: ConversationState.LISTENING,
      lastTransition: new Date(),
      history: [{
        state: ConversationState.LISTENING,
        timestamp: new Date(),
        reason: 'Reset'
      }]
    };
  }
}

/**
 * Parse user response to determine if they're confirming or denying
 */
export function parseUserConfirmation(message: string): 'yes' | 'no' | 'unclear' {
  const lowerMessage = message.toLowerCase().trim();
  
  // Affirmative responses
  const affirmative = [
    'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'proceed', 
    'go ahead', 'do it', 'confirm', 'approved', 'approve',
    'continue', 'yes please', 'absolutely', 'correct'
  ];
  
  // Negative responses
  const negative = [
    'no', 'nope', 'cancel', 'stop', 'wait', 'hold on',
    'don\'t', 'do not', 'reject', 'denied', 'deny'
  ];
  
  // Check for exact matches or starts with
  for (const term of affirmative) {
    if (lowerMessage === term || lowerMessage.startsWith(term + ' ')) {
      return 'yes';
    }
  }
  
  for (const term of negative) {
    if (lowerMessage === term || lowerMessage.startsWith(term + ' ')) {
      return 'no';
    }
  }
  
  // Check if message contains affirmative/negative words
  if (affirmative.some(term => lowerMessage.includes(term))) {
    return 'yes';
  }
  
  if (negative.some(term => lowerMessage.includes(term))) {
    return 'no';
  }
  
  return 'unclear';
}
