import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { FileSpreadsheet, Play, Save, Download, Trash2, Edit, Copy } from "lucide-react";
import { exportToCSV, exportToExcel } from "@/shared/lib/exports/reportExports";
import { format } from "date-fns";
import type { CustomReportConfig } from "@shared/schema";

interface ReportColumn {
  id: string;
  label: string;
}

interface CustomReportResult {
  columns: string[];
  rows: any[];
  totalRows: number;
}

const reportTypeOptions = [
  { value: "general_ledger", label: "General Ledger" },
  { value: "transaction_list", label: "Transaction List" },
  { value: "invoice_list", label: "Invoice List" },
  { value: "bill_list", label: "Bill List" },
  { value: "account_details", label: "Account Details" },
];

const columnsByReportType: Record<string, ReportColumn[]> = {
  general_ledger: [
    { id: "date", label: "Date" },
    { id: "account", label: "Account" },
    { id: "accountCode", label: "Account Code" },
    { id: "reference", label: "Reference" },
    { id: "description", label: "Description" },
    { id: "debit", label: "Debit" },
    { id: "credit", label: "Credit" },
  ],
  transaction_list: [
    { id: "date", label: "Date" },
    { id: "type", label: "Type" },
    { id: "reference", label: "Reference" },
    { id: "description", label: "Description" },
    { id: "status", label: "Status" },
  ],
  invoice_list: [
    { id: "invoiceNumber", label: "Invoice Number" },
    { id: "customer", label: "Customer" },
    { id: "date", label: "Date" },
    { id: "dueDate", label: "Due Date" },
    { id: "amount", label: "Amount" },
    { id: "status", label: "Status" },
    { id: "balanceDue", label: "Balance Due" },
  ],
  bill_list: [
    { id: "billNumber", label: "Bill Number" },
    { id: "vendor", label: "Vendor" },
    { id: "date", label: "Date" },
    { id: "dueDate", label: "Due Date" },
    { id: "amount", label: "Amount" },
    { id: "status", label: "Status" },
    { id: "balanceDue", label: "Balance Due" },
  ],
  account_details: [
    { id: "accountCode", label: "Account Code" },
    { id: "accountName", label: "Account Name" },
    { id: "type", label: "Type" },
    { id: "currentBalance", label: "Current Balance" },
  ],
};

