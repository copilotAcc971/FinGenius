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
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with granular permissions (70+), default roles, custom roles, multi-role support, and route/UI protection.
- **Automatic Journal Entries:** Automated double-entry bookkeeping for all major document types (Invoice, Bill, Customer Payment, Vendor Payment, Credit Note, Debit Note) with an atomic transaction pattern. Includes historical balance tracking with idempotent operations and cascade recalculation, and comprehensive journal entry reporting.
- **Approval Workflow Engine:** Multi-stage routing system for journal entries with workflow matching, multi-approver support, resubmission capabilities, and auto-posting after final approval.

## External Dependencies
- **OpenAI GPT-5:** For AI-powered document data extraction and categorization.
- **Microsoft Graph API (Outlook):** For sending emails.
- **Stripe:** For payment processing.
- **Lean Technologies:** For Open Banking integration, including OAuth2, token management, provider abstraction, and bank connection management.
- **UAE Central Bank FX Rates:** Currently uses a GitHub mirror for daily rates; recommendation to upgrade to Fluentax commercial API for production. Configuration via `CBUAE_API_SOURCE` environment variable.