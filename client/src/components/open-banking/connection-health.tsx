import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/api/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  WifiIcon, 
  WifiOffIcon, 
  RefreshCwIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  ActivityIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number | null;
}

interface RetryStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalRetries: number;
  lastSuccessTime?: string;
  lastFailureTime?: string;
  averageResponseTime: number;
  tokenRefreshes: number;
}

interface SyncStatus {
  connectionId: string;
  status: 'idle' | 'syncing' | 'failed' | 'completed';
  lastSyncTime?: string;
  nextScheduledSync?: string;
  totalTransactionsSynced: number;
  pendingTransactions: number;
  failedTransactions: number;
  lastError?: string;
  retryCount: number;
}

interface HealthMetrics {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  apiAvailability: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  retryStatistics: RetryStatistics;
  syncStatuses: SyncStatus[];
  lastHealthCheck: string;
}

interface BankConnection {
  id: string;
  provider: string;
  bankName: string;
  status: string;
  lastSyncedAt?: string;
  tokenExpiresAt?: string;
  customerName?: string;
}

export function ConnectionHealth() {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all connections
  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/open-banking/connections'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch health metrics for all providers
  const { data: healthMetrics, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['/api/open-banking/health'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest(`/api/open-banking/connections/${connectionId}/test`);
    },
    onSuccess: (data, connectionId) => {
      if (data.success) {
        toast({
          title: 'Connection Test Successful',
          description: data.message,
        });
      } else {
        toast({
          title: 'Connection Test Failed',
          description: data.message,
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/open-banking/health'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to test connection',
        variant: 'destructive',
      });
    },
  });

  // Reconnect mutation
  const reconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      // This would trigger the OAuth flow again
      return await apiRequest(`/api/open-banking/connections/${connectionId}/reconnect`, {
        method: 'POST',
      });
    },
    onSuccess: (data, connectionId) => {
      toast({
        title: 'Reconnection Initiated',
        description: 'Please complete the bank authorization process',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/open-banking/connections'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Reconnection Failed',
        description: error.message || 'Failed to initiate reconnection',
        variant: 'destructive',
      });
    },
  });

  // Manual sync trigger mutation
  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      // Get the bank accounts for this connection and trigger sync
      const accounts = await apiRequest(`/api/open-banking/connections/${connectionId}/accounts`);
      if (accounts && accounts.length > 0) {
        return await apiRequest(`/api/open-banking/bank-accounts/${accounts[0].id}/sync-transactions`, {
          method: 'POST',
          body: JSON.stringify({ forceSync: true }),
        });
      }
      throw new Error('No accounts found for this connection');
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Started',
        description: 'Transaction synchronization has been initiated',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/open-banking/health'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to start synchronization',
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertCircleIcon className="h-5 w-5 text-yellow-600" />;
      case 'unhealthy':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
    }
  };

  const getCircuitBreakerIcon = (state: 'closed' | 'open' | 'half-open') => {
    switch (state) {
      case 'closed':
        return <ShieldCheckIcon className="h-4 w-4 text-green-600" />;
      case 'half-open':
        return <ShieldAlertIcon className="h-4 w-4 text-yellow-600" />;
      case 'open':
        return <ShieldOffIcon className="h-4 w-4 text-red-600" />;
    }
  };

  const getConnectionStatus = (connection: BankConnection, health?: HealthMetrics) => {
    const syncStatus = health?.syncStatuses?.find(s => s.connectionId === connection.id);
    
    if (!health) return 'unknown';
    if (health.status === 'unhealthy') return 'error';
    if (syncStatus?.status === 'failed') return 'error';
    if (syncStatus?.status === 'syncing') return 'syncing';
    if (health.status === 'degraded') return 'warning';
    return 'connected';
  };

  const formatSuccessRate = (stats: RetryStatistics) => {
    if (stats.totalRequests === 0) return 'N/A';
    const rate = (stats.successfulRequests / stats.totalRequests) * 100;
    return `${rate.toFixed(1)}%`;
  };

  if (connectionsLoading || healthLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const allHealthMetrics = healthMetrics as HealthMetrics[] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-connection-health">Open Banking Connection Health</h2>
        <Button
          onClick={() => refetchHealth()}
          variant="outline"
          size="sm"
          data-testid="button-refresh-health"
        >
          <RefreshCwIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Provider Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {allHealthMetrics.map((health) => (
          <Card key={health.provider} className="hover-elevate">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {health.provider.toUpperCase()}
                </CardTitle>
                {getStatusIcon(health.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Circuit Breaker</span>
                  <div className="flex items-center gap-1">
                    {getCircuitBreakerIcon(health.circuitBreakerState)}
                    <span className="text-xs">{health.circuitBreakerState}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Success Rate</span>
                  <span className="text-xs font-medium">
                    {formatSuccessRate(health.retryStatistics)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Avg Response</span>
                  <span className="text-xs font-medium">
                    {health.retryStatistics.averageResponseTime.toFixed(0)}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Individual Connections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" data-testid="heading-bank-connections">Bank Connections</h3>
        
        {connections && connections.length === 0 && (
          <Alert>
            <AlertDescription>
              No bank connections found. Connect a bank account to get started.
            </AlertDescription>
          </Alert>
        )}

        {connections?.map((connection: BankConnection) => {
          const providerHealth = allHealthMetrics.find(h => h.provider === connection.provider);
          const syncStatus = providerHealth?.syncStatuses?.find(s => s.connectionId === connection.id);
          const connectionStatus = getConnectionStatus(connection, providerHealth);

          return (
            <Card key={connection.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {connectionStatus === 'connected' && <WifiIcon className="h-5 w-5 text-green-600" />}
                    {connectionStatus === 'error' && <WifiOffIcon className="h-5 w-5 text-red-600" />}
                    {connectionStatus === 'warning' && <WifiIcon className="h-5 w-5 text-yellow-600" />}
                    {connectionStatus === 'syncing' && <RefreshCwIcon className="h-5 w-5 text-blue-600 animate-spin" />}
                    <div>
                      <CardTitle className="text-lg">
                        {connection.bankName || 'Unknown Bank'}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {connection.customerName || 'Account Holder'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={connectionStatus === 'connected' ? 'default' : 
                              connectionStatus === 'error' ? 'destructive' : 
                              connectionStatus === 'syncing' ? 'secondary' : 'outline'}
                    >
                      {connectionStatus === 'syncing' ? 'Syncing...' : connectionStatus}
                    </Badge>
                    {connection.provider && (
                      <Badge variant="outline">{connection.provider}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sync Status */}
                {syncStatus && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
                      <p className="text-sm font-medium">
                        {syncStatus.lastSyncTime 
                          ? formatDistanceToNow(new Date(syncStatus.lastSyncTime), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Next Sync</p>
                      <p className="text-sm font-medium">
                        {syncStatus.nextScheduledSync
                          ? format(new Date(syncStatus.nextScheduledSync), 'HH:mm')
                          : 'Not scheduled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                      <p className="text-sm font-medium">
                        {syncStatus.totalTransactionsSynced}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Retry Count</p>
                      <p className="text-sm font-medium">
                        {syncStatus.retryCount}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {syncStatus?.lastError && (
                  <Alert variant="destructive">
                    <AlertDescription>{syncStatus.lastError}</AlertDescription>
                  </Alert>
                )}

                {/* Connection Details */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Token Expires</p>
                    <p className="text-sm font-medium">
                      {connection.tokenExpiresAt
                        ? formatDistanceToNow(new Date(connection.tokenExpiresAt), { addSuffix: true })
                        : 'Unknown'}
                    </p>
                  </div>
                  {providerHealth && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">API Status</p>
                        <p className="text-sm font-medium">
                          {providerHealth.apiAvailability ? 'Available' : 'Unavailable'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Token Refreshes</p>
                        <p className="text-sm font-medium">
                          {providerHealth.retryStatistics.tokenRefreshes}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnectionMutation.mutate(connection.id)}
                    disabled={testConnectionMutation.isPending}
                    data-testid={`button-test-connection-${connection.id}`}
                  >
                    {testConnectionMutation.isPending ? (
                      <>
                        <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <ActivityIcon className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>

                  {connectionStatus === 'error' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => reconnectMutation.mutate(connection.id)}
                      disabled={reconnectMutation.isPending}
                      data-testid={`button-reconnect-${connection.id}`}
                    >
                      {reconnectMutation.isPending ? (
                        <>
                          <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <WifiIcon className="h-4 w-4 mr-2" />
                          Reconnect
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncMutation.mutate(connection.id)}
                    disabled={syncMutation.isPending || syncStatus?.status === 'syncing'}
                    data-testid={`button-sync-${connection.id}`}
                  >
                    {syncMutation.isPending || syncStatus?.status === 'syncing' ? (
                      <>
                        <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCwIcon className="h-4 w-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}