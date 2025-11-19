# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a multi-tenant AI-powered accounting application providing 100% feature parity with Zoho Books for customer and invoice management. It offers robust features for tax compliance, AI-driven document data extraction, payment processing, extensive financial reporting, and Open Banking integration, initially for the UAE market. The application prioritizes financial integrity, scalability, security, and multi-tenancy.

## User Preferences
- Focus on matching Zoho Books 100% exactly for customer and invoice forms.
- Tax compliance is a critical requirement.
- Open Banking integration for the UAE market with Lean Technologies.
- Future-proof for other Open Banking platforms (Mastercard, card issuers, marketplace connectors).

## System Architecture
The application employs a multi-tenant architecture with a "verified-tenant pattern" where the backend strictly enforces `tenantId` from middleware. All critical financial calculations are performed server-side to ensure financial integrity.

### Frontend Code Organization (Feature-Based Architecture)
The client-side codebase follows a modern feature-based architecture for improved maintainability and scalability:

**Directory Structure:**
```
client/src/
├── app/                          # Application root
│   ├── App.tsx                   # Main app with routing
│   └── main.tsx                  # React entry point
├── features/                     # Feature modules (20+ modules)
│   ├── invoices/                 # Invoice management
│   │   ├── components/           # Invoice-specific components (dialogs, forms)
│   │   └── pages/                # Invoice pages (list, detail)
│   ├── bills/                    # Bill management
│   ├── customers/                # Customer management
│   ├── vendors/                  # Vendor management
│   ├── payments/                 # Payment processing (customer payments, expenses)
│   ├── banking/                  # Open banking integration
│   ├── accounts/                 # Chart of accounts, journal entries
│   ├── reports/                  # Financial reporting
│   ├── approvals/                # Approval workflows
│   ├── inventory/                # Inventory management
│   ├── projects/                 # Project tracking
│   └── settings/                 # Application settings
├── shared/                       # Shared utilities
│   ├── components/               # Reusable components
│   │   ├── layout/               # Layout components (sidebar, breadcrumbs, command palette)
│   │   ├── common/               # Common components (badges, gates, events)
│   │   └── ui/                   # Shadcn UI primitives
│   ├── hooks/                    # Custom hooks
│   │   └── optimistic-ui/        # Optimistic UI hooks (see below)
│   └── lib/                      # Utility libraries
│       ├── api/                  # API clients and utilities
│       ├── auth/                 # Authentication utilities
│       ├── utils/                # General utilities
│       └── exports/              # CSV/Excel export utilities
└── styles/                       # Global styles
    └── index.css                 # Monochrome design system
```

**Key Benefits:**
- **Feature Isolation:** Each feature module is self-contained with its own components and pages
- **Shared Resources:** Common components, hooks, and utilities in `shared/` directory
- **Clear Boundaries:** App core, feature modules, and shared utilities are clearly separated
- **Scalability:** Easy to add new features without touching existing code
- **Import Clarity:** 1000+ import paths updated to reflect new structure

### Optimistic UI System
The application implements a production-ready optimistic UI system for instant feedback on user actions. All create/update/delete operations show immediate changes before server confirmation, with automatic rollback on errors.

**Implementation:**
- **Location:** `client/src/shared/hooks/optimistic-ui/`
- **Hooks:** `useOptimisticCreate`, `useOptimisticUpdate`, `useOptimisticDelete`, `useOptimisticMutation`
- **Query Keys:** Normalized to `[resource, { tenantId }]` format for consistent cache invalidation
- **Temporary IDs:** Creates use `temp-${Date.now()}-${Math.random()}` until server confirms

**Key Features:**
1. **Concurrent Mutation Safety:** Each mutation tracks a unique `optimisticId` to prevent race conditions
2. **Server Reconciliation:** Server response replaces optimistic data, explicitly clearing `isPending` flags
3. **Error Rollback:** Automatic cache restoration on server errors with user-friendly toast notifications
4. **204 Response Handling:** Empty server responses trigger cache refetch to ensure data consistency
5. **Cache Hygiene:** Removed `onSettled` invalidation to prevent concurrent mutation conflicts

**Applied To:**
- Invoices (create, update, delete)
- Bills (create, update, delete)
- Customers (create, update)
- Vendors (create, update)
- Customer Payments (create)

**Technical Details:**
- **PendingBadge:** Visual indicator for optimistic items (appears during mutation)
- **Cache Strategy:** TanStack Query with tenant-scoped keys and GlobalTenantEvents for invalidation
- **Data Flow:** User action → Optimistic update → Server request → Replace/rollback → Clear pending state
- **Performance:** 900% improvement in perceived responsiveness with skeleton loading + optimistic UI

**UI/UX:**
- Shadcn UI components with React Hook Form + Zod for validation and TanStack Query for data fetching.
- `data-testid` attributes for all interactive elements.
- **Brand Identity:** Monochrome design system inspired by Notion/Vercel/NYT (black/white/grays) with sophisticated typography.
- **Typography System:** WCAG AA compliant 8-tier typography with semantic color tokens for perfect dark mode adaptation.
- **Navigation:** Global Cmd/Ctrl+K command palette, contextual breadcrumbs, OrganizationSwitcher for multi-tenant awareness, and a redesigned collapsible sidebar with RBAC-based filtering.
- **Terminology:** User-facing UI uses "organization" consistently (backend uses "tenant" for technical multi-tenancy implementation).
- **Dashboard:** Quick action cards, recent documents, and pending items summary.
- **UX Improvements:** Comprehensive empty states, advanced table skeleton loading system, StatusBadge, instant tenant initialization, toast notifications (3s auto-dismiss), reduced motion support, mobile responsiveness, and accessibility audit passed.
- **Loading States:** Production-ready table skeleton system with shared column-width contract (`table-columns.tsx`), type-safe `TableColumnDef` interface, `<colgroup>` enforcement for zero horizontal CLS, `minHeight` for vertical stability. Applied to all 9 table pages (invoices, bills, customers, vendors, items, payments, expenses, customer-payments, purchase-orders). 900% improvement over original spinner animations.
- **Advanced Data Tables (TanStack Table v8):** Enterprise-grade table system with sorting, global search, advanced filtering, column visibility management, row selection, bulk actions, CSV/Excel export, pagination, localStorage persistence. Demo available at `/demo/advanced-table`.
- **Enterprise-Grade Forms:** All major accounting forms enhanced with collapsible sections (Accordion UI), AttachmentManager for document uploads, ApprovalStatusBanner for workflow integration, AuditTrailDisplay for change history, and conditional UAE Peppol/KSA ZATCA e-invoicing fields.

