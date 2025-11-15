import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Mail, Play, Trash2, Edit, History, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ScheduledReport, ScheduledReportRun } from '@shared/schema';
import { frequencyToCron, cronToReadable, parseFrequencyFromCron, type FrequencyPreset } from '@/lib/cronHelpers';

const scheduledReportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  reportType: z.enum(['profit_loss', 'balance_sheet', 'cash_flow', 'trial_balance', 'custom']),
  customReportId: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'custom'] as const),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  customCron: z.string().optional(),
  recipients: z.string().min(1, 'At least one recipient is required'),
  emailSubject: z.string().min(1, 'Email subject is required'),
  emailBody: z.string().optional(),
  includeComparison: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type ScheduledReportFormData = z.infer<typeof scheduledReportSchema>;

export default function ScheduledReportsPage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || '';
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedReportForHistory, setSelectedReportForHistory] = useState<ScheduledReport | null>(null);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);

  // Fetch scheduled reports
  const { data: reports = [], isLoading } = useQuery<ScheduledReport[]>({
    queryKey: ['/api/scheduled-reports', tenantId],
    enabled: !!tenantId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/scheduled-reports/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports', tenantId] });
      toast({
        title: 'Report deleted',
        description: 'Scheduled report has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete scheduled report.',
        variant: 'destructive',
      });
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/scheduled-reports/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports', tenantId] });
      toast({
        title: 'Status updated',
        description: 'Report schedule status has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update report status.',
        variant: 'destructive',
      });
    },
  });

  // Run now mutation
  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/scheduled-reports/${id}/run-now`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Report triggered',
        description: 'Report execution has been triggered.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to trigger report execution.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled report?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleRunNow = (id: string) => {
    runNowMutation.mutate(id);
  };

  const handleViewHistory = (report: ScheduledReport) => {
    setSelectedReportForHistory(report);
    setIsHistoryDialogOpen(true);
  };

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setIsCreateDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingReport(null);
    setIsCreateDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingReport(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-scheduled-reports">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-scheduled-reports">Scheduled Reports</h1>
          <p className="text-muted-foreground">
            Automate report generation and email delivery
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-scheduled-report">
          <Plus className="w-4 h-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Schedules</CardTitle>
          <CardDescription>
            Manage your automated report schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8" data-testid="loading-scheduled-reports">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-scheduled-reports">
              No scheduled reports yet. Create your first schedule to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} data-testid={`row-scheduled-report-${report.id}`}>
                    <TableCell className="font-medium" data-testid={`text-report-name-${report.id}`}>
                      {report.name}
                    </TableCell>
                    <TableCell data-testid={`text-report-type-${report.id}`}>
                      {report.reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </TableCell>
                    <TableCell data-testid={`text-schedule-${report.id}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {cronToReadable(report.schedule)}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-recipients-${report.id}`}>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {report.recipients.length} recipient(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={report.isActive ? 'default' : 'secondary'}
                        data-testid={`badge-status-${report.id}`}
                      >
                        {report.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-last-run-${report.id}`}>
                      {report.lastRunAt
                        ? new Date(report.lastRunAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(report)}
                          data-testid={`button-edit-${report.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(report.id, report.isActive)}
                          data-testid={`button-toggle-${report.id}`}
                        >
                          <Calendar className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRunNow(report.id)}
                          data-testid={`button-run-now-${report.id}`}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewHistory(report)}
                          data-testid={`button-history-${report.id}`}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(report.id)}
                          data-testid={`button-delete-${report.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateEditDialog
        open={isCreateDialogOpen}
        onOpenChange={handleDialogClose}
        editingReport={editingReport}
        tenantId={tenantId}
      />

      <HistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        report={selectedReportForHistory}
        tenantId={tenantId}
      />
    </div>
  );
}

interface CreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReport: ScheduledReport | null;
  tenantId: string;
}

