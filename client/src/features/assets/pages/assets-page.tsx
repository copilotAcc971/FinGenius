import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Building } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import type { Asset } from "@shared/schema";
import { AssetDialog } from "@/features/assets/components/asset-dialog";

export default function Assets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
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

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/assets/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets", { tenantId: currentTenant?.id }] });
      toast({
        title: "Asset deleted",
        description: "Asset has been removed successfully.",
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
        description: "Failed to delete asset.",
        variant: "destructive",
      });
    },
  });

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateNetBookValue = (purchasePrice: string, accumulatedDepreciation: string) => {
    return (parseFloat(purchasePrice) - parseFloat(accumulatedDepreciation)).toFixed(2);
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      active: "default",
      disposed: "secondary",
      sold: "outline",
    };
    return variants[status] || "default";
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
          <h1 className="text-3xl font-semibold">Fixed Assets</h1>
          <p className="text-muted-foreground">Manage your fixed assets and depreciation tracking</p>
        </div>
        <Button
          onClick={() => {
            setEditingAsset(null);
            setShowDialog(true);
          }}
          data-testid="button-add-asset"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-assets"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={[{key: "1", header: "", width: "100px"}, {key: "2", header: "", width: "150px"}, {key: "3", header: "", width: "100px"}, {key: "4", header: "", width: "100px"}, {key: "5", header: "", width: "120px"}, {key: "6", header: "", width: "120px"}, {key: "7", header: "", width: "150px"}, {key: "8", header: "", width: "150px"}, {key: "9", header: "", width: "80px"}, {key: "10", header: "", width: "70px"}]} minHeight="600px" />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={Building}
          title={searchTerm ? "No assets match your search" : "No assets yet"}
          description={searchTerm ? "Try adjusting your search terms" : "Get started by adding your first fixed asset"}
          action={!searchTerm ? {
            label: "Add Asset",
            onClick: () => {
              setEditingAsset(null);
              setShowDialog(true);
            }
          } : undefined}
          dataTestId="empty-state-assets"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead className="text-right">Purchase Price</TableHead>
                <TableHead className="text-right">Salvage Value</TableHead>
                <TableHead className="text-right">Accumulated Depr.</TableHead>
                <TableHead className="text-right">Net Book Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => (
                <TableRow key={asset.id} data-testid={`row-asset-${asset.id}`}>
                  <TableCell className="font-mono font-medium" data-testid={`text-asset-number-${asset.id}`}>
                    {asset.assetNumber}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-name-${asset.id}`}>
                    {asset.name}
                  </TableCell>
                  <TableCell data-testid={`text-category-${asset.id}`}>
                    {asset.category || "-"}
                  </TableCell>
                  <TableCell data-testid={`text-purchase-date-${asset.id}`}>
                    {formatDate(asset.purchaseDate)}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-purchase-price-${asset.id}`}>
                    {formatCurrency(asset.purchasePrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-salvage-value-${asset.id}`}>
                    {formatCurrency(asset.salvageValue || "0")}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-accumulated-depreciation-${asset.id}`}>
                    {formatCurrency(asset.accumulatedDepreciation || "0")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold" data-testid={`text-net-book-value-${asset.id}`}>
                    {formatCurrency(calculateNetBookValue(asset.purchasePrice, asset.accumulatedDepreciation || "0"))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(asset.status)} data-testid={`badge-status-${asset.id}`}>
                      {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          data-testid={`button-actions-${asset.id}`}
                          aria-label={`Actions for asset ${asset.name}`}
                          title="More options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingAsset(asset);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${asset.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete asset "${asset.name}"?`)) {
                              deleteMutation.mutate(asset.id);
                            }
                          }}
                          data-testid={`button-delete-${asset.id}`}
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

      <AssetDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        asset={editingAsset}
      />
    </div>
  );
}
