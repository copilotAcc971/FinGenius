import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing report page components
import FinancialReports from "@/features/reports/pages/financial-reports-page";
import ChartOfAccountsReport from "@/features/reports/pages/chart-of-accounts-report-page";
import ARAgingReport from "@/features/customers/pages/ar-aging-page";
import APAgingReport from "@/features/vendors/pages/ap-aging-page";
import CustomReportBuilder from "@/features/reports/pages/custom-report-builder-page";
import ScheduledReportsPage from "@/features/reports/pages/scheduled-reports-page";

export default function ConsolidatedReports() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("financial");

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
    <div className="p-6" data-testid="reports-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Reports & Analytics
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Financial reports, aging analysis, and custom reporting
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="financial" data-testid="tab-financial-reports">
            Financial Reports
          </TabsTrigger>
          <TabsTrigger value="chart-of-accounts" data-testid="tab-chart-of-accounts">
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="ar-aging" data-testid="tab-ar-aging">
            AR Aging
          </TabsTrigger>
          <TabsTrigger value="ap-aging" data-testid="tab-ap-aging">
            AP Aging
          </TabsTrigger>
          <TabsTrigger value="custom" data-testid="tab-custom-reports">
            Custom Reports
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled-reports">
            Scheduled Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial" data-testid="content-financial-reports">
          <FinancialReports />
        </TabsContent>

        <TabsContent value="chart-of-accounts" data-testid="content-chart-of-accounts">
          <ChartOfAccountsReport />
        </TabsContent>

        <TabsContent value="ar-aging" data-testid="content-ar-aging">
          <ARAgingReport />
        </TabsContent>

        <TabsContent value="ap-aging" data-testid="content-ap-aging">
          <APAgingReport />
        </TabsContent>

        <TabsContent value="custom" data-testid="content-custom-reports">
          <CustomReportBuilder />
        </TabsContent>

        <TabsContent value="scheduled" data-testid="content-scheduled-reports">
          <ScheduledReportsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
