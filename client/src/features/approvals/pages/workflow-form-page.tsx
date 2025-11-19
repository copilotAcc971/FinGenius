import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { Role, User } from "@shared/schema";

const ENTITY_TYPE_OPTIONS = [
  { value: "journal_entry", label: "Journal Entry" },
  { value: "invoice", label: "Invoice" },
  { value: "bill", label: "Bill" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "payment", label: "Payment" },
  { value: "expense", label: "Expense" },
];

const approvalStepSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverType: z.enum(["role", "user"]),
  approverRole: z.string().nullable(),
  approverUserId: z.string().nullable(),
  canModify: z.boolean().default(false),
}).refine(
  (data) => data.approverRole !== null || data.approverUserId !== null,
  {
    message: "Either approver role or user must be selected",
    path: ["approverRole"],
  }
);

const workflowFormSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  entityType: z.string().min(1, "Entity type is required"),
  isActive: z.boolean().default(true),
  amountThreshold: z.string().optional(),
  steps: z.array(approvalStepSchema).min(1, "At least one approval step is required"),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

interface WorkflowWithSteps {
  id: string;
  name: string;
  entityType: string;
  isActive: boolean;
  conditions: {
    amountThreshold?: number;
  };
  steps: Array<{
    id: string;
    stepOrder: number;
    approverRole: string | null;
    approverUserId: string | null;
    requiresAll: boolean;
  }>;
}

