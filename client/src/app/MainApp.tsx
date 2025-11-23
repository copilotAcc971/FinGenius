import { Suspense, lazy } from 'react';
import { Switch, Route } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { AppSidebarHierarchical } from "@/components/layout/app-sidebar-hierarchical";
import { OrganizationSwitcher } from "@/shared/components/layout/organization-switcher";
import { UserMenu } from "@/shared/components/layout/user-menu";
import { CommandPalette } from "@/shared/components/layout/command-palette";
import { Breadcrumbs } from "@/shared/components/layout/breadcrumbs";
import { TenantBadge } from "@/shared/components/layout/tenant-badge";
import { PageSkeleton } from "@/shared/components/layout/page-skeleton";
import { useAuth } from "@/shared/hooks/useAuth";
import { TenantProvider } from "@/shared/contexts/TenantContext";
import { RBACProvider } from "@/shared/contexts/rbac-context";
import { useTenant } from "@/shared/hooks/useTenant";
import { TenantGate } from "@/shared/components/common/TenantGate";
import { GlobalTenantEvents } from "@/shared/components/common/GlobalTenantEvents";
import { AICopilotWidget } from "@/shared/components/ai-copilot/ai-copilot-widget";
import { KeyboardShortcutsModal } from "@/shared/components/ui/keyboard-shortcuts-modal";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { QuickCreateFAB } from "@/components/quick-create-fab";

console.log('[MainApp] Loading MainApp component...');

// Lazy load all page components
// Shared Pages
const NotFound = lazy(() => import("@/shared/pages/not-found-page"));

// Dashboard Pages
const Dashboard = lazy(() => import("@/features/dashboard/pages/dashboard-page"));

// Income Pages
const InvoicesPage = lazy(() => import("@/features/income/pages/invoices-page"));
const Customers = lazy(() => import("@/features/income/pages/customers-page"));

// Expenses Pages
const BillsPage = lazy(() => import("@/features/expenses/pages/bills-page"));
const Vendors = lazy(() => import("@/features/expenses/pages/vendors-page"));

// Auth Pages
const Landing = lazy(() => import("@/features/auth/pages/landing-page"));

// Settings Pages
const SettingsPage = lazy(() => import("@/features/settings/pages/settings-page"));
const CompanyProfilePage = lazy(() => import("@/features/settings/pages/company-profile-page"));
const UserManagementPage = lazy(() => import("@/features/settings/pages/user-management-page"));
const RoleManagementPage = lazy(() => import("@/features/settings/pages/role-management-page"));
const CurrenciesPage = lazy(() => import("@/features/settings/pages/currencies-page"));

function ProtectedLayout() {
  console.log('[MainApp] Rendering ProtectedLayout...');
  const { isAuthenticated, loading: authLoading, error: authError } = useAuth();
  const { tenantsLoading } = useTenant();
  const { shortcutsVisible, setShortcutsVisible } = useKeyboardShortcuts();

  if (authLoading || tenantsLoading) {
    console.log('[MainApp] Auth or tenants loading...');
    return (
      <div className="flex h-screen items-center justify-center">
        <PageSkeleton />
      </div>
    );
  }

  if (authError) {
    console.error('[MainApp] Auth error:', authError);
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Authentication Error</h1>
          <p className="text-muted-foreground">Please try logging in again.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[MainApp] Not authenticated, showing landing page');
    return <Landing />;
  }

  console.log('[MainApp] User authenticated, rendering main layout');
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebarHierarchical />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-2">
              <OrganizationSwitcher />
              <TenantBadge />
              <CommandPalette />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Suspense fallback={<PageSkeleton />}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/income/customers" component={Customers} />
                <Route path="/income/invoices" component={InvoicesPage} />
                <Route path="/expenses/bills" component={BillsPage} />
                <Route path="/expenses/vendors" component={Vendors} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/settings/company-profile" component={CompanyProfilePage} />
                <Route path="/settings/users" component={UserManagementPage} />
                <Route path="/settings/roles" component={RoleManagementPage} />
                <Route path="/settings/currencies" component={CurrenciesPage} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
      <TenantGate />
      <GlobalTenantEvents />
      <AICopilotWidget />
      <QuickCreateFAB />
      <KeyboardShortcutsModal isOpen={shortcutsVisible} onClose={() => setShortcutsVisible(false)} />
    </SidebarProvider>
  );
}

export default function MainApp() {
  console.log('[MainApp] Rendering MainApp wrapper...');
  
  return (
    <TenantProvider>
      <RBACProvider>
        <ProtectedLayout />
      </RBACProvider>
    </TenantProvider>
  );
}