import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { Project, Customer } from "@shared/schema";
import { format } from "date-fns";

export default function Projects() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/projects/${id}?tenantId=${currentTenant.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", { tenantId: currentTenant?.id }] });
      toast({
        title: "Project deleted",
        description: "Project has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project.",
        variant: "destructive",
      });
    },
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.projectNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage client projects and track progress</p>
        </div>
        {hasPermission("projects:create") && (
          <Button data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4" data-testid="text-no-projects">
              {searchQuery || statusFilter !== "all" 
                ? "No projects match your filters"
                : "No projects yet"}
            </p>
            {hasPermission("projects:create") && !searchQuery && statusFilter === "all" && (
              <Button data-testid="button-create-first-project">
                <Plus className="h-4 w-4 mr-2" />
                Create your first project
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Project Number</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Budget</TableHead>
                  <TableHead className="font-semibold">Start Date</TableHead>
                  <TableHead className="font-semibold">End Date</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    data-testid={`row-project-${project.id}`}
                  >
                    <TableCell className="font-medium font-mono" data-testid={`text-project-number-${project.id}`}>
                      {project.projectNumber}
                    </TableCell>
                    <TableCell data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </TableCell>
                    <TableCell data-testid={`text-customer-${project.id}`}>
                      {getCustomerName(project.customerId)}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-budget-${project.id}`}>
                      {project.budgetAmount ? `$${parseFloat(project.budgetAmount).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell data-testid={`text-start-date-${project.id}`}>
                      {project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell data-testid={`text-end-date-${project.id}`}>
                      {project.endDate ? format(new Date(project.endDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${project.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasPermission("projects:update") && (
                            <DropdownMenuItem data-testid={`button-edit-${project.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {hasPermission("projects:delete") && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this project?")) {
                                  deleteMutation.mutate(project.id);
                                }
                              }}
                              data-testid={`button-delete-${project.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
