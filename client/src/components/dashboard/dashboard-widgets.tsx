import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, Users, FileText } from "lucide-react";

interface WidgetProps {
  title: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function DashboardWidgetCard({ title, isLoading, children }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Cash Position Widget
export function CashPositionWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Cash Position" isLoading={isLoading}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Balance</p>
          <p className="text-2xl font-bold">${data?.total || 0}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Operating</p>
            <p className="text-lg font-semibold">${data?.operating || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reserved</p>
            <p className="text-lg font-semibold">${data?.reserved || 0}</p>
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// A/R Aging Widget
export function ARAgingWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="A/R Aging" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm">Current</span>
          <Badge variant="outline">${data?.current || 0}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">30+ Days</span>
          <Badge variant="outline" className="bg-yellow-50">${data?.days30 || 0}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">60+ Days</span>
          <Badge variant="outline" className="bg-orange-50">${data?.days60 || 0}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">90+ Days</span>
          <Badge variant="outline" className="bg-red-50">${data?.days90 || 0}</Badge>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// A/P Aging Widget
export function APAgingWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="A/P Aging" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm">Due</span>
          <Badge variant="outline">${data?.due || 0}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Overdue</span>
          <Badge variant="outline" className="bg-red-50">${data?.overdue || 0}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Upcoming (7 days)</span>
          <Badge variant="outline" className="bg-blue-50">${data?.upcoming || 0}</Badge>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// Revenue Trend Widget
export function RevenueTrendWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Revenue Trend" isLoading={isLoading}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">This Month</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">${data?.thisMonth || 0}</p>
            <div className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">{data?.trend || 0}%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Last Month: ${data?.lastMonth || 0}</p>
      </div>
    </DashboardWidgetCard>
  );
}

// Expense Trend Widget
export function ExpenseTrendWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Expense Trend" isLoading={isLoading}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">This Month</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">${data?.thisMonth || 0}</p>
            <div className="flex items-center gap-1 text-red-600">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">{data?.trend || 0}%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Budget: ${data?.budget || 0}</p>
      </div>
    </DashboardWidgetCard>
  );
}

// P&L Snapshot Widget
export function ProfitLossSnapshotWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="P&L Snapshot" isLoading={isLoading}>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revenue</span>
          <span className="font-semibold">${data?.revenue || 0}</span>
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-semibold">${data?.expenses || 0}</span>
        </div>
        <div className="border-t pt-3 flex justify-between font-bold">
          <span>Net Income</span>
          <span className={data?.netIncome >= 0 ? "text-green-600" : "text-red-600"}>
            ${data?.netIncome || 0}
          </span>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// Top Customers Widget
export function TopCustomersWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Top Customers" isLoading={isLoading}>
      <div className="space-y-3">
        {data?.customers?.slice(0, 5).map((customer: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <span>{customer.name}</span>
            <Badge variant="secondary">${customer.total}</Badge>
          </div>
        ))}
      </div>
    </DashboardWidgetCard>
  );
}

// Recent Invoices Widget
export function RecentInvoicesWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Recent Invoices" isLoading={isLoading}>
      <div className="space-y-2">
        {data?.invoices?.slice(0, 5).map((invoice: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
            <span className="text-muted-foreground">{invoice.number}</span>
            <Badge variant="outline">${invoice.total}</Badge>
          </div>
        ))}
      </div>
    </DashboardWidgetCard>
  );
}

// Pending Approvals Widget
export function PendingApprovalsWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Pending Approvals" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Journal Entries</span>
          </div>
          <Badge>{data?.journalEntries || 0}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Payments</span>
          </div>
          <Badge>{data?.payments || 0}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Expense Claims</span>
          </div>
          <Badge>{data?.expenseClaims || 0}</Badge>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// Key Metrics Widget
export function KeyMetricsWidget({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  return (
    <DashboardWidgetCard title="Key Metrics" isLoading={isLoading}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Gross Margin</p>
          <p className="text-lg font-bold">{data?.grossMargin || 0}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Quick Ratio</p>
          <p className="text-lg font-bold">{data?.quickRatio || 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">DSO</p>
          <p className="text-lg font-bold">{data?.dso || 0} days</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">DPO</p>
          <p className="text-lg font-bold">{data?.dpo || 0} days</p>
        </div>
      </div>
    </DashboardWidgetCard>
  );
}

// Widget Registry - maps widget type to component
export const WIDGET_REGISTRY = {
  cash_position: {
    title: "Cash Position",
    component: CashPositionWidget,
    defaultSize: "medium",
  },
  ar_aging: {
    title: "A/R Aging",
    component: ARAgingWidget,
    defaultSize: "medium",
  },
  ap_aging: {
    title: "A/P Aging",
    component: APAgingWidget,
    defaultSize: "medium",
  },
  revenue_trend: {
    title: "Revenue Trend",
    component: RevenueTrendWidget,
    defaultSize: "small",
  },
  expense_trend: {
    title: "Expense Trend",
    component: ExpenseTrendWidget,
    defaultSize: "small",
  },
  profit_loss_snapshot: {
    title: "P&L Snapshot",
    component: ProfitLossSnapshotWidget,
    defaultSize: "medium",
  },
  top_customers: {
    title: "Top Customers",
    component: TopCustomersWidget,
    defaultSize: "medium",
  },
  recent_invoices: {
    title: "Recent Invoices",
    component: RecentInvoicesWidget,
    defaultSize: "medium",
  },
  pending_approvals: {
    title: "Pending Approvals",
    component: PendingApprovalsWidget,
    defaultSize: "medium",
  },
  key_metrics: {
    title: "Key Metrics",
    component: KeyMetricsWidget,
    defaultSize: "large",
  },
} as const;
