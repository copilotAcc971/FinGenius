import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/contexts/rbac-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { StockAdjustment, StockAdjustmentLineItem, Warehouse, Item, WarehouseStock, User } from "@shared/schema";
import { insertStockAdjustmentSchema, insertStockAdjustmentLineItemSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash } from "lucide-react";
import { cn } from "@/lib/utils";

const lineItemSchema = insertStockAdjustmentLineItemSchema.extend({
  itemId: z.string().min(1, "Item is required"),
  quantityAdjusted: z.string().min(1, "Quantity change is required"),
  quantityBefore: z.string(),
  quantityAfter: z.string(),
  notes: z.string().optional(),
});

const formSchema = insertStockAdjustmentSchema.extend({
  warehouseId: z.string().min(1, "Warehouse is required"),
  adjustmentDate: z.date(),
  reason: z.string().min(1, "Reason is required"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

type StockAdjustmentWithRelations = StockAdjustment & {
  warehouse?: Warehouse;
  lineItems?: (StockAdjustmentLineItem & { item?: Item })[];
  creator?: User;
  approver?: User;
};

export default function StockAdjustments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [viewingAdjustment, setViewingAdjustment] = useState<StockAdjustmentWithRelations | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<StockAdjustmentWithRelations | null>(null);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([{ itemId: "", quantityAdjusted: "", notes: "" }]);
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

  const { data: adjustments = [], isLoading } = useQuery<StockAdjustmentWithRelations[]>({
    queryKey: ["/api/stock-adjustments", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: warehouseStock = [] } = useQuery<WarehouseStock[]>({
    queryKey: ["/api/warehouse-stock", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: "",
      adjustmentDate: new Date(),
      reason: "",
      notes: "",
      status: "draft",
      lineItems: [],
    },
  });

  const warehouseId = form.watch("warehouseId");

  const getCurrentQuantity = (itemId: string) => {
    if (!warehouseId) return 0;
    const stock = warehouseStock.find(
      (s) => s.warehouseId === warehouseId && s.itemId === itemId
    );
    return stock ? parseFloat(stock.quantityOnHand) : 0;
  };

  useEffect(() => {
    if (editingAdjustment) {
      form.reset({
        warehouseId: editingAdjustment.warehouseId,
        adjustmentDate: new Date(editingAdjustment.adjustmentDate),
        reason: editingAdjustment.reason,
        notes: editingAdjustment.notes || "",
        status: editingAdjustment.status,
        lineItems: editingAdjustment.lineItems?.map(li => ({
          stockAdjustmentId: editingAdjustment.id,
          itemId: li.itemId,
          quantityBefore: li.quantityBefore,
          quantityAfter: li.quantityAfter,
          quantityAdjusted: li.quantityAdjusted,
          notes: "",
        })) || [],
      });
      setLineItems(
        editingAdjustment.lineItems?.map(li => ({
          itemId: li.itemId,
          quantityAdjusted: li.quantityAdjusted,
          notes: "",
        })) || [{ itemId: "", quantityAdjusted: "", notes: "" }]
      );
    } else {
      form.reset({
        warehouseId: "",
        adjustmentDate: new Date(),
        reason: "",
        notes: "",
        status: "draft",
        lineItems: [],
      });
      setLineItems([{ itemId: "", quantityAdjusted: "", notes: "" }]);
    }
  }, [editingAdjustment, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (editingAdjustment) {
        return apiRequest(`/api/stock-adjustments/${editingAdjustment.id}`, "PATCH", data);
      }
      return apiRequest("/api/stock-adjustments", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-stock"] });
      toast({
        title: editingAdjustment ? "Adjustment updated" : "Adjustment created",
        description: `Stock adjustment has been ${editingAdjustment ? "updated" : "created"} successfully.`,
      });
      setShowDialog(false);
      setEditingAdjustment(null);
      form.reset();
      setLineItems([{ itemId: "", quantityAdjusted: "", notes: "" }]);
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
        description: `Failed to ${editingAdjustment ? "update" : "create"} adjustment.`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/stock-adjustments/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-adjustments"] });
      toast({
        title: "Adjustment deleted",
        description: "Stock adjustment has been removed successfully.",
      });
      setAdjustmentToDelete(null);
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
        description: "Failed to delete adjustment.",
        variant: "destructive",
      });
    },
  });

  const approveAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/stock-adjustments/${id}/status`, "PUT", { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-stock"] });
      toast({
        title: "Adjustment approved",
        description: "Stock adjustment has been approved and applied.",
      });
      setViewingAdjustment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to approve adjustment.",
        variant: "destructive",
      });
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { itemId: "", quantityAdjusted: "", notes: "" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const filteredAdjustments = adjustments.filter((adj) => {
    const matchesSearch = 
      adj.adjustmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      adj.warehouse?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || adj.status === statusFilter;
    const matchesWarehouse = warehouseFilter === "all" || adj.warehouseId === warehouseFilter;
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const onSubmit = (data: FormValues) => {
    if (!hasPermission("inventory.adjust")) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to create stock adjustments",
        variant: "destructive"
      });
      return;
    }
    
    const lineItemsWithCalculations = lineItems.map((item) => {
      const currentQty = getCurrentQuantity(item.itemId);
      const adjustedQty = parseFloat(item.quantityAdjusted) || 0;
      const newQty = currentQty + adjustedQty;
      
      return {
        itemId: item.itemId,
        quantityBefore: currentQty.toString(),
        quantityAfter: newQty.toString(),
        quantityAdjusted: adjustedQty.toString(),
      };
    });

    createMutation.mutate({
      ...data,
      lineItems: lineItemsWithCalculations,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" data-testid={`badge-status-draft`}>Draft</Badge>;
      case "pending_approval":
        return <Badge variant="default" className="bg-yellow-500" data-testid={`badge-status-pending`}>Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-approved`}>Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid={`badge-status-rejected`}>Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
          <h1 className="text-3xl font-semibold">Stock Adjustments</h1>
          <p className="text-muted-foreground">Manage inventory adjustments with approval workflow</p>
        </div>
        <Button onClick={() => { setShowDialog(true); setEditingAdjustment(null); }} data-testid="button-create-adjustment">
          <Plus className="h-4 w-4 mr-2" />
          New Adjustment
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search adjustments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-adjustments"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-warehouse-filter">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredAdjustments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No stock adjustments</p>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || statusFilter !== "all" || warehouseFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first stock adjustment to get started"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Total Items</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdjustments.map((adjustment) => (
                <TableRow key={adjustment.id} data-testid={`row-adjustment-${adjustment.id}`}>
                  <TableCell className="font-medium">{adjustment.adjustmentNumber}</TableCell>
                  <TableCell>{format(new Date(adjustment.adjustmentDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{adjustment.warehouse?.name || "-"}</TableCell>
                  <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                  <TableCell className="capitalize">{adjustment.reason.replace(/_/g, " ")}</TableCell>
                  <TableCell>{adjustment.lineItems?.length || 0}</TableCell>
                  <TableCell>{adjustment.creator?.email || "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${adjustment.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingAdjustment(adjustment)} data-testid={`button-view-${adjustment.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        {adjustment.status === "draft" && (
                          <DropdownMenuItem onClick={() => { setEditingAdjustment(adjustment); setShowDialog(true); }} data-testid={`button-edit-${adjustment.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {adjustment.status === "draft" && (
                          <DropdownMenuItem onClick={() => setAdjustmentToDelete(adjustment.id)} className="text-destructive" data-testid={`button-delete-${adjustment.id}`}>
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAdjustment ? "Edit Stock Adjustment" : "New Stock Adjustment"}</DialogTitle>
            <DialogDescription>
              {editingAdjustment ? "Update the stock adjustment details" : "Create a new stock adjustment"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-warehouse">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
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
                  name="adjustmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-adjustment-date"
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
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-reason">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="damage">Damage</SelectItem>
                          <SelectItem value="loss">Loss</SelectItem>
                          <SelectItem value="found">Found</SelectItem>
                          <SelectItem value="audit_correction">Audit Correction</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes..." data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <Button type="button" onClick={addLineItem} size="sm" data-testid="button-add-line-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity Change</TableHead>
                        <TableHead>Current Qty</TableHead>
                        <TableHead>New Qty</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const currentQty = getCurrentQuantity(item.itemId);
                        const adjustedQty = parseFloat(item.quantityAdjusted) || 0;
                        const newQty = currentQty + adjustedQty;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Select
                                value={item.itemId}
                                onValueChange={(value) => updateLineItem(index, "itemId", value)}
                              >
                                <SelectTrigger data-testid={`select-item-${index}`}>
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {items.filter(i => i.trackInventory).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                      {i.name} {i.sku ? `(${i.sku})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantityAdjusted}
                                onChange={(e) => updateLineItem(index, "quantityAdjusted", e.target.value)}
                                placeholder="0.00"
                                data-testid={`input-quantity-${index}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{currentQty.toFixed(2)}</TableCell>
                            <TableCell className={cn("font-mono", newQty < 0 && "text-destructive")}>
                              {newQty.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(index)}
                                data-testid={`button-remove-${index}`}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  onClick={() => form.setValue("status", "draft")}
                  disabled={createMutation.isPending}
                  data-testid="button-save-draft"
                >
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  onClick={() => form.setValue("status", "pending_approval")}
                  disabled={createMutation.isPending}
                  data-testid="button-submit-approval"
                >
                  {createMutation.isPending ? "Saving..." : "Submit for Approval"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingAdjustment} onOpenChange={() => setViewingAdjustment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Adjustment Details</DialogTitle>
            <DialogDescription>
              View stock adjustment information
            </DialogDescription>
          </DialogHeader>
          {viewingAdjustment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Adjustment #</label>
                  <p className="text-sm mt-1">{viewingAdjustment.adjustmentNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">{getStatusBadge(viewingAdjustment.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Warehouse</label>
                  <p className="text-sm mt-1">{viewingAdjustment.warehouse?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm mt-1">{format(new Date(viewingAdjustment.adjustmentDate), "PPP")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <p className="text-sm mt-1 capitalize">{viewingAdjustment.reason.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Created By</label>
                  <p className="text-sm mt-1">{viewingAdjustment.creator?.email || "-"}</p>
                </div>
              </div>

              {viewingAdjustment.notes && (
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <p className="text-sm mt-1">{viewingAdjustment.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">Line Items</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity Before</TableHead>
                        <TableHead className="text-right">Adjustment</TableHead>
                        <TableHead className="text-right">Quantity After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingAdjustment.lineItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell className="text-right font-mono">{parseFloat(item.quantityBefore).toFixed(2)}</TableCell>
                          <TableCell className={cn("text-right font-mono", parseFloat(item.quantityAdjusted) < 0 ? "text-destructive" : "text-green-600")}>
                            {parseFloat(item.quantityAdjusted) > 0 ? "+" : ""}{parseFloat(item.quantityAdjusted).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">{parseFloat(item.quantityAfter).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingAdjustment(null)} data-testid="button-close-view">
                  Close
                </Button>
                {viewingAdjustment.status === "pending_approval" && hasPermission("inventory.approve_adjustments") && (
                  <Button
                    onClick={() => {
                      if (!hasPermission("inventory.approve_adjustments")) {
                        toast({
                          title: "Permission denied",
                          description: "You don't have permission to approve stock adjustments",
                          variant: "destructive"
                        });
                        return;
                      }
                      approveAdjustmentMutation.mutate(viewingAdjustment.id);
                    }}
                    disabled={approveAdjustmentMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {approveAdjustmentMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!adjustmentToDelete} onOpenChange={() => setAdjustmentToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock adjustment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hasPermission("inventory.adjust")) {
                  toast({
                    title: "Permission denied",
                    description: "You don't have permission to delete stock adjustments",
                    variant: "destructive"
                  });
                  return;
                }
                adjustmentToDelete && deleteMutation.mutate(adjustmentToDelete);
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
