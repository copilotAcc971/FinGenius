import {
  Building2,
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  CreditCard,
  DollarSign,
  BarChart3,
  Settings,
  Upload,
  RefreshCw,
  Wallet,
  BookOpen,
  TrendingUp,
  Clock,
  Landmark,
  Shield,
  UserCog,
  Coins,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useRBAC } from "@/contexts/rbac-context";

const salesItems = [
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Quotes", url: "/quotes", icon: FileText },
  { title: "Sales Orders", url: "/sales-orders", icon: FileText },
  { title: "Credit Notes", url: "/credit-notes", icon: FileText },
  { title: "Recurring Invoices", url: "/recurring-invoices", icon: RefreshCw },
  { title: "Retainer Invoices", url: "/retainer-invoices", icon: Wallet },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Items", url: "/items", icon: Package },
  { title: "Taxes", url: "/taxes", icon: Percent },
];

const purchasesItems = [
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Bills", url: "/bills", icon: Receipt },
  { title: "Vendors", url: "/vendors", icon: Building2 },
  { title: "Expenses", url: "/expenses", icon: FileText },
];

const paymentsItems = [
  { title: "Vendor Payments", url: "/payments", icon: CreditCard },
  { title: "Customer Payments", url: "/customer-payments", icon: DollarSign },
];

const accountingItems = [
  { title: "Chart of Accounts", url: "/accounts", icon: BookOpen },
  { title: "Journal Entries", url: "/journal-entries", icon: FileText },
  { title: "Fixed Assets", url: "/assets", icon: Package },
  { title: "Bank Reconciliation", url: "/bank-reconciliations", icon: CreditCard },
  { title: "Bank Connections", url: "/bank-connections", icon: Landmark },
  { title: "Financial Reports", url: "/financial-reports", icon: TrendingUp },
  { title: "AR Aging Report", url: "/ar-aging", icon: Clock },
  { title: "AP Aging Report", url: "/ap-aging", icon: Clock },
];

const otherItems = [
  { title: "Documents", url: "/documents", icon: Upload },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Company Profile", url: "/company-profile", icon: Building2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Role Management", url: "/settings/roles", icon: Shield },
  { title: "User Management", url: "/settings/users", icon: UserCog },
  { title: "Currencies", url: "/settings/currencies", icon: Coins },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { hasAnyPermission, hasPermission, isLoading } = useRBAC();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">AccounBooks</span>
            <span className="text-xs text-muted-foreground">AI Accounting</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/"} data-testid="link-dashboard">
                <Link href="/">
                  <LayoutDashboard className="h-5 w-5" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sales</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {salesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Purchases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {purchasesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Payments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {paymentsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Accounting</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {otherItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isLoading && hasPermission('users.manage_roles') && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          Multi-tenant AI Accounting
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
