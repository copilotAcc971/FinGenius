import { useState, useEffect, useRef, useCallback } from 'react';

export interface DashboardMetrics {
  timestamp: string;
  tenantId: string;
  kpis: {
    totalRevenueToday: string;
    totalExpensesToday: string;
    outstandingInvoices: {
      count: number;
      total: string;
    };
    overdueInvoices: {
      count: number;
      total: string;
    };
    pendingPayments: {
      count: number;
      total: string;
    };
    cashPosition: string;
    arAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
    apAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
  };
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface DashboardMessage {
  type: string;
  data?: DashboardMetrics;
  error?: string;
}

export class DashboardMetricsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private tenantId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';

  public onMetricsUpdate: ((metrics: DashboardMetrics) => void) | null = null;
  public onConnectionStateChange: ((state: ConnectionState) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  async connect(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    this.tenantId = tenantId;
    this.updateConnectionState('connecting');

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/dashboard-metrics?tenantId=${encodeURIComponent(tenantId)}`;

      console.log('[DashboardMetrics] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[DashboardMetrics] Connected');
        this.reconnectAttempts = 0;
        this.updateConnectionState('connected');
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: DashboardMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[DashboardMetrics] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[DashboardMetrics] WebSocket error:', error);
        this.updateConnectionState('error');
        if (this.onError) {
          this.onError('Connection error. Please check your network and try again.');
        }
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[DashboardMetrics] Disconnected:', event.code, event.reason);
        this.stopHeartbeat();
        this.updateConnectionState('disconnected');

        // Show user-friendly error messages for specific close codes
        if (event.code === 1008) {
          if (this.onError) {
            this.onError(event.reason || 'Authentication failed');
          }
        } else if (event.code === 1003) {
          if (this.onError) {
            this.onError('Not authorized for this organization');
          }
        } else if (event.code === 1011) {
          if (this.onError) {
            this.onError('Internal server error');
          }
        }

        // Attempt reconnection for non-auth errors
        if (event.code !== 1008 && event.code !== 1003 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[DashboardMetrics] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            if (this.tenantId) {
              this.connect(this.tenantId);
            }
          }, this.reconnectDelay * this.reconnectAttempts);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.updateConnectionState('error');
          if (this.onError) {
            this.onError('Failed to reconnect after multiple attempts');
          }
        }
      };
    });
  }

  private handleMessage(message: DashboardMessage): void {
    switch (message.type) {
      case 'metrics_update':
        if (message.data && this.onMetricsUpdate) {
          this.onMetricsUpdate(message.data);
        }
        break;

      case 'pong':
        // Heartbeat response - connection is alive
        break;

      case 'error':
        console.error('[DashboardMetrics] Server error:', message.error);
        if (this.onError) {
          this.onError(message.error || 'An error occurred');
        }
        break;

      default:
        console.log('[DashboardMetrics] Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }
  }

  requestUpdate(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'request_update' }));
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateConnectionState('disconnected');
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }
}

// React hook for easy usage
export function useDashboardMetrics(tenantId: string | undefined | null) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<DashboardMetricsClient | null>(null);

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Create client if it doesn't exist
    if (!clientRef.current) {
      clientRef.current = new DashboardMetricsClient();
      
      // Set up callbacks
      clientRef.current.onMetricsUpdate = (newMetrics) => {
        setMetrics(newMetrics);
        setError(null);
      };

      clientRef.current.onConnectionStateChange = (state) => {
        setConnectionState(state);
      };

      clientRef.current.onError = (errorMsg) => {
        setError(errorMsg);
      };
    }

    // Connect to WebSocket
    clientRef.current.connect(tenantId).catch((err) => {
      console.error('[DashboardMetrics] Failed to connect:', err);
      setError('Failed to connect to real-time metrics');
    });

    // Cleanup on unmount or tenantId change
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [tenantId]);

  const refresh = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.requestUpdate();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (clientRef.current && tenantId) {
      clientRef.current.disconnect();
      clientRef.current.connect(tenantId).catch((err) => {
        console.error('[DashboardMetrics] Failed to reconnect:', err);
        setError('Failed to reconnect to real-time metrics');
      });
    }
  }, [tenantId]);

  return {
    metrics,
    connectionState,
    error,
    refresh,
    reconnect,
    isConnected: connectionState === 'connected',
  };
}
