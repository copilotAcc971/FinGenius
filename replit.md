# Multi-Tenant AI-Powered Accounting Application

## Project Overview
Building a comprehensive accounting application that matches Zoho Books functionality with 100% feature parity for customer and invoice forms. The application includes tax compliance, AI-powered document data extraction, and payment processing.

## Recent Changes (November 13, 2025)

### Phase 1: Tax Compliance & Core Invoicing - COMPLETED
- ✅ Company Profile Management with required tax registration
- ✅ Customer Schema/API/Form with tax IDs
- ✅ Vendor Schema with tax IDs
- ✅ Items Catalog
- ✅ Taxes System
- ✅ Invoice Core with auto-numbering, audit trail, soft delete
- ✅ Invoice Form with tax compliance (issuer tax ID, customer tax ID, line items)

### Phase 2: Email & PDF - IN PROGRESS
- ✅ Outlook integration (Mail.Send permission)
- ✅ Email Service Layer (server/email-service.ts)
- ✅ Send Invoice Email API (POST /api/invoices/:id/send-email)
- ✅ Email Status Tracking (emailSentAt, emailSentTo, emailStatus, emailError)
- ✅ Invoice Email UI (Send button, status badges)
- ✅ Complete email workflows with robust error handling
- ⏳ PDF generation with company logo and tax details
- ⏳ Email templates with PDF attachments

### Phase 3: Advanced Sales Modules - IN PROGRESS
- ✅ Quotes Module - PRODUCTION READY
  - Full CRUD API with server-side security and financial integrity
  - Line item amounts calculated server-side: (quantity × unitPrice) - discount
  - Totals calculated server-side from line items with database tax rates
  - Auto-numbering (QUO-0001), quote-to-invoice conversion
  - UI with list, create/edit dialog, status badges, convert action
- ✅ Sales Orders Module - PRODUCTION READY
  - Full CRUD API with server-side security and financial integrity
  - Same calculation patterns as Quotes for consistency
  - Auto-numbering (SO-0001), order-to-invoice conversion
  - UI with list, create/edit dialog, status badges, convert action
- ⏳ Credit Notes linked to invoices
- ⏳ Customer Payment Tracking
- ⏳ Retainer Invoices
- ⏳ Recurring Invoicing

## Architecture Notes

### Multi-Tenant Security Pattern
- **Verified-tenant pattern**: Middleware validates `tenantId`, backend uses `req.tenantId` from middleware
- All API routes protected with `verifyTenantAccess` middleware
- tenantId sent as query parameter: `?tenantId=xxx`
- Database queries filtered by tenantId
- **CRITICAL**: Backend NEVER trusts client-provided tenantId - always uses req.tenantId from middleware

### Financial Integrity Pattern (Quotes & Sales Orders)
- **Server-Side Line Item Calculation**: amount = (quantity × unitPrice) - discount
- **Server-Side Totals**: subtotal = sum of line items, tax = database rates × amounts, total = subtotal + tax
- **Client Protection**: PATCH routes strip client totals, validate with .omit({ subtotal, taxAmount, total })
- **Database Integrity**: updateQuote/updateSalesOrder ALWAYS recalculate and persist correct amounts
- **No Tampering Possible**: Client cannot manipulate any financial data

### Query Parameters Handling
- Updated `getQueryFn` in `client/src/lib/queryClient.ts` to handle query parameters
- Pattern: `queryKey: ['/api/endpoint', { param1: 'value1', param2: 'value2' }]`
- Builds URLs: `/api/endpoint?param1=value1&param2=value2`

### Tax Compliance Requirements
- **Compliance-First Approach**: Tax registration number required at company profile (source) before invoice creation
- Company profile requires: legalName, taxRegistrationNumber
- Invoices require: issuerTaxId (from company profile), customerTaxId (from customer)
- Per-item taxes and discounts supported
- Validation enforced at frontend (Zod), backend (routes), and database (schema)

### Invoice Numbering
- Auto-generated sequential numbers: INV-0001, INV-0002, etc.
- Unique constraint enforced per tenant
- Server-side generation in storage layer

### Audit Trail
- All invoice changes tracked in `invoice_audit_log` table
- Soft delete with `deletedAt` timestamp
- Action types: created, updated, deleted, status_changed

## Database Schema

### Core Tables
- `workspaces` (tenants with tax IDs)
- `tenant_company_profiles` (issuer information with required tax ID)
- `customers` (with tax registration numbers)
- `vendors` (with tax registration numbers)
- `items` (product/service catalog)
- `taxes` (tax rates)
- `invoices` (with issuerTaxId, customerTaxId, invoiceSubject)
- `invoice_line_items` (with itemId, discount, taxId)
- `invoice_audit_log` (complete audit trail)

### Key Foreign Keys
- invoices.customerId → customers.id
- invoices.tenantId → workspaces.id
- invoice_line_items.invoiceId → invoices.id
- invoice_line_items.itemId → items.id (nullable for custom items)
- invoice_line_items.taxId → taxes.id (nullable for non-taxable)

## Integration Notes

### Email Integration - COMPLETE
- **Outlook** (CONNECTED): Microsoft Graph Client with Mail.Send permission
- **Email Service**: server/email-service.ts with token caching/refresh
- **API Endpoint**: POST /api/invoices/:id/send-email with robust error handling
- **Status Tracking**: emailSentAt, emailSentTo, emailStatus (pending/sent/failed), emailError
- **Error Handling**:
  - Email send failures tracked with emailStatus='failed'
  - Special case: Email sent but DB update failed (distinct error)
  - Outlook connection errors handled gracefully (503 response)
  - All responses are JSON with clear error messages
- **UI**: Send Email button, status badges, proper loading/error states
- **Production-Ready**: Architect approved (Nov 13, 2025)

### AI Integration
- OpenAI API key configured (for future document data extraction)

### Payment Integration
- Stripe configured (for vendor payments via Stripe Connect)

## User Preferences
- Token budget: 62% used previously, user requested continuation with all 3 phases
- Focus on matching Zoho Books 100% exactly for customer and invoice forms
- Tax compliance is critical requirement

## Known Edge Cases to Address
1. Invoice dialog needs hard-block when company profile missing (not just alert)
2. Existing invoices with missing tax data need handling during edit
3. Error recovery UX improvements needed (keep buttons disabled during retry)

## Development Guidelines
- Use React Hook Form + Zod validation for all forms
- TanStack Query for data fetching with proper cache invalidation
- Shadcn UI components following design guidelines
- data-testid attributes on all interactive elements
- Multi-tenant isolation enforced at all layers
