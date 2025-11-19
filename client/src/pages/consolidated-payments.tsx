import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQueryTabState } from "@/hooks/useQueryTabState";

// Import existing payment page components
import Payments from "@/pages/payments";
import CustomerPayments from "@/pages/customer-payments";

export default function ConsolidatedPayments() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("vendor-payments");

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
            No Workspace Selected
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Please select or create a workspace to continue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="payments-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Payments
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage vendor and customer payments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="vendor-payments" data-testid="tab-vendor-payments">Vendor Payments</TabsTrigger>
          <TabsTrigger value="customer-payments" data-testid="tab-customer-payments">Customer Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="vendor-payments" data-testid="content-vendor-payments">
          <Payments />
        </TabsContent>

        <TabsContent value="customer-payments" data-testid="content-customer-payments">
          <CustomerPayments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
