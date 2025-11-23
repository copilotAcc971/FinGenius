import { useState, useEffect } from "react";
import {
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
  CheckCircle,
  Workflow,
  PieChart,
  Building,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  Calendar,
  FolderKanban,
  ChartBar,
  Bell,
  Inbox,
  Sparkles,
  FileSpreadsheet,
  Calculator,
  TrendingDown,
  CircleDollarSign,
  Briefcase,
  FileCheck,
  UserCircle,
  Scale,
  AlertTriangle,
  FilePlus,
  FileSearch,
  Activity,
  Database,
} from "lucide-react";
import logoImage from "@assets/generated_images/Copilot_Accountant_app_logo_0a4d944c.png";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/shared/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/shared/components/ui/collapsible";
import { Button } from "@/shared/components/ui/button";
import { Link, useLocation } from "wouter";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils/utils";

// Define the navigation structure
interface NavItem {
  title: string;
  url?: string;
  icon: any;
  badge?: number;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  icon: any;
  badge?: number;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Overview", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "Income",
    icon: TrendingUp,
    items: [
      { title: "Invoices", url: "/income/invoices", icon: FileText },
      { title: "Recurring Invoices", url: "/income/recurring-invoices", icon: RefreshCw },
      { title: "Retainer Invoices", url: "/income/retainer-invoices", icon: FileCheck },
      { title: "Customers", url: "/income/customers", icon: Users },
      { title: "Quotes", url: "/income/quotes", icon: FileSpreadsheet },
      { title: "Sales Orders", url: "/income/sales-orders", icon: ShoppingCart },
      { title: "Credit Notes", url: "/income/credit-notes", icon: Receipt },
      { title: "AR Aging", url: "/income/ar-aging", icon: Clock },
    ],
  },
  {
    title: "Expenses",
    icon: TrendingDown,
    items: [
      { title: "Bills", url: "/expenses/bills", icon: Receipt },
      { title: "Vendors", url: "/expenses/vendors", icon: Building },
      { title: "Purchase Orders", url: "/expenses/purchase-orders", icon: ShoppingCart },
      { title: "Employee Expenses", url: "/expenses/employee-expenses", icon: UserCircle },
      { title: "Expenses", url: "/expenses/expenses", icon: DollarSign },
      { title: "AP Aging", url: "/expenses/ap-aging", icon: Clock },
    ],
  },
  {
    title: "Banking",
    icon: Landmark,
    items: [
      { title: "Overview", url: "/banking", icon: Landmark },
      { title: "Bank Connections", url: "/banking/connections", icon: Database },
      { title: "Reconciliations", url: "/banking/reconciliations", icon: CheckCircle },
    ],
  },
  {
    title: "Accounting",
    icon: Calculator,
    items: [
      { title: "Chart of Accounts", url: "/accounting/accounts", icon: BookOpen },
      { title: "Account Balances", url: "/accounting/account-balances", icon: PieChart },
      { title: "Journal Entries", url: "/accounting/journal-entries", icon: FileText },
      { title: "Fixed Assets", url: "/accounting/fixed-assets", icon: Building },
      { title: "Items", url: "/accounting/items", icon: Package },
      { title: "Stock Adjustments", url: "/accounting/stock-adjustments", icon: RefreshCw },
      { title: "Inventory Reports", url: "/accounting/inventory-reports", icon: ChartBar },
      { title: "NRV Assessment", url: "/accounting/nrv-assessment", icon: Activity },
    ],
  },
  {
    title: "People",
    icon: Users,
    items: [
      { title: "User Management", url: "/settings/users", icon: UserCog },
      { title: "Role Management", url: "/settings/roles", icon: Shield },
    ],
  },
  {
    title: "Projects",
    icon: FolderKanban,
    items: [
      { title: "All Projects", url: "/projects", icon: FolderKanban },
      { title: "Timesheets", url: "/projects/timesheets", icon: Calendar },
      { title: "Time Tracking", url: "/projects/time-tracking", icon: Clock },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    items: [
      { title: "Overview", url: "/reports", icon: BarChart3 },
      { title: "Balance Sheet", url: "/reports/balance-sheet", icon: FileBarChart },
      { title: "Profit & Loss", url: "/reports/profit-loss", icon: TrendingUp },
      { title: "Cash Flow", url: "/reports/cash-flow", icon: CircleDollarSign },
      { title: "Trial Balance", url: "/reports/trial-balance", icon: Scale },
      { title: "Chart of Accounts", url: "/reports/chart-of-accounts", icon: BookOpen },
      { title: "Custom Builder", url: "/reports/custom-builder", icon: FilePlus },
      { title: "Project Reports", url: "/reports/projects", icon: FolderKanban },
      { title: "Scheduled Reports", url: "/reports/scheduled", icon: Calendar },
    ],
  },
  {
    title: "Compliance",
    icon: Shield,
    items: [
      { title: "Dashboard", url: "/compliance", icon: Shield },
      { title: "KYC Verifications", url: "/compliance/kyc", icon: UserCog },
      { title: "Sanctions Screening", url: "/compliance/sanctions", icon: FileSearch },
      { title: "Transaction Alerts", url: "/compliance/alerts", icon: Bell },
      { title: "SAR Reports", url: "/compliance/sar", icon: AlertTriangle },
      { title: "Alert Rules", url: "/compliance/rules", icon: Scale },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "General", url: "/settings", icon: Settings },
      { title: "Company Profile", url: "/company-profile", icon: Building },
      { title: "Currencies", url: "/settings/currencies", icon: Coins },
      { title: "AI Providers", url: "/settings/ai-providers", icon: Sparkles },
      { title: "Taxes", url: "/taxes", icon: Percent },
      { title: "Approvals", url: "/approvals", icon: CheckCircle },
      { title: "Workflows", url: "/workflows", icon: Workflow },
      { title: "Audit Logs", url: "/audit-logs", icon: FileBarChart },
    ],
  },
];

