import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, AlertTriangle, Package2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { AdvancedDataTable } from "@/shared/components/tables/advanced-data-table";
import type { AdvancedColumnDef, BulkAction } from "@/shared/lib/utils/advanced-table-types";
import type { Item } from "@shared/schema";
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

export default function ItemsPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const canCreate = hasPermission("items.create");
  const canUpdate = hasPermission("items.update");
  const canDelete = hasPermission("items.delete");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canDelete) {
        throw new Error("You don't have permission to delete items");
      }
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/items/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Item deleted",
        description: "Item has been removed successfully.",
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatQuantity = (quantity: string | null) => {
    if (!quantity) return "0";
    return parseFloat(quantity).toFixed(2);
  };

  const columns: AdvancedColumnDef<Item>[] = useMemo(() => [
    {
      key: "sku",
      header: "SKU",
      accessorKey: "sku",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.sku || "-"}</span>
      ),
      enableSorting: true,
      width: "120px",
    },
    {
      key: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <div className="text-sm text-muted-foreground truncate max-w-xs">
              {row.original.description}
            </div>
          )}
        </div>
      ),
      enableSorting: true,
      width: "250px",
    },
    {
      key: "type",
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.type}
        </Badge>
      ),
      enableSorting: true,
      width: "100px",
    },
    {
      key: "quantityOnHand",
      header: "Qty on Hand",
      accessorKey: "quantityOnHand",
      cell: ({ row }) => {
        const qty = parseFloat(row.original.quantityOnHand || "0");
        const reorder = parseFloat(row.original.reorderLevel || "0");
        const isLowStock = reorder > 0 && qty <= reorder;
        const isOutOfStock = qty === 0;

        return (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-right ${isLowStock || isOutOfStock ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
              {formatQuantity(row.original.quantityOnHand)}
            </span>
            {isLowStock && !isOutOfStock && (
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" data-testid={`icon-low-stock-${row.original.id}`} />
            )}
            {row.original.unit && (
              <span className="text-sm text-muted-foreground">{row.original.unit}</span>
            )}
          </div>
        );
      },
      enableSorting: true,
      align: "right",
      width: "130px",
    },
    {
      key: "reorderLevel",
      header: "Reorder Level",
      accessorKey: "reorderLevel",
      cell: ({ row }) => (
        <span className="font-mono text-right">
          {formatQuantity(row.original.reorderLevel)}
        </span>
      ),
      enableSorting: true,
      align: "right",
      width: "120px",
    },
    {
      key: "purchasePrice",
      header: "Purchase Price",
      accessorKey: "purchasePrice",
      cell: ({ row }) => (
        <span className="font-mono text-right">
          {formatCurrency(row.original.purchasePrice)}
        </span>
      ),
      enableSorting: true,
      align: "right",
      width: "130px",
    },
    {
      key: "rate",
      header: "Sale Price",
      accessorKey: "rate",
      cell: ({ row }) => (
        <span className="font-mono text-right font-medium">
          {formatCurrency(row.original.rate)}
        </span>
      ),
      enableSorting: true,
      align: "right",
      width: "120px",
    },
    {
      key: "isActive",
      header: "Status",
      accessorKey: "isActive",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      enableSorting: true,
      width: "100px",
    },
    {
      key: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          {canUpdate && (
            <Link href={`/inventory/items/${row.original.id}/edit`}>
              <Button
                variant="ghost"
                size="icon"
                data-testid={`button-edit-${row.original.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setItemToDelete(row.original);
                setDeleteDialogOpen(true);
              }}
              data-testid={`button-delete-${row.original.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      width: "100px",
    },
  ], [canUpdate, canDelete]);

  const bulkActions: BulkAction[] = [
    {
      label: "Delete Selected",
      action: "delete",
      variant: "destructive",
      permission: "items.delete",
    },
  ];

  const handleBulkAction = async (action: string, selectedRows: Item[]) => {
    if (action === "delete" && canDelete) {
      for (const item of selectedRows) {
        await deleteMutation.mutateAsync(item.id);
      }
      toast({
        title: "Items deleted",
        description: `${selectedRows.length} items have been deleted.`,
      });
    }
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
          <h1 className="text-3xl font-semibold">Inventory Items</h1>
          <p className="text-muted-foreground">
            Manage products, services, and stock levels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/inventory/reports">
            <Button variant="outline" data-testid="button-view-reports">
              <Package2 className="mr-2 h-4 w-4" />
              View Reports
            </Button>
          </Link>
          {canCreate && (
            <Link href="/inventory/items/new">
              <Button data-testid="button-create-item">
                <Plus className="mr-2 h-4 w-4" />
                New Item
              </Button>
            </Link>
          )}
        </div>
      </div>

      <AdvancedDataTable
        columns={columns}
        data={items}
        tableId="inventory-items"
        loading={isLoading}
        enableRowSelection={canDelete}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        enableExport={true}
        enableFiltering={true}
        enableSorting={true}
        enablePagination={true}
        defaultPageSize={25}
        emptyState={
          <div className="flex flex-col items-center justify-center py-12">
            <Package2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first inventory item
            </p>
            {canCreate && (
              <Link href="/inventory/items/new">
                <Button data-testid="button-add-first-item">
                  <Plus className="mr-2 h-4 w-4" />
                  New Item
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