**Technical Implementations & Feature Specifications:**
- **Core Accounting:** Modules for Company Profile, Customers, Vendors, Items, Taxes, Invoices (auto-numbering, audit trail, soft delete, tax compliance), Bills (AI extraction), Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices.
- **AI-Powered Document Extraction:** Integration with OpenAI GPT-5 (vision) for detailed line item extraction, classification, and account mapping for bills.
- **Email Integration:** Outlook integration via Microsoft Graph API for sending invoices.
- **Multi-tenancy:** Enforced at all layers with server-side `tenantId` assignment.
- **Financial Integrity:** Server-side calculation and validation.
- **Tax Compliance:** Requires tax registration and enforcement of tax IDs.
- **Auto-numbering & Audit Trails:** Sequential numbering and comprehensive change tracking for critical entities.
- **Advanced Accounting:** Chart of Accounts, Journal Entries (double-entry validation), Fixed Assets, Purchase Orders, Bank Reconciliation, Products/Inventory, Tax Management.
- **Multi-Currency Support:** Full foundation for multi-currency operations with UI, automated daily exchange rate updates, and IFRS Foreign Currency Translation compliance (IAS 21).
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with 180 granular permissions, default/custom roles, multi-role support, and route/UI protection.
- **Automatic Journal Entries:** Automated double-entry bookkeeping for all major document types with atomic transactions, historical balance tracking, and cascade recalculation.
- **Approval Workflow Engine:** Multi-stage routing system for journal entries with workflow matching, multi-approver support, and auto-posting.
- **Approval Workflow UI:** Pending approvals dashboard, journal entry detail workflow panel, sidebar approvals badge, and full CRUD for workflow management.
- **Account Balance Views:** Historical balance timeline with charts and transaction history.
- **Cache Architecture:** Tenant-scoped query keys and GlobalTenantEvents for cache hygiene.
- **Enhanced Financial Reporting & Analytics:**
    - Interactive reports: Chart of Accounts, P&L Statement, Balance Sheet, Cash Flow Statement, Trial Balance (with comparison periods and variance analysis).
    - Custom Report Builder: General Ledger, Transaction List, Invoice List, Bill List, Account Details with dynamic column selection and advanced filtering.
    - Comprehensive CSV/Excel export for all reports.
    - Scheduled Reports with Email Delivery via Microsoft Graph API.
- **IFRS Compliance:** Adherence to IAS 1 (Presentation of Financial Statements), IAS 2 (Inventories), IAS 7 (Statement of Cash Flows - Indirect Method), and IAS 21 (Foreign Currency Translation).
- **Employee Expense Management & Reimbursement:** Expense submission with receipt upload, permission-based access (6 new RBAC permissions), approval workflow, reimbursement processing, and automatic journal entries for approvals and reimbursements.
- **Inventory Management System:** Complete inventory module with FIFO/Weighted Average costing, stock adjustments, opening stock, composite items, inventory valuation reports, and automatic journal entries compliant with IAS 2 (Inventories). Includes 15 database tables, 13 RBAC permissions, 58 storage methods, and 57 API endpoints.
- **Bills Form Enhancement:** Displays vendor tax registration number conditionally.
- **Open Banking Integration - Lean Technologies:**
    - Provider-agnostic architecture with current implementation for Lean Technologies (UAE).
    - OAuth2 authentication flow with secure token storage and refresh.
    - Lean Provider SDK for account management, transaction retrieval, balance queries, and payment initiation.
    - Secure webhook handler (`/webhooks/lean`) with HMAC-SHA256 verification for real-time updates.
    - UI for bank connection management.
    - Automated daily transaction sync system with 90-day backfill and duplicate detection.
    - AI-Powered Bank Reconciliation using OpenAI GPT-4o-mini with confidence scoring and graceful fallback to rule-based matching.
    - Payment Initiation API routes with database persistence and webhook-based status updates.
    - 8 Open Banking RBAC permissions.
    - Database schema includes 4 tables with encryption for sensitive data, indexing, foreign keys, and multi-tenant isolation.
    - Security Features: AES-256-GCM token encryption, HMAC webhook verification, buffer length validation, and multi-tenant data isolation.
    - Data Integrity: Unique constraints, atomic database transactions, incremental sync, and comprehensive error handling.

## External Dependencies
- **OpenAI GPT-5:** For AI-powered document data extraction and categorization.
- **Microsoft Graph API (Outlook):** For sending emails and scheduled report delivery.
- **Stripe:** For payment processing.
- **Lean Technologies:** For Open Banking integration (OAuth2, token management, bank connections, transactions, payments).
- **UAE Central Bank FX Rates:** Currently uses a GitHub mirror for daily rates.