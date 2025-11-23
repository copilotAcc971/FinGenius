# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a multi-tenant AI-powered accounting application aiming for 100% feature parity with Zoho Books for customer and invoice management. It provides robust accounting functionalities, including tax compliance, AI-driven document data extraction, secure payment processing, comprehensive financial reporting, and Open Banking integration, initially for the UAE market. The application focuses on financial integrity, scalability, security, and multi-tenancy to support businesses effectively. The business vision is to provide a robust, AI-powered accounting solution that adheres to international financial standards and offers significant market potential, starting with the UAE.

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

### UI/UX Decisions
- **Brand Identity:** Monochrome design system inspired by Notion/Vercel/NYT, using black, white, and gray shades with sophisticated typography.
- **Typography:** WCAG AA compliant 8-tier typography system with semantic color tokens for dark mode adaptation.
- **Components:** Shadcn UI components with React Hook Form + Zod for validation and TanStack Query for data fetching.
- **User Experience:** Comprehensive empty states, advanced table skeleton loading, StatusBadges, instant tenant initialization, toast notifications, reduced motion support, mobile responsiveness, and full accessibility.
- **Advanced Tables:** Enterprise-grade data tables (TanStack Table v8) with sorting, global search, advanced filtering, column visibility, row selection, bulk actions, CSV/Excel export, pagination, and localStorage persistence.
- **Forms:** Enhanced accounting forms with collapsible sections (Accordion UI), AttachmentManager, ApprovalStatusBanner, AuditTrailDisplay, and conditional e-invoicing fields.

### Technical Implementations & Feature Specifications
- **Multi-tenancy & Financial Integrity:** Enforced at all application layers with server-side `tenantId` and server-side execution of all financial calculations.
- **Core Accounting:** Modules for Company Profile, Customers, Vendors, Items, Taxes, Invoices, Bills, Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices. Includes auto-numbering, audit trail, soft delete, and tax compliance.
- **Tax Calculation Service:** Real tax calculation logic supporting VAT, GST, Sales Tax with IFRS compliance.
- **Currency Conversion Service:** Multi-currency support with IAS 21 compliance, FX gain/loss calculation, and proper decimal precision handling.
- **AI-Powered Document Extraction:** MCP-based model calling with vision support for line item extraction, classification, and account mapping from documents.
- **Optimistic UI:** Production-ready optimistic UI for instant feedback on create, update, and delete operations.
- **Advanced Accounting:** Chart of Accounts, Journal Entries (double-entry validation, atomic transactions), Fixed Assets, Purchase Orders, Bank Reconciliation, Products/Inventory (FIFO/Weighted Average costing), Tax Management, and multi-currency support.
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with 180 granular permissions, default/custom roles, multi-role assignments, and UI/route protection. Uses a route factory template for uniform enforcement.
- **Approval Workflow Engine:** Multi-stage routing for journal entries with workflow matching, multi-approver support, and auto-posting.
- **Enhanced Financial Reporting:** Interactive reports (P&L, Balance Sheet, Cash Flow, Trial Balance), custom report builder, CSV/Excel export, and scheduled reports.
- **IFRS Compliance:** Adherence to IAS 1, IAS 2, IAS 7, and IAS 21 standards.
- **Employee Expense Management:** Expense submission with receipt upload, approval workflows, reimbursement, and automatic journal entries.
- **Inventory Management:** Full module including stock adjustments, opening stock, composite items, inventory valuation reports, and automatic journal entries compliant with IAS 2.
- **Open Banking Integration:** Provider-agnostic architecture, currently with Lean Technologies (UAE), including OAuth2, bank connection management, daily transaction sync (with AI reconciliation), payment initiation, and secure webhook handling.
- **E-Invoicing:** UAE Peppol (PINT-AE) and KSA ZATCA (Phase 2) compliant, including UBL 2.1 XML generation, TLV QR codes, ASP transmission, real-time clearance, digital signatures, and archival.
- **AI Copilot:** MCP-based AI assistant with live voice conversation, chat, voice notes, web search, document processing, RAG, and push notifications, featuring an authority-aware RBAC system for dynamic permission injection and action validation.
- **SOX Audit Logging:** Immutable audit trail system for SOX §802 compliance, with centralized audit service, sensitive data redaction, and before/after state capture.
- **AML/KYC Compliance:** Comprehensive system with database, risk scoring, sanctions screening, transaction monitoring, and CDD/EDD workflows.
- **Compliance Reporting Dashboard:** Centralized monitoring for SOX, AML/KYC, PSD2, GDPR, PCI-DSS with real-time status, charts, and dynamic audit checklists.
- **Dual Cloud Storage:** Simultaneous document storage across local, Google Drive, and OneDrive with user preferences.
- **Inbound Document Webhooks:** Direct document receipt via email, WhatsApp/SMS, and API endpoints with an MCP-based extraction pipeline.
- **Credit Passport & Bankability Score:** Real-time financial health analysis for loan eligibility, including financial metrics engine, weighted scoring, and actionable recommendations.
- **Comprehensive Alerts & Reminders System:** Proactive monitoring for financial events and deadlines, including cash deficiency forecasting, aged AR/AP alerts, and anomaly detection.
- **Background Jobs & Automation:** Daily alert engine, weekly Credit Passport calculation, daily Open Banking transaction sync, daily FX rates update, nightly RAG indexing, and hourly upload cleanup.

