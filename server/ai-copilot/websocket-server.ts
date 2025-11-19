import type { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseCookie } from 'cookie';
import { storage } from '../storage';
import { pool } from '../db';
import { RealtimeClient } from './realtime-client';
import { accountingFunctions, systemInstructions } from './functions';
import { functionHandlers } from './function-handlers';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  tenantId?: string;
  realtimeClient?: RealtimeClient;
  isAlive?: boolean;
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

      const realtimeClient = new RealtimeClient({
        apiKey,
        instructions: systemInstructions,
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
          const handler = functionHandlers[functionName];
          if (!handler) {
            throw new Error(`Unknown function: ${functionName}`);
          }

          const result = await handler(args, {
            tenantId: ws.tenantId!,
            userId: ws.userId!
          });

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
        } else if (message.type === 'function_call_confirmed') {
          const { callId, name, args } = message;
          
          try {
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
