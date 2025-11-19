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
import { Shield, Download, Eye, XCircle } from "lucide-react";
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
import { VerificationStatusBadge } from "@/features/compliance/components/verification-status-badge";
import { RiskLevelBadge } from "@/features/compliance/components/risk-level-badge";
import type { KYCVerification, Customer } from "@shared/schema";
import { format } from "date-fns";

type KYCVerificationWithCustomer = KYCVerification & {
  customer?: Customer;
};

export default function KYCVerificationsPage() {
  const { currentTenant } = useTenant();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedVerification, setSelectedVerification] = useState<KYCVerificationWithCustomer | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { data: verifications = [], isLoading, error, refetch } = useQuery<KYCVerificationWithCustomer[]>({
    queryKey: ["/api/kyc-verifications", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const columns: ColumnDef<KYCVerificationWithCustomer>[] = [
    {
      accessorKey: "customer.name",
      header: "Customer Name",
      cell: ({ row }) => (
        <div className="font-medium" data-testid={`text-customer-${row.original.id}`}>
          {row.original.customer?.name || "Unknown"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <VerificationStatusBadge status={row.original.status as any} />
      ),
    },
    {
      accessorKey: "riskLevel",
      header: "Risk Level",
      cell: ({ row }) => (
        <RiskLevelBadge level={row.original.riskLevel as any} />
      ),
    },
    {
      accessorKey: "verificationMethod",
      header: "Verification Method",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.verificationMethod || "-"}
        </span>
      ),
    },
    {
      accessorKey: "verifiedAt",
      header: "Verified Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.verifiedAt 
            ? format(new Date(row.original.verifiedAt), "MMM d, yyyy")
            : "-"}
        </span>
      ),
    },
    {
      accessorKey: "eddRequired",
      header: "EDD Required",
      cell: ({ row }) => (
        row.original.eddRequired ? (
          <Badge variant="default" className="bg-orange-600 text-white hover:bg-orange-700">
            EDD
          </Badge>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
        )
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedVerification(row.original)}
          data-testid={`button-view-${row.original.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      ),
    },
  ];

  const filteredData = verifications.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (riskFilter !== "all" && item.riskLevel !== riskFilter) return false;
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

  const exportToCSV = () => {
    const headers = ["Customer Name", "Status", "Risk Level", "Verification Method", "Verified Date", "EDD Required"];
    const rows = filteredData.map(v => [
      v.customer?.name || "Unknown",
      v.status,
      v.riskLevel,
      v.verificationMethod || "-",
      v.verifiedAt ? format(new Date(v.verifiedAt), "MMM d, yyyy") : "-",
      v.eddRequired ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyc-verifications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            {error instanceof Error ? error.message : 'Failed to load KYC verifications'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!verifications || verifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            No KYC Verifications Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by verifying your first customer.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">KYC Verifications</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer identity verification and due diligence</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" data-testid="button-export-csv">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by customer name..."
          value={(table.getColumn("customer.name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("customer.name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
          data-testid="input-search-customer"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-risk-filter">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
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
          <p className="text-lg font-medium mb-2">No KYC verifications found</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            KYC verifications will appear here once customers are onboarded
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
                  data-testid={`row-verification-${row.original.id}`}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedVerification(row.original)}
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

      {/* Pagination */}
      {filteredData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {table.getRowModel().rows.length} of {filteredData.length} verification(s)
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

      {/* Details Dialog */}
      <Dialog open={!!selectedVerification} onOpenChange={(open) => !open && setSelectedVerification(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-verification-details">
          <DialogHeader>
            <DialogTitle>KYC Verification Details</DialogTitle>
            <DialogDescription>
              Comprehensive verification information for {selectedVerification?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedVerification && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer</div>
                  <div className="text-base">{selectedVerification.customer?.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</div>
                  <VerificationStatusBadge status={selectedVerification.status as any} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Level</div>
                  <RiskLevelBadge level={selectedVerification.riskLevel as any} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Verification Method</div>
                  <div className="text-base">{selectedVerification.verificationMethod || "-"}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Verified Date</div>
                  <div className="text-base">
                    {selectedVerification.verifiedAt 
                      ? format(new Date(selectedVerification.verifiedAt), "PPP")
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Expires At</div>
                  <div className="text-base">
                    {selectedVerification.expiresAt 
                      ? format(new Date(selectedVerification.expiresAt), "PPP")
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">EDD Required</div>
                  <div className="text-base">{selectedVerification.eddRequired ? "Yes" : "No"}</div>
                </div>
                {selectedVerification.eddRequired && (
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">EDD Completed</div>
                    <div className="text-base">{selectedVerification.eddCompleted ? "Yes" : "No"}</div>
                  </div>
                )}
              </div>
              {selectedVerification.reviewNotes && (
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Review Notes</div>
                  <div className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {selectedVerification.reviewNotes}
                  </div>
                </div>
              )}
              {selectedVerification.eddNotes && (
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">EDD Notes</div>
                  <div className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {selectedVerification.eddNotes}
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
