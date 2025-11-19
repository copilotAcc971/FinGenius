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
import { Shield, Download, Search, XCircle } from "lucide-react";
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
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { ScreeningResultBadge } from "@/features/compliance/components/screening-result-badge";
import { Badge } from "@/shared/components/ui/badge";
import type { SanctionsScreening } from "@shared/schema";
import { format } from "date-fns";

export default function SanctionsScreeningPage() {
  const { currentTenant } = useTenant();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");

  const { data: screenings = [], isLoading, error, refetch } = useQuery<SanctionsScreening[]>({
    queryKey: ["/api/sanctions-screenings", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const columns: ColumnDef<SanctionsScreening>[] = [
    {
      accessorKey: "entityType",
      header: "Entity Type",
      cell: ({ row }) => (
        <Badge variant="outline" data-testid={`badge-entity-type-${row.original.id}`}>
          {row.original.entityType}
        </Badge>
      ),
    },
    {
      accessorKey: "entityName",
      header: "Entity Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.entityName}</div>
      ),
    },
    {
      accessorKey: "screeningDate",
      header: "Screening Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {format(new Date(row.original.screeningDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "overallResult",
      header: "Overall Result",
      cell: ({ row }) => (
        <ScreeningResultBadge result={row.original.overallResult as any} />
      ),
    },
    {
      accessorKey: "ofacResult",
      header: "OFAC",
      cell: ({ row }) => (
        <ScreeningResultBadge result={(row.original.ofacResult || "clear") as any} />
      ),
    },
    {
      accessorKey: "unResult",
      header: "UN",
      cell: ({ row }) => (
        <ScreeningResultBadge result={(row.original.unResult || "clear") as any} />
      ),
    },
    {
      accessorKey: "euResult",
      header: "EU",
      cell: ({ row }) => (
        <ScreeningResultBadge result={(row.original.euResult || "clear") as any} />
      ),
    },
    {
      accessorKey: "ukResult",
      header: "UK",
      cell: ({ row }) => (
        <ScreeningResultBadge result={(row.original.ukResult || "clear") as any} />
      ),
    },
    {
      accessorKey: "pepResult",
      header: "PEP",
      cell: ({ row }) => (
        <ScreeningResultBadge result={(row.original.pepResult || "clear") as any} />
      ),
    },
    {
      accessorKey: "reviewStatus",
      header: "Review Status",
      cell: ({ row }) => {
        const status = row.original.reviewStatus || "pending";
        const variants = {
          pending: { variant: "default" as const, className: "bg-amber-600 text-white" },
          false_positive: { variant: "default" as const, className: "bg-green-600 text-white" },
          true_positive: { variant: "default" as const, className: "bg-red-600 text-white" },
          escalated: { variant: "default" as const, className: "bg-orange-600 text-white" },
        };
        const config = variants[status as keyof typeof variants] || variants.pending;
        return (
          <Badge variant={config.variant} className={config.className}>
            {status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
  ];

  const filteredData = screenings.filter((item) => {
    if (entityTypeFilter !== "all" && item.entityType !== entityTypeFilter) return false;
    if (resultFilter !== "all" && item.overallResult !== resultFilter) return false;
    if (reviewStatusFilter !== "all" && item.reviewStatus !== reviewStatusFilter) return false;
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
    const headers = ["Entity Type", "Entity Name", "Screening Date", "Overall Result", "OFAC", "UN", "EU", "UK", "PEP", "Review Status"];
    const rows = filteredData.map(s => [
      s.entityType,
      s.entityName,
      format(new Date(s.screeningDate), "MMM d, yyyy"),
      s.overallResult,
      s.ofacResult || "clear",
      s.unResult || "clear",
      s.euResult || "clear",
      s.ukResult || "clear",
      s.pepResult || "clear",
      s.reviewStatus || "pending",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanctions-screenings-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
            {error instanceof Error ? error.message : 'Failed to load sanctions screenings'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!screenings || screenings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            No Sanctions Screenings Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by screening your first entity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Sanctions Screening</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor sanctions and PEP screening results</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-screen-customer">
            <Search className="mr-2 h-4 w-4" />
            Screen Customer
          </Button>
          <Button onClick={exportToCSV} variant="outline" data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by entity name..."
          value={(table.getColumn("entityName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("entityName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
          data-testid="input-search-entity"
        />
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-entity-type-filter">
            <SelectValue placeholder="All Entity Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entity Types</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="beneficial_owner">Beneficial Owner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-result-filter">
            <SelectValue placeholder="All Results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="clear">Clear</SelectItem>
            <SelectItem value="potential_match">Potential Match</SelectItem>
            <SelectItem value="match">Match</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewStatusFilter} onValueChange={setReviewStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-review-status-filter">
            <SelectValue placeholder="All Review Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="false_positive">False Positive</SelectItem>
            <SelectItem value="true_positive">True Positive</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={columns} minHeight="600px" />
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Shield className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium mb-2">No sanctions screenings found</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sanctions screenings will appear here once entities are screened
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
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
                  data-testid={`row-screening-${row.original.id}`}
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
            Showing {table.getRowModel().rows.length} of {filteredData.length} screening(s)
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
    </div>
  );
}
