import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { StatusBadge } from "@/shared/components/common/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { 
  DollarSign, 
  TrendingDown, 
  Clock, 
  FileText, 
  Receipt, 
  Plus,
  UserPlus,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  Wallet
} from "lucide-react";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { useDashboardMetrics } from "@/shared/lib/dashboard/metrics-client";
import { format } from "date-fns";
import { motion, useSpring, useTransform } from "framer-motion";
import { InteractiveReportsPanel } from "../components/interactive-reports-panel";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: string;
  total: string;
  status: string;
}

interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  billDate: string;
  total: string;
  status: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

const QuickActionCard = ({ 
  to, 
  icon: Icon, 
  title, 
  description 
}: { 
  to: string; 
  icon: any; 
  title: string; 
  description: string; 
}) => (
  <Link href={to}>
    <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-quick-action-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </Link>
);

// Animated number component with smooth transitions
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const springValue = useSpring(value, { stiffness: 75, damping: 15 });
  const display = useTransform(springValue, (current) => 
    `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  );

  useEffect(() => {
    springValue.set(value);
  }, [springValue, value]);

  return <motion.span>{display}</motion.span>;
}

// Connection status indicator
function ConnectionStatus({ state, onRefresh }: { state: string; onRefresh: () => void }) {
  const getStatusConfig = () => {
    switch (state) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Live',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-green-500/20'
        };
      case 'connecting':
        return {
          icon: RefreshCw,
          text: 'Connecting',
          variant: 'secondary' as const,
          className: 'animate-pulse'
        };
      case 'error':
        return {
          icon: WifiOff,
          text: 'Disconnected',
          variant: 'destructive' as const,
          className: ''
        };
      default:
        return {
          icon: WifiOff,
          text: 'Offline',
          variant: 'outline' as const,
          className: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={`gap-1.5 ${config.className}`}
      data-testid="badge-connection-status"
    >
      <Icon className={`h-3 w-3 ${state === 'connecting' ? 'animate-spin' : ''}`} />
      {config.text}
      {(state === 'error' || state === 'disconnected') && (
        <button 
          onClick={onRefresh} 
          className="ml-1 hover:opacity-70"
          data-testid="button-reconnect"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentTenant } = useTenant();
  
  // Connect to live metrics WebSocket
  const { 
    metrics: liveMetrics, 
    connectionState, 
    error: metricsError, 
    refresh: refreshMetrics,
    isConnected 
  } = useDashboardMetrics(currentTenant?.id);

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

  useEffect(() => {
    if (metricsError) {
      console.error('[Dashboard] Metrics error:', metricsError);
    }
  }, [metricsError]);

  const { data: recentInvoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id, limit: 5, sortBy: "createdAt", sortOrder: "desc" }],
    enabled: !!currentTenant?.id,
  });

  const { data: recentBills, isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills", { tenantId: currentTenant?.id, limit: 5, sortBy: "createdAt", sortOrder: "desc" }],
    enabled: !!currentTenant?.id,
  });

  const { data: overdueInvoices, isLoading: overdueInvoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id, status: "overdue", limit: 5 }],
    enabled: !!currentTenant?.id,
  });

  const { data: upcomingBills, isLoading: upcomingBillsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills", { tenantId: currentTenant?.id, dueSoon: true, limit: 5 }],
    enabled: !!currentTenant?.id,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: goingConcernStatus } = useQuery<{status: string; assessmentDate: Date | null; reviewedBy: string | null}>({
    queryKey: ['/api/going-concern-status', currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const getVendorName = (vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId);
    return vendor?.name || "Unknown Vendor";
  };

  const showGoingConcernAlert = goingConcernStatus && 
    goingConcernStatus.status !== 'positive' && 
    goingConcernStatus.status !== null;

  // Use live metrics if available, otherwise show loading state
  const hasMetrics = !!liveMetrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business finances</p>
        </div>
        <ConnectionStatus state={connectionState} onRefresh={refreshMetrics} />
      </div>

      {showGoingConcernAlert && (
        <Alert variant="destructive" data-testid={`badge-going-concern-${goingConcernStatus.status}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Going Concern {goingConcernStatus.status === 'uncertainty' ? 'Uncertainty' : 'Doubt'} Detected</AlertTitle>
          <AlertDescription className="flex items-center justify-between" data-testid="text-going-concern-status">
            <span>
              A going concern assessment with {goingConcernStatus.status} status has been recorded
              {goingConcernStatus.assessmentDate && ` on ${format(new Date(goingConcernStatus.assessmentDate), 'PPP')}`}.
            </span>
            <Link href="/reports/financial-statement-notes">
              <Button variant="outline" size="sm">
                Review Notes
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <QuickActionCard 
            to="/invoices" 
            icon={Plus} 
            title="Create Invoice" 
            description="Bill your customers" 
          />
          <QuickActionCard 
            to="/bills" 
            icon={FileText} 
            title="Create Bill" 
            description="Record vendor bills" 
          />
          <QuickActionCard 
            to="/customer-payments" 
            icon={DollarSign} 
            title="Record Payment" 
            description="Log received payments" 
          />
          <QuickActionCard 
            to="/customers" 
            icon={UserPlus} 
            title="Add Customer" 
            description="Manage customer list" 
          />
          <QuickActionCard 
            to="/reports" 
            icon={BarChart3} 
            title="View Reports" 
            description="Financial insights" 
          />
        </div>
      </div>

      {/* Live Metrics Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
          {hasMetrics && (
            <p className="text-xs text-muted-foreground">
              Last updated: {format(new Date(liveMetrics.timestamp), 'h:mm:ss a')}
            </p>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Revenue Today */}
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!hasMetrics ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-semibold font-mono" data-testid="text-revenue-today">
                  $<AnimatedNumber value={parseFloat(liveMetrics.kpis.totalRevenueToday)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Invoices posted today
              </p>
            </CardContent>
          </Card>

          {/* Expenses Today */}
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses Today</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!hasMetrics ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-semibold font-mono" data-testid="text-expenses-today">
                  $<AnimatedNumber value={parseFloat(liveMetrics.kpis.totalExpensesToday)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Bills posted today
              </p>
            </CardContent>
          </Card>

          {/* Outstanding Invoices */}
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!hasMetrics ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-semibold font-mono" data-testid="text-outstanding-invoices">
                    $<AnimatedNumber value={parseFloat(liveMetrics.kpis.outstandingInvoices.total)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {liveMetrics.kpis.outstandingInvoices.count} invoice{liveMetrics.kpis.outstandingInvoices.count !== 1 ? 's' : ''} awaiting payment
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cash Position */}
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!hasMetrics ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-semibold font-mono" data-testid="text-cash-position">
                  $<AnimatedNumber value={parseFloat(liveMetrics.kpis.cashPosition)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Current cash & equivalents
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AR & AP Aging Summary */}
      {hasMetrics && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AR Aging Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.arAgingSummary.current).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">1-30 Days</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.arAgingSummary.days30).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">31-60 Days</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.arAgingSummary.days60).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">90+ Days</p>
                  <p className="text-lg font-semibold font-mono text-destructive">${parseFloat(liveMetrics.kpis.arAgingSummary.days90Plus).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                AP Aging Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.apAgingSummary.current).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">1-30 Days</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.apAgingSummary.days30).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">31-60 Days</p>
                  <p className="text-lg font-semibold font-mono">${parseFloat(liveMetrics.kpis.apAgingSummary.days60).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">90+ Days</p>
                  <p className="text-lg font-semibold font-mono text-destructive">${parseFloat(liveMetrics.kpis.apAgingSummary.days90Plus).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Interactive Reports Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Interactive Financial Reports</h2>
        <InteractiveReportsPanel />
      </div>

      {/* Recent Documents Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Documents</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : recentInvoices && recentInvoices.length > 0 ? (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <Link 
                      key={invoice.id} 
                      href={`/invoices`}
                    >
                      <div 
                        className="flex items-center justify-between p-3 rounded-md hover-elevate border cursor-pointer"
                        data-testid={`invoice-item-${invoice.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                              {invoice.invoiceNumber}
                            </p>
                            <StatusBadge status={invoice.status} type="invoice" />
                          </div>
                          <p className="text-xs text-muted-foreground truncate" data-testid={`text-customer-${invoice.id}`}>
                            {getCustomerName(invoice.customerId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold font-mono text-sm" data-testid={`text-invoice-amount-${invoice.id}`}>
                            ${parseFloat(invoice.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-invoices">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No recent invoices</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Bills */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Recent Bills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : recentBills && recentBills.length > 0 ? (
                <div className="space-y-3">
                  {recentBills.map((bill) => (
                    <Link 
                      key={bill.id} 
                      href={`/bills`}
                    >
                      <div 
                        className="flex items-center justify-between p-3 rounded-md hover-elevate border cursor-pointer"
                        data-testid={`bill-item-${bill.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm" data-testid={`text-bill-number-${bill.id}`}>
                              {bill.billNumber}
                            </p>
                            <StatusBadge status={bill.status} type="bill" />
                          </div>
                          <p className="text-xs text-muted-foreground truncate" data-testid={`text-vendor-${bill.id}`}>
                            {getVendorName(bill.vendorId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(bill.billDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold font-mono text-sm" data-testid={`text-bill-amount-${bill.id}`}>
                            ${parseFloat(bill.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-bills">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No recent bills</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pending Items Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Pending Items</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/pending-approvals">
                <div className="text-center py-8 text-muted-foreground cursor-pointer hover-elevate rounded-md" data-testid="empty-state-approvals">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pending approvals</p>
                  <p className="text-xs mt-1">Click to view all approvals</p>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Overdue Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Overdue Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueInvoicesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : overdueInvoices && overdueInvoices.length > 0 ? (
                <div className="space-y-3">
                  {overdueInvoices.slice(0, 3).map((invoice) => (
                    <Link 
                      key={invoice.id} 
                      href={`/invoices`}
                    >
                      <div 
                        className="flex items-center justify-between p-3 rounded-md hover-elevate border border-destructive/20 cursor-pointer"
                        data-testid={`overdue-invoice-${invoice.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getCustomerName(invoice.customerId)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold font-mono text-sm text-destructive">
                            ${parseFloat(invoice.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-overdue">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No overdue invoices</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Upcoming Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingBillsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : upcomingBills && upcomingBills.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBills.slice(0, 3).map((bill) => (
                    <Link 
                      key={bill.id} 
                      href={`/bills`}
                    >
                      <div 
                        className="flex items-center justify-between p-3 rounded-md hover-elevate border cursor-pointer"
                        data-testid={`upcoming-payment-${bill.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {bill.billNumber}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getVendorName(bill.vendorId)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold font-mono text-sm">
                            ${parseFloat(bill.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-upcoming">
                  <CalendarClock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No upcoming payments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
