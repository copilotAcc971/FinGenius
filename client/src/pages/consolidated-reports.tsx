import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ConsolidatedPageLayout, VerticalTab } from "@/components/ui/vertical-tabs";
import {
  TrendingUp,
  FileBarChart,
  Clock,
  FileSpreadsheet,
  Calendar,
} from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Import existing report page components (we'll use them as tab content)
import FinancialReports from "@/pages/financial-reports";
import ChartOfAccountsReport from "@/pages/chart-of-accounts-report";
import ARAgingReport from "@/pages/ar-aging";
import APAgingReport from "@/pages/ap-aging";
import CustomReportBuilder from "@/pages/custom-report-builder";
import ScheduledReportsPage from "@/pages/scheduled-reports";

export default function ConsolidatedReports() {
  const [location, setLocation] = useLocation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Parse active tab from URL query param
  const searchParams = new URLSearchParams(window.location.search);
  const tabFromUrl = searchParams.get("tab") || "financial";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const newUrl = `/reports?tab=${tabId}`;
    window.history.pushState({}, "", newUrl);
  };

  // Sync tab with URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location]);

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

  const tabs: VerticalTab[] = [
    {
      id: "financial",
      label: "Financial Reports",
      icon: TrendingUp,
    },
    {
      id: "chart-of-accounts",
      label: "Chart of Accounts",
      icon: FileBarChart,
    },
    {
      id: "ar-aging",
      label: "AR Aging",
      icon: Clock,
    },
    {
      id: "ap-aging",
      label: "AP Aging",
      icon: Clock,
    },
    {
      id: "custom",
      label: "Custom Reports",
      icon: FileSpreadsheet,
    },
    {
      id: "scheduled",
      label: "Scheduled Reports",
      icon: Calendar,
    },
  ];

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "financial":
        return <FinancialReports />;
      case "chart-of-accounts":
        return <ChartOfAccountsReport />;
      case "ar-aging":
        return <ARAgingReport />;
      case "ap-aging":
        return <APAgingReport />;
      case "custom":
        return <CustomReportBuilder />;
      case "scheduled":
        return <ScheduledReportsPage />;
      default:
        return <FinancialReports />;
    }
  };

  return (
    <ConsolidatedPageLayout
      header={{
        title: "Reports",
        description: "Comprehensive financial insights, analytics, and reporting",
      }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <div className="p-6" data-testid="reports-tab-content">
        {renderTabContent()}
      </div>
    </ConsolidatedPageLayout>
  );
}
