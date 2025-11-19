# Multi-Tenant AI-Powered Accounting Application

## Overview
This project is a multi-tenant AI-powered accounting application designed to achieve 100% feature parity with Zoho Books for customer and invoice management. Its core purpose is to provide robust accounting functionalities, including tax compliance, AI-driven document data extraction, secure payment processing, comprehensive financial reporting, and Open Banking integration, initially targeting the UAE market. The application is built with a strong emphasis on financial integrity, scalability, security, and multi-tenancy to support businesses effectively.

## User Preferences
- Focus on matching Zoho Books 100% exactly for customer and invoice forms.
- Tax compliance is a critical requirement.
- Open Banking integration for the UAE market with Lean Technologies.
- Future-proof for other Open Banking platforms (Mastercard, card issuers, marketplace connectors).

## System Architecture
The application features a multi-tenant architecture employing a "verified-tenant pattern" where the backend strictly enforces `tenantId` from middleware for all operations. All critical financial calculations are performed server-side to guarantee financial integrity and accuracy.

### UI/UX Decisions
- **Brand Identity:** Monochrome design system inspired by Notion/Vercel/NYT, utilizing black, white, and various shades of gray with sophisticated typography.
- **Typography:** WCAG AA compliant 8-tier typography system with semantic color tokens for seamless dark mode adaptation.
- **Components:** Shadcn UI components integrated with React Hook Form + Zod for validation and TanStack Query for data fetching.
- **Navigation:** Global Cmd/Ctrl+K command palette, contextual breadcrumbs, OrganizationSwitcher for multi-tenant management, and a collapsible sidebar with RBAC-based filtering.
- **User Experience:** Features include comprehensive empty states, an advanced table skeleton loading system, StatusBadges, instant tenant initialization, toast notifications, reduced motion support, mobile responsiveness, and full accessibility compliance.
- **Advanced Tables:** Enterprise-grade data tables (TanStack Table v8) with sorting, global search, advanced filtering, column visibility, row selection, bulk actions, CSV/Excel export, pagination, and localStorage persistence.
- **Forms:** Major accounting forms are enhanced with collapsible sections (Accordion UI), AttachmentManager, ApprovalStatusBanner, AuditTrailDisplay, and conditional e-invoicing fields (UAE Peppol/KSA ZATCA).

### Technical Implementations & Feature Specifications
- **Multi-tenancy:** Enforced at all application layers with server-side `tenantId` assignment for strict data isolation.
- **Financial Integrity:** All financial calculations and validations are executed server-side.
- **Core Accounting:** Modules cover Company Profile, Customers, Vendors, Items, Taxes, Invoices (with auto-numbering, audit trail, soft delete, tax compliance), Bills (AI extraction), Quotes, Sales Orders, Credit Notes, Customer Payments, Recurring Invoices, Retainer Invoices.
- **AI-Powered Document Extraction:** Utilizes OpenAI GPT-5 (vision) for detailed line item extraction, classification, and account mapping from documents like bills.
- **Email Integration:** Outlook integration via Microsoft Graph API for sending invoices and scheduled reports.
- **Optimistic UI:** Production-ready optimistic UI system for instant user feedback on create, update, and delete operations across key modules (Invoices, Bills, Customers, Vendors, Customer Payments), with automatic rollback on errors.
- **Advanced Accounting:** Includes Chart of Accounts, Journal Entries (double-entry validation, atomic transactions, historical balance tracking, cascade recalculation), Fixed Assets, Purchase Orders, Bank Reconciliation, Products/Inventory (FIFO/Weighted Average costing, IAS 2 compliance), Tax Management, and multi-currency support (IFRS IAS 21 compliant, automated exchange rates).
- **Role-Based Access Control (RBAC):** Enterprise-grade RBAC with 180 granular permissions, support for default/custom roles, multi-role assignments, and UI/route protection.
- **Approval Workflow Engine:** Multi-stage routing system for journal entries with workflow matching, multi-approver support, and auto-posting. Includes a dedicated UI for managing approvals.
- **Enhanced Financial Reporting:** Interactive reports (P&L, Balance Sheet, Cash Flow, Trial Balance), a custom report builder (General Ledger, Transaction List), and comprehensive CSV/Excel export for all reports. Scheduled reports with email delivery.
- **IFRS Compliance:** Adherence to IAS 1, IAS 2, IAS 7, and IAS 21 standards.
- **Employee Expense Management:** Features expense submission with receipt upload, approval workflows, reimbursement processing, and automatic journal entries.
- **Inventory Management:** Full module including stock adjustments, opening stock, composite items, inventory valuation reports, and automatic journal entries compliant with IAS 2.
- **Open Banking Integration:** Provider-agnostic architecture, currently implemented with Lean Technologies (UAE). Includes OAuth2, bank connection management, daily transaction sync (with AI-powered reconciliation using OpenAI GPT-4o-mini), payment initiation, and secure webhook handling.
- **UAE Peppol E-Invoicing:** PINT-AE compliant with UBL 2.1 XML generation, TLV QR codes (UAE FTA compliant), ASP integration foundation, 14-day transmission deadline tracking, complete audit trail.
- **KSA ZATCA E-Invoicing (Phase 2):** ZATCA-compliant XML with UUID/hash/hash chaining, TLV QR codes, FATOORAH integration for B2B real-time clearance and B2C 24-hour reporting, SHA-256 cryptographic hashing, PKI digital signature support.
- **AI Copilot:** An AI assistant with live voice conversation capabilities.
    - **Backend:** WebSocket server with session-based authentication, OpenAI Realtime API integration, 11 accounting functions, PCM16 audio streaming, server-side VAD, function call handling with confirmation, heartbeat monitoring.
    - **Frontend:** AudioManager, AudioWorklet processor, CopilotWebSocketClient with auto-reconnection, real-time audio streaming/playback.
    - **UI:** Floating widget, push-to-talk/always-listening modes, audio visualizer, conversation transcript, function call confirmation dialog, status indicators, keyboard shortcuts.
    - **Security:** Session authentication, tenant isolation, RBAC integration, critical action confirmation.
