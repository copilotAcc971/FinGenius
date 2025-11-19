# Page Consolidation Plan - Vertical Tab Navigation

## Objective
Reduce sidebar clutter by consolidating 45+ separate pages into ~15-20 main pages using vertical tab navigation.

## Design Pattern
Each consolidated page will use a **vertical filter tabs** pattern (left sidebar layout) where:
- Tabs are displayed vertically on the left side of the content area
- Active tab has distinct styling (`bg-gray-100` + `font-medium` + `text-black`)
- Inactive tabs use `text-gray-600` with `hover:bg-gray-50`
- Content area on the right displays the selected tab's content
- Mobile: Tabs collapse to horizontal tabs or dropdown

## Consolidated Pages

### 1. Sales Transactions (`/sales`)
**Route:** `/sales?tab={invoice|quote|sales-order|credit-note|recurring|retainer}`  
**Tabs:**
- Invoices (default)
- Quotes
- Sales Orders  
- Credit Notes
- Recurring Invoices
- Retainer Invoices

**Keep Separate:** Customers (`/customers`), Items (`/items`), Taxes (`/taxes`)

### 2. Purchase Transactions (`/purchases`)
**Route:** `/purchases?tab={bill|purchase-order|expense}`  
**Tabs:**
- Bills (default)
- Purchase Orders
- Expenses

**Keep Separate:** Vendors (`/vendors`)

### 3. Payments (`/payments`)
**Route:** `/payments?tab={customer|vendor}`  
**Tabs:**
- Customer Payments (default)
- Vendor Payments

### 4. Banking (`/banking`)
**Route:** `/banking?tab={connections|reconciliation}`  
**Tabs:**
- Bank Connections (default)
- Bank Reconciliation

### 5. Reports (`/reports`)
**Route:** `/reports?tab={financial|coa|ar-aging|ap-aging|custom|scheduled}`  
**Tabs:**
- Financial Reports (P&L, Balance Sheet, Cash Flow, Trial Balance) (default)
- Chart of Accounts Report
- AR Aging Report
- AP Aging Report
- Custom Report Builder
- Scheduled Reports

### 6. Projects (`/projects`)
**Route:** `/projects?tab={list|time-tracking|timesheets|reports}`  
**Tabs:**
- Projects List (default)
- Time Tracking
- Timesheets
- Project Reports

### 7. Accounting (`/accounting`)
**Route:** `/accounting?tab={coa|journal-entries|balances|assets}`  
**Tabs:**
- Chart of Accounts (default)
- Journal Entries
- Account Balances
- Fixed Assets

### 8. Approvals (`/approvals`)
**Route:** `/approvals?tab={pending|workflows}`  
**Tabs:**
- Pending Approvals (default)
- Approval Workflows

### 9. Settings (`/settings`)
**Route:** `/settings?tab={general|company|currencies|users|roles}`  
**Tabs:**
- General Settings (default)
- Company Profile
- Currencies
- User Management
- Role Management

## Pages Remaining Separate

- **Dashboard** (`/`) - Home page
- **Customers** (`/customers`) - Contact management
- **Vendors** (`/vendors`) - Vendor management
- **Items** (`/items`) - Products/services catalog
- **Taxes** (`/taxes`) - Tax configuration
- **Documents** (`/documents`) - Document uploads/AI extraction
- **Employee Expenses** (`/employee-expenses`) - Expense reimbursement

## Implementation Strategy

### Phase 1: Create Reusable Components
1. `VerticalTabNavigation` component - Left sidebar tabs with active/inactive states
2. `ConsolidatedPageLayout` component - Wrapper with vertical tabs + content area

### Phase 2: Migrate Pages (Priority Order)
1. **Reports** (highest impact - consolidates 6 pages)
2. **Sales Transactions** (consolidates 6 pages)
3. **Projects** (consolidates 4 pages)
4. **Accounting** (consolidates 4 pages)
5. **Purchase Transactions** (consolidates 3 pages)
6. **Settings** (consolidates 3 pages)
7. **Approvals** (consolidates 2 pages)
8. **Payments** (consolidates 2 pages)
9. **Banking** (consolidates 2 pages)

### Phase 3: Update Navigation
1. Update `app-sidebar.tsx` - Remove individual pages, add consolidated entries
2. Update `command-palette.tsx` - Update navigation items to match new structure
3. Update `App.tsx` - Update routing to handle new consolidated pages with query params
4. Update breadcrumbs - Show "Section > Tab" hierarchy

## URL Structure & Deep Linking

All consolidated pages support deep linking via query parameters:
```
/sales?tab=invoice          → Opens Sales page with Invoices tab active
/reports?tab=financial      → Opens Reports with Financial Reports tab
/settings?tab=users         → Opens Settings with User Management tab
```

Default tab (first tab) loads when no query param provided.

## Mobile Considerations

- **Desktop (>768px):** Vertical tabs on left, content on right
- **Tablet (768px-1024px):** Narrower vertical tabs, larger content area
- **Mobile (<768px):** Horizontal tabs at top OR dropdown selector

## RBAC Integration

Each tab within a consolidated page checks individual permissions:
- Hide tabs user doesn't have access to
- Show "No access" message if user navigates to restricted tab via URL
- Redirect to first available tab if default tab is restricted

## Benefits

1. **Cleaner Navigation:** Sidebar reduced from 45+ items to ~15-20
2. **Logical Grouping:** Related functionality organized together
3. **Better UX:** Less cognitive load, easier to find related features
4. **Maintainability:** Easier to add new transaction types within existing groups
5. **Professional Appearance:** Matches design systems like Notion, Linear, Vercel

## Migration Checklist

For each consolidated page:
- [ ] Create new consolidated page component
- [ ] Implement VerticalTabNavigation with all tabs
- [ ] Migrate existing page content into tab content components
- [ ] Update routing in App.tsx
- [ ] Update sidebar navigation
- [ ] Update command palette
- [ ] Test RBAC permissions for each tab
- [ ] Test mobile responsiveness
- [ ] Test keyboard navigation
- [ ] Add breadcrumbs
- [ ] Update documentation
