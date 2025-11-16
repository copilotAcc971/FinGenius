import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
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
import type { TransferOrder, TransferOrderLineItem, Warehouse, Item, WarehouseStock } from "@shared/schema";
import { insertTransferOrderSchema, insertTransferOrderLineItemSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash } from "lucide-react";
import { cn } from "@/lib/utils";

const lineItemSchema = insertTransferOrderLineItemSchema.extend({
  itemId: z.string().min(1, "Item is required"),
  quantityShipped: z.string().min(1, "Quantity is required"),
});

const formSchema = insertTransferOrderSchema.extend({
  fromWarehouseId: z.string().min(1, "Source warehouse is required"),
  toWarehouseId: z.string().min(1, "Destination warehouse is required"),
  transferDate: z.date(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

type TransferOrderWithRelations = TransferOrder & {
  fromWarehouse?: Warehouse;
  toWarehouse?: Warehouse;
  lineItems?: (TransferOrderLineItem & { item?: Item })[];
};

export default function TransferOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<TransferOrderWithRelations | null>(null);
  const [editingOrder, setEditingOrder] = useState<TransferOrderWithRelations | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([{ itemId: "", quantityShipped: "" }]);
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

  const { data: transferOrders = [], isLoading } = useQuery<TransferOrderWithRelations[]>({
    queryKey: ["/api/transfer-orders", { tenantId: currentTenant?.id }],
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
      fromWarehouseId: "",
      toWarehouseId: "",
      transferDate: new Date(),
      expectedDate: undefined,
      status: "draft",
      notes: "",
      lineItems: [],
    },
  });

  const fromWarehouseId = form.watch("fromWarehouseId");

  const getAvailableStock = (itemId: string) => {
    if (!fromWarehouseId) return 0;
    const stock = warehouseStock.find(
      (s) => s.warehouseId === fromWarehouseId && s.itemId === itemId
    );
    return stock ? parseFloat(stock.availableForSale) : 0;
  };

  useEffect(() => {
    if (editingOrder) {
      form.reset({
        fromWarehouseId: editingOrder.fromWarehouseId,
        toWarehouseId: editingOrder.toWarehouseId,
        transferDate: new Date(editingOrder.transferDate),
        expectedDate: editingOrder.expectedDate ? new Date(editingOrder.expectedDate) : undefined,
        status: editingOrder.status,
        notes: editingOrder.notes || "",
        lineItems: editingOrder.lineItems?.map(li => ({
          itemId: li.itemId,
          quantityShipped: li.quantityShipped,
          transferOrderId: editingOrder.id,
        })) || [],
      });
      setLineItems(
        editingOrder.lineItems?.map(li => ({
          itemId: li.itemId,
          quantityShipped: li.quantityShipped,
        })) || [{ itemId: "", quantityShipped: "" }]
      );
    } else {
      form.reset({
        fromWarehouseId: "",
        toWarehouseId: "",
        transferDate: new Date(),
        expectedDate: undefined,
        status: "draft",
        notes: "",
        lineItems: [],
      });
      setLineItems([{ itemId: "", quantityShipped: "" }]);
    }
  }, [editingOrder, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (editingOrder) {
        return apiRequest(`/api/transfer-orders/${editingOrder.id}`, "PATCH", data);
      }
      return apiRequest("/api/transfer-orders", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-stock"] });
      toast({
        title: editingOrder ? "Transfer order updated" : "Transfer order created",
        description: `Transfer order has been ${editingOrder ? "updated" : "created"} successfully.`,
      });
      setShowDialog(false);
      setEditingOrder(null);
      form.reset();
      setLineItems([{ itemId: "", quantityShipped: "" }]);
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
        description: `Failed to ${editingOrder ? "update" : "create"} transfer order.`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/transfer-orders/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-orders"] });
      toast({
        title: "Transfer order deleted",
        description: "Transfer order has been removed successfully.",
      });
      setOrderToDelete(null);
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
        description: "Failed to delete transfer order.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/transfer-orders/${id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-stock"] });
      toast({
        title: "Status updated",
        description: "Transfer order status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const filteredOrders = transferOrders.filter((order) =>
    order.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.fromWarehouse?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.toWarehouse?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addLineItem = () => {
    setLineItems([...lineItems, { itemId: "", quantityShipped: "" }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const onSubmit = (data: Omit<FormValues, "lineItems">) => {
    if (!hasPermission("inventory.create_transfer_orders")) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to manage transfer orders",
        variant: "destructive"
      });
      return;
    }
    
    const validLineItems = lineItems.filter(
      (item) => item.itemId && item.quantityShipped
    );
    
    if (validLineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one line item.",
        variant: "destructive",
      });
      return;
    }

    const formData = {
      ...data,
      lineItems: validLineItems,
    };

    createMutation.mutate(formData as FormValues);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "pending":
        return "default";
      case "in_transit":
        return "default";
      case "received":
        return "default";
      case "cancelled":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "pending":
        return "Pending";
      case "in_transit":
        return "In Transit";
      case "received":
        return "Received";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
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
          <h1 className="text-3xl font-semibold">Transfer Orders</h1>
          <p className="text-muted-foreground">Manage stock transfers between warehouses</p>
        </div>
        <Button
          onClick={() => {
            setEditingOrder(null);
            setShowDialog(true);
          }}
          data-testid="button-add-transfer-order"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Transfer
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transfer orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-transfers"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No transfer orders found</p>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm ? "Try adjusting your search" : "Create your first transfer order to move stock between warehouses"}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => {
                setEditingOrder(null);
                setShowDialog(true);
              }}
              data-testid="button-add-first-transfer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Transfer
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From Warehouse</TableHead>
                <TableHead>To Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} data-testid={`row-transfer-${order.id}`}>
                  <TableCell className="font-medium">{order.transferNumber}</TableCell>
                  <TableCell>{format(new Date(order.transferDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{order.fromWarehouse?.name || "-"}</TableCell>
                  <TableCell>{order.toWarehouse?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status)}>
                      {getStatusDisplay(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{order.lineItems?.length || 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${order.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setViewingOrder(order)}
                          data-testid={`button-view-${order.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        {order.status === "draft" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingOrder(order);
                                setShowDialog(true);
                              }}
                              data-testid={`button-edit-${order.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (!hasPermission("inventory.approve_transfers")) {
                                  toast({
                                    title: "Permission denied",
                                    description: "You don't have permission to update transfer status",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                updateStatusMutation.mutate({ id: order.id, status: "pending" });
                              }}
                              data-testid={`button-submit-${order.id}`}
                            >
                              Submit
                            </DropdownMenuItem>
                          </>
                        )}
                        {order.status === "pending" && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (!hasPermission("inventory.approve_transfers")) {
                                toast({
                                  title: "Permission denied",
                                  description: "You don't have permission to update transfer status",
                                  variant: "destructive"
                                });
                                return;
                              }
                              updateStatusMutation.mutate({ id: order.id, status: "in_transit" });
                            }}
                            data-testid={`button-ship-${order.id}`}
                          >
                            Mark In Transit
                          </DropdownMenuItem>
                        )}
                        {order.status === "in_transit" && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (!hasPermission("inventory.approve_transfers")) {
                                toast({
                                  title: "Permission denied",
                                  description: "You don't have permission to update transfer status",
                                  variant: "destructive"
                                });
                                return;
                              }
                              updateStatusMutation.mutate({ id: order.id, status: "received" });
                            }}
                            data-testid={`button-receive-${order.id}`}
                          >
                            Mark Received
                          </DropdownMenuItem>
                        )}
                        {order.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => setOrderToDelete(order.id)}
                            className="text-destructive"
                            data-testid={`button-delete-${order.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
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
            <DialogTitle>{editingOrder ? "Edit Transfer Order" : "Create Transfer Order"}</DialogTitle>
            <DialogDescription>
              Transfer inventory between warehouses
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Warehouse *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-from-warehouse">
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
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Warehouse *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-to-warehouse">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.filter(w => w.id !== fromWarehouseId).map((warehouse) => (
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transferDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Transfer Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-transfer-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
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
                  name="expectedDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expected Delivery Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-expected-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
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

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes..." data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((lineItem, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-sm font-medium">Item</label>
                        <Select
                          value={lineItem.itemId}
                          onValueChange={(value) => updateLineItem(index, "itemId", value)}
                        >
                          <SelectTrigger data-testid={`select-item-${index}`}>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} {item.sku ? `(${item.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32">
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={lineItem.quantityShipped}
                          onChange={(e) => updateLineItem(index, "quantityShipped", e.target.value)}
                          placeholder="0.00"
                          data-testid={`input-quantity-${index}`}
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-sm font-medium">Available</label>
                        <Input
                          value={getAvailableStock(lineItem.itemId).toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                        data-testid={`button-remove-line-item-${index}`}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setEditingOrder(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save">
                  {createMutation.isPending ? "Saving..." : editingOrder ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Transfer Order Details</DialogTitle>
            <DialogDescription>
              {viewingOrder?.transferNumber}
            </DialogDescription>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">From Warehouse</p>
                  <p className="text-sm">{viewingOrder.fromWarehouse?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">To Warehouse</p>
                  <p className="text-sm">{viewingOrder.toWarehouse?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transfer Date</p>
                  <p className="text-sm">{format(new Date(viewingOrder.transferDate), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(viewingOrder.status)}>
                    {getStatusDisplay(viewingOrder.status)}
                  </Badge>
                </div>
              </div>

              {viewingOrder.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm">{viewingOrder.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">Line Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity Shipped</TableHead>
                      <TableHead className="text-right">Quantity Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingOrder.lineItems?.map((lineItem) => (
                      <TableRow key={lineItem.id}>
                        <TableCell>{lineItem.item?.name}</TableCell>
                        <TableCell className="text-right font-mono">{lineItem.quantityShipped}</TableCell>
                        <TableCell className="text-right font-mono">{lineItem.quantityReceived}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transfer order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hasPermission("inventory.create_transfer_orders")) {
                  toast({
                    title: "Permission denied",
                    description: "You don't have permission to delete transfer orders",
                    variant: "destructive"
                  });
                  return;
                }
                orderToDelete && deleteMutation.mutate(orderToDelete);
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
