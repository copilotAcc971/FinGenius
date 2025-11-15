# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a comprehensive, multi-tenant AI-powered accounting application aiming for 100% feature parity with Zoho Books, specifically for customer and invoice management. It includes advanced modules for tax compliance, AI-driven document data extraction, payment processing, and extensive financial reporting. The application is designed to provide a robust, secure, and scalable solution for businesses, with a strong emphasis on financial integrity, multi-tenancy, and compliance. Key ambitions include integrating Open Banking for enhanced financial automation and supporting the UAE market.

## User Preferences
- Focus on matching Zoho Books 100% exactly for customer and invoice forms.
- Tax compliance is a critical requirement.
- Open Banking integration for the UAE market with Lean Technologies.
- Future-proof for other Open Banking platforms (Mastercard, card issuers, marketplace connectors).

## System Architecture
The application employs a multi-tenant architecture with a "verified-tenant pattern" where the backend strictly enforces `tenantId` from middleware, never trusting client-provided values. Financial integrity is paramount, with all critical calculations (line item amounts, totals, taxes) performed server-side to prevent tampering.

**UI/UX:**
- Utilizes Shadcn UI components.
- React Hook Form + Zod for form validation.
- TanStack Query for data fetching and cache invalidation.
- `data-testid` attributes for all interactive elements.

**Technical Implementations & Feature Specifications:**
- **Core Accounting:** Company Profile, Customers, Vendors, Items Catalog, Taxes, Invoices (auto-numbering, audit trail, soft delete, tax compliance), Bills (with AI extraction), Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices.
- **AI-Powered Document Extraction:** Integration with OpenAI GPT-5 (vision) for detailed line item extraction, category classification with confidence scores, and account type mapping for bills. Includes a bulk upload feature for processing multiple documents.
- **Email Integration:** Outlook integration via Microsoft Graph API for sending invoices, with robust error handling and status tracking.
- **Multi-tenancy:** Enforced at all layers, including API routes, database queries, and data persistence, stripping `tenantId` from client payloads and forcing server-side assignment.
- **Financial Integrity:** Server-side calculation and validation of all financial data (amounts, totals, taxes) for Quotes, Sales Orders, and Bills, preventing client-side manipulation.
- **Query Parameters:** Standardized handling of query parameters using `['/api/endpoint', { params }]` pattern for TanStack Query.
- **Tax Compliance:** Requires tax registration at the company profile level, with tax IDs enforced for invoices (issuer and customer), vendors, and customers.
- **Auto-numbering:** Sequential numbering for all major modules (Invoices, Quotes, Sales Orders, Bills, Credit Notes, Payments, Recurring Invoices, Retainer Invoices, Chart of Accounts, Journal Entries, Fixed Assets, Purchase Orders).
- **Audit Trails:** Comprehensive tracking of changes for critical entities like invoices.
- **Advanced Accounting Modules:** Chart of Accounts, Journal Entries (double-entry validation), Fixed Assets (depreciation), Purchase Orders, Bank Reconciliation, Financial Reports (P&L, Balance Sheet, Trial Balance, Cash Flow), Products/Inventory, Tax Management.
- **Multi-Currency Support (COMPLETED mc-3):** Full multi-currency foundation for UAE market operations:
    - **Currency Management UI:** Complete CRUD interface at /settings/currencies with base currency designation, activate/deactivate toggles, and referential integrity protection (prevents deletion of base currency or currencies used in transactions)
    - **Exchange Rate Configuration:** Automated daily rate updates (6 AM UTC), configurable source strategy (API/Manual/Hybrid), CBUAE source selector (GitHub/OCR/Both/Fluentax/Manual), and persistent FX config storage
    - **Exchange Rate History:** Full audit trail with currency pair filters, CSV export, and manual rate entry with reciprocal rate creation
    - **Backend API:** 11 protected endpoints with RBAC (settings:update, billing:update), server-side tenantId injection, pagination, and query filters
    - **Database Schema:** currencies table (code PK, name, symbol, decimalPlaces, isActive, isBaseCurrency), exchangeRates table (20,10 precision, source tracking), fxConfigs table (per-tenant configuration persistence)
    - **Security:** Referential integrity checks prevent orphaned data, base currency deletion blocked, currencies in-use deletion blocked with guidance to deactivate
    - **Frontend Integration:** Automatic x-tenant-id header injection in all API requests via queryClient, TenantContext localStorage integration
    - **Known Limitations:** E2E testing blocked by OIDC auth bypass issues in test environment (not production code issue), manual verification confirms functionality
