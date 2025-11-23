import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing purchase page components
import PurchaseOrders from "@/features/expenses/pages/purchase-orders-page";
import Bills from "@/features/expenses/pages/bills-page";
import Expenses from "@/features/expenses/pages/expenses-page";

export default function ConsolidatedPurchases() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("purchase-orders");

  if (!authLoading && !isAuthenticated) {
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            No Organization Selected
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Please select or create an organization to continue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="purchases-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Purchase Transactions
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage purchase orders, bills, and expenses
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="purchase-orders" data-testid="tab-purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="bills" data-testid="tab-bills">Bills</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase-orders" data-testid="content-purchase-orders">
          <PurchaseOrders />
        </TabsContent>

        <TabsContent value="bills" data-testid="content-bills">
          <Bills />
        </TabsContent>

        <TabsContent value="expenses" data-testid="content-expenses">
          <Expenses />
        </TabsContent>
      </Tabs>
    </div>
  );
}
