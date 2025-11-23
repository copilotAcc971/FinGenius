import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import type { Item } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export default function InventoryReportsPage() {
  const { currentTenant } = useTenant();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const stats = useMemo(() => {
    const activeItems = items.filter(item => item.isActive);
    
    const lowStockItems = activeItems.filter(item => {
      const qty = parseFloat(item.quantityOnHand || "0");
      const reorder = parseFloat(item.reorderLevel || "0");
      return reorder > 0 && qty <= reorder && qty > 0;
    });

    const outOfStockItems = activeItems.filter(item => {
      const qty = parseFloat(item.quantityOnHand || "0");
      return qty === 0;
    });

    const inventoryValue = activeItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantityOnHand || "0");
      const price = parseFloat(item.purchasePrice || "0");
      return sum + (qty * price);
    }, 0);

    const goodsCount = activeItems.filter(item => item.type === "goods").length;
    const servicesCount = activeItems.filter(item => item.type === "service").length;

    const valueByType = {
      goods: activeItems
        .filter(item => item.type === "goods")
        .reduce((sum, item) => {
          const qty = parseFloat(item.quantityOnHand || "0");
          const price = parseFloat(item.purchasePrice || "0");
          return sum + (qty * price);
        }, 0),
      services: activeItems
        .filter(item => item.type === "service")
        .reduce((sum, item) => {
          const qty = parseFloat(item.quantityOnHand || "0");
          const price = parseFloat(item.purchasePrice || "0");
          return sum + (qty * price);
        }, 0),
    };

    return {
      activeItems,
      lowStockItems,
      outOfStockItems,
      inventoryValue,
      goodsCount,
      servicesCount,
      valueByType,
    };
  }, [items]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const inventoryValueChartData = [
    { name: "Goods", value: stats.valueByType.goods },
    { name: "Services", value: stats.valueByType.services },
  ];

  const stockStatusChartData = [
    { name: "In Stock", value: stats.activeItems.length - stats.lowStockItems.length - stats.outOfStockItems.length },
    { name: "Low Stock", value: stats.lowStockItems.length },
    { name: "Out of Stock", value: stats.outOfStockItems.length },
  ];

  const COLORS = {
    goods: "#0A0A0A",
    services: "#525252",
    inStock: "#16A34A",
    lowStock: "#D97706",
    outOfStock: "#DC2626",
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Inventory Reports</h1>
          <p className="text-muted-foreground">
            Overview of inventory levels, stock alerts, and valuation
          </p>
        </div>
        <TableSkeleton rows={8} columns={[]} minHeight="400px" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Inventory Reports</h1>
          <p className="text-muted-foreground">
            Overview of inventory levels, stock alerts, and valuation
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Inventory Items</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Add inventory items to see reports and analytics about your stock levels and valuation
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Inventory Reports</h1>
        <p className="text-muted-foreground">
          Overview of inventory levels, stock alerts, and valuation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.goodsCount} goods, {stats.servicesCount} services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(stats.inventoryValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on purchase price
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.lowStockItems.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Items need reordering
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.outOfStockItems.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Items unavailable
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value by Type</CardTitle>
            <CardDescription>Total value of goods vs services</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={inventoryValueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" stroke="#525252" />
                <YAxis stroke="#525252" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5' }}
                />
                <Bar dataKey="value" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Status Distribution</CardTitle>
            <CardDescription>Items by stock availability</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockStatusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#0A0A0A"
                  dataKey="value"
                >
                  {stockStatusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === "In Stock"
                          ? COLORS.inStock
                          : entry.name === "Low Stock"
                          ? COLORS.lowStock
                          : COLORS.outOfStock
                      }
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {stats.lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>
              Items that have reached or fallen below reorder level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.lowStockItems.map((item) => {
                const qty = parseFloat(item.quantityOnHand || "0");
                const reorder = parseFloat(item.reorderLevel || "0");
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`low-stock-item-${item.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{item.name}</div>
                      {item.sku && (
                        <div className="text-sm text-muted-foreground font-mono">
                          SKU: {item.sku}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Current</div>
                        <div className="font-mono font-semibold text-amber-600">
                          {qty.toFixed(2)} {item.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Reorder at</div>
                        <div className="font-mono">
                          {reorder.toFixed(2)} {item.unit}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Low Stock
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.outOfStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Out of Stock Items
            </CardTitle>
            <CardDescription>
              Items with zero quantity on hand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.outOfStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`out-of-stock-item-${item.id}`}
                >
                  <div className="flex-1">
                    <div className="font-semibold">{item.name}</div>
                    {item.sku && (
                      <div className="text-sm text-muted-foreground font-mono">
                        SKU: {item.sku}
                      </div>
                    )}
                  </div>
                  <Badge variant="destructive">Out of Stock</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.lowStockItems.length === 0 && stats.outOfStockItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Stock Levels Normal</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No items are currently low on stock or out of stock. Great job managing your inventory!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
