import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, X, Edit, Trash2, Power, PowerOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { ApprovalWorkflow } from "@shared/schema";

interface WorkflowWithDetails extends ApprovalWorkflow {
  totalSteps: number;
  creator: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

const ENTITY_TYPE_OPTIONS = [
  { value: "all", label: "All Entity Types" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "invoice", label: "Invoice" },
  { value: "bill", label: "Bill" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "payment", label: "Payment" },
  { value: "expense", label: "Expense" },
];

export default function Workflows() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowWithDetails | null>(null);
  const [workflowToToggle, setWorkflowToToggle] = useState<WorkflowWithDetails | null>(null);

  const { data: workflows = [], isLoading } = useQuery<WorkflowWithDetails[]>({
    queryKey: ["/api/workflows", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/workflows/${workflowId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/workflows", { tenantId: currentTenant?.id }] 
      });
      toast({
        title: "Workflow deleted",
        description: "The approval workflow has been deleted successfully",
      });
      setWorkflowToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete workflow",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ workflowId, isActive }: { workflowId: string; isActive: boolean }) => {
      return apiRequest(`/api/workflows/${workflowId}`, "PATCH", { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/workflows", { tenantId: currentTenant?.id }] 
      });
      toast({
        title: variables.isActive ? "Workflow activated" : "Workflow deactivated",
        description: `The workflow has been ${variables.isActive ? "activated" : "deactivated"} successfully`,
      });
      setWorkflowToToggle(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update workflow status",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (!workflowToDelete) return;
    deleteMutation.mutate(workflowToDelete.id);
  };

  const handleToggleActive = () => {
    if (!workflowToToggle) return;
    toggleActiveMutation.mutate({
      workflowId: workflowToToggle.id,
      isActive: !workflowToToggle.isActive,
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUserName = (creator: WorkflowWithDetails['creator']) => {
    if (!creator) return "—";
    const firstName = creator.firstName || "";
    const lastName = creator.lastName || "";
    return `${firstName} ${lastName}`.trim() || creator.email || "—";
  };

  const getEntityTypeLabel = (entityType: string) => {
    const option = ENTITY_TYPE_OPTIONS.find(opt => opt.value === entityType);
    return option?.label || entityType;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setEntityTypeFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchTerm || entityTypeFilter !== "all" || statusFilter !== "all";

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      const matchesSearch = !searchTerm || 
        workflow.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEntityType = entityTypeFilter === "all" || 
        workflow.entityType === entityTypeFilter;
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && workflow.isActive) ||
        (statusFilter === "inactive" && !workflow.isActive);

      return matchesSearch && matchesEntityType && matchesStatus;
    });
  }, [workflows, searchTerm, entityTypeFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 flex-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
            Approval Workflows
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Manage approval workflows for journal entries and other entities
          </p>
        </div>
        <Link href="/workflows/new">
          <Button data-testid="button-create-workflow">
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </Link>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-workflows"
          />
        </div>

        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-48" data-testid="select-entity-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value} data-testid={`select-item-entity-${option.value}`}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-status-all">All Statuses</SelectItem>
            <SelectItem value="active" data-testid="select-item-status-active">Active</SelectItem>
            <SelectItem value="inactive" data-testid="select-item-status-inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearFilters}
            data-testid="button-clear-filters"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Power className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state-title">
            {hasActiveFilters ? "No workflows found" : "No approval workflows yet"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md" data-testid="text-empty-state-description">
            {hasActiveFilters 
              ? "Try adjusting your filters to find what you're looking for"
              : "Create your first approval workflow to start managing approvals for journal entries and other entities"}
          </p>
          {!hasActiveFilters && (
            <Link href="/workflows/new">
              <Button data-testid="button-create-first-workflow">
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead data-testid="table-header-name">Name</TableHead>
                <TableHead data-testid="table-header-entity-type">Entity Type</TableHead>
                <TableHead data-testid="table-header-status">Status</TableHead>
                <TableHead data-testid="table-header-steps">Total Steps</TableHead>
                <TableHead data-testid="table-header-created-by">Created By</TableHead>
                <TableHead data-testid="table-header-created-date">Created Date</TableHead>
                <TableHead className="text-right" data-testid="table-header-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkflows.map((workflow) => (
                <TableRow key={workflow.id} data-testid={`row-workflow-${workflow.id}`}>
                  <TableCell className="font-medium" data-testid={`cell-name-${workflow.id}`}>
                    {workflow.name}
                  </TableCell>
                  <TableCell data-testid={`cell-entity-type-${workflow.id}`}>
                    {getEntityTypeLabel(workflow.entityType)}
                  </TableCell>
                  <TableCell data-testid={`cell-status-${workflow.id}`}>
                    <Badge 
                      variant={workflow.isActive ? "default" : "secondary"}
                      className={workflow.isActive 
                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800" 
                        : ""}
                      data-testid={`badge-status-${workflow.isActive ? 'active' : 'inactive'}-${workflow.id}`}
                    >
                      {workflow.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`cell-steps-${workflow.id}`}>
                    {workflow.totalSteps}
                  </TableCell>
                  <TableCell data-testid={`cell-creator-${workflow.id}`}>
                    {getUserName(workflow.creator)}
                  </TableCell>
                  <TableCell data-testid={`cell-created-date-${workflow.id}`}>
                    {formatDate(workflow.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/workflows/${workflow.id}`}>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          data-testid={`button-edit-${workflow.id}`}
                          aria-label={`Edit workflow ${workflow.name}`}
                          title="Edit workflow"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setWorkflowToToggle(workflow)}
                        data-testid={`button-toggle-${workflow.id}`}
                        aria-label={workflow.isActive ? `Deactivate workflow ${workflow.name}` : `Activate workflow ${workflow.name}`}
                        title={workflow.isActive ? "Deactivate" : "Activate"}
                      >
                        {workflow.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setWorkflowToDelete(workflow)}
                        data-testid={`button-delete-${workflow.id}`}
                        aria-label={`Delete workflow ${workflow.name}`}
                        title="Delete workflow"
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

      <AlertDialog open={!!workflowToDelete} onOpenChange={(open) => !open && setWorkflowToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-workflow">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-dialog-title">
              Delete Workflow
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-dialog-description">
              Are you sure you want to delete "{workflowToDelete?.name}"? This action cannot be undone.
              Any active approval requests using this workflow will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!workflowToToggle} onOpenChange={(open) => !open && setWorkflowToToggle(null)}>
        <AlertDialogContent data-testid="dialog-toggle-workflow">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-toggle-dialog-title">
              {workflowToToggle?.isActive ? "Deactivate" : "Activate"} Workflow
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-toggle-dialog-description">
              Are you sure you want to {workflowToToggle?.isActive ? "deactivate" : "activate"} "{workflowToToggle?.name}"?
              {workflowToToggle?.isActive && " This workflow will no longer be used for new approvals."}
              {!workflowToToggle?.isActive && " This workflow will be used for new approvals matching its conditions."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-toggle">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              data-testid="button-confirm-toggle"
            >
              {workflowToToggle?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
