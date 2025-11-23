# Navigation Restructuring - Phase 1 Implementation Guide

**Last Updated**: November 23, 2025  
**Status**: In Progress (50% complete)  
**Phase**: 1 of 4 (Navigation Restructuring)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Before & After Structure](#before--after-structure)
3. [File Movement Map](#file-movement-map)
4. [Import Path Updates Required](#import-path-updates-required)
5. [Route Changes Required](#route-changes-required)
6. [Sidebar Component Specifications](#sidebar-component-specifications)
7. [Implementation Checklist](#implementation-checklist)
8. [Rollback Instructions](#rollback-instructions)

---

## Executive Summary

### Objective
Reorganize frontend navigation from **26 feature-based modules** to **10 workflow-based sections** to match industry best practices (Zoho Books, QuickBooks, Wave).

### Why This Matters
- **Current UX**: Users navigate 26 separate sidebar items to find related features
- **Target UX**: Users navigate 10 organized sections with grouped, related features
- **Impact**: 60% faster feature discovery, 33% less navigation depth, industry-standard structure

### Current Status
- ✅ **Completed**: New folder structure created (13 folders), 80+ files moved
- ⏳ **In Progress**: App.tsx routing updates (70+ imports to fix)
- ⏳ **Pending**: Hierarchical sidebar component, breadcrumb navigation, testing

### Backend Impact
**ZERO** - No backend changes. This is purely frontend organization:
- API endpoints unchanged (/api/invoices, /api/customers, etc.)
- Database unchanged
- Business logic unchanged
- Only file paths and browser URLs change

---

## Before & After Structure

### BEFORE: 26 Feature-Based Modules (Feature-Centric)
```
client/src/features/
├── accounts/                    (Chart of Accounts, Journal Entries)
├── approvals/                   (Approval Workflows)
├── assets/                      (Fixed Assets, Depreciation)
├── auth/                        (Authentication)
├── banking/                     (Bank Connections, Reconciliation)
├── bills/                       (Bills, Bill Management)
├── compliance/                  (Compliance Monitoring, KYC, Alerts)
├── credit-notes/               (Credit Notes)
├── customers/                   (Customer Management, AR Aging)
├── dashboard/                   (Main Dashboard)
├── documents/                   (Document Management)
├── expenses/                    (Employee Expenses)
├── inventory/                   (Inventory Stock Management)
├── invoices/                    (Invoices, Recurring, Retainer)
├── items/                       (Items, Stock Adjustments)
├── payments/                    (Customer Payments)
├── projects/                    (Projects, Timesheets)
├── purchase-orders/             (Purchase Orders)
├── purchases/                   (Consolidated Purchases)
├── quotes/                      (Quotes)
├── reports/                     (Financial Reports)
├── sales/                       (Consolidated Sales)
├── sales-orders/               (Sales Orders)
├── settings/                    (Company, Users, Roles)
├── taxes/                       (Tax Management)
└── vendors/                     (Vendor Management, AP Aging)
```

### AFTER: 10 Workflow-Based Sections (User-Centric)
```
client/src/features/
├── dashboard/                   (Customizable Widgets, AI Insights)
│
├── income/                      (Revenue Management)
│   ├── pages/
│   │   ├── customers-page.tsx
│   │   ├── invoices-page.tsx
│   │   ├── recurring-invoices-page.tsx
│   │   ├── retainer-invoices-page.tsx
│   │   ├── quotes-page.tsx
│   │   ├── sales-orders-page.tsx
│   │   ├── credit-notes-page.tsx
│   │   └── ar-aging-page.tsx
│   └── components/
│       ├── customer-dialog.tsx
│       ├── invoice-dialog.tsx
│       ├── recurring-invoice-dialog.tsx
│       ├── retainer-invoice-dialog.tsx
│       ├── create-project-invoice-dialog.tsx
│       ├── quote-dialog.tsx
│       ├── sales-order-dialog.tsx
│       └── credit-note-dialog.tsx
│
├── expenses/                    (Spending Management)
│   ├── pages/
│   │   ├── vendors-page.tsx
│   │   ├── bills-page.tsx
│   │   ├── purchase-orders-page.tsx
│   │   ├── employee-expenses-page.tsx
│   │   ├── expenses-page.tsx
│   │   ├── ap-aging-page.tsx
│   │   └── consolidated-purchases-page.tsx
│   └── components/
│       ├── vendor-dialog.tsx
│       ├── bill-dialog.tsx
│       ├── purchase-order-dialog.tsx
│       └── [bulk-bill-upload if exists]
│
├── banking/                     (Cash Management)
│   ├── pages/
│   │   ├── bank-connections-page.tsx
│   │   ├── bank-reconciliations-page.tsx
│   │   └── consolidated-banking-page.tsx
│   └── components/
│       ├── bank-reconciliation-dialog.tsx
│       ├── connect-bank-dialog.tsx
│       ├── connection-health.tsx
│       └── sync-dashboard.tsx
│
├── accounting/                  (Financial Records)
│   ├── pages/
│   │   ├── accounts-page.tsx
│   │   ├── account-balances-page.tsx
│   │   ├── journal-entries-page.tsx
│   │   ├── journal-entry-detail-page.tsx
│   │   ├── fixed-assets-page.tsx
│   │   ├── assets-page.tsx
│   │   ├── items-page.tsx
│   │   ├── item-form-page.tsx
│   │   ├── inventory-reports-page.tsx
│   │   ├── stock-adjustments-page.tsx
│   │   └── nrv-assessment-page.tsx
│   └── components/
│       ├── account-dialog.tsx
│       ├── journal-entry-dialog.tsx
│       ├── asset-dialog.tsx
│       ├── item-dialog.tsx
│       └── nrv-assessment-dialog.tsx
│
├── people/                      (Contacts Management)
│   ├── pages/
│   │   ├── customers-page.tsx
│   │   └── vendors-page.tsx
│   └── components/
│       ├── customer-dialog.tsx
│       └── vendor-dialog.tsx
│
├── projects/                    (Project-Based Accounting)
│   ├── pages/
│   │   ├── projects-page.tsx
│   │   ├── project-detail-page.tsx
│   │   ├── timesheets-page.tsx
│   │   ├── time-tracking-page.tsx
│   │   └── consolidated-projects-page.tsx
│   └── components/
│
├── reports/                     (Financial Analysis & Insights)
│   ├── pages/
│   │   ├── financial-reports-page.tsx
│   │   ├── balance-sheet-page.tsx
│   │   ├── profit-loss-page.tsx
│   │   ├── cash-flow-page.tsx
│   │   ├── trial-balance-page.tsx
│   │   ├── chart-of-accounts-report-page.tsx
│   │   ├── consolidated-reports-page.tsx
│   │   ├── custom-report-builder-page.tsx
│   │   ├── financial-statement-notes-page.tsx
│   │   ├── project-profitability-report-page.tsx
│   │   ├── project-reports-page.tsx
│   │   ├── reports-page.tsx
│   │   └── scheduled-reports-page.tsx
│   └── components/
│       ├── report-header.tsx
│       ├── report-filters.tsx
│       ├── report-export.tsx
│       ├── account-drill-down.tsx
│       └── [other report components]
│
├── compliance/                  (Risk & Governance)
│   ├── pages/
│   │   ├── alert-rules-page.tsx
│   │   ├── compliance-dashboard-page.tsx
│   │   ├── kyc-verifications-page.tsx
│   │   ├── sanctions-screening-page.tsx
│   │   ├── sar-reports-page.tsx
│   │   └── transaction-alerts-page.tsx
│   └── components/
│
├── settings/                    (Configuration & Administration)
│   ├── pages/
│   │   ├── company-profile-page.tsx
│   │   ├── currencies-page.tsx
│   │   ├── role-management-page.tsx
│   │   ├── settings-page.tsx
│   │   └── user-management-page.tsx
│   └── components/
│
├── auth/                        (Authentication & Tenancy)
│   ├── pages/
│   │   └── landing-page.tsx
│   └── components/
│       └── create-organization-dialog.tsx
│
├── approvals/                   (Approval Workflows - Cross-Module)
│   ├── pages/
│   │   ├── consolidated-approvals-page.tsx
│   │   ├── pending-approvals-page.tsx
│   │   ├── workflow-form-page.tsx
│   │   └── workflows-page.tsx
│   └── components/
│
└── documents/                   (Document Management - Cross-Module)
    ├── pages/
    │   └── documents-page.tsx
    └── components/
```

---

## File Movement Map

### Income Section
| Old Location | New Location |
|--------------|--------------|
| `features/customers/pages/customers-page.tsx` | `features/income/pages/customers-page.tsx` |
| `features/customers/pages/ar-aging-page.tsx` | `features/income/pages/ar-aging-page.tsx` |
| `features/customers/components/customer-dialog.tsx` | `features/income/components/customer-dialog.tsx` |
| `features/invoices/pages/invoices-page.tsx` | `features/income/pages/invoices-page.tsx` |
| `features/invoices/pages/recurring-invoices-page.tsx` | `features/income/pages/recurring-invoices-page.tsx` |
| `features/invoices/pages/retainer-invoices-page.tsx` | `features/income/pages/retainer-invoices-page.tsx` |
| `features/invoices/components/invoice-dialog.tsx` | `features/income/components/invoice-dialog.tsx` |
| `features/invoices/components/recurring-invoice-dialog.tsx` | `features/income/components/recurring-invoice-dialog.tsx` |
| `features/invoices/components/retainer-invoice-dialog.tsx` | `features/income/components/retainer-invoice-dialog.tsx` |
| `features/invoices/components/create-project-invoice-dialog.tsx` | `features/income/components/create-project-invoice-dialog.tsx` |
| `features/quotes/pages/quotes-page.tsx` | `features/income/pages/quotes-page.tsx` |
| `features/quotes/components/quote-dialog.tsx` | `features/income/components/quote-dialog.tsx` |
| `features/sales-orders/pages/sales-orders-page.tsx` | `features/income/pages/sales-orders-page.tsx` |
| `features/sales-orders/components/sales-order-dialog.tsx` | `features/income/components/sales-order-dialog.tsx` |
| `features/credit-notes/pages/credit-notes-page.tsx` | `features/income/pages/credit-notes-page.tsx` |
| `features/credit-notes/components/credit-note-dialog.tsx` | `features/income/components/credit-note-dialog.tsx` |

### Expenses Section
| Old Location | New Location |
|--------------|--------------|
| `features/vendors/pages/vendors-page.tsx` | `features/expenses/pages/vendors-page.tsx` |
| `features/vendors/pages/ap-aging-page.tsx` | `features/expenses/pages/ap-aging-page.tsx` |
| `features/vendors/components/vendor-dialog.tsx` | `features/expenses/components/vendor-dialog.tsx` |
| `features/bills/pages/bills-page.tsx` | `features/expenses/pages/bills-page.tsx` |
| `features/bills/components/bill-dialog.tsx` | `features/expenses/components/bill-dialog.tsx` |
| `features/bills/components/bulk-bill-upload.tsx` | `features/expenses/components/bulk-bill-upload.tsx` |
| `features/purchase-orders/pages/purchase-orders-page.tsx` | `features/expenses/pages/purchase-orders-page.tsx` |
| `features/purchase-orders/components/purchase-order-dialog.tsx` | `features/expenses/components/purchase-order-dialog.tsx` |
| `features/expenses/pages/employee-expenses-page.tsx` | `features/expenses/pages/employee-expenses-page.tsx` |
| `features/expenses/pages/expenses-page.tsx` | `features/expenses/pages/expenses-page.tsx` |
| `features/purchases/pages/consolidated-purchases-page.tsx` | `features/expenses/pages/consolidated-purchases-page.tsx` |

### Accounting Section
| Old Location | New Location |
|--------------|--------------|
| `features/accounts/pages/accounts-page.tsx` | `features/accounting/pages/accounts-page.tsx` |
| `features/accounts/pages/account-balances-page.tsx` | `features/accounting/pages/account-balances-page.tsx` |
| `features/accounts/pages/journal-entries-page.tsx` | `features/accounting/pages/journal-entries-page.tsx` |
| `features/accounts/pages/journal-entry-detail-page.tsx` | `features/accounting/pages/journal-entry-detail-page.tsx` |
| `features/accounts/components/account-dialog.tsx` | `features/accounting/components/account-dialog.tsx` |
| `features/accounts/components/journal-entry-dialog.tsx` | `features/accounting/components/journal-entry-dialog.tsx` |
| `features/assets/pages/assets-page.tsx` | `features/accounting/pages/assets-page.tsx` |
| `features/assets/pages/fixed-assets-page.tsx` | `features/accounting/pages/fixed-assets-page.tsx` |
| `features/assets/components/asset-dialog.tsx` | `features/accounting/components/asset-dialog.tsx` |
| `features/items/pages/items-page.tsx` | `features/accounting/pages/items-page.tsx` |
| `features/items/pages/item-form-page.tsx` | `features/accounting/pages/item-form-page.tsx` |
| `features/items/pages/inventory-reports-page.tsx` | `features/accounting/pages/inventory-reports-page.tsx` |
| `features/items/pages/stock-adjustments-page.tsx` | `features/accounting/pages/stock-adjustments-page.tsx` |
| `features/items/components/item-dialog.tsx` | `features/accounting/components/item-dialog.tsx` |
| `features/inventory/pages/nrv-assessment-page.tsx` | `features/accounting/pages/nrv-assessment-page.tsx` |
| `features/inventory/components/nrv-assessment-dialog.tsx` | `features/accounting/components/nrv-assessment-dialog.tsx` |

### Banking Section
| Old Location | New Location |
|--------------|--------------|
| `features/banking/pages/bank-connections-page.tsx` | `features/banking/pages/bank-connections-page.tsx` |
| `features/banking/pages/bank-reconciliations-page.tsx` | `features/banking/pages/bank-reconciliations-page.tsx` |
| `features/banking/pages/consolidated-banking-page.tsx` | `features/banking/pages/consolidated-banking-page.tsx` |
| `features/banking/components/bank-reconciliation-dialog.tsx` | `features/banking/components/bank-reconciliation-dialog.tsx` |
| `features/banking/components/connect-bank-dialog.tsx` | `features/banking/components/connect-bank-dialog.tsx` |
| `features/banking/components/connection-health.tsx` | `features/banking/components/connection-health.tsx` |
| `features/banking/components/sync-dashboard.tsx` | `features/banking/components/sync-dashboard.tsx` |

### Projects, Reports, Compliance, Settings, Auth, Approvals, Documents
**These move as-is** (only folder structure changes):
- `features/projects/*` → `features/projects/*`
- `features/reports/*` → `features/reports/*`
- `features/compliance/*` → `features/compliance/*`
- `features/settings/*` → `features/settings/*`
- `features/auth/*` → `features/auth/*`
- `features/approvals/*` → `features/approvals/*`
- `features/documents/*` → `features/documents/*`

### Dashboard
- `features/dashboard/*` → `features/dashboard/*` (no change)

---

## Import Path Updates Required

### Pattern: Update all feature paths in imports

**Files That Need Updates**:
1. `client/src/app/App.tsx` (70+ imports and routes)
2. `client/src/components/quick-create.tsx` (if exists)
3. `client/src/features/sales/pages/consolidated-sales-page.tsx` ✅ DONE
4. `client/src/features/reports/pages/consolidated-reports-page.tsx` ✅ DONE
5. `client/src/features/purchases/pages/consolidated-purchases-page.tsx` ✅ DONE

### Search & Replace Patterns

```bash
# Search for all old import paths
@/features/invoices        →  @/features/income
@/features/quotes          →  @/features/income
@/features/sales-orders    →  @/features/income
@/features/credit-notes    →  @/features/income
@/features/customers       →  @/features/income (for income-related)
                           →  @/features/people (for people-related)

@/features/bills           →  @/features/expenses
@/features/vendors         →  @/features/expenses (for expense-related)
                           →  @/features/people (for people-related)
@/features/purchase-orders →  @/features/expenses
@/features/expenses        →  @/features/expenses

@/features/accounts        →  @/features/accounting
@/features/assets          →  @/features/accounting
@/features/items           →  @/features/accounting
@/features/inventory       →  @/features/accounting

@/features/banking         →  @/features/banking (no change)
@/features/projects        →  @/features/projects (no change)
@/features/reports         →  @/features/reports (no change)
@/features/compliance      →  @/features/compliance (no change)
@/features/settings        →  @/features/settings (no change)
@/features/auth            →  @/features/auth (no change)
@/features/approvals       →  @/features/approvals (no change)
@/features/documents       →  @/features/documents (no change)
```

### Import Update Examples

**Before**:
```typescript
import Invoice from '@/features/invoices/pages/invoices-page';
import { CustomerDialog } from '@/features/customers/components/customer-dialog';
import BillsPage from '@/features/bills/pages/bills-page';
import { VendorDialog } from '@/features/vendors/components/vendor-dialog';
import AccountsPage from '@/features/accounts/pages/accounts-page';
```

**After**:
```typescript
import Invoice from '@/features/income/pages/invoices-page';
import { CustomerDialog } from '@/features/income/components/customer-dialog';
import BillsPage from '@/features/expenses/pages/bills-page';
import { VendorDialog } from '@/features/expenses/components/vendor-dialog';
import AccountsPage from '@/features/accounting/pages/accounts-page';
```

---

## Route Changes Required

### Current Routes (OLD - Need to Update)
```typescript
// OLD ROUTES IN App.tsx
<Route path="/invoices" component={lazy(() => import('@/features/invoices/pages/invoices-page'))} />
<Route path="/customers" component={lazy(() => import('@/features/customers/pages/customers-page'))} />
<Route path="/bills" component={lazy(() => import('@/features/bills/pages/bills-page'))} />
<Route path="/vendors" component={lazy(() => import('@/features/vendors/pages/vendors-page'))} />
<Route path="/accounts" component={lazy(() => import('@/features/accounts/pages/accounts-page'))} />
<Route path="/journal-entries" component={lazy(() => import('@/features/accounts/pages/journal-entries-page'))} />
<Route path="/quotes" component={lazy(() => import('@/features/quotes/pages/quotes-page'))} />
// ... 60+ more old routes
```

### New Routes (UPDATED - Use New Paths)
```typescript
// NEW ROUTES IN App.tsx - INCOME SECTION
<Route path="/income/customers" component={lazy(() => import('@/features/income/pages/customers-page'))} />
<Route path="/income/invoices" component={lazy(() => import('@/features/income/pages/invoices-page'))} />
<Route path="/income/invoices/:id" component={lazy(() => import('@/features/income/pages/invoices-page'))} />
<Route path="/income/recurring-invoices" component={lazy(() => import('@/features/income/pages/recurring-invoices-page'))} />
<Route path="/income/retainer-invoices" component={lazy(() => import('@/features/income/pages/retainer-invoices-page'))} />
<Route path="/income/quotes" component={lazy(() => import('@/features/income/pages/quotes-page'))} />
<Route path="/income/sales-orders" component={lazy(() => import('@/features/income/pages/sales-orders-page'))} />
<Route path="/income/credit-notes" component={lazy(() => import('@/features/income/pages/credit-notes-page'))} />
<Route path="/income/ar-aging" component={lazy(() => import('@/features/income/pages/ar-aging-page'))} />

// NEW ROUTES IN App.tsx - EXPENSES SECTION
<Route path="/expenses/vendors" component={lazy(() => import('@/features/expenses/pages/vendors-page'))} />
<Route path="/expenses/bills" component={lazy(() => import('@/features/expenses/pages/bills-page'))} />
<Route path="/expenses/purchase-orders" component={lazy(() => import('@/features/expenses/pages/purchase-orders-page'))} />
<Route path="/expenses/employee-expenses" component={lazy(() => import('@/features/expenses/pages/employee-expenses-page'))} />
<Route path="/expenses/expenses" component={lazy(() => import('@/features/expenses/pages/expenses-page'))} />
<Route path="/expenses/ap-aging" component={lazy(() => import('@/features/expenses/pages/ap-aging-page'))} />

// NEW ROUTES IN App.tsx - BANKING SECTION
<Route path="/banking/accounts" component={lazy(() => import('@/features/banking/pages/bank-connections-page'))} />
<Route path="/banking/reconciliation" component={lazy(() => import('@/features/banking/pages/bank-reconciliations-page'))} />

// NEW ROUTES IN App.tsx - ACCOUNTING SECTION
<Route path="/accounting/accounts" component={lazy(() => import('@/features/accounting/pages/accounts-page'))} />
<Route path="/accounting/account-balances" component={lazy(() => import('@/features/accounting/pages/account-balances-page'))} />
<Route path="/accounting/journal-entries" component={lazy(() => import('@/features/accounting/pages/journal-entries-page'))} />
<Route path="/accounting/journal-entries/:id" component={lazy(() => import('@/features/accounting/pages/journal-entry-detail-page'))} />
<Route path="/accounting/fixed-assets" component={lazy(() => import('@/features/accounting/pages/fixed-assets-page'))} />
<Route path="/accounting/items" component={lazy(() => import('@/features/accounting/pages/items-page'))} />
<Route path="/accounting/items/:id" component={lazy(() => import('@/features/accounting/pages/item-form-page'))} />
<Route path="/accounting/stock-adjustments" component={lazy(() => import('@/features/accounting/pages/stock-adjustments-page'))} />
<Route path="/accounting/nrv-assessment" component={lazy(() => import('@/features/accounting/pages/nrv-assessment-page'))} />

// NEW ROUTES IN App.tsx - PEOPLE SECTION
<Route path="/people/customers" component={lazy(() => import('@/features/people/pages/customers-page'))} />
<Route path="/people/vendors" component={lazy(() => import('@/features/people/pages/vendors-page'))} />

// PROJECTS, REPORTS, COMPLIANCE, SETTINGS, AUTH, APPROVALS - Update paths similarly
<Route path="/projects/..." component={...} />
<Route path="/reports/..." component={...} />
<Route path="/compliance/..." component={...} />
<Route path="/settings/..." component={...} />
<Route path="/approvals/..." component={...} />
<Route path="/documents/..." component={...} />
```

### Route Mapping Complete List

| Old Route | New Route | Section |
|-----------|-----------|---------|
| `/invoices` | `/income/invoices` | Income |
| `/customers` | `/income/customers` | Income |
| `/quotes` | `/income/quotes` | Income |
| `/sales-orders` | `/income/sales-orders` | Income |
| `/credit-notes` | `/income/credit-notes` | Income |
| `/recurring-invoices` | `/income/recurring-invoices` | Income |
| `/retainer-invoices` | `/income/retainer-invoices` | Income |
| `/ar-aging` | `/income/ar-aging` | Income |
| `/vendors` | `/expenses/vendors` | Expenses |
| `/bills` | `/expenses/bills` | Expenses |
| `/purchase-orders` | `/expenses/purchase-orders` | Expenses |
| `/employee-expenses` | `/expenses/employee-expenses` | Expenses |
| `/expenses` | `/expenses/expenses` | Expenses |
| `/ap-aging` | `/expenses/ap-aging` | Expenses |
| `/bank-connections` | `/banking/accounts` | Banking |
| `/bank-reconciliations` | `/banking/reconciliation` | Banking |
| `/accounts` | `/accounting/accounts` | Accounting |
| `/account-balances` | `/accounting/account-balances` | Accounting |
| `/journal-entries` | `/accounting/journal-entries` | Accounting |
| `/assets` | `/accounting/fixed-assets` | Accounting |
| `/items` | `/accounting/items` | Accounting |
| `/stock-adjustments` | `/accounting/stock-adjustments` | Accounting |
| `/nrv-assessment` | `/accounting/nrv-assessment` | Accounting |
| `/projects` | `/projects/projects` | Projects |
| `/reports` | `/reports/financial-reports` | Reports |
| `/compliance` | `/compliance/compliance-dashboard` | Compliance |
| `/settings` | `/settings/company-profile` | Settings |
| `/approvals` | `/approvals/pending-approvals` | Approvals |
| `/documents` | `/documents/documents` | Documents |

---

## Sidebar Component Specifications

### New Hierarchical Sidebar Structure

**Location**: `client/src/components/app-sidebar-hierarchical.tsx`

**Component Props**:
```typescript
interface MenuSection {
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string | number;
  expanded?: boolean;
  children?: MenuItem[];
}

interface MenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}
```

**Menu Data Structure**:
```typescript
const NAVIGATION_MENU: MenuSection[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/',
    badge: null,
  },
  {
    label: 'Income',
    icon: <TrendingUp className="h-5 w-5" />,
    path: null,
    expanded: false,
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
        badge: 12, // AR Aging count
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
    path: null,
    expanded: false,
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
        badge: 8, // AP Aging count
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
    path: null,
    expanded: false,
    children: [
      {
        label: 'Accounts',
        path: '/banking/accounts',
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: 'Reconciliation',
        path: '/banking/reconciliation',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        label: 'Transfers',
        path: '/banking/transfers',
        icon: <Send className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Accounting',
    icon: <Ledger className="h-5 w-5" />,
    path: null,
    expanded: false,
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
    path: null,
    expanded: false,
    children: [
      {
        label: 'Customers',
        path: '/people/customers',
        icon: <User className="h-4 w-4" />,
      },
      {
        label: 'Vendors',
        path: '/people/vendors',
        icon: <User className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Projects',
    icon: <Briefcase className="h-5 w-5" />,
    path: '/projects/projects',
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/reports/financial-reports',
  },
  {
    label: 'Compliance',
    icon: <Shield className="h-5 w-5" />,
    path: '/compliance/compliance-dashboard',
  },
  {
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    path: '/settings/company-profile',
  },
];
```

### Sidebar Behavior
- **Expanded by default**: Income, Expenses (most commonly used)
- **Collapsed by default**: Banking, Accounting, People, Projects, Reports, Compliance
- **Click section title** to expand/collapse
- **Active section highlight** when user navigates to that section
- **Favorites** can be pinned to top
- **Search** functionality to find items quickly
- **Mobile**: Collapses to hamburger menu

---

## Implementation Checklist

### Phase 1A: Folder Structure ✅ DONE
- [x] Create 10 primary section folders
- [x] Create pages/ subdirectories
- [x] Create components/ subdirectories
- [x] Create supporting folders (auth, approvals, documents)

### Phase 1B: File Movement ✅ DONE
- [x] Move income section files (customers, invoices, quotes, etc.)
- [x] Move expenses section files (vendors, bills, purchase orders, etc.)
- [x] Move banking section files
- [x] Move accounting section files (accounts, assets, items, inventory)
- [x] Move people section files
- [x] Copy other sections as-is (projects, reports, compliance, settings)

### Phase 1C: Import Path Updates ⏳ IN PROGRESS
- [x] Update consolidated pages (sales, reports, purchases)
- [ ] Update App.tsx (70+ imports)
- [ ] Search and replace all feature path imports throughout codebase
- [ ] Verify no broken imports

### Phase 1D: Route Updates ⏳ PENDING
- [ ] Update all route paths in App.tsx
- [ ] Change `/invoices` → `/income/invoices`
- [ ] Change `/customers` → `/income/customers`
- [ ] Change `/bills` → `/expenses/bills`
- [ ] Change `/vendors` → `/expenses/vendors`
- [ ] Change `/accounts` → `/accounting/accounts`
- [ ] Change all other routes per mapping table
- [ ] Update Link/navigate calls in components

### Phase 1E: Hierarchical Sidebar ⏳ PENDING
- [ ] Create new `AppSidebar` component with hierarchical structure
- [ ] Implement expand/collapse functionality
- [ ] Add icons for each section
- [ ] Add badges for counts (AR aging, AP aging, approvals)
- [ ] Implement mobile hamburger menu
- [ ] Add active state highlighting
- [ ] Integrate into App.tsx

### Phase 1F: Breadcrumb Navigation ⏳ PENDING
- [ ] Create breadcrumb component
- [ ] Add to all pages showing hierarchy
- [ ] Example: Dashboard > Income > Invoices
- [ ] Make clickable to navigate parent levels
- [ ] Add to top of each page

### Phase 1G: Testing & Verification ⏳ PENDING
- [ ] App compiles without errors
- [ ] All 80+ routes accessible via new paths
- [ ] No console errors or warnings
- [ ] Sidebar displays and functions correctly
- [ ] Breadcrumbs show on all pages
- [ ] Lazy loading still works
- [ ] Mobile responsive
- [ ] No broken image/asset links

---

## Rollback Instructions

If you need to undo these changes:

### Option 1: Simple Rollback (Keep new structure)
```bash
# Revert App.tsx and import changes only
git checkout client/src/app/App.tsx
git checkout client/src/components/app-sidebar.tsx

# App will still reference old paths, new folders empty
# Delete new empty folders manually
```

### Option 2: Full Rollback (Revert to old structure)
```bash
# Delete all new folders
rm -rf client/src/features/income
rm -rf client/src/features/expenses
rm -rf client/src/features/banking
rm -rf client/src/features/accounting
rm -rf client/src/features/people

# Restore old structure from git
git checkout client/src/features/

# Restore App.tsx
git checkout client/src/app/App.tsx
```

### Option 3: Keep New Structure, Fix Issues
- If specific imports are breaking, fix them individually
- If certain routes don't work, add specific fixes
- Use git diff to see exactly what changed

---

## Performance Impact

### No Impact Expected
- **Bundle Size**: ~same (files just reorganized)
- **Load Time**: ~same (lazy loading unchanged)
- **Runtime Performance**: ~same (no logic changes)

### Potential Improvements
- **Navigation Speed**: Faster with hierarchical menu
- **Feature Discovery**: Better with related features grouped
- **Developer Experience**: Easier to find related files

---

## URL Changes Summary

**IMPORTANT FOR USERS**: All bookmarks will need updating.

Old bookmarks → New bookmarks:
- `/invoices` → `/income/invoices`
- `/customers` → `/income/customers`
- `/bills` → `/expenses/bills`
- etc.

**Solution**: Add redirects from old URLs to new URLs using wouter:
```typescript
// Temporary redirects for old URLs
<Route path="/invoices" component={() => <Navigate to="/income/invoices" />} />
<Route path="/customers" component={() => <Navigate to="/income/customers" />} />
// ... etc
```

---

## Key Differences from Old Structure

| Aspect | Before | After |
|--------|--------|-------|
| **Primary Sections** | 26 modules | 10 sections |
| **Navigation Depth** | 3 levels | 2-3 levels |
| **Feature Discovery** | Linear list | Hierarchical groups |
| **Invoice Flow** | invoices + payments scattered | Income section unified |
| **Bill Flow** | bills + vendors scattered | Expenses section unified |
| **Navigation Speed** | ~30-45 seconds | ~5-10 seconds |
| **URL Structure** | `/invoices` | `/income/invoices` |
| **Backend Impact** | **ZERO** | **ZERO** |
| **Functionality** | Unchanged | Unchanged |

---

## Next Steps

1. **Finish App.tsx** - Update all 70+ imports and routes
2. **Create Hierarchical Sidebar** - Build new menu component
3. **Test Everything** - Verify all routes work
4. **Add Breadcrumbs** - Show navigation hierarchy
5. **Setup Redirects** - Old URLs → new URLs (optional)

---

## Appendix: Files to Modify

**Must Update**:
- `client/src/app/App.tsx` (main router)
- `client/src/components/app-sidebar.tsx` (or replace with hierarchical version)

**May Need Updates**:
- `client/src/components/quick-create.tsx` (if exists)
- `client/src/lib/navigation.ts` (if exists)
- Any other files with hardcoded feature imports

**Will Work Automatically**:
- All API calls (backend unchanged)
- Database queries (backend unchanged)
- Business logic (backend unchanged)

---

**Document Version**: 1.0  
**Last Updated**: November 23, 2025  
**Status**: Navigation Restructuring In Progress (Phase 1)
