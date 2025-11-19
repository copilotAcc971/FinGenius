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
  Star,
  StarOff,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  FileSpreadsheet,
  Calendar,
  FolderKanban,
  ChartBar,
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
} from "@/shared/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/shared/components/ui/collapsible";
import { Button } from "@/shared/components/ui/button";
import { Link, useLocation } from "wouter";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { ApprovalBadge } from "@/shared/components/common/approval-badge";
import {
  getFavorites,
  getRecentPages,
  addRecentPage,
  getGroupCollapsedState,
  setGroupCollapsedState,
} from "@/shared/lib/utils/sidebar-storage";

const salesItems = [
  { title: "Sales Transactions", url: "/sales", icon: FileText },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Taxes", url: "/taxes", icon: Percent },
];

const inventoryItems = [
  { title: "Items", url: "/inventory/items", icon: Package },
  { title: "Stock Adjustments", url: "/inventory/adjustments", icon: RefreshCw },
  { title: "Reports", url: "/inventory/reports", icon: ChartBar },
];

const purchasesItems = [
  { title: "Purchase Transactions", url: "/purchases", icon: ShoppingCart },
  { title: "Vendors", url: "/vendors", icon: Building },
];

const paymentsItems = [
  { title: "Payments", url: "/payments", icon: CreditCard },
];

const projectsItems = [
  { title: "Projects & Time Tracking", url: "/projects", icon: FolderKanban },
];

const accountingItems = [
  { title: "Chart of Accounts", url: "/accounts", icon: BookOpen },
  { title: "Journal Entries", url: "/journal-entries", icon: FileText },
  { title: "Approvals", url: "/approvals", icon: CheckCircle },
  { title: "Account Balances", url: "/account-balances", icon: PieChart },
  { title: "Fixed Assets", url: "/assets", icon: Package },
  { title: "Banking", url: "/banking", icon: Landmark },
  { title: "Employee Expenses", url: "/employee-expenses", icon: Receipt },
];

const otherItems = [
  { title: "Documents", url: "/documents", icon: Upload },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Company Profile", url: "/company-profile", icon: Building },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Role Management", url: "/settings/roles", icon: Shield },
  { title: "User Management", url: "/settings/users", icon: UserCog },
  { title: "Currencies", url: "/settings/currencies", icon: Coins },
  { title: "Audit Logs", url: "/audit-logs", icon: FileBarChart },
];

// Helper to get icon name from component for storage
function getIconName(IconComponent: any): string {
  const iconMap: Record<string, string> = {
    [FileText.name]: "FileText",
    [Users.name]: "Users",
    [Package.name]: "Package",
    [Percent.name]: "Percent",
    [Receipt.name]: "Receipt",
    [ShoppingCart.name]: "ShoppingCart",
    [CreditCard.name]: "CreditCard",
    [DollarSign.name]: "DollarSign",
    [RefreshCw.name]: "RefreshCw",
    [Wallet.name]: "Wallet",
    [BookOpen.name]: "BookOpen",
    [CheckCircle.name]: "CheckCircle",
    [Workflow.name]: "Workflow",
    [PieChart.name]: "PieChart",
    [Landmark.name]: "Landmark",
    [TrendingUp.name]: "TrendingUp",
    [Clock.name]: "Clock",
    [Upload.name]: "Upload",
    [BarChart3.name]: "BarChart3",
    [Building.name]: "Building",
    [Settings.name]: "Settings",
    [Shield.name]: "Shield",
    [UserCog.name]: "UserCog",
    [Coins.name]: "Coins",
    [FileBarChart.name]: "FileBarChart",
    [FileSpreadsheet.name]: "FileSpreadsheet",
    [Calendar.name]: "Calendar",
    [FolderKanban.name]: "FolderKanban",
    [ChartBar.name]: "ChartBar",
  };
  return iconMap[IconComponent.name] || "FileText";
}

// Combine all navigation items for favorites/recent lookup
const allMenuItems = [
  ...salesItems,
  ...inventoryItems,
  ...purchasesItems,
  ...paymentsItems,
  ...projectsItems,
  ...accountingItems,
  ...otherItems,
  ...adminItems,
];

