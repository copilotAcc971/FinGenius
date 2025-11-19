import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing banking page components
import BankConnections from "@/features/banking/pages/bank-connections-page";
import BankReconciliations from "@/features/banking/pages/bank-reconciliations-page";

export default function ConsolidatedBanking() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("connections");

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
    <div className="p-6" data-testid="banking-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Banking
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage bank connections and reconcile transactions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="connections" data-testid="tab-bank-connections">Bank Connections</TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" data-testid="content-bank-connections">
          <BankConnections />
        </TabsContent>

        <TabsContent value="reconciliation" data-testid="content-reconciliation">
          <BankReconciliations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
