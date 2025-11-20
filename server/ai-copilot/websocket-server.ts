import type { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseCookie } from 'cookie';
import { storage } from '../storage';
import { pool } from '../db';
import { RealtimeClient } from './realtime-client';
import { accountingFunctions } from './functions';
import { functionHandlers } from './function-handlers';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { 
  buildUserAuthorityContext, 
  generateAuthorityAwareSystemPrompt, 
  generatePermissionSummary,
  type UserAuthorityContext 
} from './authority-context';
import { 
  ConversationStateManager, 
  parseUserConfirmation,
  type PendingAction 
} from './conversation-state';
import { RBACService } from '../rbac/service';
import { 
  FUNCTION_METADATA_CATALOG, 
  ActionImpactLevel,
  formatActionPlan,
  formatAuthorityDenial
} from './plan-confirm-protocol';
import { getKnowledgeBaseService } from './knowledge-base';
import {
  initializeChatHistory,
  processChatMessage,
  processVoiceNoteMessage,
  executeConfirmedChatFunction,
  executeConfirmedVoiceNoteFunction,
  type ChatContext,
} from './chat-handler';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  tenantId?: string;
  realtimeClient?: RealtimeClient;
  isAlive?: boolean;
  chatHistory?: ChatCompletionMessageParam[];
  authorityContext?: UserAuthorityContext;
  stateManager?: ConversationStateManager;
}

async function getUserFromSession(sessionId: string): Promise<{ userId: string } | null> {
  try {
    const query = `SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()`;
    const result = await pool.query(query, [sessionId]);
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    const sessionData = result.rows[0].sess as any;
    
    if (sessionData?.passport?.user?.claims?.sub) {
      return { userId: sessionData.passport.user.claims.sub };
    }
    
    return null;
  } catch (error) {
    console.error('[WebSocket] Error getting user from session:', error);
    return null;
  }
}

async function getTenantFromQuery(req: IncomingMessage): Promise<string | null> {
  try {
    if (!req.url) return null;
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('tenantId');
  } catch (error) {
    console.error('[WebSocket] Error parsing tenant from query:', error);
    return null;
  }
}

