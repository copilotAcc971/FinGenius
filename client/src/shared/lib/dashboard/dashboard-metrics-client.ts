import { useState, useEffect, useRef, useCallback } from 'react';

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Dashboard metrics structure (matches backend)
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

interface MetricsMessage {
  type: string;
  data?: DashboardMetrics;
  error?: string;
}

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

/**
 * WebSocket client for real-time dashboard metrics
 * - Auto-reconnects on disconnect
 * - Authenticates via session cookies
 * - Supports manual refresh requests
 */
export class DashboardMetricsClient {
  private ws: ExtendedWebSocket | null = null;
  private tenantId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;

  // Callbacks
  public onMetricsUpdate: ((metrics: DashboardMetrics) => void) | null = null;
  public onConnectionStateChange: ((state: ConnectionState) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  /**
   * Connect to dashboard metrics WebSocket
   * @param tenantId - The tenant ID to subscribe to
   */
  async connect(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    this.tenantId = tenantId;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/dashboard-metrics?tenantId=${encodeURIComponent(tenantId)}`;

      console.log('[DashboardMetrics] Connecting to:', wsUrl);
      this.setConnectionState('connecting');

      this.ws = new WebSocket(wsUrl) as ExtendedWebSocket;
      this.ws.isAlive = true;

      this.ws.onopen = () => {
        console.log('[DashboardMetrics] Connected successfully');
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[DashboardMetrics] WebSocket error:', error);
        this.setConnectionState('error');
        
        if (this.onError) {
          this.onError('Connection error. Please check your network.');
        }
        
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[DashboardMetrics] Disconnected:', event.code, event.reason);
        this.stopHeartbeat();
        this.setConnectionState('disconnected');

        // Handle specific close codes
        if (event.code === 1008) {
          const errorMsg = event.reason || 'Authentication failed';
          console.error('[DashboardMetrics]', errorMsg);
          if (this.onError) {
            this.onError(errorMsg);
          }
          this.shouldReconnect = false;
        } else if (event.code === 1003) {
          const errorMsg = 'Not authorized for this organization';
          console.error('[DashboardMetrics]', errorMsg);
          if (this.onError) {
            this.onError(errorMsg);
          }
          this.shouldReconnect = false;
        } else if (event.code === 1011) {
          const errorMsg = 'Internal server error';
          console.error('[DashboardMetrics]', errorMsg);
          if (this.onError) {
            this.onError(errorMsg);
          }
        }

        // Attempt reconnection for recoverable errors
        if (this.shouldReconnect && 
            event.code !== 1008 && 
            event.code !== 1003 && 
            this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: MetricsMessage = JSON.parse(data);

      switch (message.type) {
        case 'metrics_update':
          if (message.data && this.onMetricsUpdate) {
            this.onMetricsUpdate(message.data);
          }
          break;

        case 'pong':
          if (this.ws) {
            this.ws.isAlive = true;
          }
          break;

        case 'error':
          console.error('[DashboardMetrics] Server error:', message.error);
          if (this.onError && message.error) {
            this.onError(message.error);
          }
          break;

        default:
          console.log('[DashboardMetrics] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[DashboardMetrics] Error parsing message:', error);
    }
  }

  /**
   * Request fresh metrics from the server
   */
  requestUpdate(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[DashboardMetrics] Requesting metrics update');
      this.ws.send(JSON.stringify({
        type: 'request_update'
      }));
    } else {
      console.warn('[DashboardMetrics] Cannot request update - not connected');
      if (this.onError) {
        this.onError('Not connected. Please wait for reconnection.');
      }
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[DashboardMetrics] Disconnecting...');
    this.shouldReconnect = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(
      `[DashboardMetrics] Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      if (this.tenantId && this.shouldReconnect) {
        this.connect(this.tenantId).catch((error) => {
          console.error('[DashboardMetrics] Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat ping/pong
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.isAlive === false) {
        console.warn('[DashboardMetrics] Heartbeat timeout - terminating connection');
        this.ws.terminate();
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.isAlive = false;
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }
  }
}

/**
 * React hook for dashboard metrics WebSocket
 * @param tenantId - The tenant ID to subscribe to (null to not connect)
 * @returns Metrics data, connection state, and control functions
 */
export function useDashboardMetrics(tenantId: string | null) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<DashboardMetricsClient | null>(null);

  // Initialize client on mount
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new DashboardMetricsClient();
      
      // Set up callbacks
      clientRef.current.onMetricsUpdate = (newMetrics) => {
        setMetrics(newMetrics);
        setError(null); // Clear error on successful update
      };

      clientRef.current.onConnectionStateChange = (state) => {
        setConnectionState(state);
      };

      clientRef.current.onError = (errorMsg) => {
        setError(errorMsg);
      };
    }

    return () => {
      // Cleanup on unmount
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  // Connect/disconnect based on tenantId
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    if (tenantId) {
      console.log('[useDashboardMetrics] Connecting for tenant:', tenantId);
      client.connect(tenantId).catch((err) => {
        console.error('[useDashboardMetrics] Connection failed:', err);
        setError('Failed to connect to live metrics');
      });
    } else {
      console.log('[useDashboardMetrics] No tenant ID - disconnecting');
      client.disconnect();
    }

    return () => {
      // Disconnect when tenantId changes
      if (client.isConnected()) {
        client.disconnect();
      }
    };
  }, [tenantId]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.requestUpdate();
    }
  }, []);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (clientRef.current && tenantId) {
      clientRef.current.disconnect();
      setTimeout(() => {
        clientRef.current?.connect(tenantId).catch((err) => {
          console.error('[useDashboardMetrics] Reconnection failed:', err);
          setError('Failed to reconnect to live metrics');
        });
      }, 500);
    }
  }, [tenantId]);

  return {
    metrics,
    connectionState,
    error,
    refresh,
    reconnect,
    isConnected: connectionState === 'connected'
  };
}
