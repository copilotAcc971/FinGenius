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

**UI/UX:**
- Shadcn UI components with React Hook Form + Zod for validation and TanStack Query for data fetching.
- `data-testid` attributes for all interactive elements.
- **Brand Identity:** Crimson professional theme (#DC143C) with charcoal sidebar, white backgrounds, and "Copilot Accountant" branding.
- **Navigation:** Global Cmd/Ctrl+K command palette, contextual breadcrumbs, TenantBadge for multi-tenant awareness, and a redesigned collapsible sidebar with RBAC-based filtering.
- **Dashboard:** Quick action cards, recent documents, and pending items summary.
- **UX Improvements:** Comprehensive empty states, loading skeletons, StatusBadge, and instant tenant initialization.

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
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with 143 granular permissions, default/custom roles, multi-role support, and route/UI protection.
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
- **IFRS Compliance:** Adherence to IAS 1 (Presentation of Financial Statements), IAS 7 (Statement of Cash Flows - Indirect Method), and IAS 21 (Foreign Currency Translation).
- **Employee Expense Management & Reimbursement:** Expense submission with receipt upload, permission-based access (6 new RBAC permissions), approval workflow, and reimbursement processing.
- **Bills Form Enhancement:** Displays vendor tax registration number conditionally.
- **Open Banking Integration - Lean Technologies (Phase 3 - PRODUCTION READY ✅):**
    - **Status:** Architect approved, production-ready deployment
    - **Provider-Agnostic Architecture:** Abstracted provider interface supporting Lean Technologies (current), Mastercard, card issuers, marketplace connectors (future)
    - **OAuth2 Authentication:** Complete flow with secure token storage (AES-256-GCM encryption), automatic refresh, multi-tenant isolation
    - **Lean Provider SDK:** Full-featured 576-line implementation covering all Lean API endpoints
    - **Webhook Handler:** Secure `/webhooks/lean` endpoint with HMAC-SHA256 verification, timing-safe comparison, buffer validation, raw body middleware isolation
    - **UI Components:** Bank connection dialog, account management page, transaction display, reconciliation interface
    - **Transaction Sync:** Automated daily sync (2 AM UTC cron), 90-day backfill, pagination (500/request), incremental via lastSyncedAt, duplicate detection
    - **AI Reconciliation:** OpenAI GPT-4o-mini with confidence scoring (0-100), graceful fallback to rule-based matching, atomic transaction handling
    - **Payment Initiation:** Full API routes with database persistence, webhook status updates, payment lifecycle tracking
    - **RBAC:** 8 new permissions (connect, disconnect, view_connections, view_transactions, sync_transactions, reconcile, initiate_payment, view_payments). **Total: 157 permissions** (pre-inventory)
    - **Database:** 4 tables (open_banking_connections, bank_accounts, bank_transactions, open_banking_payments) with encryption, 11 foreign keys, unique constraints, multi-tenant isolation
    - **Security:** AES-256-GCM token encryption with key rotation, HMAC webhook verification, buffer DoS prevention, 1MB payload limit, sandbox/production mode handling
    - **Data Integrity:** 3-column unique constraint prevents duplicates, atomic db.transaction() operations, incremental sync, comprehensive error handling
    - **Critical Bug Fixes (Nov 16, 2024):**
      - ✅ RBAC Route Ordering: Fixed `/api/rbac/roles/me` returning 404 by moving /me routes before /:id routes
      - ✅ Duplicate Email Handling: Enhanced upsertUser() to gracefully handle existing users, preventing server crashes on re-login
    - **Documentation:** Complete setup guide in `LEAN_INTEGRATION_GUIDE.md` with deployment checklist, troubleshooting, monitoring
    - **Configuration:** Requires LEAN_APP_TOKEN, LEAN_CLIENT_ID, LEAN_CLIENT_SECRET (sandbox: LEAN_SANDBOX_MODE='true', production: LEAN_WEBHOOK_SECRET required)
- **Inventory Management System (Phase 4 - DATABASE FOUNDATION COMPLETE ✅):**
    - **Status:** Architect approved, production-ready database schema and RBAC (Nov 16, 2024)
    - **Database Schema:** 15 inventory tables with complete multi-warehouse stock tracking and cost layering:
      - **Core Tables:** warehouses, warehouseStock (per-warehouse quantities with committed/inTransit/reorderQuantity), transferOrders, transferOrderLineItems
      - **Tracking:** serialNumbers, batchNumbers, stockAdjustments, stockAdjustmentLineItems, stockCounts, stockCountLineItems
      - **Advanced:** compositeItemComponents (with cost rollups and effective dating for BOM versioning), uomConversions, inventoryCostLayers, inventoryTransactions (linked to cost layers)
      - **Items Table Enhanced:** Opening stock (openingStock, openingStockDate, openingStockRate), stock breakdown (inTransit, yetToReceive, committed, availableForSale), UOM (defaultUOM), cost tracking (averageCost, standardCost, compositeCost), metadata (itemImages array, customFields JSONB), warehouse assignment (defaultWarehouseId)
    - **Cost Valuation:** Complete FIFO/LIFO/Weighted Average foundation with inventoryCostLayers table:
      - Receipt date, quantity tracking (quantity, remainingQuantity)
      - Cost tracking (unitCost, totalCost)
      - Source document linkage (sourceType, sourceId, sourceNumber)
      - Serial/batch references, isActive flag for consumption tracking
      - Linked to inventoryTransactions via costLayerId for reconciliation
    - **Multi-Warehouse Support:** Per-warehouse stock levels with committed/inTransit quantities, warehouse-specific reorder levels, last count tracking
    - **RBAC:** 13 new inventory permissions. **Total: 168 permissions**
      - inventory.read, inventory.adjust, inventory.approve_adjustments
      - inventory.manage_warehouses, inventory.create_transfer_orders, inventory.approve_transfers
      - inventory.manage_serial_numbers, inventory.manage_batch_numbers, inventory.create_stock_counts
      - inventory.manage_composites, inventory.view_reports, inventory.export_reports
      - inventory.configure_settings (valuation methods, UOMs, cost layers)
    - **Data Integrity:** All tables use varchar with gen_random_uuid() for ID consistency, full multi-tenant isolation with tenantId on all tables
    - **Remaining Phase 4 Work:** Storage layer methods (4.3), API routes (4.4), UI components (4.5), Inventory reports, Testing (4.6)

## External Dependencies
- **OpenAI GPT-5:** For AI-powered document data extraction and categorization.
- **Microsoft Graph API (Outlook):** For sending emails and scheduled report delivery.
- **Stripe:** For payment processing.
- **Lean Technologies:** For Open Banking integration (OAuth2, token management, bank connections, transactions, payments).
- **UAE Central Bank FX Rates:** Currently uses a GitHub mirror for daily rates.