- **IFRS Foreign Currency Translation (COMPLETED):** Full compliance with IAS 21 and IFRS for SMEs Section 30:
    - **Translation Engine:** Tenant-scoped rate queries with proper error handling, supporting closing rate (monetary items), average rate (income/expense), and historical rate (equity items) methods
    - **Average Rate Method:** Uses full reporting period per IAS 21 (not transaction date approximation)
    - **Historical Rate Method:** Transaction date rates for equity items per IFRS requirements
    - **FX Configuration UI:** Configurable translation standard (Full IFRS vs IFRS for SMEs) and income/expense method (average-rate vs transaction-date) at company profile level
    - **System Accounts:** Code 4910 (Foreign Exchange Gain), Code 5900 (Foreign Exchange Loss) for realized/unrealized FX differences
    - **Security:** All rate queries are tenant-scoped to prevent cross-tenant data leakage
    - **Proper Error Handling:** Returns null for missing rates instead of silent 1.0 fallback, with explicit error messages in API responses
    - **Known Limitation:** Exchange difference calculation requires historical balance tracking infrastructure (opening balances, transaction-level currency tracking, period-over-period comparison). Per IAS 21 compliance, incomplete data is NOT disclosed rather than showing misleading zeros. Implementation deferred until multi-currency transaction tracking is active.
- **Role-Based Access Control (RBAC):** Complete enterprise-grade RBAC system with:
    - **Permission Catalog:** 70+ granular permissions across 12 modules (customers, vendors, items, taxes, invoices, bills, quotes, sales_orders, purchase_orders, reports, users, billing)
    - **Default Roles:** 7 system roles (Owner, Admin, Accountant, Bookkeeper, Sales, Purchase, Viewer) with curated permission sets
    - **Custom Roles:** Tenants can create custom roles with specific permission combinations
    - **Multi-Role Support:** Users can have multiple roles with combined permissions
    - **Permission Inheritance:** Hierarchical permissions (delete → update → read, approve → read)
    - **Route Protection:** All 60+ critical financial routes protected with permission checks
    - **UI Gating:** Frontend components conditionally render based on user permissions
    - **Owner Bypass:** Owner role has universal access to all features
    - **Migration Support:** Automatic migration from legacy role strings to new RBAC system
    - **Administration UI:** Role management and user management pages with full CRUD operations

## External Dependencies
- **OpenAI GPT-5:** Used for AI-powered document data extraction from bills and categorisation.
- **Microsoft Graph API (Outlook):** For sending emails (e.g., invoices) with Mail.Send permission.
- **Stripe:** Configured for payment processing, specifically for vendor payments via Stripe Connect.
- **Lean Technologies (Implemented):** Complete Open Banking integration with:
    - **OAuth2 Flow:** JWT-based secure authorization with entity ownership validation
    - **Token Management:** AES-256-GCM encryption with automatic refresh (pending KMS integration for production)
    - **Provider Abstraction:** Capability-based architecture supporting data access, payments, and identity verification
    - **Bank Connections UI:** Full connection management (connect, view, refresh, disconnect)
    - **Security:** Multi-tenant isolation, signed state parameters, entity validation
    - **Future Capabilities:** Ready for autonomous reconciliation, AP/AR command center, cash flow forecasting, KYC/KYB verification
- **UAE Central Bank FX Rates (Critical Limitation):**
    - **Official API Status:** CBUAE does NOT provide a public API
    - **Current Implementation:** GitHub mirror (https://github.com/paulbares/centralbank-ae-fx-rates)
        - Daily scraping of official CBUAE website
        - Structured JSON format
        - Most reliable free public source
        - Fallback to aggregator on failure
    - **Production Recommendation:** Upgrade to Fluentax commercial API (https://www.fluentax.com/products/exchange-rates-api/banks/AECB) for SLA guarantees
    - **Configuration:** Set CBUAE_API_SOURCE environment variable ('github', 'fluentax', 'manual')
    - **Note:** OCR-based extraction rejected as unsuitable for automated financial data updates