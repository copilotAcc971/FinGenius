import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { RBACProvider } from "@/contexts/rbac-context";
import { useTenant } from "@/hooks/useTenant";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Vendors from "@/pages/vendors";
import Items from "@/pages/items";
import Taxes from "@/pages/taxes";
import Accounts from "@/pages/accounts";
import Invoices from "@/pages/invoices";
import Quotes from "@/pages/quotes";
import SalesOrders from "@/pages/sales-orders";
import CreditNotes from "@/pages/credit-notes";
import RecurringInvoices from "@/pages/recurring-invoices";
import RetainerInvoices from "@/pages/retainer-invoices";
import Bills from "@/pages/bills";
import Expenses from "@/pages/expenses";
import Payments from "@/pages/payments";
import CustomerPayments from "@/pages/customer-payments";
import Documents from "@/pages/documents";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import CompanyProfile from "@/pages/company-profile";
import JournalEntries from "@/pages/journal-entries";
import Assets from "@/pages/assets";
import PurchaseOrders from "@/pages/purchase-orders";
import BankReconciliations from "@/pages/bank-reconciliations";
import FinancialReports from "@/pages/financial-reports";
import ARAgingReport from "@/pages/ar-aging";
import APAgingReport from "@/pages/ap-aging";
import BankConnections from "@/pages/bank-connections";
import RoleManagement from "@/pages/role-management";
import UserManagement from "@/pages/user-management";
import CurrenciesPage from "@/pages/settings/currencies";

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
          <Route path="/journal-entries" component={JournalEntries} />
          <Route path="/assets" component={Assets} />
          <Route path="/bank-reconciliations" component={BankReconciliations} />
          <Route path="/bank-connections" component={BankConnections} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/quotes" component={Quotes} />
          <Route path="/sales-orders" component={SalesOrders} />
          <Route path="/credit-notes" component={CreditNotes} />
          <Route path="/recurring-invoices" component={RecurringInvoices} />
          <Route path="/retainer-invoices" component={RetainerInvoices} />
          <Route path="/bills" component={Bills} />
          <Route path="/purchase-orders" component={PurchaseOrders} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/payments" component={Payments} />
          <Route path="/customer-payments" component={CustomerPayments} />
          <Route path="/documents" component={Documents} />
          <Route path="/reports" component={Reports} />
          <Route path="/financial-reports" component={FinancialReports} />
          <Route path="/ar-aging" component={ARAgingReport} />
          <Route path="/ap-aging" component={APAgingReport} />
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
      <RBACProvider tenantId={currentTenant?.id || null}>
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
                  <UserMenu />
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
                <div className="mx-auto max-w-7xl">
                  <Router />
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </RBACProvider>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <AppContent />
        </TenantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
