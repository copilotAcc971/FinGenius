# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a multi-tenant AI-powered accounting application designed to achieve 100% feature parity with Zoho Books for customer and invoice management. Its core purpose is to provide robust accounting functionalities, including tax compliance, AI-driven document data extraction, secure payment processing, comprehensive financial reporting, and Open Banking integration, initially targeting the UAE market. The application emphasizes financial integrity, scalability, security, and multi-tenancy to support businesses effectively.

## User Preferences
- Focus on matching Zoho Books 100% exactly for customer and invoice forms.
- Tax compliance is a critical requirement.
- Open Banking integration for the UAE market with Lean Technologies.
- Future-proof for other Open Banking platforms (Mastercard, card issuers, marketplace connectors).
- **AI Architecture**: MCP (Model Context Protocol) based with OIDC authentication
- **MCP Philosophy**: Pre-configured MCPs built-in, users just insert API keys or click OIDC connect
- **No OpenAI Lock-in**: Vendor-agnostic MCP system for maximum portability
- **RBAC Strategy**: Tag first, apply uniformly at end to avoid friction with ongoing fixes

## System Architecture
The application employs a multi-tenant architecture with a "verified-tenant pattern," enforcing `tenantId` from middleware for all operations. All critical financial calculations are performed server-side to guarantee financial integrity and accuracy.

### AI/MCP Architecture (Phase 8+)
- **Model Context Protocol (MCP)**: Vendor-agnostic protocol for AI provider integration
- **Pre-configured MCPs**:
  - Kimi AI (free tier, vision)
  - Qwen (Alibaba, free tier, multimodal)
  - DeepSeek (reasoning, free tier)
  - OpenAI (optional, if API key provided)
  - Custom MCPs via API key input
- **OIDC Integration**: One-click authentication for providers supporting OIDC
- **Cost Tracking**: Per-provider token counting and cost calculation
- **Authority-Aware RBAC**: AI prompts dynamically inject user permissions

### UI/UX Decisions
- **Brand Identity:** Monochrome design system inspired by Notion/Vercel/NYT, using black, white, and gray shades with sophisticated typography.
- **Typography:** WCAG AA compliant 8-tier typography system with semantic color tokens for dark mode adaptation.
- **Components:** Shadcn UI components with React Hook Form + Zod for validation and TanStack Query for data fetching.
- **Navigation:** Global Cmd/Ctrl+K command palette, contextual breadcrumbs, OrganizationSwitcher, and a collapsible sidebar with RBAC-based filtering.
- **User Experience:** Comprehensive empty states, advanced table skeleton loading, StatusBadges, instant tenant initialization, toast notifications, reduced motion support, mobile responsiveness, and full accessibility.
- **Advanced Tables:** Enterprise-grade data tables (TanStack Table v8) with sorting, global search, advanced filtering, column visibility, row selection, bulk actions, CSV/Excel export, pagination, and localStorage persistence.
- **Forms:** Enhanced accounting forms with collapsible sections (Accordion UI), AttachmentManager, ApprovalStatusBanner, AuditTrailDisplay, and conditional e-invoicing fields (UAE Peppol/KSA ZATCA).

### Technical Implementations & Feature Specifications
- **Multi-tenancy & Financial Integrity:** Enforced at all application layers with server-side `tenantId` and server-side execution of all financial calculations.
- **Core Accounting:** Modules for Company Profile, Customers, Vendors, Items, Taxes, Invoices (with auto-numbering, audit trail, soft delete, tax compliance), Bills (AI extraction), Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices.
- **Tax Calculation Service** (NEW): Real tax calculation logic supporting VAT, GST, Sales Tax with IFRS compliance and audit validation.
- **Currency Conversion Service** (NEW): Multi-currency support with IAS 21 compliance, FX gain/loss calculation, and proper decimal precision handling.
- **AI-Powered Document Extraction:** MCP-based model calling with vision support for line item extraction, classification, and account mapping from documents.
- **Optimistic UI:** Production-ready optimistic UI for instant feedback on create, update, and delete operations across key modules, with automatic rollback.
- **Advanced Accounting:** Includes Chart of Accounts, Journal Entries (double-entry validation, atomic transactions, historical balance tracking), Fixed Assets, Purchase Orders, Bank Reconciliation, Products/Inventory (FIFO/Weighted Average costing), Tax Management, and multi-currency support (IFRS IAS 21 compliant).
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with 180 granular permissions, default/custom roles, multi-role assignments, and UI/route protection.
  - **Tagging Strategy**: 49 endpoints tagged for RBAC application (documented in RBAC_TAGGING_REPORT.md)
  - **Route Factory Template**: Standardized middleware for uniform RBAC enforcement (server/middleware/route-factory.ts)
