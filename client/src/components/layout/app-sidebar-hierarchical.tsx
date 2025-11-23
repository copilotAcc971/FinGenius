import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/shared/components/ui/sidebar';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Landmark,
  Ledger,
  Users,
  Briefcase,
  BarChart3,
  Shield,
  Settings,
  ChevronDown,
  FileText,
  Repeat,
  Calendar,
  FileQuestion,
  ShoppingCart,
  File,
  Clock,
  Receipt,
  Package,
  User,
  DollarSign,
  Wallet,
  CheckSquare,
  Send,
  LayoutList,
  BookOpen,
  Box,
  ArrowUpDown,
  ArchiveX,
} from 'lucide-react';

interface MenuItemConfig {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface MenuSectionConfig {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItemConfig[];
}

const NAVIGATION_MENU: MenuSectionConfig[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/',
  },
  {
    label: 'Income',
    icon: <TrendingUp className="h-5 w-5" />,
    children: [
      {
        label: 'Customers',
        path: '/income/customers',
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: 'Invoices',
        path: '/income/invoices',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'Recurring Invoices',
        path: '/income/recurring-invoices',
        icon: <Repeat className="h-4 w-4" />,
      },
      {
        label: 'Retainer Invoices',
        path: '/income/retainer-invoices',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        label: 'Quotes',
        path: '/income/quotes',
        icon: <FileQuestion className="h-4 w-4" />,
      },
      {
        label: 'Sales Orders',
        path: '/income/sales-orders',
        icon: <ShoppingCart className="h-4 w-4" />,
      },
      {
        label: 'Credit Notes',
        path: '/income/credit-notes',
        icon: <File className="h-4 w-4" />,
      },
      {
        label: 'A/R Aging',
        path: '/income/ar-aging',
        icon: <Clock className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Expenses',
    icon: <TrendingDown className="h-5 w-5" />,
    children: [
      {
        label: 'Vendors',
        path: '/expenses/vendors',
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: 'Bills',
        path: '/expenses/bills',
        icon: <Receipt className="h-4 w-4" />,
      },
      {
        label: 'Purchase Orders',
        path: '/expenses/purchase-orders',
        icon: <Package className="h-4 w-4" />,
      },
      {
        label: 'Employee Expenses',
        path: '/expenses/employee-expenses',
        icon: <User className="h-4 w-4" />,
      },
      {
        label: 'Expenses',
        path: '/expenses/expenses',
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: 'A/P Aging',
        path: '/expenses/ap-aging',
        icon: <Clock className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Banking',
    icon: <Landmark className="h-5 w-5" />,
    children: [
      {
        label: 'Accounts',
        path: '/banking/connections',
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: 'Reconciliation',
        path: '/banking/reconciliations',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        label: 'Consolidated',
        path: '/banking',
        icon: <Send className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Accounting',
    icon: <Ledger className="h-5 w-5" />,
    children: [
      {
        label: 'Chart of Accounts',
        path: '/accounting/accounts',
        icon: <LayoutList className="h-4 w-4" />,
      },
      {
        label: 'Journal Entries',
        path: '/accounting/journal-entries',
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        label: 'Fixed Assets',
        path: '/accounting/fixed-assets',
        icon: <Package className="h-4 w-4" />,
      },
      {
        label: 'Items & Services',
        path: '/accounting/items',
        icon: <Box className="h-4 w-4" />,
      },
      {
        label: 'Stock Adjustments',
        path: '/accounting/stock-adjustments',
        icon: <ArrowUpDown className="h-4 w-4" />,
      },
      {
        label: 'NRV Assessment',
        path: '/accounting/nrv-assessment',
        icon: <TrendingDown className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'People',
    icon: <Users className="h-5 w-5" />,
    children: [
      {
        label: 'Customers',
        path: '/income/customers',
        icon: <User className="h-4 w-4" />,
      },
      {
        label: 'Vendors',
        path: '/expenses/vendors',
        icon: <User className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Projects',
    icon: <Briefcase className="h-5 w-5" />,
    children: [
      {
        label: 'Projects',
        path: '/projects',
        icon: <Briefcase className="h-4 w-4" />,
      },
      {
        label: 'Timesheets',
        path: '/projects/timesheets',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        label: 'Time Tracking',
        path: '/projects/time-tracking',
        icon: <Clock className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      {
        label: 'Financial Statements',
        path: '/reports',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'P&L Statement',
        path: '/reports/profit-loss',
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        label: 'Balance Sheet',
        path: '/reports/balance-sheet',
        icon: <LayoutList className="h-4 w-4" />,
      },
      {
        label: 'Cash Flow',
        path: '/reports/cash-flow',
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: 'Trial Balance',
        path: '/reports/trial-balance',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        label: 'Custom Reports',
        path: '/reports/custom-builder',
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Compliance',
    icon: <Shield className="h-5 w-5" />,
    children: [
      {
        label: 'Dashboard',
        path: '/compliance',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        label: 'KYC Verifications',
        path: '/compliance/kyc',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        label: 'Sanctions Screening',
        path: '/compliance/sanctions',
        icon: <Shield className="h-4 w-4" />,
      },
      {
        label: 'Alerts',
        path: '/compliance/alerts',
        icon: <AlertCircle className="h-4 w-4" />,
      },
      {
        label: 'SAR Reports',
        path: '/compliance/sar',
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    children: [
      {
        label: 'Company Profile',
        path: '/settings',
        icon: <LayoutList className="h-4 w-4" />,
      },
      {
        label: 'Users & Roles',
        path: '/settings/roles',
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: 'Currencies',
        path: '/settings/currencies',
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: 'AI Providers',
        path: '/settings/ai-providers',
        icon: <Briefcase className="h-4 w-4" />,
      },
    ],
  },
];

interface SidebarMenuItemProps {
  item: MenuSectionConfig;
  isActive: boolean;
}

function HierarchicalMenuItem({ item, isActive }: SidebarMenuItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isMobile } = useSidebar();

  if (!item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.path || '/'}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer"
      >
        {item.icon}
        <span>{item.label}</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </SidebarMenuButton>

      {isExpanded && (
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.path}>
              <SidebarMenuSubButton asChild>
                <Link href={child.path}>
                  {child.icon}
                  <span>{child.label}</span>
                  {child.badge && (
                    <span className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {child.badge}
                    </span>
                  )}
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebarHierarchical() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION_MENU.map((item) => {
                const isActive = item.path === location || location.startsWith(item.path || '');
                return (
                  <HierarchicalMenuItem
                    key={item.label}
                    item={item}
                    isActive={isActive}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// Import AlertCircle icon that was missing
import { AlertCircle } from 'lucide-react';
