/**
 * Journal Entry List Component
 * 
 * Displays journal entries with filtering, sorting, and status indicators
 * Provides quick actions for posting, reversing, and editing entries
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type JournalEntry } from "@shared/schema";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { useTenant } from "@/shared/hooks/useTenant";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils/utils";
import {
  FileText,
  Filter,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  RotateCcw,
  Edit,
  Eye,
  MoreHorizontal,
  DollarSign,
  AlertCircle,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface JournalEntryListProps {
  onSelectEntry?: (entry: JournalEntry) => void;
  onCreateNew?: () => void;
  showActions?: boolean;
}

interface FilterState {
  status: string;
  startDate: string;
  endDate: string;
  search: string;
}

export function JournalEntryList({
  onSelectEntry,
  onCreateNew,
  showActions = true,
}: JournalEntryListProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    startDate: "",
    endDate: "",
    search: "",
  });
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedEntryForReversal, setSelectedEntryForReversal] = useState<JournalEntry | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // Build query params based on filters
  const queryParams = new URLSearchParams();
  if (currentTenant?.id) {
    queryParams.append("tenantId", currentTenant.id);
  }
  if (filters.status && filters.status !== "all") {
    queryParams.append("status", filters.status);
  }
  if (filters.startDate) {
    queryParams.append("startDate", filters.startDate);
  }
  if (filters.endDate) {
    queryParams.append("endDate", filters.endDate);
  }
  if (filters.search) {
    queryParams.append("search", filters.search);
  }

  // Fetch journal entries
  const { data: entries = [], isLoading, refetch } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries", queryParams.toString()],
    enabled: !!currentTenant?.id,
  });

  // Post journal entry mutation
  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/journal-entries/${id}/post`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Posted",
        description: "Journal entry has been posted successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/journal-entries"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.error || error.message || "Failed to post journal entry",
        variant: "destructive",
      });
    },
  });

  // Reverse journal entry mutation
  const reverseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest(`/api/journal-entries/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Reversed",
        description: "Reversal entry has been created successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/journal-entries"],
      });
      setReversalDialogOpen(false);
      setSelectedEntryForReversal(null);
      setReversalReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.error || error.message || "Failed to create reversal entry",
        variant: "destructive",
      });
    },
  });

  // Delete journal entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/journal-entries/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Journal entry has been deleted successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/journal-entries"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete journal entry",
        variant: "destructive",
      });
    },
  });

  const handlePostEntry = (entry: JournalEntry) => {
    if (entry.status === 'posted') {
      toast({
        title: "Already Posted",
        description: "This journal entry is already posted",
      });
      return;
    }
    postMutation.mutate(entry.id);
  };

  const handleReverseEntry = (entry: JournalEntry) => {
    setSelectedEntryForReversal(entry);
    setReversalDialogOpen(true);
  };

  const confirmReversal = () => {
    if (!selectedEntryForReversal || !reversalReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the reversal",
        variant: "destructive",
      });
      return;
    }
    reverseMutation.mutate({
      id: selectedEntryForReversal.id,
      reason: reversalReason,
    });
  };

  const handleDeleteEntry = (entry: JournalEntry) => {
    if (entry.status !== 'draft') {
      toast({
        title: "Cannot Delete",
        description: "Only draft entries can be deleted",
        variant: "destructive",
      });
      return;
    }
    deleteMutation.mutate(entry.id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Edit className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case 'posted':
        return (
          <Badge variant="default" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Posted
          </Badge>
        );
      case 'pending_approval':
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate summary statistics
  const stats = {
    total: entries.length,
    draft: entries.filter(e => e.status === 'draft').length,
    posted: entries.filter(e => e.status === 'posted').length,
    pending: entries.filter(e => e.status === 'pending_approval').length,
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Journal Entries
              </CardTitle>
              <CardDescription className="mt-2">
                Manage and track all journal entries with double-entry validation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {onCreateNew && (
                <Button onClick={onCreateNew} data-testid="button-new-entry">
                  <FileText className="h-4 w-4 mr-2" />
                  New Entry
                </Button>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card className="p-3">
              <div className="text-sm text-gray-500">Total Entries</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-500">Draft</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-500">Posted</div>
              <div className="text-2xl font-bold text-green-600">{stats.posted}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
            </Card>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search entries..."
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  data-testid="input-search"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Start Date */}
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  className="pl-9"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  placeholder="Start Date"
                  data-testid="input-start-date"
                />
              </div>

              {/* End Date */}
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  className="pl-9"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  placeholder="End Date"
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Entry Number</TableHead>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total Debits</TableHead>
                  <TableHead className="text-right">Total Credits</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]">Source</TableHead>
                  {showActions && <TableHead className="w-[80px] text-center">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      {showActions && (
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded ml-auto" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showActions ? 8 : 7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-gray-300" />
                        <p className="text-gray-500">No journal entries found</p>
                        {onCreateNew && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onCreateNew}
                            className="mt-2"
                          >
                            Create First Entry
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow 
                      key={entry.id}
                      className={cn(
                        "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800",
                        entry.reversedById && "opacity-60"
                      )}
                      onClick={() => onSelectEntry?.(entry)}
                    >
                      <TableCell className="font-mono font-medium">
                        {entry.entryNumber}
                        {entry.reversedById && (
                          <span className="text-xs text-red-600 block">Reversed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.entryDate ? format(new Date(entry.entryDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.description || 'No description'}</div>
                          {entry.notes && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${parseFloat(entry.totalDebits || '0').toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${parseFloat(entry.totalCredits || '0').toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status)}
                      </TableCell>
                      <TableCell>
                        {entry.sourceType && (
                          <Badge variant="outline" className="text-xs">
                            {entry.sourceType}
                          </Badge>
                        )}
                      </TableCell>
                      {showActions && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                data-testid={`button-actions-${entry.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem onClick={() => onSelectEntry?.(entry)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>

                              {entry.status === 'draft' && (
                                <>
                                  <DropdownMenuItem onClick={() => onSelectEntry?.(entry)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Entry
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuItem onClick={() => handlePostEntry(entry)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Post Entry
                                  </DropdownMenuItem>

                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteEntry(entry)}
                                    className="text-red-600"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Delete Entry
                                  </DropdownMenuItem>
                                </>
                              )}

                              {entry.status === 'posted' && !entry.reversedById && (
                                <DropdownMenuItem onClick={() => handleReverseEntry(entry)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Create Reversal
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reversal Dialog */}
      <AlertDialog open={reversalDialogOpen} onOpenChange={setReversalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Reversal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new journal entry that reverses all debits and credits from:
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <div className="font-mono font-medium">
                  {selectedEntryForReversal?.entryNumber}
                </div>
                <div className="text-sm">
                  {selectedEntryForReversal?.description}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Reversal Reason *</label>
            <Textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Enter reason for reversal..."
              rows={3}
              data-testid="textarea-reversal-reason"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setReversalReason("");
              setSelectedEntryForReversal(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReversal}
              disabled={!reversalReason.trim() || reverseMutation.isPending}
              data-testid="button-confirm-reversal"
            >
              {reverseMutation.isPending ? 'Creating...' : 'Create Reversal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Re-export for convenience
export { JournalEntryForm } from './journal-entry-form';

// Add missing import for Textarea
import { Textarea } from "@/shared/components/ui/textarea";