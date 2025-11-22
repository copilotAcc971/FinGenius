import { useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FileText, Truck } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { CardSkeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { type SalesOrder, type Currency } from "@shared/schema";
import { SalesOrderDialog } from "@/features/sales-orders/components/sales-order-dialog";
import { useState } from "react";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
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

export default function SalesOrdersPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery<SalesOrder[]>({
    queryKey: ["/api/sales-orders", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const handleCreate = () => {
    setSelectedOrder(null);
    setDialogOpen(true);
  };

  const handleEdit = (order: SalesOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleDeleteClick = (orderId: string) => {
    setOrderToDelete(orderId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!orderToDelete || !currentTenant?.id) return;

    try {
      await apiRequest(`/api/sales-orders/${orderToDelete}?tenantId=${currentTenant.id}`, "DELETE", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", { tenantId: currentTenant.id }] });
      toast({ title: "Sales order deleted successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error deleting sales order", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleConvertToInvoice = async (orderId: string) => {
    if (!currentTenant?.id) return;

    setConvertingOrderId(orderId);
    try {
      await apiRequest(`/api/sales-orders/${orderId}/convert-to-invoice?tenantId=${currentTenant.id}`, "POST", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", { tenantId: currentTenant.id }] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant.id }] });
      
      toast({ 
        title: "Sales order converted to invoice", 
        description: "Successfully created invoice from sales order" 
      });
    } catch (error: any) {
      toast({ 
        title: "Error converting sales order", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setConvertingOrderId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      confirmed: "default",
      packed: "default",
      shipped: "default",
      delivered: "default",
      invoiced: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>{status}</Badge>;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Sales Orders</h1>
          <p className="text-muted-foreground">Manage your sales orders</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-order">
          <Plus className="w-4 h-4 mr-2" />
          New Sales Order
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} data-testid={`card-order-${order.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-order-number-${order.id}`}>
                      {order.orderNumber || order.id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Order Date: {new Date(order.orderDate).toLocaleDateString()}
                      {order.deliveryDate && (
                        <> - Delivery: {new Date(order.deliveryDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.status)}
                    <span className="text-lg font-semibold" data-testid={`text-order-total-${order.id}`}>
                      {currenciesLoading 
                        ? '...' 
                        : formatCurrency(parseFloat(order.total), order.currencyCode, currencies)
                      }
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(order)}
                    data-testid={`button-edit-order-${order.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {order.status !== 'invoiced' && order.status !== 'cancelled' && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleConvertToInvoice(order.id)}
                      disabled={convertingOrderId === order.id}
                      data-testid={`button-convert-order-${order.id}`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {convertingOrderId === order.id ? 'Converting...' : 'Convert to Invoice'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(order.id)}
                    data-testid={`button-delete-order-${order.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Truck}
          title="No sales orders yet"
          description="Create your first sales order to get started"
          action={{
            label: "Create Sales Order",
            onClick: handleCreate
          }}
          dataTestId="empty-state-sales-orders"
        />
      )}

      <SalesOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sales order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