export function AppSidebar() {
  const [location] = useLocation();
  const { hasAnyPermission, hasPermission, isLoading } = useRBAC();

  // State for favorites and recent pages - initialize with data from localStorage
  const [favorites, setFavorites] = useState<string[]>(getFavorites());
  const [recentPages, setRecentPages] = useState(getRecentPages());

  // Consolidated state for collapsed groups using Record
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    favorites: getGroupCollapsedState("favorites"),
    recent: getGroupCollapsedState("recent"),
    sales: getGroupCollapsedState("sales"),
    inventory: getGroupCollapsedState("inventory"),
    purchases: getGroupCollapsedState("purchases"),
    payments: getGroupCollapsedState("payments"),
    projects: getGroupCollapsedState("projects"),
    accounting: getGroupCollapsedState("accounting"),
    administration: getGroupCollapsedState("administration"),
  });

  // Track route changes and update recent pages
  useEffect(() => {
    if (location && location !== "/") {
      const item = allMenuItems.find(i => i.url === location);
      if (item) {
        addRecentPage({
          title: item.title,
          url: item.url,
          icon: getIconName(item.icon),
        });
        setRecentPages(getRecentPages());
      }
    }
  }, [location]);

  // Handler to toggle favorites - updates both localStorage AND React state
  const handleToggleFavorite = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setFavorites(prev => {
      const newFavorites = prev.includes(url)
        ? prev.filter(fav => fav !== url)
        : [...prev, url];
      
      // Update localStorage
      localStorage.setItem('sidebar-favorites', JSON.stringify(newFavorites));
      
      return newFavorites;
    });
  };

  // Handler for group collapse - updates both localStorage and state
  const handleGroupToggle = (groupName: string, isOpen: boolean) => {
    const newCollapsed = !isOpen;
    setGroupCollapsedState(groupName, newCollapsed);
    setCollapsed(prev => ({ ...prev, [groupName]: newCollapsed }));
  };

  // Helper function to filter items by RBAC permissions
  const filterItemsByPermission = (items: typeof allMenuItems) => {
    if (isLoading) return items;
    
    return items.filter(item => {
      // Check if item is an admin item
      const isAdminItem = adminItems.some(adminItem => adminItem.url === item.url);
      
      // If it's an admin item, check permission
      if (isAdminItem) {
        return hasPermission('users.manage_roles');
      }
      
      // Non-admin items are always allowed
      return true;
    });
  };

  // Get favorite items with RBAC filtering
  const favoriteItems = filterItemsByPermission(
    allMenuItems.filter(item => favorites.includes(item.url))
  );

  // Get recent pages with RBAC filtering
  const filteredRecentPages = recentPages.filter(page => {
    const item = allMenuItems.find(i => i.url === page.url);
    if (!item) return false;
    
    const isAdminItem = adminItems.some(adminItem => adminItem.url === item.url);
    if (isAdminItem && !isLoading) {
      return hasPermission('users.manage_roles');
    }
    
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
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
        {/* Dashboard - Always visible */}
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

        {/* Favorites Section */}
        <Collapsible open={!collapsed.favorites} onOpenChange={(open) => handleGroupToggle("favorites", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-favorites">
                <span>Favorites</span>
                {collapsed.favorites ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {favoriteItems.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground" data-testid="text-no-favorites">
                    No favorites yet. Click the star icon to add pages.
                  </div>
                ) : (
                  <SidebarMenu>
                    {favoriteItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <div className="flex items-center w-full gap-1">
                          <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                            <Link href={item.url}>
                              <item.icon className="h-5 w-5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => handleToggleFavorite(item.url, e)}
                            data-testid={`button-unfavorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <Star className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                        {item.title === "Approvals" && <ApprovalBadge />}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Recent Section */}
        <Collapsible open={!collapsed.recent} onOpenChange={(open) => handleGroupToggle("recent", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-recent">
                <span>Recent</span>
                {collapsed.recent ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {filteredRecentPages.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground" data-testid="text-no-recent">
                    No recent pages yet.
                  </div>
                ) : (
                  <SidebarMenu>
                    {filteredRecentPages.map((page) => {
                      const item = allMenuItems.find(i => i.url === page.url);
                      if (!item) return null;
                      return (
                        <SidebarMenuItem key={page.url}>
                          <div className="flex items-center w-full gap-1">
                            <SidebarMenuButton asChild isActive={location === page.url} className="flex-1" data-testid={`link-recent-${page.title.toLowerCase().replace(/\s+/g, '-')}`}>
                              <Link href={page.url}>
                                <item.icon className="h-5 w-5" />
                                <span>{page.title}</span>
                              </Link>
                            </SidebarMenuButton>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => handleToggleFavorite(page.url, e)}
                              data-testid={`button-favorite-${page.title.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {favorites.includes(page.url) ? (
                                <Star className="h-4 w-4 fill-current" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {page.title === "Approvals" && <ApprovalBadge />}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Sales Section */}
        <Collapsible open={!collapsed.sales} onOpenChange={(open) => handleGroupToggle("sales", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-sales">
                <span>Sales</span>
                {collapsed.sales ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {salesItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Inventory Section */}
        <Collapsible open={!collapsed.inventory} onOpenChange={(open) => handleGroupToggle("inventory", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-inventory">
                <span>Inventory</span>
                {collapsed.inventory ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {inventoryItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Purchases Section */}
        <Collapsible open={!collapsed.purchases} onOpenChange={(open) => handleGroupToggle("purchases", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-purchases">
                <span>Purchases</span>
                {collapsed.purchases ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {purchasesItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Payments Section */}
        <Collapsible open={!collapsed.payments} onOpenChange={(open) => handleGroupToggle("payments", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-payments">
                <span>Payments</span>
                {collapsed.payments ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {paymentsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Projects Section */}
        <Collapsible open={!collapsed.projects} onOpenChange={(open) => handleGroupToggle("projects", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-projects">
                <span>Projects</span>
                {collapsed.projects ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Accounting Section */}
        <Collapsible open={!collapsed.accounting} onOpenChange={(open) => handleGroupToggle("accounting", open)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-accounting">
                <span>Accounting</span>
                {collapsed.accounting ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {accountingItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center w-full gap-1">
                        <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <Link href={item.url}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => handleToggleFavorite(item.url, e)}
                          data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {favorites.includes(item.url) ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {item.title === "Approvals" && <ApprovalBadge />}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Other Items Section (No label, just items with star buttons) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {otherItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <div className="flex items-center w-full gap-1">
                    <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleToggleFavorite(item.url, e)}
                      data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {favorites.includes(item.url) ? (
                        <Star className="h-4 w-4 fill-current" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Administration Section - RBAC protected */}
        {!isLoading && hasPermission('users.manage_roles') && (
          <Collapsible open={!collapsed.administration} onOpenChange={(open) => handleGroupToggle("administration", open)}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover-elevate" data-testid="button-collapse-administration">
                  <span>Administration</span>
                  {collapsed.administration ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <div className="flex items-center w-full gap-1">
                          <SidebarMenuButton asChild isActive={location === item.url} className="flex-1" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                            <Link href={item.url}>
                              <item.icon className="h-5 w-5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => handleToggleFavorite(item.url, e)}
                            data-testid={`button-favorite-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {favorites.includes(item.url) ? (
                              <Star className="h-4 w-4 fill-current" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
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
