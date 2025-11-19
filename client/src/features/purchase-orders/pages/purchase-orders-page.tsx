import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { purchaseOrderColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
import type { PurchaseOrder, Vendor, Currency } from "@shared/schema";
import { PurchaseOrderDialog } from "@/features/purchase-orders/components/purchase-order-dialog";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";

export default function PurchaseOrders() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.name : vendorId;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/purchase-orders/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", { tenantId: currentTenant?.id }] });
      toast({
        title: "Purchase Order deleted",
        description: "Purchase Order has been removed successfully.",
      });
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
        description: "Failed to delete purchase order.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      pending_approval: "outline",
      approved: "default",
      partially_received: "outline",
      fully_received: "default",
      closed: "secondary",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      draft: "Draft",
      pending_approval: "Pending Approval",
      approved: "Approved",
      partially_received: "Partially Received",
      fully_received: "Fully Received",
      closed: "Closed",
      cancelled: "Cancelled",
    };
    return (
      <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>
        {labels[status] || status}
      </Badge>
    );
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
          <h1 className="text-3xl font-semibold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage your purchase orders</p>
        </div>
        <Button
          onClick={() => {
            setEditingPO(null);
            setShowDialog(true);
          }}
          data-testid="button-create-purchase-order"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Purchase Order
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={purchaseOrderColumns} minHeight="400px" />
      ) : purchaseOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">No purchase orders yet</p>
          <Button
            onClick={() => {
              setEditingPO(null);
              setShowDialog(true);
            }}
            data-testid="button-create-first-purchase-order"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first purchase order
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(purchaseOrderColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(purchaseOrderColumns[0])}>PO Number</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[1])}>Vendor</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[2])}>Order Date</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[3])}>Expected Delivery</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[4])}>Total</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[5])}>Status</TableHead>
                <TableHead className={getColumnClassName(purchaseOrderColumns[6])}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id} data-testid={`row-purchase-order-${po.id}`}>
                  <TableCell className={`${getColumnClassName(purchaseOrderColumns[0])} font-medium`} data-testid={`text-po-number-${po.id}`}>
                    {po.poNumber}
                  </TableCell>
                  <TableCell className={getColumnClassName(purchaseOrderColumns[1])} data-testid={`text-vendor-${po.id}`}>
                    {getVendorName(po.vendorId)}
                  </TableCell>
                  <TableCell className={getColumnClassName(purchaseOrderColumns[2])} data-testid={`text-order-date-${po.id}`}>
                    {new Date(po.orderDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className={getColumnClassName(purchaseOrderColumns[3])} data-testid={`text-expected-date-${po.id}`}>
                    {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className={`${getColumnClassName(purchaseOrderColumns[4])} font-mono`} data-testid={`text-total-${po.id}`}>
                    {currenciesLoading 
                      ? '...' 
                      : formatCurrency(parseFloat(po.total), po.currencyCode, currencies)
                    }
                  </TableCell>
                  <TableCell className={getColumnClassName(purchaseOrderColumns[5])}>{getStatusBadge(po.status)}</TableCell>
                  <TableCell className={getColumnClassName(purchaseOrderColumns[6])}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${po.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingPO(po);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${po.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(po.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${po.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PurchaseOrderDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingPO(null);
        }}
        purchaseOrder={editingPO}
      />
    </div>
  );
}