/**
 * Check if user has permission to execute a function (Phase 2: Permission Validation)
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
async function checkFunctionPermission(
  functionName: string,
  authorityContext: UserAuthorityContext,
  tenantId: string
): Promise<{ allowed: boolean; reason?: string; escalationRole?: string }> {
  const metadata = FUNCTION_METADATA_CATALOG[functionName];
  
  if (!metadata) {
    return { 
      allowed: false, 
      reason: `Unknown function: ${functionName}` 
    };
  }
  
  // READ_ONLY functions are always allowed
  if (metadata.impactLevel === ActionImpactLevel.READ_ONLY) {
    return { allowed: true };
  }
  
  // Check specific permission requirements
  const rbacService = new RBACService(tenantId);
  const userPermissions = authorityContext.permissions;
  
  // Check for required permission
  if (metadata.requiredModule) {
    const requiredPermName = `${metadata.requiredModule}.${metadata.requiredPermission}`;
    const hasPermission = userPermissions.some(p => 
      p === requiredPermName || 
      p === `${metadata.requiredModule}.*` || 
      p === '*'
    );
    
    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Requires '${requiredPermName}' permission`,
        escalationRole: authorityContext.escalationRole
      };
    }
  }
  
  // Check special constraints for post/execute operations
  if (metadata.requiresConstraint) {
    switch (metadata.requiresConstraint) {
      case 'canPost':
        if (!authorityContext.canPost) {
          return {
            allowed: false,
            reason: 'Posting to ledger requires Accountant authority or higher',
            escalationRole: authorityContext.escalationRole
          };
        }
        break;
      case 'canApprove':
        if (!authorityContext.canApprove) {
          return {
            allowed: false,
            reason: 'Approval requires Senior Accountant authority or higher',
            escalationRole: authorityContext.escalationRole
          };
        }
        break;
      case 'canReverse':
        if (!authorityContext.canReverse) {
          return {
            allowed: false,
            reason: 'Reversing entries requires Controller or CFO authority',
            escalationRole: 'CFO or Controller'
          };
        }
        break;
      case 'canExecute':
        if (!authorityContext.canExecutePayments) {
          return {
            allowed: false,
            reason: 'Executing payments requires CFO authority',
            escalationRole: 'CFO'
          };
        }
        break;
    }
  }
  
  return { allowed: true };
}

export function createAICopilotWebSocketServer(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/ai-copilot'
  });

  console.log('[AI Copilot] WebSocket server initialized on /ws/ai-copilot');

  wss.on('connection', async (ws: ExtendedWebSocket, req: IncomingMessage) => {
    try {
      console.log('[AI Copilot] New connection attempt');

      // Authenticate user from session cookie
      const cookies = parseCookie(req.headers.cookie || '');
      const sessionId = cookies['connect.sid']?.split('s:')[1]?.split('.')[0];

      if (!sessionId) {
        console.error('[AI Copilot] No session cookie found');
        ws.close(1008, 'Authentication required');
        return;
      }

      const user = await getUserFromSession(sessionId);
      if (!user) {
        console.error('[AI Copilot] Invalid session');
        ws.close(1008, 'Invalid session');
        return;
      }

      // Get tenant ID from query parameter
      const tenantId = await getTenantFromQuery(req);
      if (!tenantId) {
        console.error('[AI Copilot] No tenant ID provided in query string');
        ws.close(1008, 'Tenant context required');
        return;
      }

      // Verify user has access to this tenant
      const isMember = await storage.isTenantMember(tenantId, user.userId);
      if (!isMember) {
        console.error('[AI Copilot] User not member of tenant');
        ws.close(1003, 'Not authorized for this tenant');
        return;
      }

      ws.userId = user.userId;
      ws.tenantId = tenantId;
      ws.isAlive = true;

      console.log(`[AI Copilot] WebSocket connected: userId=${user.userId}, tenantId=${tenantId}`);

      // Build user authority context (Phase 2: Dynamic Context Injection)
      try {
        const authorityContext = await buildUserAuthorityContext(user.userId, tenantId);
        ws.authorityContext = authorityContext;
        
        console.log(`[AI Copilot] Authority Context: ${generatePermissionSummary(authorityContext)}`);
        
        // Initialize conversation state machine (Phase 2: State Machine)
        ws.stateManager = new ConversationStateManager();
        
      } catch (error) {
        console.error('[AI Copilot] Failed to build authority context:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to initialize user permissions'
        }));
        ws.close(1011, 'Authorization error');
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('[AI Copilot] OPENAI_API_KEY not configured');
        ws.send(JSON.stringify({
          type: 'error',
          error: 'AI service not configured'
        }));
        ws.close(1011, 'Service unavailable');
        return;
      }

      // Generate authority-aware system prompt (Phase 2: Authority Context Injection)
      const authorityAwareInstructions = generateAuthorityAwareSystemPrompt(ws.authorityContext!);

      const realtimeClient = new RealtimeClient({
        apiKey,
        instructions: authorityAwareInstructions,
        tools: accountingFunctions,
        temperature: 0.8
      });

      ws.realtimeClient = realtimeClient;

      await realtimeClient.connect();
      
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'AI Copilot ready'
      }));

      realtimeClient.on('response.audio.delta', (event) => {
        if (event.delta) {
          ws.send(JSON.stringify({
            type: 'audio_response',
            data: event.delta
          }));
        }
      });

      realtimeClient.on('response.function_call_arguments.done', async (event) => {
        console.log('[AI Copilot] Function call:', event.name);
        
        const functionName = event.name;
        const args = JSON.parse(event.arguments || '{}');

        if (functionName === 'create_invoice' || functionName === 'record_payment') {
          ws.send(JSON.stringify({
            type: 'function_call_confirmation_required',
            callId: event.call_id,
            name: functionName,
            args
          }));
          return;
        }

        try {
          // PERMISSION VALIDATION - Check before execution
          const { validateFunctionPermission } = await import('./function-permissions');
          const permissionCheck = await validateFunctionPermission(
            functionName,
            ws.userId!,
            ws.tenantId!
          );

          if (!permissionCheck.allowed) {
            // Permission denied - throw error with professional message
            throw new Error(permissionCheck.message || 'You do not have permission to perform this action.');
          }

          const handler = functionHandlers[functionName];
          if (!handler) {
            throw new Error(`Unknown function: ${functionName}`);
          }

          const result = await handler(args, {
            tenantId: ws.tenantId!,
            userId: ws.userId!
          });

          // Send function result to client for real-time UI updates
          ws.send(JSON.stringify({
            type: 'function_call_result',
            callId: event.call_id,
            functionName,
            args,
            result,
            success: true
          }));

          realtimeClient.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.call_id,
              output: JSON.stringify(result)
            }
          });

          realtimeClient.createResponse();

        } catch (error: any) {
          console.error('[AI Copilot] Function execution error:', error);
          
          // Send error to client
          ws.send(JSON.stringify({
            type: 'function_call_result',
            callId: event.call_id,
            functionName,
            args,
            error: error.message || 'Function execution failed',
            success: false
          }));
          
          realtimeClient.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.call_id,
              output: JSON.stringify({
                error: error.message || 'Function execution failed'
              })
            }
          });

          realtimeClient.createResponse();
        }
      });

      realtimeClient.on('error', (event) => {
        console.error('[AI Copilot] OpenAI error:', event);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'AI service error'
        }));
      });

      realtimeClient.on('disconnected', () => {
        console.log('[AI Copilot] OpenAI disconnected');
        ws.close(1000, 'AI service disconnected');
      });

      ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'audio_input') {
          const audioBuffer = Buffer.from(message.data, 'base64');
          realtimeClient.sendAudio(audioBuffer);
        } else if (message.type === 'voice_note_message') {
          try {
            if (!ws.chatHistory) {
              ws.chatHistory = initializeChatHistory(ws.authorityContext!);
            }

            const context: ChatContext = {
              tenantId: ws.tenantId!,
              userId: ws.userId!,
              chatHistory: ws.chatHistory,
              authorityContext: ws.authorityContext!,
            };

            const response = await processVoiceNoteMessage(message.content, context);

            if (response.requiresConfirmation && response.toolCall) {
              ws.send(JSON.stringify({
                type: 'function_call_confirmation_required',
                callId: response.toolCall.id,
                name: response.toolCall.name,
                args: response.toolCall.args,
                assistantMessage: response.transcript
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'voice_note_response',
                audioData: response.audioData,
                transcript: response.transcript,
                timestamp: Date.now()
              }));
            }

          } catch (error: any) {
            console.error('[AI Copilot Voice Note] Error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to process voice note message'
            }));
          }
        } else if (message.type === 'chat_message') {
          // Handle text-based chat using OpenAI Chat Completions API
          try {
            if (!ws.chatHistory) {
              ws.chatHistory = initializeChatHistory(ws.authorityContext!);
            }

            const context: ChatContext = {
              tenantId: ws.tenantId!,
              userId: ws.userId!,
              chatHistory: ws.chatHistory,
              authorityContext: ws.authorityContext!,
            };

            // Use chat-handler module for chat completion with RAG
            const response = await processChatMessage(message.content, context);

            // Check if there's a function call
            if (response.toolCall) {
              const functionName = response.toolCall.name;
              const args = response.toolCall.args;

              console.log('[AI Copilot Chat] Function call:', functionName);

              // PHASE 2: Permission Validation Before Execution
              const permissionCheck = await checkFunctionPermission(
                functionName,
                ws.authorityContext!,
                ws.tenantId!
              );

              if (!permissionCheck.allowed) {
                // User lacks permission - send authority denial response
                console.log(`[AI Copilot] Permission denied: ${functionName} - ${permissionCheck.reason}`);
                
                const denialResponse = formatAuthorityDenial(
                  functionName,
                  ws.authorityContext!.userRole,
                  permissionCheck.reason || 'Insufficient permissions',
                  permissionCheck.escalationRole
                );
                
                ws.send(JSON.stringify({
                  type: 'chat_response',
                  content: denialResponse,
                  timestamp: Date.now(),
                  permissionDenied: true
                }));
                
                // Add denial to chat history
                ws.chatHistory.push({
                  role: 'assistant',
                  content: denialResponse
                });
                
                return;
              }

              // Check function metadata to determine if confirmation required
              const metadata = FUNCTION_METADATA_CATALOG[functionName];
              const requiresConfirmation = metadata && 
                metadata.impactLevel !== ActionImpactLevel.READ_ONLY;
              
              if (requiresConfirmation || response.requiresConfirmation) {
                // PHASE 2: Plan & Confirm Protocol
                // Generate action plan and request confirmation
                const plan: any = {
                  steps: metadata?.examplePlanSteps || [
                    `Execute ${functionName} with provided parameters`,
                    'Update database records',
                    'Return confirmation to user'
                  ],
                  functionName,
                  args,
                  impactLevel: metadata?.impactLevel || ActionImpactLevel.MODIFY,
                  expectedOutcome: metadata?.description || 'Execute function'
                };
                
                // Store pending action in state machine
                ws.stateManager!.transitionToAwaitingConfirmation({
                  plan,
                  functionName,
                  args,
                  proposedAt: new Date(),
                  callId: response.toolCall.id
                });
                
                // Format and send plan to user
                const formattedPlan = formatActionPlan(plan);
                
                ws.send(JSON.stringify({
                  type: 'function_call_confirmation_required',
                  callId: response.toolCall.id,
                  name: functionName,
                  args,
                  plan: formattedPlan,
                  assistantMessage: response.content || ''
                }));
              } else {
                // READ_ONLY operation - auto-execute using chat-handler
                const execResult = await executeConfirmedChatFunction(
                  response.toolCall.id,
                  functionName,
                  args,
                  context
                );

                ws.send(JSON.stringify({
                  type: 'chat_response',
                  content: execResult.content || execResult.error,
                  timestamp: Date.now(),
                  error: !!execResult.error
                }));
              }
            } else {
              // No function calls, send response directly
              ws.send(JSON.stringify({
                type: 'chat_response',
                content: response.content,
                timestamp: Date.now()
              }));
            }

          } catch (error: any) {
            console.error('[AI Copilot Chat] Error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to process chat message'
            }));
          }
        } else if (message.type === 'voice_note_function_confirmed') {
          const { callId, name, args } = message;
          
          try {
            if (!ws.chatHistory) {
              ws.chatHistory = initializeChatHistory(ws.authorityContext!);
            }

            const context: ChatContext = {
              tenantId: ws.tenantId!,
              userId: ws.userId!,
              chatHistory: ws.chatHistory,
              authorityContext: ws.authorityContext!,
            };

            const result = await executeConfirmedVoiceNoteFunction(callId, name, args, context);

            ws.send(JSON.stringify({
              type: 'voice_note_response',
              audioData: result.audioData,
              transcript: result.transcript,
              timestamp: Date.now(),
              error: !!result.error
            }));

          } catch (error: any) {
            console.error('[AI Copilot Voice Note] Confirmed function execution error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to execute confirmed function'
            }));
          }
        } else if (message.type === 'chat_function_confirmed') {
          // PHASE 2: Handle confirmed function call with state machine
          const { callId, name, args } = message;
          
          try {
            // Transition to EXECUTING state
            ws.stateManager!.transitionToExecuting();
            
            console.log(`[AI Copilot] Executing confirmed function: ${name}`);

            if (!ws.chatHistory) {
              ws.chatHistory = initializeChatHistory(ws.authorityContext!);
            }

            const context: ChatContext = {
              tenantId: ws.tenantId!,
              userId: ws.userId!,
              chatHistory: ws.chatHistory,
              authorityContext: ws.authorityContext!,
            };

            const result = await executeConfirmedChatFunction(callId, name, args, context);

            // Clear pending action and transition to LISTENING
            ws.stateManager!.transitionToListening('Action executed successfully');

            ws.send(JSON.stringify({
              type: 'chat_response',
              content: result.content || result.error,
              timestamp: Date.now(),
              actionCompleted: !result.error,
              error: !!result.error
            }));

          } catch (error: any) {
            console.error('[AI Copilot Chat] Confirmed function execution error:', error);
            
            // Transition back to LISTENING on error
            ws.stateManager!.transitionToListening('Execution failed');
            
            ws.send(JSON.stringify({
              type: 'chat_response',
              content: `I encountered an error: ${error.message}. Please try again.`,
              timestamp: Date.now(),
              error: true
            }));
          }
        } else if (message.type === 'chat_function_cancelled') {
          // PHASE 2: Handle function cancellation with state machine
          console.log('[AI Copilot] Function call cancelled by user');
          
          // Transition back to LISTENING
          ws.stateManager!.transitionToListening('User cancelled action');
          
          ws.send(JSON.stringify({
            type: 'chat_response',
            content: 'Action cancelled. How else can I help you?',
            timestamp: Date.now(),
            actionCancelled: true
          }));
        } else if (message.type === 'function_call_confirmed') {
          const { callId, name, args } = message;
          
          try {
            // PERMISSION VALIDATION - Check before execution
            const { validateFunctionPermission } = await import('./function-permissions');
            const permissionCheck = await validateFunctionPermission(
              name,
              ws.userId!,
              ws.tenantId!
            );

            if (!permissionCheck.allowed) {
              // Permission denied - throw error with professional message
              throw new Error(permissionCheck.message || 'You do not have permission to perform this action.');
            }

            const handler = functionHandlers[name];
            if (!handler) {
              throw new Error(`Unknown function: ${name}`);
            }

            const result = await handler(args, {
              tenantId: ws.tenantId!,
              userId: ws.userId!
            });

            realtimeClient.sendEvent({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(result)
              }
            });

            realtimeClient.createResponse();

          } catch (error: any) {
            console.error('[AI Copilot] Confirmed function execution error:', error);
            
            realtimeClient.sendEvent({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({
                  error: error.message || 'Function execution failed'
                })
              }
            });

            realtimeClient.createResponse();
          }
        } else if (message.type === 'ping') {
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: 'pong' }));
        }

      } catch (error) {
        console.error('[AI Copilot] Message handling error:', error);
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log(`[AI Copilot] Connection closed for user ${ws.userId}`);
      if (ws.realtimeClient) {
        ws.realtimeClient.disconnect();
      }
    });

      ws.on('error', (error) => {
        console.error('[AI Copilot] WebSocket error:', error);
        if (ws.realtimeClient) {
          ws.realtimeClient.disconnect();
        }
      });

    } catch (error) {
      console.error('[AI Copilot] Connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        console.log('[AI Copilot] Terminating inactive connection');
        if (extWs.realtimeClient) {
          extWs.realtimeClient.disconnect();
        }
        return extWs.terminate();
      }
      
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