- **SOX Audit Logging:** Immutable audit trail system for SOX §802 compliance.
    - **Implementation:** Centralized audit service with immutable storage, sensitive data redaction (PII/PCI), before/after state capture.
    - **Coverage:** 20+ financial routes instrumented (invoices, bills, payments, journal entries, bank transactions, inventory).
    - **Features:** Success/failure logging, RBAC enforcement tracking, pagination, export limits (10,000 records), search by entity/user/action.
    - **Security:** Tenant-scoped access, role-based viewing permissions, tamper-proof storage.
- **AML/KYC Compliance:** Comprehensive anti-money laundering and know-your-customer system.
    - **Database:** 7 core tables (kycVerifications, transactionAlerts, sarReports, sanctionsScreening, customerRiskAssessment, kycDocuments, eddReviews) plus dedicated transaction_history table.
    - **Risk Scoring:** Data-driven engine using actual customer payment data (transaction volume, frequency, velocity, cross-border patterns).
    - **Sanctions Screening:** Structured multi-list system (OFAC SDN, UN, EU, UK HMT, DFAT) - mocked for development with clear production integration path.
    - **Transaction Monitoring:** Real-time detection with dedicated history table (no commingling with alerts), velocity/structuring/round-amount detection.
    - **Workflows:** CDD/EDD with 25% beneficial ownership validation, 3-tier PEP classification, SAR automatic creation and escalation.
    - **UI:** 5 comprehensive pages (KYC Verifications, Transaction Alerts, SAR Reports, Sanctions Screening, Risk Assessment) with proper loading/empty/error states.
- **Compliance Reporting Dashboard:** Centralized compliance monitoring and management.
    - **Real-Time Status:** SOX, AML/KYC, PSD2, GDPR (placeholder), PCI-DSS (placeholder) with live data integration.
    - **Charts:** Alerts by severity (bar chart), KYC status distribution (pie chart with defensive defaults ensuring zero-value visibility).
    - **Dynamic Features:** 8-item audit checklist with real completion calculation (0-100%), deadlines table with CRUD operations, training requirements tracking.
    - **Data Sources:** All metrics from real API responses, defensive defaults prevent empty states, zero-value segments always visible.

## External Dependencies
-   **OpenAI GPT-5:** Used for AI-powered document data extraction, categorization, and AI-powered bank reconciliation.
-   **Microsoft Graph API:** Utilized for Outlook email integration, including sending invoices and scheduled report delivery.
-   **Stripe:** Integrated for secure payment processing functionalities.
-   **Lean Technologies:** Serves as the primary Open Banking provider for UAE, handling OAuth2, token management, bank connections, transaction retrieval, and payment initiation.
-   **UAE Central Bank FX Rates:** Currently sourced from a GitHub mirror for daily foreign exchange rates.