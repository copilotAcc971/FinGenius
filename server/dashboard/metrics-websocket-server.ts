import type { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from '../storage';
import { getUserFromSession, getTenantFromQuery, parseSessionCookie } from './websocket-auth';
import { calculateDashboardMetrics, type DashboardMetrics } from './metrics-calculator';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  tenantId?: string;
  isAlive?: boolean;
}

// Global map to track tenant subscriptions
const tenantSubscriptions = new Map<string, Set<ExtendedWebSocket>>();

export function createDashboardMetricsWebSocketServer(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/dashboard-metrics'
  });

  console.log('[Dashboard Metrics] WebSocket server initialized on /ws/dashboard-metrics');

  wss.on('connection', async (ws: ExtendedWebSocket, req: IncomingMessage) => {
    try {
      console.log('[Dashboard Metrics] New connection attempt');

      // Authenticate user from session cookie
      const sessionId = await parseSessionCookie(req);
      if (!sessionId) {
        console.error('[Dashboard Metrics] No session cookie found');
        ws.close(1008, 'Authentication required');
        return;
      }

      const user = await getUserFromSession(sessionId);
      if (!user) {
        console.error('[Dashboard Metrics] Invalid session');
        ws.close(1008, 'Invalid session');
        return;
      }

      // Get tenant ID from query parameter
      const tenantId = await getTenantFromQuery(req);
      if (!tenantId) {
        console.error('[Dashboard Metrics] No tenant ID provided in query string');
        ws.close(1008, 'Tenant context required');
        return;
      }

      // Verify user has access to this tenant
      const isMember = await storage.isTenantMember(tenantId, user.userId);
      if (!isMember) {
        console.error('[Dashboard Metrics] User not member of tenant');
        ws.close(1003, 'Not authorized for this tenant');
        return;
      }

      ws.userId = user.userId;
      ws.tenantId = tenantId;
      ws.isAlive = true;

      console.log(`[Dashboard Metrics] Connected: userId=${user.userId}, tenantId=${tenantId}`);

      // Add to tenant subscription map
      if (!tenantSubscriptions.has(tenantId)) {
        tenantSubscriptions.set(tenantId, new Set());
      }
      tenantSubscriptions.get(tenantId)!.add(ws);

      // Send initial metrics
      try {
        const metrics = await calculateDashboardMetrics(tenantId);
        ws.send(JSON.stringify({
          type: 'metrics_update',
          data: metrics
        }));
      } catch (error) {
        console.error('[Dashboard Metrics] Error calculating initial metrics:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to calculate metrics'
        }));
      }

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'ping') {
            ws.isAlive = true;
            ws.send(JSON.stringify({ type: 'pong' }));
          } else if (message.type === 'request_update') {
            // Client requesting fresh metrics
            if (ws.tenantId) {
              const metrics = await calculateDashboardMetrics(ws.tenantId);
              ws.send(JSON.stringify({
                type: 'metrics_update',
                data: metrics
              }));
            }
          }
        } catch (error) {
          console.error('[Dashboard Metrics] Message handling error:', error);
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        console.log(`[Dashboard Metrics] Connection closed for user ${ws.userId}`);
        
        // Remove from subscription map
        if (ws.tenantId && tenantSubscriptions.has(ws.tenantId)) {
          tenantSubscriptions.get(ws.tenantId)!.delete(ws);
          
          // Clean up empty tenant subscriptions
          if (tenantSubscriptions.get(ws.tenantId)!.size === 0) {
            tenantSubscriptions.delete(ws.tenantId);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('[Dashboard Metrics] WebSocket error:', error);
      });

    } catch (error) {
      console.error('[Dashboard Metrics] Connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  // Heartbeat mechanism
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        console.log('[Dashboard Metrics] Terminating inactive connection');
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

/**
 * Broadcast metrics update to all clients subscribed to a tenant
 */
export async function broadcastMetricsUpdate(tenantId: string) {
  const subscribers = tenantSubscriptions.get(tenantId);
  
  if (!subscribers || subscribers.size === 0) {
    return; // No active subscribers for this tenant
  }

  try {
    const metrics = await calculateDashboardMetrics(tenantId);
    const message = JSON.stringify({
      type: 'metrics_update',
      data: metrics
    });

    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });

    console.log(`[Dashboard Metrics] Broadcasted update to ${subscribers.size} clients for tenant ${tenantId}`);
  } catch (error) {
    console.error(`[Dashboard Metrics] Error broadcasting to tenant ${tenantId}:`, error);
  }
}
