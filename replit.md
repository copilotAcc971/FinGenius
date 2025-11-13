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

### Bulk Upload Bills Feature - COMPLETED ✅
- ✅ **API Endpoint**: POST /api/bills/extract-bulk
  - Accepts up to 20 documents per batch
  - Processes files in parallel with Promise.allSettled
  - Returns per-file success/failure results
  - Multi-tenant security with verifyTenantAccess
- ✅ **UI Component**: BulkBillUpload (client/src/components/bulk-bill-upload.tsx)
  - Multi-file upload with drag-and-drop support
  - AI extraction for all documents
  - Results review table with extracted data
  - Shows AI-suggested categories with confidence scores
  - Batch bill creation with progress tracking
  - Proper error handling and loading states
- ✅ **Integration**: Bulk Upload button on Bills page
  - Seamless integration with existing bills list
  - Cache invalidation ensures immediate UI refresh
  - Triple-layer tenantId guards prevent edge cases
- ✅ **Workspace Selection Fix**: Shared TenantContext
  - Fixed state sharing bug with React Context
  - All components now share same tenant state
  - LocalStorage persistence maintained
  - No memory leaks or unnecessary re-renders

### Phase 3: Advanced Sales Modules - COMPLETED ✅
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
- ✅ Credit Notes Module - PRODUCTION READY
  - Full CRUD API with apply-to-invoice functionality
  - Server-side financial calculations (line items, totals, tax)
  - Auto-numbering (CN-0001), balance tracking
  - UI with list, create/edit dialog, apply-to-invoice action
  - Status workflow: draft → issued → applied
- ✅ Customer Payments Module - PRODUCTION READY
  - Full CRUD API with invoice balance updates
  - Auto-numbering (PAY-0001)
  - Payment methods: Cash, Check, Bank Transfer, Credit Card, Other
  - UI with list, create/edit dialog, payment method badges
  - Reference number and notes tracking
- ✅ Recurring Invoices Module - PRODUCTION READY
  - Full CRUD API with invoice generation from templates
  - Server-side financial calculations
  - Auto-numbering (REC-0001)
  - Frequencies: Daily, Weekly, Monthly, Quarterly, Yearly
  - Manual invoice generation ("Generate Now" action)
  - Batch processing endpoint for automation
  - UI with list, create/edit dialog, status badges, frequency badges
  - Status workflow: active → paused → completed
- ✅ Retainer Invoices Module - PRODUCTION READY
  - Full CRUD API with balance tracking
  - Server-side financial calculations
  - Auto-numbering (RET-0001)
  - Balance tracking (amountUsed, remainingBalance)
  - Apply-to-invoice functionality
  - UI with list, create/edit dialog, balance display
  - Status workflow: draft → sent → paid → partially_applied → fully_applied

### Phase 4: Bills & AI Document Extraction - COMPLETED ✅
- ✅ Bills Module - PRODUCTION READY
  - Full CRUD API with multi-tenant security and financial integrity
  - AI-powered document data extraction using OpenAI GPT-5 with vision
  - **Enhanced AI Extraction**:
    - Line item extraction with description, quantity, unit price
    - Category classification with confidence scores
    - Predefined expense categories (Office Supplies, Travel, Utilities, Marketing, Software, etc.)
    - Primary category detection across all line items
    - Account type mapping (expense, asset, liability)
    - Category badges displayed on line items with Tag icon
    - Primary category alert banner at form top with Sparkles icon
  - Embedded file upload with AI extraction in bill dialog
  - **Bulk Upload Feature**:
    - Upload up to 20 bill documents at once
    - Parallel AI extraction with individual success/failure tracking
    - Review all extracted data before saving
    - Batch creation with automatic cache refresh
    - Progress tracking and error handling
  - Auto-numbering (BILL-0001)
  - Server-side financial calculations (line items, totals, tax)
  - Multi-tenant isolation: tenantId ALWAYS stripped from payload, forced from parameter
  - Security hardening: Bills and line items inject server tenantId on create/update
  - GET line-items verifies bill ownership before returning data
  - UI with list, create/edit dialog with AI document uploader, and bulk upload dialog
  - Status workflow: draft → pending_approval → approved → paid
- ✅ Vendor Dialog Enhanced
  - Redesigned to match customer dialog structure
  - Three tabs: Basic Details, Payment Info, Additional
  - Tax Registration Number (TRN) field added
  - Payment terms and banking information
  - Multi-currency support

## Architecture Notes

### Multi-Tenant Security Pattern
- **Verified-tenant pattern**: Middleware validates `tenantId`, backend uses `req.tenantId` from middleware
- All API routes protected with `verifyTenantAccess` middleware
- tenantId sent as query parameter: `?tenantId=xxx`
- Database queries filtered by tenantId
- **CRITICAL**: Backend NEVER trusts client-provided tenantId - always uses req.tenantId from middleware
- **CRITICAL STORAGE PATTERN**: Strip tenantId from ALL payload data before spreading
  ```typescript
  // SECURITY: Strip tenantId from payload, FORCE server tenantId
  const { tenantId: _, ...safeData } = payload;
  const entity = {
    ...safeData,
    tenantId: tenantId, // FORCE from parameter
  };
  ```
  - Applied to ALL entities: bills, line items, quotes, invoices, etc.
  - Prevents accidental tenantId injection from client
  - Ensures TypeScript catches missing tenantId (fail-safe)

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

### Advanced Sales Tables
- `quotations` + `quotation_line_items` (quotes with QUO-XXXX numbering)
- `sales_orders` + `sales_order_line_items` (orders with SO-XXXX numbering)
- `credit_notes` + `credit_note_line_items` (credit notes with CN-XXXX numbering)
- `customer_payments` (payment tracking with PAY-XXXX numbering)
- `recurring_invoices` + `recurring_invoice_line_items` (templates with REC-XXXX numbering)
- `retainer_invoices` + `retainer_invoice_line_items` (retainers with RET-XXXX numbering)

### Bills & Expenses Tables
- `bills` + `bill_line_items` (vendor invoices with BILL-XXXX numbering)
- `expenses` (expense tracking linked to bills or standalone)

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

### AI Integration - PRODUCTION READY
- **OpenAI GPT-5** with vision support for bill document extraction
- **AI Service**: server/ai-bill-extractor.ts
- **Features**:
  - Base64 image input via image_url content type
  - Structured JSON output with response_format
  - Extracts: vendor name, bill number, date, line items with descriptions/quantities/prices, totals
  - **Category Classification**: AI suggests expense categories for each line item
  - **Account Type Mapping**: Automatically determines if expense, asset, or liability
  - **Confidence Scoring**: Each category suggestion includes confidence level
  - **Primary Category Detection**: Identifies the most common category across all line items
  - **Predefined Categories**: Office Supplies, Travel & Transportation, Utilities, Marketing & Advertising, Software & Subscriptions, Professional Services, Rent & Lease, Meals & Entertainment, Equipment & Hardware, Insurance, Taxes & Fees, Bank Charges, Other
  - Error handling and validation
  - Embedded in bill dialog for seamless UX

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
