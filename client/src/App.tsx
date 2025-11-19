import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserMenu } from "@/components/user-menu";
import { CommandPalette } from "@/components/command-palette";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TenantBadge } from "@/components/tenant-badge";
import { useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { RBACProvider } from "@/contexts/rbac-context";
import { useTenant } from "@/hooks/useTenant";
import { TenantGate } from "@/components/TenantGate";
import { GlobalTenantEvents } from "@/components/GlobalTenantEvents";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Vendors from "@/pages/vendors";
import Items from "@/pages/items";
import Taxes from "@/pages/taxes";
import Accounts from "@/pages/accounts";
import AccountBalances from "@/pages/account-balances";
import ConsolidatedSales from "@/pages/consolidated-sales";
import ConsolidatedPurchases from "@/pages/consolidated-purchases";
import ConsolidatedPayments from "@/pages/consolidated-payments";
import Documents from "@/pages/documents";
import Settings from "@/pages/settings";
import CompanyProfile from "@/pages/company-profile";
import JournalEntries from "@/pages/journal-entries";
import JournalEntryDetailPage from "@/pages/JournalEntryDetailPage";
import Assets from "@/pages/assets";
import PurchaseOrders from "@/pages/purchase-orders";
import RoleManagement from "@/pages/role-management";
import UserManagement from "@/pages/user-management";
import CurrenciesPage from "@/pages/settings/currencies";
import WorkflowForm from "@/pages/workflow-form";
import ConsolidatedBanking from "@/pages/consolidated-banking";
import ConsolidatedApprovals from "@/pages/consolidated-approvals";
import EmployeeExpenses from "@/pages/employee-expenses";
import ProjectDetail from "@/pages/project-detail";
import ProjectProfitabilityReport from "@/pages/project-profitability-report";
import ConsolidatedReports from "@/pages/consolidated-reports";
import ConsolidatedProjects from "@/pages/consolidated-projects";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/customers" component={Customers} />
          <Route path="/vendors" component={Vendors} />
          <Route path="/items" component={Items} />
          <Route path="/taxes" component={Taxes} />
          <Route path="/accounts" component={Accounts} />
          <Route path="/account-balances" component={AccountBalances} />
          <Route path="/journal-entries/:id" component={JournalEntryDetailPage} />
          <Route path="/journal-entries" component={JournalEntries} />
          <Route path="/approvals" component={ConsolidatedApprovals} />
          <Route path="/workflows/:id" component={WorkflowForm} />
          <Route path="/assets" component={Assets} />
          <Route path="/banking" component={ConsolidatedBanking} />
          <Route path="/sales" component={ConsolidatedSales} />
          <Route path="/purchases" component={ConsolidatedPurchases} />
          <Route path="/employee-expenses" component={EmployeeExpenses} />
          <Route path="/payments" component={ConsolidatedPayments} />
          <Route path="/reports/projects/profitability" component={ProjectProfitabilityReport} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/projects" component={ConsolidatedProjects} />
          <Route path="/documents" component={Documents} />
          <Route path="/reports" component={ConsolidatedReports} />
          <Route path="/company-profile" component={CompanyProfile} />
          <Route path="/settings" component={Settings} />
          <Route path="/settings/roles" component={RoleManagement} />
          <Route path="/settings/users" component={UserManagement} />
          <Route path="/settings/currencies" component={CurrenciesPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentTenant } = useTenant();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Toaster />
        <Router />
      </>
    );
  }

  return (
    <>
      <TenantGate>
        <RBACProvider tenantId={currentTenant?.id || null}>
          <CommandPalette />
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex h-16 items-center justify-between gap-4 border-b px-6 bg-background">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <WorkspaceSwitcher />
                  </div>
                  <div className="flex items-center gap-4">
                    <TenantBadge />
                    <UserMenu />
                  </div>
                </header>
                <div className="border-b bg-background px-6 py-3">
                  <Breadcrumbs />
                </div>
                <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
                  <div className="mx-auto max-w-7xl">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </RBACProvider>
      </TenantGate>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <GlobalTenantEvents />
          <AppContent />
        </TenantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
