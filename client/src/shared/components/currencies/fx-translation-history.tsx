import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FxTranslationRun {
  id: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  status: 'running' | 'completed' | 'failed';
  ociAmount?: string;
  retainedEarningsAmount?: string;
  createdBy: string;
}

interface JournalEntry {
  id: string;
  entryDate: string;
  description: string;
  referenceNumber: string;
  totalDebit: string;
  totalCredit: string;
  status: string;
}

interface FxTranslationRunDetails extends FxTranslationRun {
  entries?: JournalEntry[];
}

export function FxTranslationHistory() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: runs, isLoading } = useQuery<FxTranslationRun[]>({
    queryKey: ['/api/fx-translation/runs'],
  });

  const { data: runDetails } = useQuery<FxTranslationRunDetails>({
    queryKey: ['/api/fx-translation/runs', selectedRunId],
    enabled: !!selectedRunId,
  });

  const filteredRuns = runs?.filter((run) => {
    if (statusFilter === 'all') return true;
    return run.status === statusFilter;
  });

  const handleExportCSV = () => {
    if (!filteredRuns || filteredRuns.length === 0) return;

    const headers = [
      'Run Date',
      'Period Start',
      'Period End',
      'Status',
      'OCI Amount',
      'P&L Amount',
      'Created By',
    ];

    const rows = filteredRuns.map((run) => [
      format(new Date(run.runDate), 'yyyy-MM-dd'),
      format(new Date(run.periodStart), 'yyyy-MM-dd'),
      format(new Date(run.periodEnd), 'yyyy-MM-dd'),
      run.status,
      run.ociAmount || '0.00',
      run.retainedEarningsAmount || '0.00',
      run.createdBy,
    ]);

    const csvContent =
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fx-translation-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-fx-history">
        <p className="text-muted-foreground">Loading FX translation history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="fx-translation-history">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">FX Translation History</h3>
          <p className="text-sm text-muted-foreground">
            View all foreign currency translation runs and their results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter('all')}
              className={cn(statusFilter === 'all' && 'bg-muted')}
              data-testid="button-filter-all"
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter('completed')}
              className={cn(statusFilter === 'completed' && 'bg-muted')}
              data-testid="button-filter-completed"
            >
              Completed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter('failed')}
              className={cn(statusFilter === 'failed' && 'bg-muted')}
              data-testid="button-filter-failed"
            >
              Failed
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!filteredRuns || filteredRuns.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!filteredRuns || filteredRuns.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-md border border-dashed py-12"
          data-testid="empty-fx-history"
        >
          <p className="text-muted-foreground">No FX translation runs found</p>
        </div>
      ) : (
        <div className="rounded-md border" data-testid="table-fx-translation-runs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">OCI Amount</TableHead>
                <TableHead className="text-right">P&L Amount</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow
                  key={run.id}
                  data-testid={`row-fx-run-${run.id}`}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <TableCell data-testid={`text-run-date-${run.id}`}>
                    {format(new Date(run.runDate), 'PPP')}
                  </TableCell>
                  <TableCell data-testid={`text-period-${run.id}`}>
                    {format(new Date(run.periodStart), 'PP')} -{' '}
                    {format(new Date(run.periodEnd), 'PP')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusBadgeVariant(run.status)}
                      data-testid={`badge-status-${run.id}`}
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-oci-${run.id}`}>
                    {run.ociAmount
                      ? parseFloat(run.ociAmount).toFixed(2)
                      : '0.00'}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-pl-${run.id}`}>
                    {run.retainedEarningsAmount
                      ? parseFloat(run.retainedEarningsAmount).toFixed(2)
                      : '0.00'}
                  </TableCell>
                  <TableCell data-testid={`text-created-by-${run.id}`}>
                    {run.createdBy}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRunId(run.id);
                      }}
                      data-testid={`button-view-details-${run.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedRunId} onOpenChange={() => setSelectedRunId(null)}>
        <DialogContent className="max-w-4xl" data-testid="dialog-fx-run-details">
          <DialogHeader>
            <DialogTitle>FX Translation Run Details</DialogTitle>
            <DialogDescription>
              View the journal entries created by this translation run
            </DialogDescription>
          </DialogHeader>

          {runDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                <div>
                  <span className="text-sm text-muted-foreground">Run Date:</span>
                  <p className="font-medium" data-testid="detail-run-date">
                    {format(new Date(runDetails.runDate), 'PPP')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <p className="font-medium" data-testid="detail-status">
                    {runDetails.status}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Period:</span>
                  <p className="font-medium" data-testid="detail-period">
                    {format(new Date(runDetails.periodStart), 'PP')} -{' '}
                    {format(new Date(runDetails.periodEnd), 'PP')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">OCI Amount:</span>
                  <p className="font-medium" data-testid="detail-oci-amount">
                    {runDetails.ociAmount
                      ? parseFloat(runDetails.ociAmount).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
              </div>

              {runDetails.entries && runDetails.entries.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Journal Entries</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runDetails.entries.map((entry) => (
                          <TableRow
                            key={entry.id}
                            data-testid={`row-entry-${entry.id}`}
                          >
                            <TableCell>
                              {format(new Date(entry.entryDate), 'PP')}
                            </TableCell>
                            <TableCell>{entry.referenceNumber}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right">
                              {parseFloat(entry.totalDebit).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  No journal entries found for this run
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
