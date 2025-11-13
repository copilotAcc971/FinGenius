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

## External Dependencies
- **OpenAI GPT-5:** Used for AI-powered document data extraction from bills and categorisation.
- **Microsoft Graph API (Outlook):** For sending emails (e.g., invoices) with Mail.Send permission.
- **Stripe:** Configured for payment processing, specifically for vendor payments via Stripe Connect.
- **Lean Technologies (Planned):** Integration for Open Banking functionalities, including:
    - Autonomous Reconciler (transaction webhooks, NLP parsing, auto-categorization, VAT calculation).
    - AP/AR Command Center (live bank balance checks, bill payments, payment links).
    - Cash Flow Co-Pilot (predictive forecasting).
    - Onboarding & Trust Shield (KYC/KYB verification).