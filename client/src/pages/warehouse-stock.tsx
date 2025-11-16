import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { WarehouseStock, Warehouse, Item } from "@shared/schema";
import { Link } from "wouter";

type WarehouseStockWithRelations = WarehouseStock & {
  warehouse?: Warehouse;
  item?: Item;
};

export default function WarehouseStockPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");
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

  const { data: warehouseStock = [], isLoading: isLoadingStock } = useQuery<WarehouseStockWithRelations[]>({
    queryKey: ["/api/warehouse-stock", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const isLoading = isLoadingStock || isLoadingWarehouses || isLoadingItems;

  const filteredStock = warehouseStock.filter((stock) => {
    const matchesSearch =
      stock.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.item?.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = warehouseFilter === "all" || stock.warehouseId === warehouseFilter;
    const matchesItem = itemFilter === "all" || stock.itemId === itemFilter;
    return matchesSearch && matchesWarehouse && matchesItem;
  });

  const formatQuantity = (value: string | null | undefined) => {
    if (!value) return "0";
    return parseFloat(value).toLocaleString();
  };

  const isBelowReorderLevel = (stock: WarehouseStockWithRelations) => {
    if (!stock.reorderLevel) return false;
    return parseFloat(stock.quantityOnHand) < parseFloat(stock.reorderLevel);
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
          <h1 className="text-3xl font-semibold">Warehouse Stock</h1>
          <p className="text-muted-foreground">View stock levels across all warehouses</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-stock"
          />
        </div>
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
        <Select value={itemFilter} onValueChange={setItemFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-item-filter">
            <SelectValue placeholder="All Items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredStock.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No stock found</p>
          <p className="text-sm text-muted-foreground">
            {searchTerm || warehouseFilter !== "all" || itemFilter !== "all"
              ? "Try adjusting your filters"
              : "Stock levels will appear here once you add items to warehouses"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Quantity On Hand</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">In Transit</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.map((stock) => (
                <TableRow 
                  key={stock.id} 
                  data-testid={`row-stock-${stock.id}`}
                  className={isBelowReorderLevel(stock) ? "bg-destructive/10" : ""}
                >
                  <TableCell className="font-medium">
                    <Link href={`/items`} className="hover:underline" data-testid={`link-item-${stock.itemId}`}>
                      {stock.item?.name || "-"}
                    </Link>
                  </TableCell>
                  <TableCell>{stock.item?.sku || "-"}</TableCell>
                  <TableCell>
                    <Link href={`/warehouses`} className="hover:underline" data-testid={`link-warehouse-${stock.warehouseId}`}>
                      {stock.warehouse?.name || "-"}
                    </Link>
                  </TableCell>
                  <TableCell 
                    className={`text-right font-mono ${isBelowReorderLevel(stock) ? "text-destructive font-semibold" : ""}`}
                  >
                    {formatQuantity(stock.quantityOnHand)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatQuantity(stock.committed)}</TableCell>
                  <TableCell className="text-right font-mono">{formatQuantity(stock.availableForSale)}</TableCell>
                  <TableCell className="text-right font-mono">{formatQuantity(stock.inTransit)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {stock.reorderLevel ? formatQuantity(stock.reorderLevel) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