function CreateEditDialog({ open, onOpenChange, editingReport, tenantId }: CreateEditDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editingReport;

  // Parse existing schedule if editing
  const existingConfig = editingReport
    ? parseFrequencyFromCron(editingReport.schedule)
    : null;

  const form = useForm<ScheduledReportFormData>({
    resolver: zodResolver(scheduledReportSchema),
    defaultValues: {
      name: editingReport?.name || '',
      reportType: editingReport?.reportType || 'profit_loss',
      customReportId: editingReport?.customReportId || undefined,
      frequency: (existingConfig?.frequency || 'daily') as FrequencyPreset,
      time: existingConfig?.time || '09:00',
      dayOfWeek: existingConfig?.dayOfWeek,
      dayOfMonth: existingConfig?.dayOfMonth,
      customCron: existingConfig?.customCron,
      recipients: editingReport?.recipients.join(', ') || '',
      emailSubject: editingReport?.emailSubject || '',
      emailBody: editingReport?.emailBody || '',
      includeComparison: editingReport?.includeComparison || false,
      isActive: editingReport?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = isEditing
        ? `/api/scheduled-reports/${editingReport.id}`
        : '/api/scheduled-reports';
      const method = isEditing ? 'PATCH' : 'POST';

      return await apiRequest(endpoint, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports', tenantId] });
      toast({
        title: isEditing ? 'Report updated' : 'Report created',
        description: `Scheduled report has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} scheduled report.`,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ScheduledReportFormData) => {
    // Convert frequency to cron
    const schedule = frequencyToCron({
      frequency: data.frequency,
      time: data.time,
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
      customCron: data.customCron,
    });

    // Parse recipients
    const recipients = data.recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    createMutation.mutate({
      name: data.name,
      reportType: data.reportType,
      customReportId: data.customReportId || null,
      schedule,
      recipients,
      emailSubject: data.emailSubject,
      emailBody: data.emailBody || '',
      includeComparison: data.includeComparison,
      isActive: data.isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-edit-scheduled-report">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Scheduled Report</DialogTitle>
          <DialogDescription>
            Configure automatic report generation and email delivery
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Monthly P&L Report" data-testid="input-report-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-report-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="profit_loss">Profit & Loss Statement</SelectItem>
                      <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                      <SelectItem value="cash_flow">Cash Flow Statement</SelectItem>
                      <SelectItem value="trial_balance">Trial Balance</SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Schedule</FormLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time (UTC)</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" data-testid="input-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipients</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="user1@example.com, user2@example.com"
                      data-testid="input-recipients"
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated email addresses
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailSubject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Subject</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Monthly P&L Report - {date}" data-testid="input-email-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailBody"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Body (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Custom message..." data-testid="input-email-body" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="includeComparison"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Include Comparison Period</FormLabel>
                    <FormDescription>
                      Compare with previous period in the report
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-include-comparison"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable automatic report generation
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-schedule">
                {createMutation.isPending ? 'Saving...' : 'Save Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ScheduledReport | null;
  tenantId: string;
}

function HistoryDialog({ open, onOpenChange, report, tenantId }: HistoryDialogProps) {
  const { data: runs = [], isLoading } = useQuery<ScheduledReportRun[]>({
    queryKey: ['/api/scheduled-reports', report?.id, 'runs', tenantId],
    enabled: open && !!report && !!tenantId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="dialog-execution-history">
        <DialogHeader>
          <DialogTitle>Execution History: {report?.name}</DialogTitle>
          <DialogDescription>
            View past executions of this scheduled report
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8" data-testid="loading-history">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-history">
            No execution history yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Email Sent</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} data-testid={`row-run-${run.id}`}>
                  <TableCell data-testid={`text-run-date-${run.id}`}>
                    {new Date(run.runAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={run.status === 'success' ? 'default' : 'destructive'}
                      data-testid={`badge-run-status-${run.id}`}
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-recipient-count-${run.id}`}>
                    {run.recipientCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={run.emailSent ? 'default' : 'secondary'} data-testid={`badge-email-sent-${run.id}`}>
                      {run.emailSent ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" data-testid={`text-error-${run.id}`}>
                    {run.errorMessage || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
