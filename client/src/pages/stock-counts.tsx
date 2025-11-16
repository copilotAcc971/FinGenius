import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Download } from "lucide-react";
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
import type { StockCount, StockCountLineItem, Warehouse, Item, WarehouseStock, User } from "@shared/schema";
import { insertStockCountSchema, insertStockCountLineItemSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const lineItemSchema = insertStockCountLineItemSchema.extend({
  itemId: z.string().min(1, "Item is required"),
  expectedQuantity: z.string(),
  actualQuantity: z.string().optional(),
  variance: z.string().optional(),
  notes: z.string().optional(),
});

const formSchema = insertStockCountSchema.extend({
  warehouseId: z.string().min(1, "Warehouse is required"),
  countDate: z.date(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

type StockCountWithRelations = StockCount & {
  warehouse?: Warehouse;
  lineItems?: (StockCountLineItem & { item?: Item })[];
  creator?: User;
};

export default function StockCounts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [viewingCount, setViewingCount] = useState<StockCountWithRelations | null>(null);
  const [editingCount, setEditingCount] = useState<StockCountWithRelations | null>(null);
  const [countToDelete, setCountToDelete] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
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

  const { data: stockCounts = [], isLoading } = useQuery<StockCountWithRelations[]>({
    queryKey: ["/api/stock-counts", { tenantId: currentTenant?.id }],
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
      countDate: new Date(),
      notes: "",
      status: "draft",
      lineItems: [],
    },
  });

  const warehouseId = form.watch("warehouseId");

  const loadWarehouseStock = () => {
    if (!warehouseId) {
      toast({
        title: "Select warehouse",
        description: "Please select a warehouse first",
        variant: "destructive",
      });
      return;
    }

    const stockForWarehouse = warehouseStock.filter(s => s.warehouseId === warehouseId);
    const newLineItems = stockForWarehouse.map(stock => ({
      itemId: stock.itemId,
      expectedQuantity: stock.quantityOnHand,
      actualQuantity: "",
      variance: "",
      notes: "",
    }));

    setLineItems(newLineItems);
    toast({
      title: "Stock loaded",
      description: `Loaded ${newLineItems.length} items from warehouse`,
    });
  };

  useEffect(() => {
    if (editingCount) {
      form.reset({
        warehouseId: editingCount.warehouseId,
        countDate: new Date(editingCount.countDate),
        notes: editingCount.notes || "",
        status: editingCount.status,
        lineItems: editingCount.lineItems?.map(li => ({
          stockCountId: editingCount.id,
          itemId: li.itemId,
          expectedQuantity: li.expectedQuantity,
          actualQuantity: li.actualQuantity || "",
          variance: li.variance || "",
          notes: li.notes || "",
        })) || [],
      });
      setLineItems(
        editingCount.lineItems?.map(li => ({
          itemId: li.itemId,
          expectedQuantity: li.expectedQuantity,
          actualQuantity: li.actualQuantity || "",
          variance: li.variance || "",
          notes: li.notes || "",
        })) || []
      );
    } else {
      form.reset({
        warehouseId: "",
        countDate: new Date(),
        notes: "",
        status: "draft",
        lineItems: [],
      });
      setLineItems([]);
    }
  }, [editingCount, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (editingCount) {
        return apiRequest(`/api/stock-counts/${editingCount.id}`, "PATCH", data);
      }
      return apiRequest("/api/stock-counts", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-counts"] });
      toast({
        title: editingCount ? "Count updated" : "Count created",
        description: `Stock count has been ${editingCount ? "updated" : "created"} successfully.`,
      });
      setShowDialog(false);
      setEditingCount(null);
      form.reset();
      setLineItems([]);
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
        description: `Failed to ${editingCount ? "update" : "create"} count.`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/stock-counts/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-counts"] });
      toast({
        title: "Count deleted",
        description: "Stock count has been removed successfully.",
      });
      setCountToDelete(null);
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
        description: "Failed to delete count.",
        variant: "destructive",
      });
    },
  });

  const generateAdjustmentMutation = useMutation({
    mutationFn: async (countId: string) => {
      return apiRequest(`/api/stock-counts/${countId}/generate-adjustment`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-adjustments"] });
      toast({
        title: "Adjustment created",
        description: "Stock adjustment has been generated from this count.",
      });
      setViewingCount(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to generate adjustment.",
        variant: "destructive",
      });
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { itemId: "", expectedQuantity: "", actualQuantity: "", variance: "", notes: "" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "actualQuantity" || field === "expectedQuantity") {
      const expected = parseFloat(field === "expectedQuantity" ? value : updated[index].expectedQuantity) || 0;
      const actual = parseFloat(field === "actualQuantity" ? value : updated[index].actualQuantity) || 0;
      updated[index].variance = (actual - expected).toString();
    }
    
    setLineItems(updated);
  };

  const filteredCounts = stockCounts.filter((count) => {
    const matchesSearch = 
      count.countNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      count.warehouse?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || count.status === statusFilter;
    const matchesWarehouse = warehouseFilter === "all" || count.warehouseId === warehouseFilter;
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const onSubmit = (data: FormValues) => {
    if (!hasPermission("inventory.create_stock_counts")) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to create stock counts",
        variant: "destructive"
      });
      return;
    }
    
    const lineItemsWithCalculations = lineItems.map((item) => {
      const expected = parseFloat(item.expectedQuantity) || 0;
      const actual = parseFloat(item.actualQuantity) || 0;
      const variance = actual - expected;
      
      return {
        itemId: item.itemId,
        expectedQuantity: expected.toString(),
        actualQuantity: actual.toString(),
        variance: variance.toString(),
        notes: item.notes || "",
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
      case "in_progress":
        return <Badge variant="default" className="bg-blue-500" data-testid={`badge-status-in-progress`}>In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-completed`}>Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive" data-testid={`badge-status-cancelled`}>Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getVarianceSummary = (count: StockCountWithRelations) => {
    const itemsWithVariance = count.lineItems?.filter(li => {
      const variance = parseFloat(li.variance || "0");
      return Math.abs(variance) > 0.001;
    }).length || 0;
    
    return itemsWithVariance;
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
          <h1 className="text-3xl font-semibold">Stock Counts</h1>
          <p className="text-muted-foreground">Physical inventory counts and variance tracking</p>
        </div>
        <Button onClick={() => { setShowDialog(true); setEditingCount(null); }} data-testid="button-create-count">
          <Plus className="h-4 w-4 mr-2" />
          New Stock Count
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search counts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-counts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
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
      ) : filteredCounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No stock counts</p>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || statusFilter !== "all" || warehouseFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first stock count to get started"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Count #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items Counted</TableHead>
                <TableHead className="text-right">Variances Found</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCounts.map((count) => (
                <TableRow key={count.id} data-testid={`row-count-${count.id}`}>
                  <TableCell className="font-medium">{count.countNumber}</TableCell>
                  <TableCell>{format(new Date(count.countDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{count.warehouse?.name || "-"}</TableCell>
                  <TableCell>{getStatusBadge(count.status)}</TableCell>
                  <TableCell className="text-right">{count.lineItems?.length || 0}</TableCell>
                  <TableCell className="text-right">
                    {count.status === "completed" ? getVarianceSummary(count) : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${count.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingCount(count)} data-testid={`button-view-${count.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        {count.status !== "completed" && (
                          <DropdownMenuItem onClick={() => { setEditingCount(count); setShowDialog(true); }} data-testid={`button-edit-${count.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {count.status === "draft" && (
                          <DropdownMenuItem onClick={() => setCountToDelete(count.id)} className="text-destructive" data-testid={`button-delete-${count.id}`}>
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCount ? "Edit Stock Count" : "New Stock Count"}</DialogTitle>
            <DialogDescription>
              {editingCount ? "Update the stock count details" : "Create a new physical inventory count"}
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
                  name="countDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Count Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-count-date"
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
                  <div className="flex gap-2">
                    <Button type="button" onClick={loadWarehouseStock} variant="outline" size="sm" data-testid="button-load-warehouse-stock">
                      <Download className="h-4 w-4 mr-2" />
                      Load Warehouse Stock
                    </Button>
                    <Button type="button" onClick={addLineItem} size="sm" data-testid="button-add-line-item">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">System Qty</TableHead>
                        <TableHead className="text-right">Physical Qty</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const variance = parseFloat(item.variance) || 0;
                        
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
                            <TableCell className="text-right font-mono">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.expectedQuantity}
                                onChange={(e) => updateLineItem(index, "expectedQuantity", e.target.value)}
                                placeholder="0.00"
                                data-testid={`input-expected-${index}`}
                                className="text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.actualQuantity}
                                onChange={(e) => updateLineItem(index, "actualQuantity", e.target.value)}
                                placeholder="0.00"
                                data-testid={`input-actual-${index}`}
                                className="text-right font-mono"
                              />
                            </TableCell>
                            <TableCell className={cn("text-right font-mono", variance !== 0 && (variance > 0 ? "text-green-600" : "text-destructive"))}>
                              {variance !== 0 && (variance > 0 ? "+" : "")}{variance.toFixed(2)}
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
                {lineItems.length > 0 && (
                  <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                    <div className="text-sm">
                      <strong>Variance Summary:</strong> {lineItems.filter(item => Math.abs(parseFloat(item.variance) || 0) > 0.001).length} items with variances
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  onClick={() => form.setValue("status", "in_progress")}
                  disabled={createMutation.isPending}
                  data-testid="button-mark-in-progress"
                >
                  Mark as In Progress
                </Button>
                <Button
                  type="submit"
                  onClick={() => form.setValue("status", "completed")}
                  disabled={createMutation.isPending}
                  data-testid="button-complete"
                >
                  {createMutation.isPending ? "Saving..." : "Complete"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingCount} onOpenChange={() => setViewingCount(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Count Details</DialogTitle>
            <DialogDescription>
              View stock count information and variance summary
            </DialogDescription>
          </DialogHeader>
          {viewingCount && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Count #</label>
                  <p className="text-sm mt-1">{viewingCount.countNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">{getStatusBadge(viewingCount.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Warehouse</label>
                  <p className="text-sm mt-1">{viewingCount.warehouse?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm mt-1">{format(new Date(viewingCount.countDate), "PPP")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Created By</label>
                  <p className="text-sm mt-1">{viewingCount.creator?.email || "-"}</p>
                </div>
              </div>

              {viewingCount.notes && (
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <p className="text-sm mt-1">{viewingCount.notes}</p>
                </div>
              )}

              {viewingCount.status === "completed" && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm">
                    <strong>Variance Summary:</strong> {getVarianceSummary(viewingCount)} items with variances out of {viewingCount.lineItems?.length || 0} total items
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">Line Items</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">System Qty</TableHead>
                        <TableHead className="text-right">Physical Qty</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingCount.lineItems?.map((item) => {
                        const variance = parseFloat(item.variance || "0");
                        return (
                          <TableRow key={item.id} className={Math.abs(variance) > 0.001 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
                            <TableCell>{item.item?.name}</TableCell>
                            <TableCell className="text-right font-mono">{parseFloat(item.expectedQuantity).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{item.actualQuantity ? parseFloat(item.actualQuantity).toFixed(2) : "-"}</TableCell>
                            <TableCell className={cn("text-right font-mono", variance !== 0 && (variance > 0 ? "text-green-600" : "text-destructive"))}>
                              {variance !== 0 && (variance > 0 ? "+" : "")}{variance.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingCount(null)} data-testid="button-close-view">
                  Close
                </Button>
                {viewingCount.status === "completed" && getVarianceSummary(viewingCount) > 0 && (
                  <Button
                    onClick={() => {
                      if (!hasPermission("inventory.adjust")) {
                        toast({
                          title: "Permission denied",
                          description: "You don't have permission to generate adjustments",
                          variant: "destructive"
                        });
                        return;
                      }
                      generateAdjustmentMutation.mutate(viewingCount.id);
                    }}
                    disabled={generateAdjustmentMutation.isPending}
                    data-testid="button-generate-adjustment"
                  >
                    {generateAdjustmentMutation.isPending ? "Generating..." : "Generate Adjustment"}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!countToDelete} onOpenChange={() => setCountToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock count. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hasPermission("inventory.create_stock_counts")) {
                  toast({
                    title: "Permission denied",
                    description: "You don't have permission to delete stock counts",
                    variant: "destructive"
                  });
                  return;
                }
                countToDelete && deleteMutation.mutate(countToDelete);
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
