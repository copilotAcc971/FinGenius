import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem as CommandItemUI,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useLocation } from "wouter";
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
  Settings,
  Upload,
  BarChart3,
  BookOpen,
  TrendingUp,
  Clock,
  Landmark,
  Shield,
  UserCog,
  Coins,
  RefreshCw,
  Wallet,
  CheckCircle,
  Workflow,
  PieChart,
  Search,
  Building2,
} from "lucide-react";

interface NavigationItem {
  id: string;
  label: string;
  icon: any;
  url: string;
  category: string;
  keywords?: string[];
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, url: "/", category: "Overview", keywords: ["home", "overview"] },
  
  { id: "invoices", label: "Invoices", icon: FileText, url: "/invoices", category: "Sales", keywords: ["sales", "billing"] },
  { id: "quotes", label: "Quotes", icon: FileText, url: "/quotes", category: "Sales", keywords: ["sales", "estimate"] },
  { id: "sales-orders", label: "Sales Orders", icon: FileText, url: "/sales-orders", category: "Sales" },
  { id: "credit-notes", label: "Credit Notes", icon: FileText, url: "/credit-notes", category: "Sales" },
  { id: "recurring-invoices", label: "Recurring Invoices", icon: RefreshCw, url: "/recurring-invoices", category: "Sales" },
  { id: "retainer-invoices", label: "Retainer Invoices", icon: Wallet, url: "/retainer-invoices", category: "Sales" },
  { id: "customers", label: "Customers", icon: Users, url: "/customers", category: "Sales", keywords: ["clients"] },
  { id: "items", label: "Items", icon: Package, url: "/items", category: "Sales", keywords: ["products", "services"] },
  { id: "taxes", label: "Taxes", icon: Percent, url: "/taxes", category: "Sales", keywords: ["vat", "gst"] },
  
  { id: "purchase-orders", label: "Purchase Orders", icon: ShoppingCart, url: "/purchase-orders", category: "Purchases" },
  { id: "bills", label: "Bills", icon: Receipt, url: "/bills", category: "Purchases", keywords: ["payables"] },
  { id: "vendors", label: "Vendors", icon: Building2, url: "/vendors", category: "Purchases", keywords: ["suppliers"] },
  { id: "expenses", label: "Expenses", icon: FileText, url: "/expenses", category: "Purchases" },
  
  { id: "vendor-payments", label: "Vendor Payments", icon: CreditCard, url: "/payments", category: "Payments" },
  { id: "customer-payments", label: "Customer Payments", icon: DollarSign, url: "/customer-payments", category: "Payments", keywords: ["receivables"] },
  
  { id: "accounts", label: "Chart of Accounts", icon: BookOpen, url: "/accounts", category: "Accounting", keywords: ["coa"] },
  { id: "journal-entries", label: "Journal Entries", icon: FileText, url: "/journal-entries", category: "Accounting" },
  { id: "approvals", label: "Pending Approvals", icon: CheckCircle, url: "/approvals", category: "Accounting", keywords: ["workflow"] },
  { id: "workflows", label: "Approval Workflows", icon: Workflow, url: "/workflows", category: "Accounting" },
  { id: "account-balances", label: "Account Balances", icon: PieChart, url: "/account-balances", category: "Accounting" },
  { id: "assets", label: "Fixed Assets", icon: Package, url: "/assets", category: "Accounting", keywords: ["depreciation"] },
  { id: "bank-reconciliations", label: "Bank Reconciliation", icon: CreditCard, url: "/bank-reconciliations", category: "Accounting" },
  { id: "bank-connections", label: "Bank Connections", icon: Landmark, url: "/bank-connections", category: "Accounting", keywords: ["open banking"] },
  { id: "financial-reports", label: "Financial Reports", icon: TrendingUp, url: "/financial-reports", category: "Reports", keywords: ["p&l", "balance sheet"] },
  { id: "ar-aging", label: "AR Aging Report", icon: Clock, url: "/ar-aging", category: "Reports", keywords: ["receivables"] },
  { id: "ap-aging", label: "AP Aging Report", icon: Clock, url: "/ap-aging", category: "Reports", keywords: ["payables"] },
  
  { id: "documents", label: "Documents", icon: Upload, url: "/documents", category: "Other" },
  { id: "reports", label: "Reports", icon: BarChart3, url: "/reports", category: "Other" },
  { id: "company-profile", label: "Company Profile", icon: Building2, url: "/company-profile", category: "Settings" },
  { id: "settings", label: "Settings", icon: Settings, url: "/settings", category: "Settings" },
  { id: "role-management", label: "Role Management", icon: Shield, url: "/settings/roles", category: "Administration" },
  { id: "user-management", label: "User Management", icon: UserCog, url: "/settings/users", category: "Administration" },
  { id: "currencies", label: "Currencies", icon: Coins, url: "/settings/currencies", category: "Settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return navigationItems;
    
    const searchLower = search.toLowerCase();
    return navigationItems.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(searchLower);
      const categoryMatch = item.category.toLowerCase().includes(searchLower);
      const keywordMatch = item.keywords?.some(k => k.includes(searchLower));
      return labelMatch || categoryMatch || keywordMatch;
    });
  }, [search]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, NavigationItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setLocation(url);
    setSearch("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, actions, and more..."
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedItems).map(([category, items], index) => (
          <div key={category}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={category}>
              {items.map((item) => (
                <CommandItemUI
                  key={item.id}
                  value={`${item.label} ${item.category} ${item.keywords?.join(" ") || ""}`}
                  onSelect={() => handleSelect(item.url)}
                  data-testid={`command-item-${item.id}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItemUI>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
