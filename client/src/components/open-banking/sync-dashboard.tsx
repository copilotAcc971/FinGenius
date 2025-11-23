import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  RefreshCwIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ActivityIcon,
  AlertTriangleIcon,
  InfoIcon,
  DownloadIcon,
  UploadIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/shared/hooks/use-toast';

interface SyncAttempt {
  id: string;
  connectionId: string;
  connectionName: string;
  timestamp: string;
  status: 'success' | 'failed' | 'partial' | 'in_progress';
  transactionsSynced: number;
  transactionsFailed: number;
  duration: number; // in milliseconds
  retryCount: number;
  error?: string;
  rateLimitHit?: boolean;
}

interface SyncStatistics {
  totalSynced: number;
  pendingSync: number;
  failedSync: number;
  successRate: number;
  averageSyncTime: number;
  lastSuccessfulSync?: string;
  lastFailedSync?: string;
  activeJobs: number;
  queuedJobs: number;
}

interface RateLimitStatus {
  provider: string;
  remaining: number;
  limit: number;
  resetsAt: string;
  currentUsage: number;
}

interface ConnectionSyncStatus {
  connectionId: string;
  connectionName: string;
  bankName: string;
  provider: string;
  isSyncing: boolean;
  progress: number;
  lastSyncTime?: string;
  nextScheduledSync?: string;
  totalTransactions: number;
  newTransactions: number;
  status: 'idle' | 'syncing' | 'completed' | 'failed';
}