export default function WorkflowForm() {
  const [, params] = useRoute("/workflows/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const workflowId = params?.id;
  const isEditMode = !!workflowId && workflowId !== "new";

  // Fetch workflow data if editing
  const { data: workflow, isLoading: workflowLoading } = useQuery<WorkflowWithSteps>({
    queryKey: ["/api/workflows", workflowId, { tenantId: currentTenant?.id }],
    enabled: isEditMode && !!currentTenant?.id,
  });

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/rbac/roles", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  // Fetch tenant members (users)
  const { data: tenantMembers = [], isLoading: usersLoading } = useQuery<Array<{
    user: User;
  }>>({
    queryKey: ["/api/tenants/members", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const users = tenantMembers.map((tm) => tm.user);

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: "",
      entityType: "",
      isActive: true,
      amountThreshold: "",
      steps: [
        {
          stepOrder: 1,
          approverType: "role",
          approverRole: null,
          approverUserId: null,
          canModify: false,
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  // Load workflow data when editing
  useEffect(() => {
    if (isEditMode && workflow) {
      form.reset({
        name: workflow.name,
        entityType: workflow.entityType,
        isActive: workflow.isActive,
        amountThreshold: workflow.conditions?.amountThreshold?.toString() || "",
        steps: workflow.steps.map((step) => ({
          stepOrder: step.stepOrder,
          approverType: step.approverRole ? "role" : "user",
          approverRole: step.approverRole,
          approverUserId: step.approverUserId,
          canModify: false,
        })),
      });
    }
  }, [workflow, isEditMode, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: WorkflowFormValues) => {
      const payload = {
        name: data.name,
        entityType: data.entityType,
        isActive: data.isActive,
        conditions: {
          amountThreshold: data.amountThreshold ? parseFloat(data.amountThreshold) : undefined,
        },
        steps: data.steps.map((step) => ({
          stepOrder: step.stepOrder,
          approverRole: step.approverType === "role" ? step.approverRole : null,
          approverUserId: step.approverType === "user" ? step.approverUserId : null,
          requiresAll: false,
        })),
      };
      return apiRequest("/api/workflows", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Workflow created",
        description: "The approval workflow has been created successfully",
      });
      setLocation("/workflows");
    },
    onError: (error: any) => {
      toast({
        title: "Create failed",
        description: error.message || "Failed to create workflow",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: WorkflowFormValues) => {
      const payload = {
        name: data.name,
        entityType: data.entityType,
        isActive: data.isActive,
        conditions: {
          amountThreshold: data.amountThreshold ? parseFloat(data.amountThreshold) : undefined,
        },
        steps: data.steps.map((step) => ({
          stepOrder: step.stepOrder,
          approverRole: step.approverType === "role" ? step.approverRole : null,
          approverUserId: step.approverType === "user" ? step.approverUserId : null,
          requiresAll: false,
        })),
      };
      return apiRequest(`/api/workflows/${workflowId}`, "PUT", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Workflow updated",
        description: "The approval workflow has been updated successfully",
      });
      setLocation("/workflows");
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update workflow",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/workflows/${workflowId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Workflow deleted",
        description: "The approval workflow has been deleted successfully",
      });
      setLocation("/workflows");
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete workflow",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: WorkflowFormValues) => {
    // Reorder steps to ensure sequential order
    const reorderedSteps = data.steps.map((step, index) => ({
      ...step,
      stepOrder: index + 1,
    }));

    const formData = {
      ...data,
      steps: reorderedSteps,
    };

    if (isEditMode) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleAddStep = () => {
    append({
      stepOrder: fields.length + 1,
      approverType: "role",
      approverRole: null,
      approverUserId: null,
      canModify: false,
    });
  };

  const handleRemoveStep = (index: number) => {
    remove(index);
  };

  const handleMoveStepUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const handleMoveStepDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  const getUserName = (user: User) => {
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user.email || "Unknown User";
  };

  if (workflowLoading || rolesLoading || usersLoading) {
    return (
      <div className="flex flex-col h-full p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isEditMode && !workflow) {
    return (
      <div className="flex flex-col h-full p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Workflow not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-8 space-y-6">
        <Breadcrumb data-testid="breadcrumb-workflow-form">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/workflows" data-testid="link-workflows">
                Workflows
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="text-workflow-name">
                {isEditMode ? workflow?.name || "Edit Workflow" : "New Workflow"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold" data-testid="heading-workflow-form">
            {isEditMode ? "Edit Workflow" : "Create Workflow"}
          </h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/workflows")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workflow Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Journal Entry Approval"
                          data-testid="input-workflow-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-entity-type">
                            <SelectValue placeholder="Select entity type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ENTITY_TYPE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              data-testid={`option-entity-type-${option.value}`}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The type of entity this workflow applies to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable or disable this workflow
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-workflow-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="amountThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Threshold (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="e.g., 10000"
                          data-testid="input-amount-threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum amount that triggers this approval workflow
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>Approval Steps</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStep}
                    data-testid="button-add-step"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No steps defined</AlertTitle>
                    <AlertDescription>
                      Add at least one approval step to this workflow
                    </AlertDescription>
                  </Alert>
                )}

                {fields.map((field, index) => (
                  <Card key={field.id} data-testid={`card-step-${index + 1}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="text-base">
                          Step {index + 1}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveStepUp(index)}
                            disabled={index === 0}
                            data-testid={`button-move-up-${index + 1}`}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveStepDown(index)}
                            disabled={index === fields.length - 1}
                            data-testid={`button-move-down-${index + 1}`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStep(index)}
                            disabled={fields.length === 1}
                            data-testid={`button-remove-step-${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`steps.${index}.approverType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approver Type</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Clear the other approver field when type changes
                                if (value === "role") {
                                  form.setValue(`steps.${index}.approverUserId`, null);
                                } else {
                                  form.setValue(`steps.${index}.approverRole`, null);
                                }
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid={`select-approver-type-${index + 1}`}>
                                  <SelectValue placeholder="Select approver type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="role" data-testid={`option-approver-type-role-${index + 1}`}>
                                  Role
                                </SelectItem>
                                <SelectItem value="user" data-testid={`option-approver-type-user-${index + 1}`}>
                                  User
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch(`steps.${index}.approverType`) === "role" && (
                        <FormField
                          control={form.control}
                          name={`steps.${index}.approverRole`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approver Role *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || undefined}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-approver-role-${index + 1}`}>
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {roles.map((role) => (
                                    <SelectItem
                                      key={role.id}
                                      value={role.name}
                                      data-testid={`option-role-${role.name}-${index + 1}`}
                                    >
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {form.watch(`steps.${index}.approverType`) === "user" && (
                        <FormField
                          control={form.control}
                          name={`steps.${index}.approverUserId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approver User *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || undefined}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-approver-user-${index + 1}`}>
                                    <SelectValue placeholder="Select user" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {users.map((user) => (
                                    <SelectItem
                                      key={user.id}
                                      value={user.id}
                                      data-testid={`option-user-${user.id}-${index + 1}`}
                                    >
                                      {getUserName(user)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isPending}
                    data-testid="button-delete-workflow"
                  >
                    {deleteMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Delete Workflow
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/workflows")}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save-workflow"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {isEditMode ? "Update Workflow" : "Create Workflow"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
