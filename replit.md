# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a multi-tenant AI-powered accounting application designed for 100% feature parity with Zoho Books for customer and invoice management. It includes modules for tax compliance, AI-driven document data extraction, payment processing, and extensive financial reporting. The application aims to be a robust, secure, and scalable solution for businesses, with a focus on financial integrity, multi-tenancy, and compliance, including Open Banking integration for the UAE market.

## User Preferences
- Focus on matching Zoho Books 100% exactly for customer and invoice forms.
- Tax compliance is a critical requirement.
- Open Banking integration for the UAE market with Lean Technologies.
- Future-proof for other Open Banking platforms (Mastercard, card issuers, marketplace connectors).

## System Architecture
The application uses a multi-tenant architecture with a "verified-tenant pattern" where the backend strictly enforces `tenantId` from middleware. All critical financial calculations are performed server-side to ensure financial integrity.

**UI/UX:**
- Shadcn UI components.
- React Hook Form + Zod for form validation.
- TanStack Query for data fetching and cache invalidation.
- `data-testid` attributes for all interactive elements.
- **Brand Identity:** Crimson professional theme (#DC143C) with charcoal sidebar, white backgrounds, and professional "Copilot Accountant" branding.
- **Navigation Enhancement (Phase 1 - COMPLETED):**
  - **Brand Identity:** Professional crimson theme (#DC143C), modern typography, AI-generated logo integrated into sidebar.
  - **Command Palette:** Global Cmd/Ctrl+K shortcut for quick navigation with fuzzy search across all modules, categorized results, keyboard shortcuts, and search-as-you-type.
  - **Breadcrumbs:** Contextual navigation trail showing tenant name and current location with clickable intermediate paths for easy backtracking.
  - **Tenant Context Indicators:** Visual TenantBadge in header showing active workspace name for clear multi-tenant context awareness.
  - **Sidebar Redesign:** Collapsible navigation groups (Accounting, Reports, etc.), favorites system, recent pages tracking, RBAC-based menu filtering, and professional branding.
  - **Enhanced Dashboard:** Quick action cards (Create Invoice, Record Payment, etc.), recent documents widget with real-time updates, pending items summary (overdue invoices, upcoming bills) with dedicated backend queries.
  - **UX Improvements:** Comprehensive empty states, loading skeletons, StatusBadge component for consistent status display, and instant tenant initialization.
  - **Critical Bug Fixes:** Synchronous tenant onboarding (no delays), database schema sync (tenant_members table), TenantGate error handling for failed queries, WorkspaceSwitcher "Create Your First Workspace" CTA for new users, and comprehensive logging in verifyTenantAccess middleware.

**Technical Implementations & Feature Specifications:**
- **Core Accounting:** Modules for Company Profile, Customers, Vendors, Items, Taxes, Invoices (auto-numbering, audit trail, soft delete, tax compliance), Bills (AI extraction), Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices.
- **AI-Powered Document Extraction:** Integration with OpenAI GPT-5 (vision) for detailed line item extraction, category classification, and account type mapping for bills, including bulk upload.
- **Email Integration:** Outlook integration via Microsoft Graph API for sending invoices.
- **Multi-tenancy:** Enforced at all layers (API routes, database queries, data persistence) with server-side `tenantId` assignment.
- **Financial Integrity:** Server-side calculation and validation of all financial data for Quotes, Sales Orders, and Bills.
- **Tax Compliance:** Requires tax registration and enforcement of tax IDs for all relevant entities.
- **Auto-numbering:** Sequential numbering for all major modules.
- **Audit Trails:** Comprehensive tracking of changes for critical entities.
- **Advanced Accounting Modules:** Chart of Accounts, Journal Entries (double-entry validation), Fixed Assets (depreciation), Purchase Orders, Bank Reconciliation, Financial Reports (P&L, Balance Sheet, Trial Balance, Cash Flow), Products/Inventory, Tax Management.
- **Multi-Currency Support:** Full foundation for multi-currency operations with UI for currency management, automated daily exchange rate updates, and exchange rate history. Includes IFRS Foreign Currency Translation compliance (IAS 21) as an optional feature.
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with granular permissions (143 total), default roles, custom roles, multi-role support, route/UI protection, and comprehensive initialization ensuring all tenants have Owner roles with full permissions.
- **Automatic Journal Entries:** Automated double-entry bookkeeping for all major document types (Invoice, Bill, Customer Payment, Vendor Payment, Credit Note, Debit Note) with an atomic transaction pattern. Includes historical balance tracking with idempotent operations and cascade recalculation, and comprehensive journal entry reporting.
- **Approval Workflow Engine:** Multi-stage routing system for journal entries with workflow matching, multi-approver support, resubmission capabilities, and auto-posting after final approval.
- **Approval Workflow UI (Phase 4 - COMPLETED):**
  - **Pending Approvals Dashboard:** List view with entity filtering, approve/reject actions with comments, tenant-scoped queries with cache invalidation.
  - **Journal Entry Detail Workflow Panel:** Audit timeline showing approval steps, integrated approve/reject functionality.
  - **Sidebar Approvals Badge:** Real-time pending count with tenant isolation and GlobalTenantEvents cache reset.
  - **Workflows Management:** Full CRUD for approval workflows (list/create/edit/delete) with entity type filters, search, status toggle.
  - **Workflow Form:** Dynamic approval step configuration with role/user selection, amount thresholds, and validation.
  - **Account Balance Views:** Historical balance timeline with charts, transaction history with pagination, date range filtering.
  - **Cache Architecture:** Tenant-scoped query keys pattern `["/api/resource", { tenantId }]` prevents cross-tenant data leakage. GlobalTenantEvents component centralizes tenant-switch cache hygiene.
- **Enhanced Financial Reporting & Analytics (Phase 2 - COMPLETED):**
  - **Phase 2.1 - Chart of Accounts Report:** Interactive report with drill-down to transactions, account balance history, and CSV export.
  - **Phase 2.2 - P&L Statement:** Comparative Profit & Loss with period comparison, variance analysis (amount and percentage), side-by-side bar charts, expense breakdown pie charts, and CSV/Excel export.
  - **Phase 2.3 - Balance Sheet:** Enhanced Balance Sheet with hierarchical asset/liability/equity breakdown, period comparison, variance metrics, stacked bar charts, and CSV/Excel export.
  - **Phase 2.4 - Cash Flow Statement:** Indirect Method per IAS 7 with operating/investing/financing activities, working capital adjustments, period comparison, variance analysis, and CSV/Excel export.
  - **Phase 2.5 - Trial Balance Comparison:** Optional comparison period support with variance analysis (amount and percentage). Point-in-time balance calculation using accountTransactionHistory. Enhanced Trial Balance report with 8-column display (current/comparison/variance for debit/credit). CSV/Excel export with comparison data.
  - **Phase 2.6 - Custom Report Builder:** Full-featured builder with 5 report types (General Ledger, Transaction List, Invoice List, Bill List, Account Details). Dynamic column selection, advanced filtering, save/load/edit/delete configurations, and CSV/Excel export. Includes 4 RBAC permissions for configuration management.
  - **Phase 2.7 - Export Functionality:** Comprehensive CSV and Excel export for all financial reports (P&L, Balance Sheet, Cash Flow, Trial Balance) with professional formatting, numeric values for Excel formulas, and proper handling of comparison periods.
  - **Phase 2.8 - Scheduled Reports with Email Delivery:** Comprehensive scheduling system with cron jobs for automated report generation. Email delivery via Microsoft Graph API with Excel/CSV attachments. Execution history tracking with success/failure logging. Dynamic cron job registration/unregistration. Includes 5 RBAC permissions for schedule management.
- **IFRS Compliance (Phase 2 Enhancements):**
  - **IAS 1 (Presentation of Financial Statements):** P&L and Balance Sheet meet all minimum line items, expense classification, current/non-current classification, and comparative period requirements. Comprehensive compliance documentation in codebase.
  - **IAS 7 (Statement of Cash Flows):** Cash Flow Statement using Indirect Method with proper classification of activities and comparative information.
  - **IAS 21 (Foreign Currency Translation):** FX disclosure components in all financial reports showing IFRS compliance standard, translation method, and presentation currency.
  - **Comparative Period Support:** All major reports (P&L, Balance Sheet, Cash Flow) support at least one comparative period with side-by-side presentation and variance analysis as required by IAS 1.38.
- **Employee Expense Management & Reimbursement (COMPLETED):**
  - **Expense Submission:** Employees submit expense claims with amount, category, date, description, and receipt upload. System auto-sets submittedBy, submittedAt, and reimbursementStatus (pending).
  - **Permission-Based Access:** 6 new RBAC permissions (submit, read, approve, reject, reimburse, view_all) for granular control. Users with only submit permission can view their own expenses. Users with read permission see expenses based on view_all flag. OR filtering enables users to see expenses they submitted on behalf of others.
  - **Approval Workflow:** Managers approve or reject expenses with optional rejection reasons. System tracks approvedBy, approvedAt, rejectedBy, rejectedAt for full audit trail.
  - **Reimbursement Processing:** Finance team processes approved expenses with payment method and reference validation (Zod schema enforcement). System tracks reimbursedBy, reimbursedAt, paymentMethod, paymentReference.
  - **UI Components:** Three-tab interface (My Expenses, Pending Approvals, All Expenses) with permission-based rendering, status badges (pending/approved/rejected/reimbursed), filtering by status/employee/date range, and four dialogs (Submit, Approve, Reject, Reimburse).
  - **Technical Excellence:** Centralized date serialization helper (serializeExpense) ensures consistent ISO string formatting across all 5 API endpoints. Server-side field control prevents client manipulation of tenantId, submittedBy, and timestamps. Multi-tenant isolation with OR filtering (employeeId OR submittedBy) for flexible data access.
  - **Integration:** Fully integrated into sidebar navigation, command palette, breadcrumbs, and routing with RBAC filtering. 143 total permissions across all modules.
- **Bills Form Enhancement (COMPLETED):**
  - **Vendor Tax Registration Display:** Bills form now displays vendor tax registration number below vendor selection field when vendor is selected and has a tax ID. Field is conditionally rendered and includes proper data-testid for testing.

## External Dependencies
- **OpenAI GPT-5:** For AI-powered document data extraction and categorization.
- **Microsoft Graph API (Outlook):** For sending emails.
- **Stripe:** For payment processing.
- **Lean Technologies:** For Open Banking integration, including OAuth2, token management, provider abstraction, and bank connection management.
- **UAE Central Bank FX Rates:** Currently uses a GitHub mirror for daily rates; recommendation to upgrade to Fluentax commercial API for production. Configuration via `CBUAE_API_SOURCE` environment variable.