export function SyncDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [syncingConnections, setSyncingConnections] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch sync statistics
  const { data: syncStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SyncStatistics>({
    queryKey: ['/api/open-banking/sync-statistics'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch recent sync attempts
  const { data: syncHistory, isLoading: historyLoading } = useQuery<SyncAttempt[]>({
    queryKey: ['/api/open-banking/sync-history'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch connection sync statuses
  const { data: connectionStatuses, isLoading: statusesLoading } = useQuery<ConnectionSyncStatus[]>({
    queryKey: ['/api/open-banking/connections/sync-status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch rate limit status
  const { data: rateLimits, isLoading: rateLimitsLoading } = useQuery<RateLimitStatus[]>({
    queryKey: ['/api/open-banking/rate-limits'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Manual sync trigger mutation
  const triggerSyncMutation = useMutation({
    mutationFn: async (connectionId?: string) => {
      if (connectionId) {
        // Sync specific connection
        const connection = connectionStatuses?.find(c => c.connectionId === connectionId);
        if (connection) {
          setSyncingConnections(prev => new Set(prev).add(connectionId));
          return await apiRequest(`/api/open-banking/connections/${connectionId}/sync`, {
            method: 'POST',
            body: JSON.stringify({ forceSync: true }),
          });
        }
      } else {
        // Sync all connections
        return await apiRequest('/api/open-banking/sync-all', {
          method: 'POST',
          body: JSON.stringify({ forceSync: true }),
        });
      }
    },
    onSuccess: (data, connectionId) => {
      toast({
        title: 'Sync Initiated',
        description: connectionId 
          ? `Synchronization started for connection`
          : 'Synchronization started for all connections',
      });
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['/api/open-banking/connections/sync-status'] });
      
      // Remove from syncing set after delay
      if (connectionId) {
        setTimeout(() => {
          setSyncingConnections(prev => {
            const newSet = new Set(prev);
            newSet.delete(connectionId);
            return newSet;
          });
        }, 30000); // 30 seconds
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to initiate synchronization',
        variant: 'destructive',
      });
    },
  });

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'partial':
        return <AlertCircleIcon className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
      case 'syncing':
        return <RefreshCwIcon className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSyncStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'partial':
        return 'outline';
      case 'in_progress':
      case 'syncing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getRateLimitPercentage = (used: number, limit: number) => {
    return (used / limit) * 100;
  };

  const getRateLimitColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-sync-dashboard">Transaction Sync Dashboard</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => refetchStats()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-stats"
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => triggerSyncMutation.mutate()}
            disabled={triggerSyncMutation.isPending}
            data-testid="button-sync-all"
          >
            {triggerSyncMutation.isPending ? (
              <>
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 mr-2" />
                Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-synced">
              {syncStats?.totalSynced || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending">
              {syncStats?.pendingSync || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">To be synced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-failed">
              {syncStats?.failedSync || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-success-rate">
              {syncStats?.successRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-jobs">
              {syncStats?.activeJobs || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {syncStats?.queuedJobs || 0} queued
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limit Status */}
      {rateLimits && rateLimits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rateLimits.map((limit) => {
                const percentage = getRateLimitPercentage(limit.currentUsage, limit.limit);
                return (
                  <div key={limit.provider} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{limit.provider}</span>
                      <span className={`text-sm ${getRateLimitColor(percentage)}`}>
                        {limit.remaining}/{limit.limit}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Resets {formatDistanceToNow(new Date(limit.resetsAt), { addSuffix: true })}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Connection Status</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
          <TabsTrigger value="errors">Error Details</TabsTrigger>
        </TabsList>

        {/* Connection Status Tab */}
        <TabsContent value="overview" className="space-y-4">
          {connectionStatuses?.map((connection) => {
            const isSyncing = syncingConnections.has(connection.connectionId) || 
                             connection.isSyncing || 
                             connection.status === 'syncing';
            
            return (
              <Card key={connection.connectionId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {connection.bankName}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {connection.connectionName} • {connection.provider}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getSyncStatusIcon(connection.status)}
                      <Badge variant={getSyncStatusBadgeVariant(connection.status)}>
                        {connection.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isSyncing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Syncing transactions...</span>
                        <span>{connection.progress}%</span>
                      </div>
                      <Progress value={connection.progress} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Transactions</p>
                      <p className="text-sm font-medium">{connection.totalTransactions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">New Transactions</p>
                      <p className="text-sm font-medium">{connection.newTransactions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
                      <p className="text-sm font-medium">
                        {connection.lastSyncTime 
                          ? formatDistanceToNow(new Date(connection.lastSyncTime), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Next Sync</p>
                      <p className="text-sm font-medium">
                        {connection.nextScheduledSync
                          ? format(new Date(connection.nextScheduledSync), 'HH:mm')
                          : 'Not scheduled'}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerSyncMutation.mutate(connection.connectionId)}
                      disabled={isSyncing || triggerSyncMutation.isPending}
                      data-testid={`button-sync-connection-${connection.connectionId}`}
                    >
                      {isSyncing ? (
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

          {connectionStatuses?.length === 0 && (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>No Connections</AlertTitle>
              <AlertDescription>
                No bank connections available for synchronization. Connect a bank account to start syncing transactions.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Sync History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Rate Limit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory?.slice(0, 10).map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="text-sm">
                          {format(new Date(attempt.timestamp), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {attempt.connectionName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSyncStatusIcon(attempt.status)}
                            <Badge variant={getSyncStatusBadgeVariant(attempt.status)}>
                              {attempt.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">{attempt.transactionsSynced}</span>
                            {attempt.transactionsFailed > 0 && (
                              <>
                                <span>/</span>
                                <span className="text-red-600">{attempt.transactionsFailed}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(attempt.duration)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {attempt.retryCount > 0 && (
                            <Badge variant="outline">{attempt.retryCount}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {attempt.rateLimitHit && (
                            <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {syncHistory?.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No sync history available
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Details Tab */}
        <TabsContent value="errors">
          <div className="space-y-4">
            {syncHistory
              ?.filter(attempt => attempt.status === 'failed' && attempt.error)
              .slice(0, 5)
              .map((attempt) => (
                <Alert key={attempt.id} variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>
                    {attempt.connectionName} - {format(new Date(attempt.timestamp), 'HH:mm:ss')}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    {attempt.error}
                    {attempt.retryCount > 0 && (
                      <div className="mt-2">
                        <Badge variant="outline">
                          Retried {attempt.retryCount} time{attempt.retryCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}

            {!syncHistory?.some(a => a.status === 'failed' && a.error) && (
              <Alert>
                <CheckCircleIcon className="h-4 w-4" />
                <AlertTitle>No Recent Errors</AlertTitle>
                <AlertDescription>
                  All recent sync attempts have completed without errors.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}