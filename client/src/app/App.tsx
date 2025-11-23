import { Suspense, lazy } from 'react';
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

// Lazy load all page components
// Shared Pages
const NotFound = lazy(() => import("@/shared/pages/not-found-page"));
const AdvancedTableDemo = lazy(() => import("@/shared/pages/advanced-table-demo-page"));

// Top-Level Pages
const AlertsCenterPage = lazy(() => import("@/pages/alerts-center"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs-page"));
const CompliancePage = lazy(() => import("@/pages/compliance"));
const CopilotPage = lazy(() => import("@/pages/copilot"));
const CreditPassportPage = lazy(() => import("@/pages/credit-passport"));
const InboundDocumentsPage = lazy(() => import("@/pages/inbound-documents"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AIProvidersPage = lazy(() => import("@/pages/settings/ai-providers"));

// Report Pages
const BalanceSheetPage = lazy(() => import("@/pages/reports/balance-sheet-page"));
const CashFlowPage = lazy(() => import("@/pages/reports/cash-flow-page"));
const ProfitLossPage = lazy(() => import("@/pages/reports/profit-loss-page"));
const TrialBalancePage = lazy(() => import("@/pages/reports/trial-balance-page"));

// Auth Pages
const Landing = lazy(() => import("@/features/auth/pages/landing-page"));

// Accounting Pages (formerly Accounts, Assets, Items, Inventory)
const Accounts = lazy(() => import("@/features/accounting/pages/accounts-page"));
const AccountBalances = lazy(() => import("@/features/accounting/pages/account-balances-page"));
const JournalEntries = lazy(() => import("@/features/accounting/pages/journal-entries-page"));
const JournalEntryDetailPage = lazy(() => import("@/features/accounting/pages/journal-entry-detail-page"));
const Assets = lazy(() => import("@/features/accounting/pages/assets-page"));
const FixedAssets = lazy(() => import("@/features/accounting/pages/fixed-assets-page"));
const InventoryReportsPage = lazy(() => import("@/features/accounting/pages/inventory-reports-page"));
const ItemFormPage = lazy(() => import("@/features/accounting/pages/item-form-page"));
const Items = lazy(() => import("@/features/accounting/pages/items-page"));
const StockAdjustmentsPage = lazy(() => import("@/features/accounting/pages/stock-adjustments-page"));
const NrvAssessmentPage = lazy(() => import("@/features/accounting/pages/nrv-assessment-page"));

// Income Pages (formerly Invoices, Customers, Quotes, Sales Orders, Credit Notes)
const InvoicesPage = lazy(() => import("@/features/income/pages/invoices-page"));
const RecurringInvoicesPage = lazy(() => import("@/features/income/pages/recurring-invoices-page"));
const RetainerInvoicesPage = lazy(() => import("@/features/income/pages/retainer-invoices-page"));
const Customers = lazy(() => import("@/features/income/pages/customers-page"));
const ARAgingPage = lazy(() => import("@/features/income/pages/ar-aging-page"));
const QuotesPage = lazy(() => import("@/features/income/pages/quotes-page"));
const SalesOrdersPage = lazy(() => import("@/features/income/pages/sales-orders-page"));
const CreditNotesPage = lazy(() => import("@/features/income/pages/credit-notes-page"));

// Expenses Pages (formerly Bills, Vendors, Purchase Orders)
const BillsPage = lazy(() => import("@/features/expenses/pages/bills-page"));
const Vendors = lazy(() => import("@/features/expenses/pages/vendors-page"));
const APAgingPage = lazy(() => import("@/features/expenses/pages/ap-aging-page"));
const PurchaseOrdersPage = lazy(() => import("@/features/expenses/pages/purchase-orders-page"));
const EmployeeExpenses = lazy(() => import("@/features/expenses/pages/employee-expenses-page"));
const ExpensesPage = lazy(() => import("@/features/expenses/pages/expenses-page"));
const ConsolidatedPurchases = lazy(() => import("@/features/expenses/pages/consolidated-purchases-page"));

// Approvals Pages
const ConsolidatedApprovals = lazy(() => import("@/features/approvals/pages/consolidated-approvals-page"));
const PendingApprovalsPage = lazy(() => import("@/features/approvals/pages/pending-approvals-page"));
const WorkflowForm = lazy(() => import("@/features/approvals/pages/workflow-form-page"));
const WorkflowsPage = lazy(() => import("@/features/approvals/pages/workflows-page"));

// Banking Pages
const BankConnectionsPage = lazy(() => import("@/features/banking/pages/bank-connections-page"));
const BankReconciliationsPage = lazy(() => import("@/features/banking/pages/bank-reconciliations-page"));
const ConsolidatedBanking = lazy(() => import("@/features/banking/pages/consolidated-banking-page"));

// Compliance Pages
const AlertRulesPage = lazy(() => import("@/features/compliance/pages/alert-rules-page"));
const ComplianceDashboardPage = lazy(() => import("@/features/compliance/pages/compliance-dashboard-page"));
const KYCVerificationsPage = lazy(() => import("@/features/compliance/pages/kyc-verifications-page"));
const SanctionsScreeningPage = lazy(() => import("@/features/compliance/pages/sanctions-screening-page"));
const SARReportsPage = lazy(() => import("@/features/compliance/pages/sar-reports-page"));
const TransactionAlertsPage = lazy(() => import("@/features/compliance/pages/transaction-alerts-page"));

// Dashboard Pages
const Dashboard = lazy(() => import("@/features/dashboard/pages/dashboard-page"));

// Documents Pages
const Documents = lazy(() => import("@/features/documents/pages/documents-page"));

// Payments Pages
const ConsolidatedPayments = lazy(() => import("@/features/payments/pages/consolidated-payments-page"));
const CustomerPaymentsPage = lazy(() => import("@/features/payments/pages/customer-payments-page"));
const PaymentsPage = lazy(() => import("@/features/payments/pages/payments-page"));

// Projects Pages
const ConsolidatedProjects = lazy(() => import("@/features/projects/pages/consolidated-projects-page"));
const ProjectDetail = lazy(() => import("@/features/projects/pages/project-detail-page"));
const ProjectsPage = lazy(() => import("@/features/projects/pages/projects-page"));
const TimesheetsPage = lazy(() => import("@/features/projects/pages/timesheets-page"));
const TimeTrackingPage = lazy(() => import("@/features/projects/pages/time-tracking-page"));

// Reports Pages
const ChartOfAccountsReportPage = lazy(() => import("@/features/reports/pages/chart-of-accounts-report-page"));
const ConsolidatedReportsPage = lazy(() => import("@/features/reports/pages/consolidated-reports-page"));
const CustomReportBuilderPage = lazy(() => import("@/features/reports/pages/custom-report-builder-page"));
const FinancialReportsPage = lazy(() => import("@/features/reports/pages/financial-reports-page"));
const FinancialStatementNotesPage = lazy(() => import("@/features/reports/pages/financial-statement-notes-page"));
const ProjectProfitabilityReport = lazy(() => import("@/features/reports/pages/project-profitability-report-page"));
const ProjectReportsPage = lazy(() => import("@/features/reports/pages/project-reports-page"));
const ConsolidatedReports = lazy(() => import("@/features/reports/pages/reports-page"));
const ScheduledReportsPage = lazy(() => import("@/features/reports/pages/scheduled-reports-page"));

// Sales Pages
const ConsolidatedSales = lazy(() => import("@/features/sales/pages/consolidated-sales-page"));

// Settings Pages
const CompanyProfile = lazy(() => import("@/features/settings/pages/company-profile-page"));
const CurrenciesPage = lazy(() => import("@/features/settings/pages/currencies-page"));
const RoleManagement = lazy(() => import("@/features/settings/pages/role-management-page"));
const Settings = lazy(() => import("@/features/settings/pages/settings-page"));
const UserManagement = lazy(() => import("@/features/settings/pages/user-management-page"));

// Taxes Pages
const Taxes = lazy(() => import("@/features/taxes/pages/taxes-page"));

// Helper component to wrap routes with Suspense
interface RouteProps {
  path: string;
  component: React.ComponentType<any>;
  params?: string;
}

const SuspenseRoute = ({ path, component: Component, params }: RouteProps) => (
  <Route 
    path={path}
    component={(props: any) => (
      <Suspense fallback={<PageSkeleton />}>
        <Component {...props} />
      </Suspense>
    )}
  />
);

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <SuspenseRoute path="/" component={Landing} />
      ) : (
        <>
          {/* Dashboard & Core Pages */}
          <SuspenseRoute path="/" component={Dashboard} />
          
          {/* Income Section */}
          <SuspenseRoute path="/income/invoices" component={InvoicesPage} />
          <SuspenseRoute path="/income/recurring-invoices" component={RecurringInvoicesPage} />
          <SuspenseRoute path="/income/retainer-invoices" component={RetainerInvoicesPage} />
          <SuspenseRoute path="/income/customers" component={Customers} />
          <SuspenseRoute path="/income/ar-aging" component={ARAgingPage} />
          <SuspenseRoute path="/income/quotes" component={QuotesPage} />
          <SuspenseRoute path="/income/sales-orders" component={SalesOrdersPage} />
          <SuspenseRoute path="/income/credit-notes" component={CreditNotesPage} />
          
          {/* Expenses Section */}
          <SuspenseRoute path="/expenses/bills" component={BillsPage} />
          <SuspenseRoute path="/expenses/vendors" component={Vendors} />
          <SuspenseRoute path="/expenses/ap-aging" component={APAgingPage} />
          <SuspenseRoute path="/expenses/purchase-orders" component={PurchaseOrdersPage} />
          <SuspenseRoute path="/expenses/employee-expenses" component={EmployeeExpenses} />
          <SuspenseRoute path="/expenses/expenses" component={ExpensesPage} />
          <SuspenseRoute path="/expenses/purchases" component={ConsolidatedPurchases} />
          
          {/* Accounting Section */}
          <SuspenseRoute path="/accounting/accounts" component={Accounts} />
          <SuspenseRoute path="/accounting/account-balances" component={AccountBalances} />
          <SuspenseRoute path="/accounting/journal-entries" component={JournalEntries} />
          <SuspenseRoute path="/accounting/journal-entries/:id" component={JournalEntryDetailPage} />
          <SuspenseRoute path="/accounting/fixed-assets" component={FixedAssets} />
          <SuspenseRoute path="/accounting/items" component={Items} />
          <SuspenseRoute path="/accounting/items/new" component={ItemFormPage} />
          <SuspenseRoute path="/accounting/items/:id/edit" component={ItemFormPage} />
          <SuspenseRoute path="/accounting/stock-adjustments" component={StockAdjustmentsPage} />
          <SuspenseRoute path="/accounting/inventory-reports" component={InventoryReportsPage} />
          <SuspenseRoute path="/accounting/nrv-assessment" component={NrvAssessmentPage} />
          
          {/* Taxes */}
          <SuspenseRoute path="/taxes" component={Taxes} />
          
          {/* Approvals & Workflows */}
          <SuspenseRoute path="/approvals" component={ConsolidatedApprovals} />
          <SuspenseRoute path="/approvals/pending" component={PendingApprovalsPage} />
          <SuspenseRoute path="/workflows" component={WorkflowsPage} />
          <SuspenseRoute path="/workflows/:id" component={WorkflowForm} />
          
          {/* Banking */}
          <SuspenseRoute path="/banking" component={ConsolidatedBanking} />
          <SuspenseRoute path="/banking/connections" component={BankConnectionsPage} />
          <SuspenseRoute path="/banking/reconciliations" component={BankReconciliationsPage} />
          
          {/* Sales */}
          <SuspenseRoute path="/sales" component={ConsolidatedSales} />
          
          {/* Payments */}
          <SuspenseRoute path="/payments" component={PaymentsPage} />
          <SuspenseRoute path="/payments/consolidated" component={ConsolidatedPayments} />
          <SuspenseRoute path="/payments/customer" component={CustomerPaymentsPage} />
          
          {/* Projects */}
          <SuspenseRoute path="/projects" component={ProjectsPage} />
          <SuspenseRoute path="/projects/consolidated" component={ConsolidatedProjects} />
          <SuspenseRoute path="/projects/:id" component={ProjectDetail} />
          <SuspenseRoute path="/projects/timesheets" component={TimesheetsPage} />
          <SuspenseRoute path="/projects/time-tracking" component={TimeTrackingPage} />
          
          {/* Reports */}
          <SuspenseRoute path="/reports" component={ConsolidatedReportsPage} />
          <SuspenseRoute path="/reports/all" component={ConsolidatedReports} />
          <SuspenseRoute path="/reports/balance-sheet" component={BalanceSheetPage} />
          <SuspenseRoute path="/reports/cash-flow" component={CashFlowPage} />
          <SuspenseRoute path="/reports/profit-loss" component={ProfitLossPage} />
          <SuspenseRoute path="/reports/trial-balance" component={TrialBalancePage} />
          <SuspenseRoute path="/reports/chart-of-accounts" component={ChartOfAccountsReportPage} />
          <SuspenseRoute path="/reports/financial" component={FinancialReportsPage} />
          <SuspenseRoute path="/reports/financial-statement-notes" component={FinancialStatementNotesPage} />
          <SuspenseRoute path="/reports/projects/profitability" component={ProjectProfitabilityReport} />
          <SuspenseRoute path="/reports/projects" component={ProjectReportsPage} />
          <SuspenseRoute path="/reports/custom-builder" component={CustomReportBuilderPage} />
          <SuspenseRoute path="/reports/scheduled" component={ScheduledReportsPage} />
          
          {/* Documents */}
          <SuspenseRoute path="/documents" component={Documents} />
          
          {/* Compliance */}
          <SuspenseRoute path="/compliance" component={ComplianceDashboardPage} />
          <SuspenseRoute path="/compliance/kyc" component={KYCVerificationsPage} />
          <SuspenseRoute path="/compliance/sanctions" component={SanctionsScreeningPage} />
          <SuspenseRoute path="/compliance/alerts" component={TransactionAlertsPage} />
          <SuspenseRoute path="/compliance/sar" component={SARReportsPage} />
          <SuspenseRoute path="/compliance/rules" component={AlertRulesPage} />
          <SuspenseRoute path="/compliance-dashboard" component={CompliancePage} />
          
          {/* Settings */}
          <SuspenseRoute path="/settings" component={Settings} />
          <SuspenseRoute path="/company-profile" component={CompanyProfile} />
          <SuspenseRoute path="/settings/roles" component={RoleManagement} />
          <SuspenseRoute path="/settings/users" component={UserManagement} />
          <SuspenseRoute path="/settings/currencies" component={CurrenciesPage} />
          <SuspenseRoute path="/settings/ai-providers" component={AIProvidersPage} />
          
          {/* Alerts & Other */}
          <SuspenseRoute path="/alerts-center" component={AlertsCenterPage} />
          <SuspenseRoute path="/audit-logs" component={AuditLogsPage} />
          <SuspenseRoute path="/credit-passport" component={CreditPassportPage} />
          <SuspenseRoute path="/inbound-documents" component={InboundDocumentsPage} />
          <SuspenseRoute path="/copilot" component={CopilotPage} />
          
          {/* Demo Pages */}
          <SuspenseRoute path="/demo/advanced-table" component={AdvancedTableDemo} />
        </>
      )}
      <SuspenseRoute path="/*" component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentTenant } = useTenant();
  useKeyboardShortcuts();

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
      {/* WCAG 2.2 Level A: Skip to Main Content Link */}
      <a 
        href="#main-content" 
        className="skip-to-main" 
        data-testid="link-skip-to-main"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      
      <TenantGate>
        <RBACProvider tenantId={currentTenant?.id || null}>
          <CommandPalette />
          <KeyboardShortcutsModal />
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              {/* WCAG 2.2 Level AA: Semantic nav element for sidebar */}
              <nav 
                aria-label="Main navigation" 
                className="flex h-screen"
                role="navigation"
                data-testid="nav-main-sidebar"
              >
                <AppSidebar />
              </nav>
              
              <div className="flex flex-col flex-1 overflow-hidden">
                <header 
                  className="flex h-16 items-center justify-between gap-4 border-b px-6 bg-background"
                  role="banner"
                  aria-label="Page header"
                >
                  <div className="flex items-center gap-4">
                    <SidebarTrigger 
                      data-testid="button-sidebar-toggle"
                      aria-label="Toggle sidebar navigation"
                      aria-expanded="false"
                    />
                    <OrganizationSwitcher />
                  </div>
                  <div className="flex items-center gap-4">
                    <TenantBadge />
                    <UserMenu />
                  </div>
                </header>
                
                {/* WCAG 2.2 Level A: Semantic region for breadcrumbs */}
                <div 
                  className="border-b bg-background px-6 py-3"
                  role="navigation"
                  aria-label="Breadcrumb navigation"
                >
                  <Breadcrumbs />
                </div>
                
                {/* WCAG 2.2 Level A: Semantic main element with id for skip link */}
                <main 
                  id="main-content"
                  className="flex-1 overflow-y-auto p-6 bg-muted/20"
                  role="main"
                  aria-label="Main content area"
                >
                  <div className="mx-auto max-w-7xl">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
          {/* AI Copilot Widget - Always available for authenticated users */}
          <AICopilotWidget />
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

// Add lang attribute to html root element for semantic HTML
// Initialize accessibility helpers
if (typeof document !== 'undefined') {
  document.documentElement.lang = 'en-US';
  
  // Import and run accessibility initialization
  import('@/shared/lib/utils/accessibility-helpers').then(({ initializeAccessibility }) => {
    initializeAccessibility();
  });
}
