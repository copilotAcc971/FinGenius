import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { FileText, Download, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AgingSummary {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120plus: number;
  total: number;
}

interface VendorAgingRow {
  vendorId: number;
  vendorName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120plus: number;
  total: number;
}

interface BillAgingRow {
  billId: number;
  billNumber: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  daysOverdue: number;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  bucket: string;
}

interface ProjectAgingRow {
  projectId: number | null;
  projectName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120plus: number;
  total: number;
}

interface APAgingReport {
  summary: AgingSummary;
  vendors?: VendorAgingRow[];
  bills?: BillAgingRow[];
  projects?: ProjectAgingRow[];
}

type GroupByType = "vendor" | "invoice" | "project";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getBucketBadgeVariant = (bucket: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (bucket.toLowerCase()) {
    case "current":
      return "secondary";
    case "1-30":
      return "outline";
    case "31-60":
      return "default";
    case "61-90":
    case "91-120":
    case "120+":
      return "destructive";
    default:
      return "secondary";
  }
};

export default function APAgingReport() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  
  // Parse query parameter for groupBy
  const searchParams = new URLSearchParams(searchString);
  const initialView = (searchParams.get('groupBy') as GroupByType) || 'vendor';
  const [activeView, setActiveView] = useState<GroupByType>(initialView);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination state for bill view
  const [billPage, setBillPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.assign("/api/login");
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast, navigate]);

  // Update URL when view changes
  useEffect(() => {
    navigate(`/ap-aging?groupBy=${activeView}`, { replace: true });
    setBillPage(1);
  }, [activeView, navigate]);

  // Fetch AP Aging Report
  const { data: report, isLoading } = useQuery<APAgingReport>({
    queryKey: ['/api/reports/ap-aging', { tenantId: currentTenant?.id, groupBy: activeView }],
    enabled: !!currentTenant?.id,
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortData = <T extends Record<string, any>>(data: T[], column: keyof T): T[] => {
    if (!column) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === "asc") {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return bStr < aStr ? -1 : bStr > aStr ? 1 : 0;
      }
    });
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

  const chartData = report?.summary ? [
    { bucket: 'Current', amount: report.summary.current },
    { bucket: '1-30', amount: report.summary.days1to30 },
    { bucket: '31-60', amount: report.summary.days31to60 },
    { bucket: '61-90', amount: report.summary.days61to90 },
    { bucket: '91-120', amount: report.summary.days91to120 },
    { bucket: '120+', amount: report.summary.days120plus },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">AP Aging Report</h1>
          <p className="text-muted-foreground">Accounts payable aging analysis</p>
        </div>
        <Button variant="outline" data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as GroupByType)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="vendor" data-testid="tab-vendor">
            By Vendor
          </TabsTrigger>
          <TabsTrigger value="invoice" data-testid="tab-bill">
            By Bill
          </TabsTrigger>
          <TabsTrigger value="project" data-testid="tab-project">
            By Project
          </TabsTrigger>
        </TabsList>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {/* Summary Cards */}
        {report?.summary && !isLoading && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card data-testid="card-summary-current">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.current)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-1-30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">1-30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.days1to30)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-31-60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">31-60 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.days31to60)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-61-90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">61-90 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.days61to90)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-91-120">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">91-120 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.days91to120)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-120-plus">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">120+ Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-mono font-semibold">
                  {formatCurrency(report.summary.days120plus)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Total Payables Card */}
        {report?.summary && !isLoading && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Total Payables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-primary">
                {formatCurrency(report.summary.total)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Visualization */}
        {report?.summary && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Aging Bucket Distribution</CardTitle>
              <CardDescription>Payables breakdown by aging period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="bucket" 
                    className="text-sm"
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-sm"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" name="Amount" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Vendor View */}
        <TabsContent value="vendor" className="space-y-6">
          {report?.vendors && report.vendors.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No payables found</p>
                <p className="text-sm text-muted-foreground">There are no outstanding payables for any vendors.</p>
              </CardContent>
            </Card>
          ) : report?.vendors && !isLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Vendor Aging Detail</CardTitle>
                <CardDescription>
                  Showing {report.vendors.length} vendor{report.vendors.length !== 1 ? 's' : ''} with outstanding payables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table data-testid="table-ap-aging">
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover-elevate"
                          onClick={() => handleSort('vendorName')}
                        >
                          <div className="flex items-center gap-2">
                            Vendor Name
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('current')}>
                          <div className="flex items-center justify-end gap-2">
                            Current
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days1to30')}>
                          <div className="flex items-center justify-end gap-2">
                            1-30
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days31to60')}>
                          <div className="flex items-center justify-end gap-2">
                            31-60
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days61to90')}>
                          <div className="flex items-center justify-end gap-2">
                            61-90
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days91to120')}>
                          <div className="flex items-center justify-end gap-2">
                            91-120
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days120plus')}>
                          <div className="flex items-center justify-end gap-2">
                            120+
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('total')}>
                          <div className="flex items-center justify-end gap-2">
                            Total
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortData(report.vendors, sortColumn as keyof VendorAgingRow).map((vendor, idx) => (
                        <TableRow key={vendor.vendorId} data-testid={`row-vendor-${idx}`}>
                          <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.current)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.days1to30)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.days31to60)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.days61to90)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.days91to120)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(vendor.days120plus)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(vendor.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Bill View */}
        <TabsContent value="invoice" className="space-y-6">
          {report?.bills && report.bills.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No payables found</p>
                <p className="text-sm text-muted-foreground">There are no outstanding bills.</p>
              </CardContent>
            </Card>
          ) : report?.bills && !isLoading ? (() => {
            const defaultSorted = sortColumn ? report.bills : [...report.bills].sort((a, b) => b.daysOverdue - a.daysOverdue);
            const sortedBills = sortData(defaultSorted, sortColumn as keyof BillAgingRow);
            const totalPages = Math.ceil(sortedBills.length / pageSize);
            const paginatedBills = sortedBills.slice((billPage - 1) * pageSize, billPage * pageSize);
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Bill Aging Detail</CardTitle>
                  <CardDescription>
                    Showing {paginatedBills.length} of {sortedBills.length} bill{sortedBills.length !== 1 ? 's' : ''} with outstanding balances
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table data-testid="table-ap-aging">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Bill Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('daysOverdue')}>
                            <div className="flex items-center justify-end gap-2">
                              Days Overdue
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead>Bucket</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBills.map((bill, idx) => (
                          <TableRow key={bill.billId} data-testid={`row-bill-${idx}`}>
                            <TableCell className="font-medium">
                              <a 
                                href={`/bills?id=${bill.billId}`}
                                className="text-primary hover:underline"
                                data-testid={`link-bill-${bill.billId}`}
                              >
                                {bill.billNumber}
                              </a>
                            </TableCell>
                            <TableCell>{bill.vendorName}</TableCell>
                            <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right font-mono">
                              {bill.daysOverdue > 0 ? bill.daysOverdue : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(bill.totalAmount)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(bill.paidAmount)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{formatCurrency(bill.outstanding)}</TableCell>
                            <TableCell>
                              <Badge variant={getBucketBadgeVariant(bill.bucket)}>
                                {bill.bucket}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {billPage} of {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBillPage(p => Math.max(1, p - 1))}
                          disabled={billPage === 1}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBillPage(p => Math.min(totalPages, p + 1))}
                          disabled={billPage === totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })() : null}
        </TabsContent>

        {/* Project View */}
        <TabsContent value="project" className="space-y-6">
          {report?.projects && report.projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No payables found</p>
                <p className="text-sm text-muted-foreground">There are no outstanding payables for any projects.</p>
              </CardContent>
            </Card>
          ) : report?.projects && !isLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Project Aging Detail</CardTitle>
                <CardDescription>
                  Showing {report.projects.length} project{report.projects.length !== 1 ? 's' : ''} with outstanding payables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table data-testid="table-ap-aging">
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover-elevate"
                          onClick={() => handleSort('projectName')}
                        >
                          <div className="flex items-center gap-2">
                            Project Name
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('current')}>
                          <div className="flex items-center justify-end gap-2">
                            Current
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days1to30')}>
                          <div className="flex items-center justify-end gap-2">
                            1-30
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days31to60')}>
                          <div className="flex items-center justify-end gap-2">
                            31-60
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days61to90')}>
                          <div className="flex items-center justify-end gap-2">
                            61-90
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days91to120')}>
                          <div className="flex items-center justify-end gap-2">
                            91-120
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('days120plus')}>
                          <div className="flex items-center justify-end gap-2">
                            120+
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover-elevate" onClick={() => handleSort('total')}>
                          <div className="flex items-center justify-end gap-2">
                            Total
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortData(report.projects, sortColumn as keyof ProjectAgingRow).map((project, idx) => (
                        <TableRow key={project.projectId || 0} data-testid={`row-project-${idx}`}>
                          <TableCell className="font-medium">
                            {project.projectName || "Unassigned"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.current)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.days1to30)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.days31to60)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.days61to90)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.days91to120)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(project.days120plus)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(project.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