// Additional standalone items
const additionalItems: NavItem[] = [
  { title: "Alert Center", url: "/alerts-center", icon: Bell },
  { title: "Credit Passport", url: "/credit-passport", icon: TrendingUp },
  { title: "Inbound Documents", url: "/inbound-documents", icon: Inbox },
  { title: "Documents", url: "/documents", icon: Upload },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

export function AppSidebarHierarchical() {
  const [location] = useLocation();
  const { hasPermission, isLoading } = useRBAC();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Initialize expanded sections based on current route
  useEffect(() => {
    const path = location;
    navigationSections.forEach((section) => {
      const hasActiveChild = section.items.some(item => 
        item.url && (path === item.url || path.startsWith(item.url + '/'))
      );
      if (hasActiveChild) {
        setExpandedSections(prev => new Set([...prev, section.title]));
      }
    });
  }, [location]);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  };

  const isActive = (url?: string) => {
    if (!url) return false;
    return location === url || location.startsWith(url + '/');
  };

  // Filter items based on permissions
  const filterByPermissions = (items: NavItem[]): NavItem[] => {
    if (isLoading) return items;
    
    return items.filter(item => {
      // Admin-only items
      if (item.title === "User Management" || item.title === "Role Management") {
        return hasPermission('users.manage_roles');
      }
      if (item.title === "Audit Logs") {
        return hasPermission('users.manage_roles');
      }
      return true;
    });
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1.5">
            <img src={logoImage} alt="Copilot Accountant" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Copilot Accountant</span>
            <span className="text-xs text-sidebar-foreground/70">AI-Powered Accounting</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {navigationSections.map((section) => {
          const isExpanded = expandedSections.has(section.title);
          const filteredItems = filterByPermissions(section.items);
          
          // Skip rendering if section has no items after filtering
          if (filteredItems.length === 0) return null;
          
          // Dashboard is special case - always visible, not collapsible
          if (section.title === "Dashboard") {
            return (
              <SidebarGroup key={section.title}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive("/")}
                      data-testid="link-dashboard"
                    >
                      <Link href="/">
                        <section.icon className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            );
          }
          
          return (
            <Collapsible
              key={section.title}
              open={isExpanded}
              onOpenChange={() => toggleSection(section.title)}
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel 
                    className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 px-3 py-2 rounded-md transition-colors"
                    data-testid={`button-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      <span>{section.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {section.badge && (
                        <Badge variant="secondary" className="h-5 px-1.5">
                          {section.badge}
                        </Badge>
                      )}
                      {isExpanded ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </div>
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild
                            isActive={isActive(item.url)}
                            className="pl-9"
                            data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <Link href={item.url || "#"}>
                              <item.icon className="h-4 w-4" />
                              <span className="flex-1">{item.title}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="h-5 px-1.5 ml-auto">
                                  {item.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
        
        {/* Additional Items */}
        <SidebarGroup>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterByPermissions(additionalItems).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url || "#"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          © 2025 Copilot Accountant
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}