export default function CustomReportBuilder() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<string>("general_ledger");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["date", "account", "description", "debit", "credit"]);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [reportName, setReportName] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReportConfig | null>(null);

  // Fetch saved reports
  const { data: savedReports = [], isLoading: isLoadingSavedReports } = useQuery<CustomReportConfig[]>({
    queryKey: ["/api/custom-reports"],
  });

  // Fetch accounts for filters
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts"],
  });

  // Fetch customers for filters
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch vendors for filters
  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
  });

  // Generate report preview
  const { data: reportData, isLoading: isGenerating, mutate: generateReport } = useMutation<CustomReportResult>({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/custom-reports/generate", {
        reportType,
        selectedColumns,
        filters,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  // Save report config
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      if (editingReport) {
        return await apiRequest("PATCH", `/api/custom-reports/${editingReport.id}`, {
          name: reportName,
          reportType,
          selectedColumns,
          filters,
        });
      } else {
        return await apiRequest("POST", "/api/custom-reports", {
          name: reportName,
          reportType,
          selectedColumns,
          filters,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingReport ? "Report updated successfully" : "Report saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-reports"] });
      setSaveDialogOpen(false);
      setReportName("");
      setEditingReport(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save report",
        variant: "destructive",
      });
    },
  });

  // Delete report
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest("DELETE", `/api/custom-reports/${reportId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-reports"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    },
  });

  // Handle report type change
  const handleReportTypeChange = (value: string) => {
    setReportType(value);
    // Reset selected columns to default for new report type
    const defaultColumns = columnsByReportType[value]?.slice(0, 5).map(col => col.id) || [];
    setSelectedColumns(defaultColumns);
    setFilters({});
  };

  // Handle column selection
  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  // Load saved report
  const loadReport = (report: CustomReportConfig) => {
    setReportType(report.reportType);
    setSelectedColumns(report.selectedColumns);
    setFilters(report.filters);
    toast({
      title: "Success",
      description: "Report loaded successfully",
    });
  };

  // Edit saved report
  const editReport = (report: CustomReportConfig) => {
    setEditingReport(report);
    setReportName(report.name);
    setReportType(report.reportType);
    setSelectedColumns(report.selectedColumns);
    setFilters(report.filters);
    setSaveDialogOpen(true);
  };

  // Duplicate report
  const duplicateReport = (report: CustomReportConfig) => {
    setReportType(report.reportType);
    setSelectedColumns(report.selectedColumns);
    setFilters(report.filters);
    setReportName(`${report.name} (Copy)`);
    setSaveDialogOpen(true);
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!reportData || !reportData.rows.length) {
      toast({
        title: "No Data",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    const filename = `custom-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    exportToCSV(reportData.rows, filename);
    toast({
      title: "Success",
      description: "Report exported to CSV successfully",
    });
  };

  const handleExportExcel = () => {
    if (!reportData || !reportData.rows.length) {
      toast({
        title: "No Data",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    const filename = `custom-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}`;
    exportToExcel(reportData.rows, filename, 'Report');
    toast({
      title: "Success",
      description: "Report exported to Excel successfully",
    });
  };

  const availableColumns = columnsByReportType[reportType] || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Report Builder</h1>
          <p className="text-muted-foreground">Create and manage custom reports with flexible columns and filters</p>
        </div>
        <FileSpreadsheet className="h-8 w-8 text-primary" />
      </div>

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder" data-testid="tab-report-builder">Report Builder</TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved-reports">Saved Reports ({savedReports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          {/* Step 1: Select Report Type */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Report Type</CardTitle>
              <CardDescription>Choose the type of report you want to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={reportType} onValueChange={handleReportTypeChange}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportTypeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} data-testid={`radio-report-type-${option.value}`} />
                      <Label htmlFor={option.value} className="cursor-pointer">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Step 2: Select Columns */}
          <Card>
            <CardHeader>
              <CardTitle>2. Select Columns</CardTitle>
              <CardDescription>Choose which columns to display in your report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableColumns.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                      data-testid={`checkbox-column-${column.id}`}
                    />
                    <Label htmlFor={column.id} className="cursor-pointer">{column.label}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Apply Filters */}
          <Card>
            <CardHeader>
              <CardTitle>3. Apply Filters</CardTitle>
              <CardDescription>Filter your report data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range Filter */}
              {(reportType === "general_ledger" || reportType === "transaction_list" || reportType === "invoice_list" || reportType === "bill_list") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filter-date-start">Start Date</Label>
                    <Input
                      id="filter-date-start"
                      type="date"
                      value={filters.dateRange?.start || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                      data-testid="input-filter-date-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-date-end">End Date</Label>
                    <Input
                      id="filter-date-end"
                      type="date"
                      value={filters.dateRange?.end || ""}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                      data-testid="input-filter-date-end"
                    />
                  </div>
                </div>
              )}

              {/* Account Filter */}
              {(reportType === "general_ledger" || reportType === "account_details") && (
                <div className="space-y-2">
                  <Label htmlFor="filter-accounts">Accounts</Label>
                  <Select
                    value={filters.accounts?.[0] || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, accounts: value === "all" ? [] : [value] }))}
                  >
                    <SelectTrigger id="filter-accounts" data-testid="select-filter-accounts">
                      <SelectValue placeholder="Select account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Customer Filter */}
              {reportType === "invoice_list" && (
                <div className="space-y-2">
                  <Label htmlFor="filter-customers">Customer</Label>
                  <Select
                    value={filters.customers?.[0] || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, customers: value === "all" ? [] : [value] }))}
                  >
                    <SelectTrigger id="filter-customers" data-testid="select-filter-customers">
                      <SelectValue placeholder="Select customer (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {customers.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vendor Filter */}
              {reportType === "bill_list" && (
                <div className="space-y-2">
                  <Label htmlFor="filter-vendors">Vendor</Label>
                  <Select
                    value={filters.vendors?.[0] || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, vendors: value === "all" ? [] : [value] }))}
                  >
                    <SelectTrigger id="filter-vendors" data-testid="select-filter-vendors">
                      <SelectValue placeholder="Select vendor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {vendors.map((vendor: any) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Filter */}
              {(reportType === "transaction_list" || reportType === "invoice_list" || reportType === "bill_list") && (
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={filters.status?.[0] || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? [] : [value] }))}
                  >
                    <SelectTrigger id="filter-status" data-testid="select-filter-status">
                      <SelectValue placeholder="Select status (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {reportType === "transaction_list" && (
                        <>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="posted">Posted</SelectItem>
                        </>
                      )}
                      {(reportType === "invoice_list" || reportType === "bill_list") && (
                        <>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Preview & Actions */}
          <Card>
            <CardHeader>
              <CardTitle>4. Preview & Actions</CardTitle>
              <CardDescription>Generate and export your report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => generateReport()}
                  disabled={isGenerating || selectedColumns.length === 0}
                  data-testid="button-preview-report"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isGenerating ? "Generating..." : "Preview Report"}
                </Button>

                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-save-config">
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingReport ? "Update Report" : "Save Report Configuration"}</DialogTitle>
                      <DialogDescription>
                        Give your report a name to save it for later use
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="report-name">Report Name</Label>
                        <Input
                          id="report-name"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                          placeholder="e.g., Monthly General Ledger"
                          data-testid="input-report-name"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => saveReportMutation.mutate()}
                        disabled={!reportName || saveReportMutation.isPending}
                        data-testid="button-confirm-save"
                      >
                        {saveReportMutation.isPending ? "Saving..." : (editingReport ? "Update" : "Save")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={!reportData || reportData.rows.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>

                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={!reportData || reportData.rows.length === 0}
                  data-testid="button-export-excel"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
              </div>

              {/* Preview Table */}
              {reportData && reportData.rows.length > 0 && (
                <div className="border rounded-md">
                  <div className="p-4 border-b bg-muted">
                    <p className="text-sm font-medium">Preview Results ({reportData.totalRows} rows)</p>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedColumns.map((colId) => {
                            const column = availableColumns.find(c => c.id === colId);
                            return (
                              <TableHead key={colId} data-testid={`table-header-${colId}`}>
                                {column?.label || colId}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.rows.map((row, idx) => (
                          <TableRow key={idx} data-testid={`table-row-${idx}`}>
                            {selectedColumns.map((colId) => (
                              <TableCell key={colId} data-testid={`table-cell-${idx}-${colId}`}>
                                {colId.includes('date') || colId.includes('Date')
                                  ? row[colId] ? format(new Date(row[colId]), 'yyyy-MM-dd') : '-'
                                  : colId.includes('amount') || colId.includes('debit') || colId.includes('credit') || colId.includes('balance') || colId.includes('Balance')
                                  ? row[colId] ? `$${parseFloat(row[colId]).toFixed(2)}` : '-'
                                  : row[colId] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {reportData && reportData.rows.length === 0 && (
                <div className="border rounded-md p-8 text-center text-muted-foreground">
                  <FileSpreadsheet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No data found for the selected criteria</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>Manage your saved report configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSavedReports ? (
                <div className="text-center py-8 text-muted-foreground">Loading saved reports...</div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No saved reports yet</p>
                  <p className="text-sm">Create and save a report from the Report Builder tab</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="saved-reports-header-name">Name</TableHead>
                        <TableHead data-testid="saved-reports-header-type">Type</TableHead>
                        <TableHead data-testid="saved-reports-header-columns">Columns</TableHead>
                        <TableHead data-testid="saved-reports-header-created">Created</TableHead>
                        <TableHead data-testid="saved-reports-header-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedReports.map((report) => (
                        <TableRow key={report.id} data-testid={`saved-report-row-${report.id}`}>
                          <TableCell className="font-medium" data-testid={`saved-report-name-${report.id}`}>
                            {report.name}
                          </TableCell>
                          <TableCell data-testid={`saved-report-type-${report.id}`}>
                            {reportTypeOptions.find(opt => opt.value === report.reportType)?.label || report.reportType}
                          </TableCell>
                          <TableCell data-testid={`saved-report-columns-${report.id}`}>
                            {report.selectedColumns.length} columns
                          </TableCell>
                          <TableCell data-testid={`saved-report-created-${report.id}`}>
                            {format(new Date(report.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadReport(report)}
                                data-testid={`button-load-report-${report.id}`}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => editReport(report)}
                                data-testid={`button-edit-report-${report.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => duplicateReport(report)}
                                data-testid={`button-duplicate-report-${report.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this report?")) {
                                    deleteReportMutation.mutate(report.id);
                                  }
                                }}
                                data-testid={`button-delete-report-${report.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
