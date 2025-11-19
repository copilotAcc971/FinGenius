import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Shield, Plus, Edit, Trash2, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
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
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { AlertSeverityBadge } from "@/features/compliance/components/alert-severity-badge";
import type { AlertRule } from "@shared/schema";
import { format } from "date-fns";

export default function AlertRulesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleTypeFilter, setRuleTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    ruleName: "",
    ruleType: "threshold",
    description: "",
    severity: "medium",
    isActive: true,
    thresholdAmount: "",
    thresholdCurrency: "USD",
    thresholdPeriod: "transaction",
  });

  const { data: rules = [], isLoading, error, refetch } = useQuery<AlertRule[]>({
    queryKey: ["/api/alert-rules", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/alert-rules/${id}`, "PATCH", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/alert-rules/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "Alert rule deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert rule",
        variant: "destructive",
      });
    },
  });

  const columns: ColumnDef<AlertRule>[] = [
    {
      accessorKey: "ruleName",
      header: "Rule Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.ruleName}</div>
      ),
    },
    {
      accessorKey: "ruleType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.ruleType?.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "thresholdAmount",
      header: "Threshold Amount",
      cell: ({ row }) => (
        <div className="font-mono text-right">
          {row.original.thresholdAmount 
            ? `${row.original.thresholdCurrency || ""} ${parseFloat(row.original.thresholdAmount as any).toLocaleString()}`
            : "-"}
        </div>
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
      accessorKey: "isActive",
      header: "Is Active",
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive || false}
          onCheckedChange={(checked) => {
            toggleActiveMutation.mutate({ id: row.original.id, isActive: checked });
          }}
          data-testid={`switch-active-${row.original.id}`}
        />
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.createdAt 
            ? format(new Date(row.original.createdAt), "MMM d, yyyy")
            : "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
            data-testid={`button-edit-${row.original.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(row.original.id)}
            data-testid={`button-delete-${row.original.id}`}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  const filteredData = rules.filter((item) => {
    if (ruleTypeFilter !== "all" && item.ruleType !== ruleTypeFilter) return false;
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

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      description: rule.description || "",
      severity: rule.severity,
      isActive: rule.isActive || true,
      thresholdAmount: rule.thresholdAmount?.toString() || "",
      thresholdCurrency: rule.thresholdCurrency || "USD",
      thresholdPeriod: rule.thresholdPeriod || "transaction",
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingRule(null);
    setFormData({
      ruleName: "",
      ruleType: "threshold",
      description: "",
      severity: "medium",
      isActive: true,
      thresholdAmount: "",
      thresholdCurrency: "USD",
      thresholdPeriod: "transaction",
    });
  };

  const handleSaveRule = () => {
    console.log("Saving rule:", formData);
    handleCloseDialog();
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
            {error instanceof Error ? error.message : 'Failed to load alert rules'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            No Alert Rules Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by creating your first transaction monitoring rule.
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Alert Rules</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure AML transaction monitoring rules</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-rule">
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by rule name..."
          value={(table.getColumn("ruleName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("ruleName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
          data-testid="input-search-rule"
        />
        <Select value={ruleTypeFilter} onValueChange={setRuleTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-rule-type-filter">
            <SelectValue placeholder="All Rule Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rule Types</SelectItem>
            <SelectItem value="threshold">Threshold</SelectItem>
            <SelectItem value="velocity">Velocity</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
            <SelectItem value="geographic">Geographic</SelectItem>
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
          <p className="text-lg font-medium mb-2">No alert rules configured</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Create your first monitoring rule to start detecting suspicious activity
          </p>
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-first-rule">
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
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
                  data-testid={`row-rule-${row.original.id}`}
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
            Showing {table.getRowModel().rows.length} of {filteredData.length} rule(s)
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

      {/* Create/Edit Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl" data-testid="dialog-alert-rule">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit" : "Create"} Alert Rule</DialogTitle>
            <DialogDescription>
              Configure a monitoring rule to detect suspicious transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="ruleName">Rule Name *</Label>
                <Input
                  id="ruleName"
                  value={formData.ruleName}
                  onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <Label htmlFor="ruleType">Rule Type *</Label>
                <Select
                  value={formData.ruleType}
                  onValueChange={(value) => setFormData({ ...formData, ruleType: value })}
                >
                  <SelectTrigger id="ruleType" data-testid="select-rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threshold">Threshold</SelectItem>
                    <SelectItem value="velocity">Velocity</SelectItem>
                    <SelectItem value="pattern">Pattern</SelectItem>
                    <SelectItem value="geographic">Geographic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger id="severity" data-testid="select-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.ruleType === "threshold" && (
                <>
                  <div>
                    <Label htmlFor="thresholdAmount">Threshold Amount</Label>
                    <Input
                      id="thresholdAmount"
                      type="number"
                      step="0.01"
                      value={formData.thresholdAmount}
                      onChange={(e) => setFormData({ ...formData, thresholdAmount: e.target.value })}
                      data-testid="input-threshold-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="thresholdCurrency">Currency</Label>
                    <Input
                      id="thresholdCurrency"
                      value={formData.thresholdCurrency}
                      onChange={(e) => setFormData({ ...formData, thresholdCurrency: e.target.value })}
                      data-testid="input-threshold-currency"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="thresholdPeriod">Threshold Period</Label>
                    <Select
                      value={formData.thresholdPeriod}
                      onValueChange={(value) => setFormData({ ...formData, thresholdPeriod: value })}
                    >
                      <SelectTrigger id="thresholdPeriod" data-testid="select-threshold-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transaction">Per Transaction</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when this rule should trigger..."
                  data-testid="textarea-description"
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-is-active"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Rule is active
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSaveRule} data-testid="button-save-rule">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
