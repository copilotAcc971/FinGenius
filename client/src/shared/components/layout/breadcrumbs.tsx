import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTenant } from "@/shared/hooks/useTenant";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeMap: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/vendors": "Vendors",
  "/items": "Items",
  "/taxes": "Taxes",
  "/accounts": "Chart of Accounts",
  "/account-balances": "Account Balances",
  "/journal-entries": "Journal Entries",
  "/approvals": "Pending Approvals",
  "/workflows": "Approval Workflows",
  "/assets": "Fixed Assets",
  "/bank-reconciliations": "Bank Reconciliation",
  "/bank-connections": "Bank Connections",
  "/invoices": "Invoices",
  "/quotes": "Quotes",
  "/sales-orders": "Sales Orders",
  "/credit-notes": "Credit Notes",
  "/recurring-invoices": "Recurring Invoices",
  "/retainer-invoices": "Retainer Invoices",
  "/bills": "Bills",
  "/purchase-orders": "Purchase Orders",
  "/expenses": "Expenses",
  "/employee-expenses": "Employee Expenses",
  "/payments": "Vendor Payments",
  "/customer-payments": "Customer Payments",
  "/documents": "Documents",
  "/reports": "Reports",
  "/financial-reports": "Financial Reports",
  "/ar-aging": "AR Aging Report",
  "/ap-aging": "AP Aging Report",
  "/company-profile": "Company Profile",
  "/settings": "Settings",
  "/settings/roles": "Role Management",
  "/settings/users": "User Management",
  "/settings/currencies": "Currencies",
};

export function Breadcrumbs() {
  const [location] = useLocation();
  const { currentTenant } = useTenant();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];
    
    if (currentTenant) {
      breadcrumbs.push({ label: currentTenant.name });
    }

    if (location === "/") {
      breadcrumbs.push({ label: "Dashboard" });
      return breadcrumbs;
    }

    const pathParts = location.split("/").filter(Boolean);
    let currentPath = "";

    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      const label = routeMap[currentPath] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
      
      if (index === pathParts.length - 1) {
        breadcrumbs.push({ label });
      } else {
        breadcrumbs.push({ label, href: currentPath });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground" data-testid="breadcrumbs">
      <Link href="/" className="hover-elevate rounded-md p-1.5 transition-colors hover:text-foreground" data-testid="breadcrumb-home">
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1" />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover-elevate rounded-md px-2 py-1 transition-colors hover:text-foreground"
              data-testid={`breadcrumb-${index}`}
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="px-2 py-1 font-medium text-foreground" data-testid={`breadcrumb-current`}>
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
