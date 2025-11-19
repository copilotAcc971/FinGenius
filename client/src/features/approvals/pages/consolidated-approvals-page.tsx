import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing approval page components
import PendingApprovals from "@/features/approvals/pages/pending-approvals-page";
import Workflows from "@/features/approvals/pages/workflows-page";

export default function ConsolidatedApprovals() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("pending");

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
    <div className="p-6" data-testid="approvals-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Approvals
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Review pending approvals and manage workflow rules
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" data-testid="tab-pending-approvals">Pending Approvals</TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">Approval Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" data-testid="content-pending-approvals">
          <PendingApprovals />
        </TabsContent>

        <TabsContent value="workflows" data-testid="content-workflows">
          <Workflows />
        </TabsContent>
      </Tabs>
    </div>
  );
}
