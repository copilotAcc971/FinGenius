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
- **Open Banking Integration - Lean Technologies:**
    - Provider-agnostic architecture with current implementation for Lean Technologies (UAE).
    - OAuth2 authentication flow with secure token storage and refresh.
    - Lean Provider SDK for account management, transaction retrieval, balance queries, and payment initiation.
    - Secure webhook handler (`/webhooks/lean`) with HMAC-SHA256 verification for real-time updates.
    - UI for bank connection management.
    - Automated daily transaction sync system with 90-day backfill and duplicate detection.
    - AI-Powered Bank Reconciliation using OpenAI GPT-4o-mini with confidence scoring and graceful fallback to rule-based matching.
    - Payment Initiation API routes with database persistence and webhook-based status updates.
    - 8 new Open Banking RBAC permissions (total 151).
    - Database schema includes 4 tables with encryption for sensitive data, indexing, foreign keys, and multi-tenant isolation.
    - Security Features: AES-256-GCM token encryption, HMAC webhook verification, buffer length validation, and multi-tenant data isolation.
    - Data Integrity: Unique constraints, atomic database transactions, incremental sync, and comprehensive error handling.

## External Dependencies
- **OpenAI GPT-5:** For AI-powered document data extraction and categorization.
- **Microsoft Graph API (Outlook):** For sending emails and scheduled report delivery.
- **Stripe:** For payment processing.
- **Lean Technologies:** For Open Banking integration (OAuth2, token management, bank connections, transactions, payments).
- **UAE Central Bank FX Rates:** Currently uses a GitHub mirror for daily rates.