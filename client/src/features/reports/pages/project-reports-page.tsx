import { useState, useEffect } from "react";
import { useQuery, skipToken } from "@tanstack/react-query";
import { ChartBar, TrendingUp, DollarSign, Clock, Users } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { format, subDays } from "date-fns";
import type { Project, Customer } from "@shared/schema";

interface ProfitabilityReport {
  projectId: string;
  projectName: string;
  budgetAmount: string;
  totalRevenue: string;
  totalCosts: string;
  totalProfit: string;
  profitMargin: string;
  budgetedHours: string;
  actualHours: string;
  billableHours: string;
  nonBillableHours: string;
}

interface ResourceUtilizationRow {
  userId: string;
  userName: string;
  totalHours: string;
  billableHours: string;
  nonBillableHours: string;
  utilization: string;
}

interface ProjectSummaryRow {
  projectId: string;
  projectName: string;
  status: string;
  customerName: string;
  budgetAmount: string;
  actualCosts: string;
  budgetVariance: string;
  startDate: Date | null;
  endDate: Date | null;
}

const safeDecimal = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

export default function ProjectReports() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState("profitability");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const defaultEndDate = new Date();
  const defaultStartDate = subDays(defaultEndDate, 30);
  const [startDate, setStartDate] = useState(format(defaultStartDate, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(defaultEndDate, "yyyy-MM-dd"));

  useEffect(() => {
    setSelectedProjectId(null);
  }, [currentTenant?.id]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: !!currentTenant?.id,
  });

  const { data: profitability, isPending: profitabilityLoading } = useQuery<ProfitabilityReport>(
    currentTenant?.id && selectedProjectId && activeTab === "profitability"
      ? {
          queryKey: ['/api/projects', selectedProjectId, 'report', 'profitability']
        }
      : skipToken
  );

  const { data: utilization = [], isLoading: utilizationLoading } = useQuery<ResourceUtilizationRow[]>({
    queryKey: [
      '/api/projects/report/resource-utilization',
      { startDate, endDate }
    ],
    enabled: !!currentTenant?.id && activeTab === "utilization",
  });

  const { data: summary = [], isLoading: summaryLoading } = useQuery<ProjectSummaryRow[]>({
    queryKey: ["/api/projects/report/summary"],
    enabled: !!currentTenant?.id && activeTab === "summary",
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      on_hold: "secondary",
      completed: "outline",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      active: "Active",
      on_hold: "On Hold",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return (
      <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const sortedUtilization = [...utilization].sort((a, b) => {
    return safeDecimal(b.totalHours) - safeDecimal(a.totalHours);
  });

  const sortedSummary = [...summary].sort((a, b) => {
    return a.projectName.localeCompare(b.projectName);
  });

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          Project Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Analyze project profitability, resource utilization, and overall performance
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="profitability" data-testid="tab-profitability">
            <ChartBar className="h-4 w-4 mr-2" />
            Profitability
          </TabsTrigger>
          <TabsTrigger value="utilization" data-testid="tab-utilization">
            <Users className="h-4 w-4 mr-2" />
            Resource Utilization
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary">
            <TrendingUp className="h-4 w-4 mr-2" />
            Project Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profitability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Project</CardTitle>
              <CardDescription>Choose a project to view its profitability analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full" data-testid="select-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading projects...
                    </SelectItem>
                  ) : projects.length === 0 ? (
                    <SelectItem value="no-projects" disabled>
                      No projects available
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectNumber} - {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {profitabilityLoading && selectedProjectId && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(9)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          )}

          {!selectedProjectId && !profitabilityLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ChartBar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground" data-testid="text-no-project-selected">
                  Select a project to view profitability
                </p>
                <p className="text-sm text-muted-foreground">
                  Choose a project from the dropdown above to see detailed profitability metrics
                </p>
              </CardContent>
            </Card>
          )}

          {profitability && selectedProjectId && !profitabilityLoading && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-total-revenue">
                      ${safeDecimal(profitability.totalRevenue).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Costs
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-total-costs">
                      ${safeDecimal(profitability.totalCosts).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Profit
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-mono font-semibold ${
                        safeDecimal(profitability.totalProfit) >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                      data-testid="text-total-profit"
                    >
                      ${safeDecimal(profitability.totalProfit).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Profit Margin
                    </CardTitle>
                    <ChartBar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-profit-margin">
                      {safeDecimal(profitability.profitMargin).toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Budget Amount
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-budget-amount">
                      ${safeDecimal(profitability.budgetAmount).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Budgeted Hours
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-budgeted-hours">
                      {safeDecimal(profitability.budgetedHours).toFixed(1)} hrs
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Actual Hours
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-actual-hours">
                      {safeDecimal(profitability.actualHours).toFixed(1)} hrs
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Billable Hours
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-billable-hours">
                      {safeDecimal(profitability.billableHours).toFixed(1)} hrs
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Non-Billable Hours
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-semibold" data-testid="text-non-billable-hours">
                      {safeDecimal(profitability.nonBillableHours).toFixed(1)} hrs
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="utilization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
              <CardDescription>Select the date range for resource utilization analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {utilizationLoading && (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {!utilizationLoading && sortedUtilization.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground" data-testid="text-no-utilization">
                  No utilization data found
                </p>
                <p className="text-sm text-muted-foreground">
                  There is no resource utilization data for the selected date range
                </p>
              </CardContent>
            </Card>
          )}

          {!utilizationLoading && sortedUtilization.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>
                  Showing utilization for {sortedUtilization.length} user
                  {sortedUtilization.length !== 1 ? "s" : ""} from {format(new Date(startDate), "MMM dd, yyyy")} to{" "}
                  {format(new Date(endDate), "MMM dd, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">User Name</TableHead>
                        <TableHead className="text-right font-semibold">Total Hours</TableHead>
                        <TableHead className="text-right font-semibold">Billable Hours</TableHead>
                        <TableHead className="text-right font-semibold">Non-Billable Hours</TableHead>
                        <TableHead className="text-right font-semibold">Utilization %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUtilization.map((row, idx) => (
                        <TableRow key={row.userId} data-testid={`row-utilization-${idx}`}>
                          <TableCell className="font-medium" data-testid={`text-user-name-${idx}`}>
                            {row.userName}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-total-hours-${idx}`}>
                            {safeDecimal(row.totalHours).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-billable-hours-${idx}`}>
                            {safeDecimal(row.billableHours).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-non-billable-hours-${idx}`}>
                            {safeDecimal(row.nonBillableHours).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-utilization-${idx}`}>
                            {safeDecimal(row.utilization).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          {summaryLoading && (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {!summaryLoading && sortedSummary.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground" data-testid="text-no-projects">
                  No projects found
                </p>
                <p className="text-sm text-muted-foreground">There are no projects to display in the summary</p>
              </CardContent>
            </Card>
          )}

          {!summaryLoading && sortedSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Project Summary</CardTitle>
                <CardDescription>
                  Overview of all {sortedSummary.length} project{sortedSummary.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Project Name</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="text-right font-semibold">Budget Amount</TableHead>
                        <TableHead className="text-right font-semibold">Actual Costs</TableHead>
                        <TableHead className="text-right font-semibold">Budget Variance</TableHead>
                        <TableHead className="font-semibold">Start Date</TableHead>
                        <TableHead className="font-semibold">End Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSummary.map((row, idx) => {
                        const variance = safeDecimal(row.budgetVariance);
                        return (
                          <TableRow key={row.projectId} data-testid={`row-summary-${idx}`}>
                            <TableCell className="font-medium" data-testid={`text-project-name-${idx}`}>
                              {row.projectName}
                            </TableCell>
                            <TableCell data-testid={`badge-status-${idx}`}>{getStatusBadge(row.status)}</TableCell>
                            <TableCell data-testid={`text-customer-${idx}`}>{row.customerName}</TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-budget-${idx}`}>
                              ${safeDecimal(row.budgetAmount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-actual-costs-${idx}`}>
                              ${safeDecimal(row.actualCosts).toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                variance >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                              data-testid={`text-variance-${idx}`}
                            >
                              ${variance.toFixed(2)}
                            </TableCell>
                            <TableCell data-testid={`text-start-date-${idx}`}>
                              {row.startDate ? format(new Date(row.startDate), "MMM dd, yyyy") : "-"}
                            </TableCell>
                            <TableCell data-testid={`text-end-date-${idx}`}>
                              {row.endDate ? format(new Date(row.endDate), "MMM dd, yyyy") : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
