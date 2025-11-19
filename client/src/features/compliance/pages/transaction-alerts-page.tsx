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
import { Shield, AlertTriangle, XCircle } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { AlertSeverityBadge } from "@/features/compliance/components/alert-severity-badge";
import type { TransactionAlert } from "@shared/schema";
import { format } from "date-fns";

export default function TransactionAlertsPage() {
  const { currentTenant } = useTenant();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedAlert, setSelectedAlert] = useState<TransactionAlert | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: alerts = [], isLoading, error, refetch } = useQuery<TransactionAlert[]>({
    queryKey: ["/api/transaction-alerts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const totalAlerts = alerts.length;
  const openAlerts = alerts.filter(a => a.status === "open").length;
  const criticalAlerts = alerts.filter(a => a.severity === "high" || a.severity === "critical").length;

  const columns: ColumnDef<TransactionAlert>[] = [
    {
      accessorKey: "alertType",
      header: "Alert Type",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.alertType?.replace(/_/g, " ")}</div>
      ),
    },
    {
      accessorKey: "customerId",
      header: "Customer",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.customerId || "-"}
        </span>
      ),
    },
    {
      accessorKey: "transactionAmount",
      header: "Amount",
      cell: ({ row }) => (
        <div className="font-mono text-right">
          {row.original.transactionAmount 
            ? `${row.original.transactionCurrency || ""} ${parseFloat(row.original.transactionAmount as any).toLocaleString()}`
            : "-"}
        </div>
      ),
    },
    {
      accessorKey: "alertDate",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {format(new Date(row.original.alertDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => (
        <AlertSeverityBadge severity={row.original.severity as any} />
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "open";
        const variants = {
          open: { variant: "default" as const, className: "bg-amber-600 text-white" },
          under_review: { variant: "default" as const, className: "bg-blue-600 text-white" },
          closed: { variant: "default" as const, className: "bg-green-600 text-white" },
          escalated_to_sar: { variant: "default" as const, className: "bg-red-600 text-white" },
        };
        const config = variants[status as keyof typeof variants] || variants.open;
        return (
          <Badge variant={config.variant} className={config.className}>
            {status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "riskScore",
      header: "Risk Score",
      cell: ({ row }) => (
        <div className="font-mono text-center">
          {row.original.riskScore || "-"}
        </div>
      ),
    },
  ];

  const filteredData = alerts.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
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
            {error instanceof Error ? error.message : 'Failed to load transaction alerts'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            No Transaction Alerts Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            No alerts have been generated yet. Alerts will appear here when transactions match your monitoring rules.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Transaction Alerts</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor and review AML transaction alerts</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Alerts</div>
              <div className="text-3xl font-semibold mt-2">{totalAlerts}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Alerts</div>
              <div className="text-3xl font-semibold mt-2">{openAlerts}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">High/Critical</div>
              <div className="text-3xl font-semibold mt-2">{criticalAlerts}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by alert type..."
          value={(table.getColumn("alertType")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("alertType")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
          data-testid="input-search-alert-type"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="escalated_to_sar">Escalated to SAR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-severity-filter">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={columns} minHeight="600px" />
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Shield className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium mb-2">No transaction alerts found</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Transaction alerts will appear here when monitoring rules are triggered
          </p>
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
                  data-testid={`row-alert-${row.original.id}`}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedAlert(row.original)}
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
            Showing {table.getRowModel().rows.length} of {filteredData.length} alert(s)
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

      {/* Alert Details Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-alert-details">
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
            <DialogDescription>
              Comprehensive information about this transaction alert
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Alert Type</div>
                  <div className="text-base">{selectedAlert.alertType?.replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Severity</div>
                  <AlertSeverityBadge severity={selectedAlert.severity as any} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Transaction Amount</div>
                  <div className="text-base font-mono">
                    {selectedAlert.transactionAmount 
                      ? `${selectedAlert.transactionCurrency || ""} ${parseFloat(selectedAlert.transactionAmount as any).toLocaleString()}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Score</div>
                  <div className="text-base font-mono">{selectedAlert.riskScore || "-"}/100</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Rule Triggered</div>
                  <div className="text-base">{selectedAlert.ruleName || "-"}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Transaction Date</div>
                  <div className="text-base">
                    {selectedAlert.transactionDate 
                      ? format(new Date(selectedAlert.transactionDate), "PPP")
                      : "-"}
                  </div>
                </div>
              </div>
              {selectedAlert.patternDescription && (
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Pattern Description</div>
                  <div className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {selectedAlert.patternDescription}
                  </div>
                </div>
              )}
              {selectedAlert.resolutionNotes && (
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Resolution Notes</div>
                  <div className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {selectedAlert.resolutionNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