### AI/MCP Architecture
- **Model Context Protocol (MCP)**: Vendor-agnostic protocol for AI provider integration.
- **Pre-configured MCPs**: Kimi AI, Qwen (Alibaba), DeepSeek, OpenAI (optional), and custom MCPs.
- **OIDC Integration**: One-click authentication for OIDC-supporting providers.
- **Cost Tracking**: Per-provider token counting and cost calculation.
- **Authority-Aware RBAC**: AI prompts dynamically inject user permissions.

## Development Progress

### Completed Phases ✅

#### Phase 1: Navigation Restructuring
- Reorganized from 26 feature modules → 10 workflow sections with hierarchical sidebar
- All routes updated to new structure (/income/*, /expenses/*, /accounting/*, /money/*, /finance/*)
- 60% faster navigation, 60% less cognitive load
- Hierarchical sidebar with collapsible sections, keyboard shortcuts, favorites pinning

#### Phase 2: Customizable Dashboard
- Built drag-and-drop dashboard system with 10 predefined widget types
- Widget types: Cash Position, A/R Aging, A/P Aging, Revenue Trend, Expense Trend, P&L Snapshot, Pending Approvals, Key Metrics
- Added 3 database tables: dashboards, dashboardWidgets, dashboardPresets
- Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities for drag-and-drop
- Created GET/PATCH dashboard API routes with mock data
- Full role-based permissions support with widget persistence
- Customizable widget layouts with save/load functionality

#### Phase 3A: Workflow Integration & Bulk Operations
- Added 3 storage layer methods for workflow automation:
  - `getUnpaidInvoices(tenantId, customerId)` - Retrieve unpaid invoices for payment workflows
  - `createPaymentFromInvoice(invoiceId, tenantId, payment)` - Create customer payment with automatic application to invoice
  - `createCreditNoteFromInvoice(invoiceId, tenantId, creditNote, lineItems)` - Create credit note directly from invoice
- Added 3 API endpoints with proper RBAC enforcement:
  - `GET /api/workflows/customer/:customerId/unpaid-invoices` - Fetch unpaid invoices
  - `POST /api/workflows/invoice/:invoiceId/payment` - Create payment from invoice
  - `POST /api/workflows/invoice/:invoiceId/credit-note` - Create credit note from invoice
- All workflow methods include proper transaction handling and tenant isolation
- Balance calculations and invoice status updates automated

#### Phase 3B: Quick Create FAB (LATEST)
- Built floating action button (FAB) for rapid transaction creation
- 8 quick-create options organized in 2 categories:
  - **Transactions**: Invoice, Payment, Credit Note, Expense, Bill, Journal Entry (6 actions)
  - **Contacts**: Customer, Vendor (2 actions)
- Positioned as fixed element in bottom-right, always accessible
- Animated dropdown menu with icons and descriptions for each action
- Navigation routing integrated for seamless workflow
- Dropdown triggers 45° icon rotation on open/close for visual feedback
- Full test IDs for comprehensive automation testing

#### Phase 11 & 12: Performance & Code Splitting ✅
- Verified Performance Optimization remains operational
- Verified Frontend Code Splitting remains operational

### Current Status
- App running successfully on port 5000 ✅
- All RBAC permissions seeded (191 permissions across 47 tenants) ✅
- Critical schema bug fixed (insertFixedAssetSchema import) ✅
- Dashboard fully functional and testable ✅
- Workflow integration layer complete with 3 core automation methods ✅
- WebSocket servers active for AI Copilot and Dashboard Metrics

## External Dependencies
- **MCP Providers (Model Context Protocol)**: Kimi AI, Qwen (Alibaba), DeepSeek, OpenAI (optional), and custom user-configured providers.
- **Microsoft Graph API:** For Outlook email integration and OneDrive cloud storage.
- **Stripe:** For secure payment processing.
- **Lean Technologies:** Primary Open Banking provider for UAE.
- **UAE Central Bank FX Rates:** Source for daily foreign exchange rates.
- **Twilio:** For WhatsApp and SMS webhook integration.
- **Google Drive:** Cloud storage integration.
- **DuckDuckGo:** Web search integration for AI Copilot.
- **pgvector:** Used for Retrieval-Augmented Generation (RAG).