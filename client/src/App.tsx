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

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Vendors from "@/pages/vendors";
import Items from "@/pages/items";
import Taxes from "@/pages/taxes";
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
          <Route path="/invoices" component={Invoices} />
          <Route path="/quotes" component={Quotes} />
          <Route path="/sales-orders" component={SalesOrders} />
          <Route path="/credit-notes" component={CreditNotes} />
          <Route path="/recurring-invoices" component={RecurringInvoices} />
          <Route path="/retainer-invoices" component={RetainerInvoices} />
          <Route path="/bills" component={Bills} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/payments" component={Payments} />
          <Route path="/customer-payments" component={CustomerPayments} />
          <Route path="/documents" component={Documents} />
          <Route path="/reports" component={Reports} />
          <Route path="/company-profile" component={CompanyProfile} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

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
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
