import { Switch, Route } from "wouter";
import { queryClient } from "@/shared/lib/api/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import { OrganizationSwitcher } from "@/shared/components/layout/organization-switcher";
import { UserMenu } from "@/shared/components/layout/user-menu";
import { CommandPalette } from "@/shared/components/layout/command-palette";
import { Breadcrumbs } from "@/shared/components/layout/breadcrumbs";
import { TenantBadge } from "@/shared/components/layout/tenant-badge";
import { useAuth } from "@/shared/hooks/useAuth";
import { TenantProvider } from "@/shared/contexts/TenantContext";
import { RBACProvider } from "@/shared/contexts/rbac-context";
import { useTenant } from "@/shared/hooks/useTenant";
import { TenantGate } from "@/shared/components/common/TenantGate";
import { GlobalTenantEvents } from "@/shared/components/common/GlobalTenantEvents";

import NotFound from "@/shared/pages/not-found-page";
import Landing from "@/features/auth/pages/landing-page";
import Dashboard from "@/features/dashboard/pages/dashboard-page";
import Customers from "@/features/customers/pages/customers-page";
import Vendors from "@/features/vendors/pages/vendors-page";
import Items from "@/features/items/pages/items-page";
import Taxes from "@/features/taxes/pages/taxes-page";
import Accounts from "@/features/accounts/pages/accounts-page";
import AccountBalances from "@/features/accounts/pages/account-balances-page";
import ConsolidatedSales from "@/features/sales/pages/consolidated-sales-page";
import ConsolidatedPurchases from "@/features/purchases/pages/consolidated-purchases-page";
import ConsolidatedPayments from "@/features/payments/pages/consolidated-payments-page";
import Documents from "@/features/documents/pages/documents-page";
import Settings from "@/features/settings/pages/settings-page";
import CompanyProfile from "@/features/settings/pages/company-profile-page";
import JournalEntries from "@/features/accounts/pages/journal-entries-page";
import JournalEntryDetailPage from "@/features/accounts/pages/journal-entry-detail-page";
import Assets from "@/features/assets/pages/assets-page";
import PurchaseOrders from "@/features/purchase-orders/pages/purchase-orders-page";
import RoleManagement from "@/features/settings/pages/role-management-page";
import UserManagement from "@/features/settings/pages/user-management-page";
import CurrenciesPage from "@/features/settings/pages/currencies-page";
import WorkflowForm from "@/features/approvals/pages/workflow-form-page";
import ConsolidatedBanking from "@/features/banking/pages/consolidated-banking-page";
import ConsolidatedApprovals from "@/features/approvals/pages/consolidated-approvals-page";
import EmployeeExpenses from "@/features/expenses/pages/employee-expenses-page";
import ProjectDetail from "@/features/projects/pages/project-detail-page";
import ProjectProfitabilityReport from "@/features/reports/pages/project-profitability-report-page";
import ConsolidatedReports from "@/features/reports/pages/consolidated-reports-page";
import ConsolidatedProjects from "@/features/projects/pages/consolidated-projects-page";

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
                    <OrganizationSwitcher />
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
