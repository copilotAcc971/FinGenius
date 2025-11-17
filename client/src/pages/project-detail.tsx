import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Edit, Trash2, ArrowLeft, Plus, Check, X, Clock as ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/contexts/rbac-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Customer, TimeEntry, ProjectTask, ProjectMilestone, User, ProjectBudget, ProjectExpense, ProjectInvoice } from "@shared/schema";
import { format } from "date-fns";
import { CreateProjectInvoiceDialog } from "@/components/create-project-invoice-dialog";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id;
  const [, setLocation] = useLocation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission, canUpdate } = useRBAC();
  const canManage = canUpdate('projects');
  const [activeTab, setActiveTab] = useState("overview");
  const [createInvoiceDialogOpen, setCreateInvoiceDialogOpen] = useState(false);

  // Safe decimal to number conversion
  const safeDecimal = (value: string | null | undefined): number => {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId, currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}?tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", project?.customerId, currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${project?.customerId}?tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch customer');
      return res.json();
    },
    enabled: !!project?.customerId && !!currentTenant?.id,
  });

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { projectId, tenantId: currentTenant?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch time entries');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === "time",
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ProjectTask[]>({
    queryKey: ["/api/project-tasks", { projectId, tenantId: currentTenant?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/project-tasks?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === "tasks",
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<ProjectMilestone[]>({
    queryKey: ["/api/project-milestones", { projectId, tenantId: currentTenant?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/project-milestones?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch milestones');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === "milestones",
  });

  const { data: budgets, isLoading: budgetsLoading } = useQuery<ProjectBudget[]>({
    queryKey: ['/api/project-budgets', projectId, currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/project-budgets?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch budgets');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === 'budget'
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<ProjectExpense[]>({
    queryKey: ['/api/project-expenses', projectId, currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/project-expenses?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === 'expenses'
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<ProjectInvoice[]>({
    queryKey: ['/api/project-invoices', projectId, currentTenant?.id],
    queryFn: async () => {
      const res = await fetch(`/api/project-invoices?projectId=${projectId}&tenantId=${currentTenant?.id}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
    enabled: !!projectId && !!currentTenant?.id && activeTab === 'invoices'
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !projectId) throw new Error("Missing required data");
      await apiRequest(`/api/projects/${projectId}?tenantId=${currentTenant.id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Project deleted",
        description: "Project has been removed successfully.",
      });
      setLocation("/projects");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project.",
        variant: "destructive",
      });
    },
  });

  const updateTimeEntryStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/time-entries/${id}?tenantId=${currentTenant.id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", { projectId, tenantId: currentTenant?.id }] });
      toast({
        title: "Time entry updated",
        description: "Status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update time entry.",
        variant: "destructive",
      });
    },
  });

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
      <Badge variant={variants[status] || "secondary"} data-testid="badge-project-status">
        {labels[status] || status}
      </Badge>
    );
  };

  const getTimeEntryStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "outline",
      approved: "default",
      rejected: "destructive",
      invoiced: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

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

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Project Not Found</h2>
          <Button onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold" data-testid="text-project-name">{project.name}</h1>
                {getStatusBadge(project.status)}
              </div>
              <p className="text-muted-foreground mt-1 font-mono" data-testid="text-project-number">
                {project.projectNumber}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission("projects:update") && (
            <Button variant="outline" data-testid="button-edit-project">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {hasPermission("projects:delete") && (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to delete this project?")) {
                  deleteMutation.mutate();
                }
              }}
              data-testid="button-delete-project"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="time" data-testid="tab-time">Time Entries</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="budget" data-testid="tab-budget">Budget</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="milestones" data-testid="tab-milestones">Milestones</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Project Details</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Client</dt>
                  <dd className="text-base" data-testid="text-client">{customer?.name || "Loading..."}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Billing Type</dt>
                  <dd className="text-base" data-testid="text-billing-type">
                    {project.billingType === "time_and_materials" ? "Time & Materials" : 
                     project.billingType === "fixed_price" ? "Fixed Price" : "Non-Billable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Budget</dt>
                  <dd className="text-base font-mono" data-testid="text-budget">
                    {project.budgetAmount ? `$${safeDecimal(project.budgetAmount).toLocaleString()}` : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Budget Hours</dt>
                  <dd className="text-base font-mono" data-testid="text-budget-hours">
                    {project.budgetHours ? `${safeDecimal(project.budgetHours).toFixed(2)} hrs` : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Start Date</dt>
                  <dd className="text-base" data-testid="text-start-date">
                    {project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">End Date</dt>
                  <dd className="text-base" data-testid="text-end-date">
                    {project.endDate ? format(new Date(project.endDate), "MMM d, yyyy") : "Not set"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Team Members</h2>
                {hasPermission("projects:update") && (
                  <Button size="sm" data-testid="button-add-member">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-no-members">
                No team members assigned yet.
              </p>
            </Card>
          </div>

          {project.description && (
            <Card className="p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                {project.description}
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="time" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Time Entries</h2>
              {hasPermission("time_entries:create") && (
                <Button data-testid="button-log-time">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Log Time
                </Button>
              )}
            </div>

            {timeEntries.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground" data-testid="text-no-time-entries">
                No time entries recorded yet.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold text-right">Hours</TableHead>
                      <TableHead className="font-semibold">Billable</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                        <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {parseFloat(entry.hours).toFixed(2)}
                        </TableCell>
                        <TableCell>{entry.isBillable ? "Yes" : "No"}</TableCell>
                        <TableCell>{getTimeEntryStatusBadge(entry.status)}</TableCell>
                        <TableCell className="text-right">
                          {hasPermission("time_entries:approve") && entry.status === "submitted" && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTimeEntryStatusMutation.mutate({ id: entry.id, status: "approved" })}
                                data-testid={`button-approve-${entry.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateTimeEntryStatusMutation.mutate({ id: entry.id, status: "rejected" })}
                                data-testid={`button-reject-${entry.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" data-testid="content-tasks">
          <Card>
            <CardHeader>
              <CardTitle>Project Tasks</CardTitle>
              <CardDescription>Track task progress and completion</CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks for this project
                  {canManage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      data-testid="button-add-task"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Estimated Hours</TableHead>
                      <TableHead className="text-right">Actual Hours</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              task.status === 'completed' ? 'default' :
                              task.status === 'in_progress' ? 'secondary' :
                              'outline'
                            }
                          >
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {task.estimatedHours ? safeDecimal(task.estimatedHours).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {safeDecimal(task.actualHours).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {task.estimatedHours && task.actualHours
                            ? `${Math.round((safeDecimal(task.actualHours) / safeDecimal(task.estimatedHours)) * 100)}%`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Budget</CardTitle>
            </CardHeader>
            <CardContent>
              {budgetsLoading ? (
                <div>Loading budgets...</div>
              ) : !budgets || budgets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No budgets defined for this project
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Budgeted</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.map((budget) => (
                      <TableRow key={budget.id}>
                        <TableCell>{budget.category}</TableCell>
                        <TableCell className="text-right font-mono">
                          {safeDecimal(budget.budgetedAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {safeDecimal(budget.actualAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(safeDecimal(budget.budgetedAmount) - safeDecimal(budget.actualAmount)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Linked Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div>Loading expenses...</div>
              ) : !expenses || expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No expenses linked to this project
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{new Date(expense.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {safeDecimal(expense.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge>{expense.isInvoiced ? 'Invoiced' : 'Not Invoiced'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" data-testid="content-milestones">
          <Card>
            <CardHeader>
              <CardTitle>Project Milestones</CardTitle>
              <CardDescription>Key project milestones and deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              {milestonesLoading ? (
                <div className="text-center py-8">Loading milestones...</div>
              ) : !milestones || milestones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No milestones defined for this project
                  {canManage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      data-testid="button-add-milestone"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Milestone
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <Card key={milestone.id} data-testid={`card-milestone-${milestone.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{milestone.name}</h4>
                              <Badge variant={milestone.isCompleted ? 'default' : 'outline'}>
                                {milestone.isCompleted ? 'Completed' : 'Pending'}
                              </Badge>
                            </div>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {milestone.description}
                              </p>
                            )}
                            <div className="flex gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Due: </span>
                                <span className="font-medium">
                                  {new Date(milestone.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                              {milestone.completedAt && (
                                <div>
                                  <span className="text-muted-foreground">Completed: </span>
                                  <span className="font-medium">
                                    {new Date(milestone.completedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {milestone.amount && (
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Amount</div>
                              <div className="font-mono font-semibold">
                                ${safeDecimal(milestone.amount).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Project Invoices</CardTitle>
              {hasPermission("invoices:create") && (
                <Button
                  onClick={() => setCreateInvoiceDialogOpen(true)}
                  data-testid="button-create-invoice"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-center py-8">Loading invoices...</div>
              ) : !invoices || invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No invoices linked to this project</p>
                  {hasPermission("invoices:create") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setCreateInvoiceDialogOpen(true)}
                      data-testid="button-create-first-invoice"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Invoice
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Invoice Number</TableHead>
                        <TableHead className="font-semibold">Billing Mode</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold text-right">Hours</TableHead>
                        <TableHead className="font-semibold text-right">Amount</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                          <TableCell className="font-mono">{invoice.invoiceId}</TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-mode-${invoice.id}`}>
                              {invoice.billingMode === "time_entries" ? "Time Entries" :
                               invoice.billingMode === "milestone" ? "Milestone" :
                               invoice.billingMode === "progress" ? "Progress" :
                               invoice.billingMode}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right font-mono">
                            {invoice.totalHours ? safeDecimal(invoice.totalHours).toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`amount-${invoice.id}`}>
                            ${safeDecimal(invoice.totalAmount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`status-${invoice.id}`}>
                              Active
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          
          {customer && (
            <CreateProjectInvoiceDialog
              open={createInvoiceDialogOpen}
              onOpenChange={setCreateInvoiceDialogOpen}
              project={project}
              customer={customer}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
