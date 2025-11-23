import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X, ChevronUp, ChevronDown, Eye, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { PermissionGate } from "@/shared/components/common/permission-gate";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
import type { Currency } from "@shared/schema";

type JournalEntryStatus = 'draft' | 'pending_approval' | 'approved' | 'posted' | 'rejected';
type SourceDocumentType = 'invoice' | 'bill' | 'payment' | 'customer_payment' | 'credit_note' | 'debit_note' | 'expense' | 'fixed_asset' | 'inventory_adjustment' | 'depreciation' | 'payment_batch' | 'approval';

interface JournalEntry {
  id: string;
  tenantId: string;
  journalEntryNumber: string | null;
  entryDate: string;
  referenceNumber: string | null;
  description: string | null;
  status: JournalEntryStatus;
  currencyCode: string;
  sourceDocumentType: SourceDocumentType | null;
  sourceDocumentId: string | null;
  preparedByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  postedByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  legs?: Array<{
    amount: string;
    type: 'Debit' | 'Credit';
  }>;
}

type SortField = 'entryDate' | 'journalEntryNumber' | 'status' | 'totalAmount';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

export default function JournalEntries() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('entryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: journalEntries = [], isLoading, error, refetch } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUserName = (user: JournalEntry['preparedByUser']) => {
    if (!user) return "—";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName} ${lastName}`.trim() || user.email || "—";
  };

  const calculateTotalAmount = (entry: JournalEntry): number => {
    if (!entry.legs || entry.legs.length === 0) return 0;
    
    // In a balanced journal entry, total debits should equal total credits
    // We'll display the total debit amount (which should match credit amount)
    const totalDebits = entry.legs
      .filter(leg => leg.type === 'Debit')
      .reduce((sum, leg) => sum + parseFloat(leg.amount || '0'), 0);
    
    return totalDebits;
  };

  const getStatusBadge = (status: JournalEntryStatus) => {
    const config: Record<JournalEntryStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_approval: { variant: "outline", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", label: "Pending Approval" },
      approved: { variant: "outline", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800", label: "Approved" },
      posted: { variant: "default", label: "Posted" },
      rejected: { variant: "destructive", label: "Rejected" },
    };
    const { variant, className, label } = config[status] || { variant: "secondary", label: status };
    return (
      <Badge variant={variant} className={className} data-testid={`badge-status-${status}`}>
        {label}
      </Badge>
    );
  };

  const getSourceDocumentLink = (type: SourceDocumentType | null, id: string | null) => {
    if (!type || !id) return null;
    
    const routes: Record<SourceDocumentType, string> = {
      invoice: `/invoices/${id}`,
      bill: `/bills/${id}`,
      payment: `/payments/${id}`,
      customer_payment: `/customer-payments/${id}`,
      credit_note: `/credit-notes/${id}`,
      debit_note: `/debit-notes/${id}`,
      expense: `/expenses/${id}`,
      fixed_asset: `/assets/${id}`,
      inventory_adjustment: `/inventory/${id}`,
      depreciation: `/assets/${id}`,
      payment_batch: `/payments/${id}`,
      approval: `/approvals/${id}`,
    };

    const labels: Record<SourceDocumentType, string> = {
      invoice: "Invoice",
      bill: "Bill",
      payment: "Vendor Payment",
      customer_payment: "Customer Payment",
      credit_note: "Credit Note",
      debit_note: "Debit Note",
      expense: "Expense",
      fixed_asset: "Fixed Asset",
      inventory_adjustment: "Inventory Adj.",
      depreciation: "Depreciation",
      payment_batch: "Payment Batch",
      approval: "Approval",
    };

    return {
      path: routes[type],
      label: labels[type] || type,
    };
  };

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = [...journalEntries];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.journalEntryNumber?.toLowerCase().includes(search) ||
        entry.description?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(entry => entry.status === statusFilter);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(entry => new Date(entry.entryDate) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter(entry => new Date(entry.entryDate) <= toDate);
    }

    if (sourceTypeFilter !== "all") {
      filtered = filtered.filter(entry => entry.sourceDocumentType === sourceTypeFilter);
    }

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'entryDate':
          aValue = new Date(a.entryDate).getTime();
          bValue = new Date(b.entryDate).getTime();
          break;
        case 'journalEntryNumber':
          aValue = a.journalEntryNumber || '';
          bValue = b.journalEntryNumber || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'totalAmount':
          aValue = calculateTotalAmount(a);
          bValue = calculateTotalAmount(b);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [journalEntries, searchTerm, statusFilter, dateFrom, dateTo, sourceTypeFilter, sortField, sortDirection]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedEntries.slice(startIndex, endIndex);
  }, [filteredAndSortedEntries, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedEntries.length / ITEMS_PER_PAGE);

  const hasActiveFilters = searchTerm || statusFilter !== "all" || dateFrom || dateTo || sourceTypeFilter !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSourceTypeFilter("all");
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4 inline" />
    );
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="heading-journal-entries">Journal Entries</h1>
          <p className="text-muted-foreground">View and manage double-entry accounting journal entries</p>
        </div>
        <PermissionGate permission="journal_entries.create">
          <Link href="/journal-entries/new">
            <Button data-testid="button-create-manual-entry">
              <Plus className="mr-2 h-4 w-4" />
              Create Manual Entry
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by entry number or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="input-date-from"
          />

          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="input-date-to"
          />

          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger data-testid="select-source-type-filter">
              <SelectValue placeholder="All Source Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Source Types</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
              <SelectItem value="customer_payment">Customer Payment</SelectItem>
              <SelectItem value="payment">Vendor Payment</SelectItem>
              <SelectItem value="credit_note">Credit Note</SelectItem>
              <SelectItem value="debit_note">Debit Note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
            <span className="text-sm text-muted-foreground">
              Showing {filteredAndSortedEntries.length} of {journalEntries.length} entries
            </span>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2 text-destructive">Failed to load journal entries</p>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <Button onClick={() => refetch()} data-testid="button-retry">
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="border rounded-lg p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : filteredAndSortedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">
            {hasActiveFilters ? 'No matching journal entries found' : 'No journal entries found'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters or search criteria'
              : 'Get started by creating your first journal entry'}
          </p>
          {!hasActiveFilters && (
            <PermissionGate permission="journal_entries.create">
              <Link href="/journal-entries/new">
                <Button data-testid="button-create-first-entry">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Manual Entry
                </Button>
              </Link>
            </PermissionGate>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('journalEntryNumber')}
                    data-testid="header-entry-number"
                  >
                    Entry Number
                    <SortIcon field="journalEntryNumber" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('entryDate')}
                    data-testid="header-date"
                  >
                    Date
                    <SortIcon field="entryDate" />
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('status')}
                    data-testid="header-status"
                  >
                    Status
                    <SortIcon field="status" />
                  </TableHead>
                  <TableHead>Source Document</TableHead>
                  <TableHead>Preparer</TableHead>
                  <TableHead>Poster</TableHead>
                  <TableHead
                    className="text-right cursor-pointer"
                    onClick={() => handleSort('totalAmount')}
                    data-testid="header-amount"
                  >
                    Total Amount
                    <SortIcon field="totalAmount" />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry) => {
                  const sourceLink = getSourceDocumentLink(entry.sourceDocumentType, entry.sourceDocumentId);
                  const totalAmount = calculateTotalAmount(entry);
                  const description = entry.description || '—';
                  const shouldTruncate = description.length > 50;

                  return (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell className="font-medium font-mono">
                        <Link href={`/journal-entries/${entry.id}`}>
                          <span className="text-primary hover:underline cursor-pointer" data-testid={`link-entry-${entry.id}`}>
                            {entry.journalEntryNumber || '—'}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell data-testid={`text-date-${entry.id}`}>
                        {formatDate(entry.entryDate)}
                      </TableCell>
                      <TableCell data-testid={`text-description-${entry.id}`}>
                        {shouldTruncate ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{description.substring(0, 50)}...</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          description
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status)}
                      </TableCell>
                      <TableCell data-testid={`text-source-${entry.id}`}>
                        {sourceLink ? (
                          <Link href={sourceLink.path}>
                            <span className="text-primary hover:underline cursor-pointer" data-testid={`link-source-${entry.id}`}>
                              {sourceLink.label}
                            </span>
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-preparer-${entry.id}`}>
                        {getUserName(entry.preparedByUser)}
                      </TableCell>
                      <TableCell data-testid={`text-poster-${entry.id}`}>
                        {getUserName(entry.postedByUser)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium" data-testid={`text-amount-${entry.id}`}>
                        {formatCurrency(totalAmount, entry.currencyCode, currencies)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/journal-entries/${entry.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${entry.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredAndSortedEntries.length} entries)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
