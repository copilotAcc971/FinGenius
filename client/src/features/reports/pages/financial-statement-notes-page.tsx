import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Calendar as CalendarComponent } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { AlertTriangle, Plus, Edit, Trash2, History, Calendar, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils/utils';
import type { FinancialStatementNote } from '@shared/schema';

const noteSchema = z.object({
  reportingPeriodStart: z.date(),
  reportingPeriodEnd: z.date(),
  noteType: z.enum(['accounting_policy', 'contingent_liability', 'contingent_asset', 'related_party_transaction', 'subsequent_event', 'going_concern', 'significant_accounting_judgment', 'general']),
  noteTitle: z.string().min(1, 'Title is required').max(500),
  noteContent: z.string().min(1, 'Content is required'),
  displayOrder: z.number().min(1).default(1),
  goingConcernStatus: z.enum(['positive', 'uncertainty', 'doubt']).optional(),
  goingConcernAssessmentDate: z.date().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;

const NOTE_TYPE_LABELS: Record<string, string> = {
  accounting_policy: 'Accounting Policy',
  contingent_liability: 'Contingent Liability',
  contingent_asset: 'Contingent Asset',
  related_party_transaction: 'Related Party Transaction',
  subsequent_event: 'Subsequent Event',
  going_concern: 'Going Concern',
  significant_accounting_judgment: 'Significant Accounting Judgment',
  general: 'General Note',
};

const NOTE_TEMPLATES: Record<string, string> = {
  accounting_policy: 'The company follows [IFRS/IFRS for SMEs] standards for financial reporting. The following accounting policies have been applied consistently in preparing the financial statements:\n\n1. [Policy area]\n2. [Policy details]',
  going_concern: 'The directors have assessed the company\'s ability to continue as a going concern and have reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future.\n\n[Add specific details about assessment and any relevant factors considered]',
  contingent_liability: 'As of [date], the company has the following contingent liabilities:\n\n1. [Description]\n   Estimated amount: [Amount]\n   Likelihood: [Remote/Possible/Probable]',
  contingent_asset: 'As of [date], the company has identified the following contingent assets:\n\n1. [Description]\n   Estimated amount: [Amount]',
  related_party_transaction: 'The following related party transactions occurred during the period:\n\n1. [Party name and relationship]\n   Transaction type: [Type]\n   Amount: [Amount]',
  subsequent_event: 'The following events occurred after the reporting period end date but before the financial statements were authorized for issue:\n\n1. [Event description]\n   Date: [Date]\n   Impact: [Description]',
  significant_accounting_judgment: 'In preparing these financial statements, the directors have made the following significant judgments:\n\n1. [Area of judgment]\n   Basis: [Explanation]',
  general: '[Enter note content here]',
};

export default function FinancialStatementNotesPage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || '';
  const { toast } = useToast();
  
  const [periodStart, setPeriodStart] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date(new Date().getFullYear(), 11, 31));
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('all');
  const [isEditorDialogOpen, setIsEditorDialogOpen] = useState(false);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FinancialStatementNote | null>(null);
  const [viewingVersionsFor, setViewingVersionsFor] = useState<FinancialStatementNote | null>(null);

  // Fetch notes for period
  const { data: notes = [], isLoading: notesLoading } = useQuery<FinancialStatementNote[]>({
    queryKey: ['/api/financial-statement-notes', tenantId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      const response = await fetch(`/api/financial-statement-notes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
    enabled: !!tenantId,
  });

  // Fetch going concern status
  const { data: goingConcernStatus } = useQuery<{status: string; assessmentDate: Date | null; reviewedBy: string | null}>({
    queryKey: ['/api/going-concern-status', tenantId],
    enabled: !!tenantId,
  });

  // Fetch version history
  const { data: versions = [] } = useQuery<FinancialStatementNote[]>({
    queryKey: ['/api/financial-statement-notes', viewingVersionsFor?.id, 'versions'],
    queryFn: async () => {
      const response = await fetch(`/api/financial-statement-notes/${viewingVersionsFor!.id}/versions`);
      if (!response.ok) throw new Error('Failed to fetch versions');
      return response.json();
    },
    enabled: !!viewingVersionsFor,
  });

  const form = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      noteType: 'general',
      noteTitle: '',
      noteContent: '',
      displayOrder: 1,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      return await apiRequest('/api/financial-statement-notes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-statement-notes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/going-concern-status', tenantId] });
      toast({ title: 'Success', description: 'Note created successfully.' });
      setIsEditorDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create note.', variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NoteFormData> }) => {
      return await apiRequest(`/api/financial-statement-notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-statement-notes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/going-concern-status', tenantId] });
      toast({ title: 'Success', description: 'Note updated successfully (new version created).' });
      setIsEditorDialogOpen(false);
      setEditingNote(null);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update note.', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/financial-statement-notes/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-statement-notes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['/api/going-concern-status', tenantId] });
      toast({ title: 'Success', description: 'Note deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete note.', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    setEditingNote(null);
    form.reset({
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      noteType: 'general',
      noteTitle: '',
      noteContent: '',
      displayOrder: notes.length + 1,
    });
    setIsEditorDialogOpen(true);
  };

  const handleEdit = (note: FinancialStatementNote) => {
    setEditingNote(note);
    form.reset({
      reportingPeriodStart: new Date(note.reportingPeriodStart),
      reportingPeriodEnd: new Date(note.reportingPeriodEnd),
      noteType: note.noteType as any,
      noteTitle: note.noteTitle,
      noteContent: note.noteContent,
      displayOrder: note.displayOrder,
      goingConcernStatus: note.goingConcernStatus as any,
      goingConcernAssessmentDate: note.goingConcernAssessmentDate ? new Date(note.goingConcernAssessmentDate) : undefined,
    });
    setIsEditorDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewVersions = (note: FinancialStatementNote) => {
    setViewingVersionsFor(note);
    setIsVersionDialogOpen(true);
  };

  const onSubmit = (data: NoteFormData) => {
    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNoteTypeChange = (value: string) => {
    form.setValue('noteType', value as any);
    if (NOTE_TEMPLATES[value]) {
      form.setValue('noteContent', NOTE_TEMPLATES[value]);
    }
  };

  const filteredNotes = noteTypeFilter === 'all' 
    ? notes 
    : notes.filter(n => n.noteType === noteTypeFilter);

  const showGoingConcernAlert = goingConcernStatus && 
    goingConcernStatus.status !== 'positive' && 
    goingConcernStatus.status !== null;

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-financial-statement-notes">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Statement Notes</h1>
          <p className="text-muted-foreground">
            Manage disclosure notes and going concern assessments (IAS 1)
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-add-note">
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>

      {showGoingConcernAlert && (
        <Alert variant="destructive" data-testid={`badge-going-concern-${goingConcernStatus.status}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Going Concern {goingConcernStatus.status === 'uncertainty' ? 'Uncertainty' : 'Doubt'}</AlertTitle>
          <AlertDescription data-testid="text-going-concern-status">
            A going concern assessment with {goingConcernStatus.status} status was recorded
            {goingConcernStatus.assessmentDate && ` on ${format(new Date(goingConcernStatus.assessmentDate), 'PPP')}`}.
            Please review the going concern note for details.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Notes</CardTitle>
          <CardDescription>Select reporting period and note type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period Start</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(periodStart, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={periodStart}
                    onSelect={(date) => date && setPeriodStart(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Period End</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(periodEnd, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={periodEnd}
                    onSelect={(date) => date && setPeriodEnd(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Note Type</label>
              <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter} data-testid="select-note-type">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {notesLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading notes...</p>
          </CardContent>
        </Card>
      ) : filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No notes found for the selected period and type.</p>
              <Button onClick={handleCreate} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create First Note
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNotes.map((note) => (
            <Card key={note.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{note.noteTitle}</CardTitle>
                      <Badge variant="outline">{NOTE_TYPE_LABELS[note.noteType]}</Badge>
                      {note.noteType === 'going_concern' && note.goingConcernStatus && note.goingConcernStatus !== 'positive' && (
                        <Badge variant="destructive">
                          {note.goingConcernStatus === 'uncertainty' ? 'Uncertainty' : 'Doubt'}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Order: {note.displayOrder} • Version: {note.versionNumber} • 
                      Last updated: {format(new Date(note.updatedAt), 'PPP')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(note)}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewVersions(note)}
                      data-testid={`button-view-versions-${note.id}`}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {note.noteContent}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Note Editor Dialog */}
      <Dialog open={isEditorDialogOpen} onOpenChange={(open) => {
        setIsEditorDialogOpen(open);
        if (!open) {
          setEditingNote(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? `Edit Note (Create Version ${(editingNote.versionNumber || 1) + 1})` : 'Create New Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote 
                ? 'Editing will create a new version while preserving the history.' 
                : 'Add a new disclosure note to the financial statements.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reportingPeriodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reportingPeriodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="noteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note Type</FormLabel>
                    <Select 
                      onValueChange={handleNoteTypeChange} 
                      value={field.value}
                      data-testid="select-note-type-editor"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noteTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Basis of Preparation" data-testid="input-note-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noteContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={10}
                        placeholder="Enter note content (supports markdown)"
                        data-testid="textarea-note-content"
                      />
                    </FormControl>
                    <FormDescription>
                      Use this field to provide detailed disclosure information.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                        min={1}
                      />
                    </FormControl>
                    <FormDescription>
                      Order in which this note appears in financial statements
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('noteType') === 'going_concern' && (
                <>
                  <FormField
                    control={form.control}
                    name="goingConcernStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Going Concern Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-going-concern-status">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="positive">Positive (No concerns)</SelectItem>
                            <SelectItem value="uncertainty">Material Uncertainty</SelectItem>
                            <SelectItem value="doubt">Significant Doubt</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goingConcernAssessmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assessment Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className="w-full justify-start">
                                <Calendar className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditorDialogOpen(false);
                    setEditingNote(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {viewingVersionsFor?.noteTitle} - All versions
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Content Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell>
                    <Badge variant={version.isActive ? 'default' : 'outline'}>
                      v{version.versionNumber}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(version.updatedAt), 'PPP p')}</TableCell>
                  <TableCell>
                    {version.isActive ? (
                      <Badge>Current</Badge>
                    ) : (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground truncate">
                      {version.noteContent.substring(0, 100)}...
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
