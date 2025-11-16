import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Package, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/contexts/rbac-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { CompositeItemComponent, Item } from "@shared/schema";
import { insertCompositeItemComponentSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertCompositeItemComponentSchema.extend({
  componentItemId: z.string().min(1, "Component item is required"),
  quantity: z.string().min(1, "Quantity is required").refine(val => parseFloat(val) > 0, "Quantity must be greater than 0"),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CompositeItemComponentWithRelations = CompositeItemComponent & {
  componentItem?: Item;
  compositeItem?: Item;
};

export default function CompositeItems() {
  const [selectedCompositeId, setSelectedCompositeId] = useState<string>("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingComponent, setEditingComponent] = useState<CompositeItemComponentWithRelations | null>(null);
  const [componentToDelete, setComponentToDelete] = useState<string | null>(null);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasPermission } = useRBAC();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: components = [], isLoading: isLoadingComponents } = useQuery<CompositeItemComponentWithRelations[]>({
    queryKey: ["/api/composite-items", selectedCompositeId, "components"],
    enabled: !!selectedCompositeId,
  });

  const compositeItems = items.filter(item => item.type === "composite");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      componentItemId: "",
      quantity: "",
      effectiveFrom: new Date(),
      effectiveTo: undefined,
    },
  });

  useEffect(() => {
    if (editingComponent) {
      form.reset({
        compositeItemId: editingComponent.compositeItemId,
        componentItemId: editingComponent.componentItemId,
        quantity: editingComponent.quantity,
        effectiveFrom: new Date(editingComponent.effectiveFrom),
        effectiveTo: editingComponent.effectiveTo ? new Date(editingComponent.effectiveTo) : undefined,
        sortOrder: editingComponent.sortOrder,
        isActive: editingComponent.isActive,
      });
    } else {
      form.reset({
        componentItemId: "",
        quantity: "",
        effectiveFrom: new Date(),
        effectiveTo: undefined,
      });
    }
  }, [editingComponent, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (editingComponent) {
        return apiRequest(`/api/composite-items/${selectedCompositeId}/components/${editingComponent.id}`, "PUT", data);
      }
      return apiRequest(`/api/composite-items/${selectedCompositeId}/components`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/composite-items", selectedCompositeId, "components"] });
      toast({
        title: editingComponent ? "Component updated" : "Component added",
        description: `Component has been ${editingComponent ? "updated" : "added"} successfully.`,
      });
      setShowDialog(false);
      setEditingComponent(null);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to ${editingComponent ? "update" : "add"} component.`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/composite-items/${selectedCompositeId}/components/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/composite-items", selectedCompositeId, "components"] });
      toast({
        title: "Component deleted",
        description: "Component has been removed successfully.",
      });
      setComponentToDelete(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete component.",
        variant: "destructive",
      });
    },
  });

  const filteredComponents = components.filter((comp) => {
    if (!showActiveOnly) return true;
    const now = new Date();
    return comp.isActive && (!comp.effectiveTo || new Date(comp.effectiveTo) > now);
  });

  const calculateTotalCost = () => {
    return filteredComponents.reduce((total, comp) => {
      const componentCost = parseFloat(comp.componentCost || "0");
      const quantity = parseFloat(comp.quantity);
      return total + (componentCost * quantity);
    }, 0);
  };

  const onSubmit = (data: FormValues) => {
    if (!hasPermission("inventory.manage_composites")) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to manage composite items",
        variant: "destructive"
      });
      return;
    }
    
    const componentItem = items.find(i => i.id === data.componentItemId);
    const componentCost = componentItem?.purchasePrice || "0";
    const quantity = parseFloat(data.quantity);
    const totalCost = parseFloat(componentCost) * quantity;

    createMutation.mutate({
      ...data,
      compositeItemId: selectedCompositeId,
      componentCost: componentCost.toString(),
      totalComponentCost: totalCost.toString(),
    });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Composite Items</h1>
          <p className="text-muted-foreground">Manage Bill of Materials (BOM) for composite items</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 max-w-md">
          <Label htmlFor="composite-item-select" className="text-sm font-medium mb-2 block">
            Select Composite Item
          </Label>
          <Select value={selectedCompositeId} onValueChange={setSelectedCompositeId}>
            <SelectTrigger id="composite-item-select" data-testid="select-composite-item">
              <SelectValue placeholder="Choose a composite item" />
            </SelectTrigger>
            <SelectContent>
              {compositeItems.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  No composite items found. Create items with type "composite" first.
                </div>
              ) : (
                compositeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.sku ? `(${item.sku})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {selectedCompositeId && (
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="active-only"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
                data-testid="switch-active-only"
              />
              <Label htmlFor="active-only" className="cursor-pointer">
                Active Components Only
              </Label>
            </div>
            <Button onClick={() => { setShowDialog(true); setEditingComponent(null); }} data-testid="button-add-component">
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </>
        )}
      </div>

      {!selectedCompositeId ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Box className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Select a composite item</p>
          <p className="text-sm text-muted-foreground">
            Choose a composite item from the dropdown to view and manage its components
          </p>
        </div>
      ) : isLoadingComponents ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredComponents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No components</p>
          <p className="text-sm text-muted-foreground mb-4">
            {showActiveOnly 
              ? "No active components found. Add components or toggle to show all."
              : "Add components to define the bill of materials for this item"}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component Item</TableHead>
                  <TableHead className="text-right">Quantity Required</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map((component) => (
                  <TableRow key={component.id} data-testid={`row-component-${component.id}`}>
                    <TableCell className="font-medium">
                      {component.componentItem?.name || "-"}
                      {component.componentItem?.sku && (
                        <span className="text-xs text-muted-foreground ml-2">({component.componentItem.sku})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{parseFloat(component.quantity).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${parseFloat(component.componentCost || "0").toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${parseFloat(component.totalComponentCost || "0").toFixed(2)}
                    </TableCell>
                    <TableCell>{format(new Date(component.effectiveFrom), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      {component.effectiveTo ? format(new Date(component.effectiveTo), "MMM dd, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {component.isActive ? (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingComponent(component); setShowDialog(true); }}
                          data-testid={`button-edit-${component.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setComponentToDelete(component.id)}
                          data-testid={`button-delete-${component.id}`}
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
          
          <div className="flex justify-end">
            <div className="p-6 bg-muted rounded-lg">
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Total Composite Cost</p>
                <p className="text-3xl font-bold font-mono" data-testid="text-total-cost">
                  ${calculateTotalCost().toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {filteredComponents.length} active component{filteredComponents.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingComponent ? "Edit Component" : "Add Component"}</DialogTitle>
            <DialogDescription>
              {editingComponent ? "Update the component details" : "Add a new component to the bill of materials"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="componentItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Component Item *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-component-item">
                          <SelectValue placeholder="Select component item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items.filter(item => item.id !== selectedCompositeId).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} {item.sku ? `(${item.sku})` : ""}
                            {item.purchasePrice && ` - $${parseFloat(item.purchasePrice).toFixed(2)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity Required *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective From *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-effective-from"
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective To (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-effective-to"
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save">
                  {createMutation.isPending ? "Saving..." : editingComponent ? "Update Component" : "Add Component"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!componentToDelete} onOpenChange={() => setComponentToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this component from the bill of materials. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hasPermission("inventory.manage_composites")) {
                  toast({
                    title: "Permission denied",
                    description: "You don't have permission to delete composite item components",
                    variant: "destructive"
                  });
                  return;
                }
                componentToDelete && deleteMutation.mutate(componentToDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