- **Approval Workflow Engine:** Multi-stage routing for journal entries with workflow matching, multi-approver support, and auto-posting.
- **Enhanced Financial Reporting:** Interactive reports (P&L, Balance Sheet, Cash Flow, Trial Balance), a custom report builder, and comprehensive CSV/Excel export. Scheduled reports with email delivery.
- **IFRS Compliance:** Adherence to IAS 1, IAS 2, IAS 7, and IAS 21 standards.
- **Employee Expense Management:** Expense submission with receipt upload, approval workflows, reimbursement, and automatic journal entries.
- **Inventory Management:** Full module including stock adjustments, opening stock, composite items, inventory valuation reports, and automatic journal entries compliant with IAS 2.
- **Open Banking Integration:** Provider-agnostic architecture, currently with Lean Technologies (UAE), including OAuth2, bank connection management, daily transaction sync (with AI reconciliation), payment initiation, and secure webhook handling.
- **E-Invoicing:**
    - **UAE Peppol:** PINT-AE compliant UBL 2.1 XML generation, TLV QR codes, ASP integration foundation, 14-day transmission deadline tracking, audit trail.
    - **KSA ZATCA (Phase 2):** ZATCA-compliant XML with UUID/hash/hash chaining, TLV QR codes, FATOORAH integration, SHA-256 cryptographic hashing, PKI digital signature support.
- **AI Copilot:** MCP-based AI assistant with live voice conversation, chat, and voice notes, strictly authority-aware RBAC system, web search, document processing, RAG, and push notifications.
    - **Authority-Aware RBAC System:** Dynamic context injection of user roles and permissions into AI prompts, "plan & confirm" protocol for mutating actions, permission validation before function execution, segregation of duties (draft vs. post functions), and authority-aware denial responses.
- **SOX Audit Logging:** Immutable audit trail system for SOX §802 compliance, with centralized audit service, sensitive data redaction, before/after state capture, and comprehensive coverage of financial routes.
- **AML/KYC Compliance:** Comprehensive anti-money laundering and know-your-customer system with database, risk scoring, sanctions screening, transaction monitoring, and CDD/EDD workflows.
- **Compliance Reporting Dashboard:** Centralized monitoring for SOX, AML/KYC, PSD2, GDPR, PCI-DSS with real-time status, charts, dynamic audit checklists, deadlines tracking, and training requirements.
- **Dual Cloud Storage:** Simultaneous document storage across local, Google Drive, and OneDrive with user preferences.
- **Inbound Document Webhooks:** Direct document receipt via email, WhatsApp/SMS, and API endpoints with HMAC verification and an MCP-based extraction pipeline with vision support.
- **Credit Passport & Bankability Score:** Real-time financial health analysis for loan eligibility, including a financial metrics engine, weighted bankability scoring, blocking factor analysis, actionable recommendations, and professional PDF export.
- **Comprehensive Alerts & Reminders System:** Proactive monitoring for financial events and deadlines, including cash deficiency forecasting, aged AR/AP alerts, pending approvals aggregator, month-end closing checklist, suggested accruals detector, compliance deadline tracker, and anomaly detection.
- **Background Jobs & Automation:** Daily alert engine, weekly Credit Passport calculation, daily Open Banking transaction sync, daily FX rates update, nightly RAG indexing, and hourly upload cleanup.

## External Dependencies
- **MCP Providers (Model Context Protocol)**:
  - Kimi AI: Free tier vision model
  - Qwen (Alibaba): Free tier multimodal
  - DeepSeek: Free tier reasoning
  - OpenAI: Optional if API key provided
  - Custom: User can configure additional MCP providers
- **Microsoft Graph API:** Outlook email integration and OneDrive cloud storage.
- **Stripe:** Secure payment processing.
- **Lean Technologies:** Primary Open Banking provider for UAE.
- **UAE Central Bank FX Rates:** Source for daily foreign exchange rates (currently from a GitHub mirror).
- **Twilio:** WhatsApp and SMS webhook integration.
- **Google Drive:** Cloud storage integration via Replit connector.
- **DuckDuckGo:** Web search integration for AI Copilot.
- **pgvector:** Used for Retrieval-Augmented Generation (RAG).

## Phase 1 - Remediation Status (Active)

### ✅ Completed in This Session (Foundation)
1. **RBAC Tagging System** - 49 endpoints documented for systematic RBAC application
2. **Tax Calculator Service** - Real tax logic with VAT/GST/Sales Tax support
3. **Currency Converter Service** - Multi-currency with IFRS IAS 21 compliance
4. **Route Factory Template** - Standardized middleware pattern for uniform endpoint protection

### 🔄 In Progress (Phase 2: Integration)
1. Integrate TaxCalculator into invoice/bill creation
2. Integrate CurrencyConverter into payment operations
3. Test all new business logic
4. Comprehensive verification

### ⏳ Planned (Phase 3: Security)
1. Apply route factory to all 49 tagged endpoints
2. Add audit logging to critical financial operations
3. Remove debug statements systematically
4. Verify RBAC enforcement

### 📊 Audit Summary
- **Total Issues Found**: 305 critical findings
- **Current Focus**: Core business logic (tax, currency) before security layer
- **Strategy**: Low-friction tagging-first approach to minimize disruption
- **Reference**: See RBAC_TAGGING_REPORT.md for complete endpoint list

