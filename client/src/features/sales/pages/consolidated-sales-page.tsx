import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing sales page components
import Invoices from "@/features/invoices/pages/invoices-page";
import Quotes from "@/features/quotes/pages/quotes-page";
import SalesOrders from "@/features/sales-orders/pages/sales-orders-page";
import CreditNotes from "@/features/credit-notes/pages/credit-notes-page";
import RecurringInvoices from "@/features/invoices/pages/recurring-invoices-page";
import RetainerInvoices from "@/features/invoices/pages/retainer-invoices-page";

export default function ConsolidatedSales() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("invoices");

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
    <div className="p-6" data-testid="sales-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Sales Transactions
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage invoices, quotes, orders, and all sales documents
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotes" data-testid="tab-quotes">Quotes</TabsTrigger>
          <TabsTrigger value="sales-orders" data-testid="tab-sales-orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="credit-notes" data-testid="tab-credit-notes">Credit Notes</TabsTrigger>
          <TabsTrigger value="recurring" data-testid="tab-recurring">Recurring Invoices</TabsTrigger>
          <TabsTrigger value="retainer" data-testid="tab-retainer">Retainer Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" data-testid="content-invoices">
          <Invoices />
        </TabsContent>

        <TabsContent value="quotes" data-testid="content-quotes">
          <Quotes />
        </TabsContent>

        <TabsContent value="sales-orders" data-testid="content-sales-orders">
          <SalesOrders />
        </TabsContent>

        <TabsContent value="credit-notes" data-testid="content-credit-notes">
          <CreditNotes />
        </TabsContent>

        <TabsContent value="recurring" data-testid="content-recurring">
          <RecurringInvoices />
        </TabsContent>

        <TabsContent value="retainer" data-testid="content-retainer">
          <RetainerInvoices />
        </TabsContent>
      </Tabs>
    </div>
  );
}
