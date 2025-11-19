import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Shield, Plus, FileText, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { SARStatusBadge } from "@/features/compliance/components/sar-status-badge";
import type { SuspiciousActivityReport } from "@shared/schema";
import { format } from "date-fns";

export default function SARReportsPage() {
  const { currentTenant } = useTenant();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    subjectType: "customer",
    subjectName: "",
    activityType: "structuring",
    activityDescription: "",
    activityStartDate: "",
    activityEndDate: "",
    totalAmountInvolved: "",
    currencyCode: "USD",
    investigationNotes: "",
  });

  const { data: reports = [], isLoading, error, refetch } = useQuery<SuspiciousActivityReport[]>({
    queryKey: ["/api/suspicious-activity-reports", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const totalSARs = reports.length;
  const pendingReview = reports.filter(r => r.status === "under_review").length;
  const filedThisMonth = reports.filter(r => {
    if (!r.filedAt) return false;
    const filedDate = new Date(r.filedAt);
    const now = new Date();
    return filedDate.getMonth() === now.getMonth() && filedDate.getFullYear() === now.getFullYear();
  }).length;

  const columns: ColumnDef<SuspiciousActivityReport>[] = [
    {
      accessorKey: "sarNumber",
      header: "SAR Number",
      cell: ({ row }) => (
        <div className="font-mono font-medium">{row.original.sarNumber}</div>
      ),
    },
    {
      accessorKey: "subjectName",
      header: "Subject Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.subjectName}</div>
      ),
    },
    {
      accessorKey: "activityType",
      header: "Activity Type",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.activityType?.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <SARStatusBadge status={row.original.status as any} />
      ),
    },
    {
      accessorKey: "totalAmountInvolved",
      header: "Total Amount",
      cell: ({ row }) => (
        <div className="font-mono text-right">
          {row.original.totalAmountInvolved 
            ? `${row.original.currencyCode || ""} ${parseFloat(row.original.totalAmountInvolved as any).toLocaleString()}`
            : "-"}
        </div>
      ),
    },
    {
      accessorKey: "submittedAt",
      header: "Submitted Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.submittedAt 
            ? format(new Date(row.original.submittedAt), "MMM d, yyyy")
            : "-"}
        </span>
      ),
    },
    {
      accessorKey: "filedAt",
      header: "Filed Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.filedAt 
            ? format(new Date(row.original.filedAt), "MMM d, yyyy")
            : "-"}
        </span>
      ),
    },
  ];

  const filteredData = reports.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleCreateSAR = () => {
    console.log("Creating SAR:", formData);
    setShowCreateDialog(false);
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-gray-600 dark:text-gray-400">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <CardTitle>Error Loading Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load SAR reports'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            No SAR Reports Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by creating your first Suspicious Activity Report.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New SAR
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Suspicious Activity Reports (SAR)</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage SAR filings to regulatory authorities</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-sar">
          <Plus className="mr-2 h-4 w-4" />
          Create New SAR
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total SARs</div>
              <div className="text-3xl font-semibold mt-2">{totalSARs}</div>
            </div>
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Review</div>
              <div className="text-3xl font-semibold mt-2">{pendingReview}</div>
            </div>
            <FileText className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Filed This Month</div>
              <div className="text-3xl font-semibold mt-2">{filedThisMonth}</div>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by SAR number or subject..."
          value={(table.getColumn("sarNumber")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("sarNumber")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
          data-testid="input-search-sar"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="filed">Filed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={columns} minHeight="600px" />
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Shield className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium mb-2">No SAR reports found</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Create your first Suspicious Activity Report
          </p>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-sar">
            <Plus className="mr-2 h-4 w-4" />
            Create New SAR
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid={`row-sar-${row.original.id}`}
                  className="cursor-pointer hover-elevate"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {table.getRowModel().rows.length} of {filteredData.length} SAR(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create SAR Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-sar">
          <DialogHeader>
            <DialogTitle>Create Suspicious Activity Report</DialogTitle>
            <DialogDescription>
              File a new SAR for suspicious activity. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subjectType">Subject Type *</Label>
                <Select
                  value={formData.subjectType}
                  onValueChange={(value) => setFormData({ ...formData, subjectType: value })}
                >
                  <SelectTrigger id="subjectType" data-testid="select-subject-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="beneficial_owner">Beneficial Owner</SelectItem>
                    <SelectItem value="transaction">Transaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activityType">Activity Type *</Label>
                <Select
                  value={formData.activityType}
                  onValueChange={(value) => setFormData({ ...formData, activityType: value })}
                >
                  <SelectTrigger id="activityType" data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structuring">Structuring</SelectItem>
                    <SelectItem value="money_laundering">Money Laundering</SelectItem>
                    <SelectItem value="terrorism_financing">Terrorism Financing</SelectItem>
                    <SelectItem value="fraud">Fraud</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="subjectName">Subject Name *</Label>
                <Input
                  id="subjectName"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  data-testid="input-subject-name"
                />
              </div>
              <div>
                <Label htmlFor="activityStartDate">Activity Start Date</Label>
                <Input
                  id="activityStartDate"
                  type="date"
                  value={formData.activityStartDate}
                  onChange={(e) => setFormData({ ...formData, activityStartDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="activityEndDate">Activity End Date</Label>
                <Input
                  id="activityEndDate"
                  type="date"
                  value={formData.activityEndDate}
                  onChange={(e) => setFormData({ ...formData, activityEndDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
              <div>
                <Label htmlFor="totalAmountInvolved">Total Amount Involved</Label>
                <Input
                  id="totalAmountInvolved"
                  type="number"
                  step="0.01"
                  value={formData.totalAmountInvolved}
                  onChange={(e) => setFormData({ ...formData, totalAmountInvolved: e.target.value })}
                  data-testid="input-total-amount"
                />
              </div>
              <div>
                <Label htmlFor="currencyCode">Currency</Label>
                <Input
                  id="currencyCode"
                  value={formData.currencyCode}
                  onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                  data-testid="input-currency"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="activityDescription">Activity Description *</Label>
              <Textarea
                id="activityDescription"
                value={formData.activityDescription}
                onChange={(e) => setFormData({ ...formData, activityDescription: e.target.value })}
                placeholder="Describe the suspicious activity in detail..."
                rows={5}
                data-testid="textarea-activity-description"
              />
            </div>
            <div>
              <Label htmlFor="investigationNotes">Investigation Notes</Label>
              <Textarea
                id="investigationNotes"
                value={formData.investigationNotes}
                onChange={(e) => setFormData({ ...formData, investigationNotes: e.target.value })}
                placeholder="Document investigation findings..."
                rows={4}
                data-testid="textarea-investigation-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleCreateSAR} data-testid="button-save-sar">
              Create SAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
