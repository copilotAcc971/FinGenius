# Design Guidelines: Multi-Tenant AI Accounting Application

## Design Approach

**Selected Approach:** Design System with Reference Inspiration
- **Primary System:** Material Design 3 with productivity-focused adaptations
- **Reference Products:** Zoho Books, QuickBooks Online, Xero, Linear (for modern SaaS polish)
- **Rationale:** Information-dense accounting application requiring consistency, clarity, and efficiency over visual experimentation

## Core Design Principles

1. **Data Clarity First:** All financial information must be scannable and unambiguous
2. **Hierarchical Clarity:** Clear visual distinction between sections, modules, and data levels
3. **Workflow Efficiency:** Minimize clicks for common accounting tasks
4. **Professional Trust:** Design conveys reliability and security for financial data

## Typography System

**Font Stack:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for financial figures, account numbers)

**Hierarchy:**
- Page Titles: text-3xl font-semibold
- Section Headers: text-xl font-semibold
- Subsections: text-lg font-medium
- Body Text: text-base font-normal
- Table Headers: text-sm font-semibold uppercase tracking-wide
- Financial Figures: text-base font-mono font-medium
- Small Labels: text-xs font-medium uppercase tracking-wider
- Critical Actions: text-sm font-semibold

## Layout System

**Spacing Primitives:** Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16
- Micro spacing (form fields, table cells): p-2, p-3
- Standard spacing (cards, sections): p-4, p-6
- Large spacing (page margins, major sections): p-8, p-12, p-16

**Grid Structure:**
- App Shell: Fixed sidebar (w-64) + main content area (flex-1)
- Content Container: max-w-7xl mx-auto
- Dashboard Widgets: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Data Tables: Full width within container
- Forms: max-w-3xl for single-column, grid-cols-2 gap-6 for multi-column

## Navigation Architecture

**Top Navigation Bar:**
- Height: h-16
- Contains: Workspace switcher (dropdown), global search, notifications, user menu
- Positioned: sticky top-0 with subtle shadow

**Left Sidebar:**
- Width: w-64 (collapsible to w-16 on mobile)
- Module sections: Dashboard, Sales (Invoices, Customers), Purchases (Bills, Vendors, Expenses), Banking, Reports, Settings
- Active state: Background fill with left border accent (border-l-4)
- Icons: Heroicons outline (w-5 h-5), filled when active

**Breadcrumbs:**
- Below top nav on content pages: text-sm with separators

## Component Library

### Dashboard Components

**Metric Cards:**
- Layout: Compact cards with icon, label, value, trend indicator
- Structure: p-6 rounded-lg border with subtle shadow on hover
- Content: Icon (top-left), metric label (text-sm text-muted), large value (text-2xl font-semibold), trend chip (small percentage with arrow)

**Chart Containers:**
- White background, p-6, rounded-lg border
- Chart titles: text-lg font-semibold mb-4
- Use Chart.js or similar for clean financial charts

### Data Tables

**Structure:**
- Zebra striping for rows (subtle even:bg-muted)
- Sticky headers with border-b-2
- Row height: h-12 for data rows, h-10 for header
- Cell padding: px-4 py-3
- Actions column: right-aligned with icon buttons (w-8 h-8)
- Sortable columns: Header with sort icon
- Row hover: Subtle background change

**Financial Columns:**
- Right-aligned for all monetary values
- Monospace font for amounts
- Negative values: Distinct treatment (not just color)
- Currency symbols: Consistent positioning

### Forms & Inputs

**Input Fields:**
- Height: h-10 for text inputs
- Padding: px-3 py-2
- Border: border rounded-md
- Focus: ring-2 ring-offset-1
- Labels: text-sm font-medium mb-1.5
- Helper text: text-xs mt-1
- Error state: Red border with error message below

**Invoice/Bill Creation Form:**
- Header section: Customer/Vendor selector, date, reference number
- Line items table: Editable table with add/remove rows
- Totals panel: Right-aligned summary with subtotal, tax, total
- Action buttons: Bottom-right (Save Draft, Save & Send)

**Document Upload Area:**
- Large dropzone: min-h-48 border-2 border-dashed rounded-lg
- Upload icon, instructional text, "Browse files" button
- Preview thumbnails below with AI extraction status indicators

### AI Document Processing

**Processing States:**
- Upload progress: Linear progress bar
- Extraction in progress: Pulsing indicator with "AI Analyzing..." text
- Review extracted data: Side-by-side document preview + editable form fields
- Confidence indicators: Visual badges for high/medium/low confidence extractions

### Payment Workflows

**Stripe Connect Integration UI:**
- Vendor payment setup: Clear wizard flow with progress steps
- Payment scheduling: Calendar picker with amount confirmation
- Payment status badges: Pending (yellow), Scheduled (blue), Completed (green), Failed (red)
- Transaction list: Table with date, vendor, amount, status, actions

**Payment Dashboard:**
- Summary cards: Total payables, scheduled payments, completed this month
- Upcoming payments timeline: Visual calendar/list view
- Quick actions: "Pay Now" buttons with confirmation modals

### Reports

**Report Pages:**
- Report controls: Date range picker, filters in top bar
- Print/Export buttons: Top-right corner
- Report content: Clean table layouts with subtotals, totals emphasized (font-semibold, border-t-2)
- Financial statements: Proper indentation for account hierarchies

### Modals & Overlays

**Modal Structure:**
- Max width: max-w-2xl for forms, max-w-4xl for data views
- Padding: p-6
- Header: pb-4 border-b with title and close button
- Footer: pt-4 border-t with action buttons (right-aligned)
- Backdrop: Semi-transparent overlay

## Multi-Tenant Elements

**Workspace Switcher:**
- Dropdown in top nav showing current workspace name/logo
- List of workspaces with create new option
- Visual separator between personal and team workspaces

## Animations

Use sparingly, only for:
- Loading states: Subtle spinners
- Skeleton screens: Pulse animation during data fetch
- Success confirmations: Brief checkmark animation
- Transitions: Smooth height/opacity changes (duration-200)

## Images

**No hero images required** - this is a utility-focused application.

**Where images appear:**
- Document previews: Uploaded invoice/receipt thumbnails
- Vendor/Customer logos: Small circular avatars (w-10 h-10)
- Empty states: Simple illustrative graphics for "No data yet"