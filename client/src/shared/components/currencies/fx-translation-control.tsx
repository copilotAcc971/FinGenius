import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FxTranslationStatus {
  translationApplied: boolean;
  baseCurrency: string;
}

interface FxTranslationRun {
  id: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  ociAmount?: string;
  retainedEarningsAmount?: string;
}

export function FxTranslationControl() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState<Date>();
  const [periodEnd, setPeriodEnd] = useState<Date>();

  const { data: status } = useQuery<FxTranslationStatus>({
    queryKey: ['/api/fx-translation/status'],
  });

  const { data: runs } = useQuery<FxTranslationRun[]>({
    queryKey: ['/api/fx-translation/runs'],
  });

  const executeMutation = useMutation({
    mutationFn: async (data: { periodStart: Date; periodEnd: Date }) => {
      return await apiRequest('/api/fx-translation/execute', 'POST', {
        periodStart: data.periodStart.toISOString(),
        periodEnd: data.periodEnd.toISOString(),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/fx-translation/runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fx-translation/status'] });
      
      setOpen(false);
      setPeriodStart(undefined);
      setPeriodEnd(undefined);
      
      toast({
        title: 'FX Translation Completed',
        description: `OCI Amount: ${data.summary?.ociAmount?.toFixed(2) || '0.00'} | P&L Amount: ${data.summary?.plAmount?.toFixed(2) || '0.00'} | Accounts: ${data.summary?.accountsProcessed || 0}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'FX Translation Failed',
        description: error.message || 'An error occurred during translation',
        variant: 'destructive',
      });
    },
  });

  const handleExecute = () => {
    if (!periodStart || !periodEnd) {
      toast({
        title: 'Validation Error',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }

    if (periodStart >= periodEnd) {
      toast({
        title: 'Validation Error',
        description: 'Period start must be before period end',
        variant: 'destructive',
      });
      return;
    }

    executeMutation.mutate({ periodStart, periodEnd });
  };

  const lastRun = runs?.[0];

  return (
    <div className="space-y-4" data-testid="fx-translation-control">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">FX Translation (IAS 21)</h3>
          <p className="text-sm text-muted-foreground">
            Execute foreign currency translation for financial statement consolidation
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          data-testid="button-run-fx-translation"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Run FX Translation
        </Button>
      </div>

      {lastRun && (
        <div className="rounded-md border p-4" data-testid="last-translation-run">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Last Run:</span>{' '}
              <span data-testid="text-last-run-date">
                {format(new Date(lastRun.runDate), 'PPP')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <span
                className={cn(
                  'font-medium',
                  lastRun.status === 'completed' && 'text-green-600',
                  lastRun.status === 'running' && 'text-blue-600',
                  lastRun.status === 'failed' && 'text-red-600'
                )}
                data-testid="text-last-run-status"
              >
                {lastRun.status}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Period:</span>{' '}
              <span data-testid="text-last-run-period">
                {format(new Date(lastRun.periodStart), 'PP')} -{' '}
                {format(new Date(lastRun.periodEnd), 'PP')}
              </span>
            </div>
            {lastRun.ociAmount && (
              <div>
                <span className="text-muted-foreground">OCI Amount:</span>{' '}
                <span data-testid="text-last-run-oci">
                  {parseFloat(lastRun.ociAmount).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-fx-translation">
          <DialogHeader>
            <DialogTitle>Execute FX Translation</DialogTitle>
            <DialogDescription>
              Translate foreign currency balances to {status?.baseCurrency || 'base currency'} per IAS 21 standards.
              This will create journal entries for realized and unrealized FX gains/losses.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="periodStart">Period Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !periodStart && 'text-muted-foreground'
                    )}
                    data-testid="button-select-period-start"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {periodStart ? format(periodStart, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={periodStart}
                    onSelect={setPeriodStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="periodEnd">Period End (Closing Date)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !periodEnd && 'text-muted-foreground'
                    )}
                    data-testid="button-select-period-end"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {periodEnd ? format(periodEnd, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={periodEnd}
                    onSelect={setPeriodEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={executeMutation.isPending}
              data-testid="button-cancel-fx-translation"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecute}
              disabled={executeMutation.isPending || !periodStart || !periodEnd}
              data-testid="button-confirm-fx-translation"
            >
              {executeMutation.isPending ? 'Executing...' : 'Execute Translation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
