# Database Migrations

This file documents important database migrations that need to be run when deploying schema changes.

## Migration Approach

**Best Practices:**
1. **Add Defaults in Schema**: All new fields should have sensible defaults defined in `shared/schema.ts`
2. **Create Executable Migration Scripts**: Store migration SQL in `migrations/` directory
3. **Document Execution**: Update this file with migration details and status
4. **Test First**: Always test migrations in development before production

## Migration 1: Customer Schema - Zoho Books Compatibility (2025-01-13)

**Purpose:** Add Zoho Books fields to customers table including structured JSONB addresses with proper defaults.

**Schema Changes:**
- Added with defaults:
  - `customerType` (varchar): default 'business'
  - `paymentTerms` (integer): default 30
  - `currencyCode` (varchar): default 'USD'
  - `billingAddress` (jsonb): default '{}'
  - `shippingAddress` (jsonb): default '{}'
  - `contactPersons` (jsonb): default '[]'
- Added without defaults:
  - `displayName` (varchar)
  - `website` (varchar)
- Preserved legacy `address` text field for backward compatibility

**Migration Files:**
- Schema: `shared/schema.ts` (updated with defaults)
- SQL Script: `migrations/001_customer_zoho_backfill.sql`
- Documentation: `migrations/run-migrations.md`

**Execution Steps:**
1. Run `npm run db:push` to sync schema with new defaults
2. Execute migration SQL:
   ```bash
   # Development (using execute_sql_tool)
   # Or Production:
   psql $DATABASE_URL -f migrations/001_customer_zoho_backfill.sql
   ```
3. Verify existing customers have defaults applied
4. Verify new customers automatically get defaults

**What the Migration Does:**
1. Backfills NULL values with defaults for existing rows
2. Migrates legacy `address` field data into structured `billingAddress.street`

**Status:** ✅ Completed - Schema updated with defaults | ✅ Migration SQL executed successfully (0 rows updated)

---

## Migration 2: Vendor Schema Parity with Customers (2025-01-13)

**Purpose:** Add Zoho Books fields to vendors table to achieve schema parity with customers for consistency and tax compliance.

**Schema Changes:**
- Added with defaults:
  - `customerType` (varchar): default 'business' (field name kept for consistency with customers)
  - `paymentTerms` (integer): default 30
  - `currencyCode` (varchar): default 'USD'
  - `billingAddress` (jsonb): default '{}'
  - `shippingAddress` (jsonb): default '{}'
  - `contactPersons` (jsonb): default '[]'
- Added without defaults:
  - `displayName` (varchar)
  - `website` (varchar)
- Preserved vendor-specific fields:
  - `stripeAccountId` (Vendor's Stripe Connect account)
  - `bankAccountLast4` (Bank account info)
- Preserved legacy `address` text field for backward compatibility

**Migration Files:**
- Schema: `shared/schema.ts` (updated vendors table, schemas, and types)
- SQL Script: `migrations/002_vendor_schema_parity.sql`

**Execution Steps:**
1. Run `npm run db:push` to sync schema with new defaults
2. Execute migration SQL:
   ```bash
   # Development (using execute_sql_tool)
   # Or Production:
   psql $DATABASE_URL -f migrations/002_vendor_schema_parity.sql
   ```
3. Verify existing vendors have defaults applied
4. Verify new vendors automatically get defaults

**What the Migration Does:**
1. Backfills NULL values with defaults for existing vendor rows
2. Migrates legacy `address` field data into structured `billingAddress.street`

**Key Changes:**
- Added `updateVendorSchema` for PATCH operations (matching customer pattern)
- Added `vendorFormSchema` for client-side validation (matching customer pattern)
- Added `VendorFormValues` type export
- Reused `addressSchema` and `contactPersonSchema` from customer implementation

**Status:** ✅ Completed - Schema updated with defaults | ✅ Migration SQL executed successfully (0 rows updated)

---

## Migration 3: Tax Registration Numbers for Tax Compliance (2025-11-13)

**Purpose:** Add tax registration numbers to customers and vendors, and create tenant company profiles for invoice issuer tax compliance.

**Schema Changes:**

**Customers Table:**
- Added without defaults:
  - `taxRegistrationNumber` (varchar, length 100): Optional tax registration/VAT number

**Vendors Table:**
- Added without defaults:
  - `taxRegistrationNumber` (varchar, length 100): Optional tax registration/VAT number

**Tenant Company Profiles Table (NEW):**
- `id` (varchar): Primary key with UUID default
- `tenantId` (varchar): Foreign key to tenants.id with unique constraint
- `legalName` (varchar, length 255): Required - Legal business name
- `taxRegistrationNumber` (varchar, length 100): Optional - Company tax/VAT number
- `address` (jsonb): Structured address using addressSchema, default '{}'
- `email` (varchar, length 255): Optional - Company email
- `phone` (varchar, length 50): Optional - Company phone
- `website` (varchar, length 255): Optional - Company website
- `createdAt`, `updatedAt` timestamps

**Migration Files:**
- Schema: `shared/schema.ts` (updated customers, vendors, added tenantCompanyProfiles)
- SQL Script: `migrations/003_tax_registration_numbers.sql`

**Execution Steps:**
1. Run `npm run db:push` to sync schema
2. Execute migration SQL:
   ```bash
   # Development (using execute_sql_tool)
   # Or Production:
   psql $DATABASE_URL -f migrations/003_tax_registration_numbers.sql
   ```
3. Verify columns exist in customers and vendors tables
4. Verify tenant_company_profiles table created with unique tenantId constraint

**What the Migration Does:**
1. Adds `tax_registration_number` column to customers table (nullable)
2. Adds `tax_registration_number` column to vendors table (nullable)
3. Creates `tenant_company_profiles` table via db:push
4. Backfills NULL values for existing rows (if any)

**Key Changes:**
- Added `insertTenantCompanyProfileSchema` for INSERT operations
- Added `updateTenantCompanyProfileSchema` for PATCH operations
- Added `InsertTenantCompanyProfile` and `TenantCompanyProfile` type exports
- Schemas for customers and vendors automatically include new optional field
- Unique constraint on tenantId ensures one company profile per tenant

**Status:** ✅ Completed - Schema updated | ✅ Migration SQL executed successfully (0 rows updated) | ✅ tenant_company_profiles table created

---

## Migration 4: Invoice Audit Trail, Uniqueness Constraints, and Soft Delete (2025-11-13)

**Purpose:** Implement comprehensive invoice audit trail for compliance, enforce data integrity with unique constraints per tenant, and enable soft delete functionality for invoice recovery and historical tracking.

**Schema Changes:**

**Invoices Table:**
- Added without defaults:
  - `poReference` (varchar, length 100): Optional Purchase Order reference number
  - `deletedAt` (timestamp): Soft delete timestamp (NULL means not deleted)
- Added composite unique constraints:
  - `unique_invoice_number_tenant`: Ensures invoice_number is unique per tenant
  - `unique_po_reference_tenant`: Ensures po_reference is unique per tenant when not NULL
  - Note: PostgreSQL allows multiple NULL values in UNIQUE constraints

**Invoice Audit Logs Table (NEW):**
- `id` (varchar): Primary key with UUID default
- `tenantId` (varchar): Foreign key to tenants.id
- `invoiceId` (varchar): Foreign key to invoices.id
- `userId` (varchar): Foreign key to users.id (nullable) - who performed the action
- `action` (varchar, length 50): Action type - created, updated, deleted, sent, paid, cancelled
- `changes` (jsonb): Detailed JSON of what changed (before/after values)
- `timestamp` (timestamp): When the action occurred (auto-set)

**Invoice Sequences Table (NEW):**
- `tenantId` (varchar): Primary key, foreign key to tenants.id
- `lastNumber` (integer): Last used invoice number, default 0
- `prefix` (varchar, length 20): Invoice number prefix (e.g., "INV-"), default "INV-"
- `updatedAt` (timestamp): Last updated timestamp

**Migration Files:**
- Schema: `shared/schema.ts` (updated invoices, added invoiceAuditLogs, added invoiceSequences)
- SQL Script: `migrations/004_invoice_audit_constraints.sql`

**Execution Steps:**
1. Run `npm run db:push` to sync schema
2. Execute migration SQL (if needed for manual verification):
   ```bash
   # Development (using execute_sql_tool)
   # Or Production:
   psql $DATABASE_URL -f migrations/004_invoice_audit_constraints.sql
   ```
3. Verify invoices table has new columns: po_reference, deleted_at
4. Verify unique constraints exist: unique_invoice_number_tenant, unique_po_reference_tenant
5. Verify invoice_audit_logs table created with foreign keys
6. Verify invoice_sequences table created with tenantId as primary key

**What the Migration Does:**
1. Adds `po_reference` column to invoices table (nullable)
2. Adds `deleted_at` column to invoices table for soft delete (nullable)
3. Creates composite unique constraints via Drizzle schema
4. Creates `invoice_audit_logs` table for compliance tracking
5. Creates `invoice_sequences` table for automatic invoice numbering per tenant

**Key Changes:**
- Updated `insertInvoiceSchema` to omit `deletedAt` (managed internally)
- Added `InsertInvoiceAuditLog` and `InvoiceAuditLog` type exports
- Added `InsertInvoiceSequence` and `InvoiceSequence` type exports
- Unique constraints enforce data integrity at database level
- Audit logs provide complete change history for regulatory compliance
- Soft delete preserves invoice history while hiding from normal queries

**Use Cases:**
- **Audit Trail**: Track all invoice modifications for compliance (SOX, GDPR, etc.)
- **Data Integrity**: Prevent duplicate invoice numbers within same tenant
- **PO Tracking**: Link invoices to customer purchase orders with uniqueness guarantee
- **Soft Delete**: Recover accidentally deleted invoices, maintain historical records
- **Auto-numbering**: Generate sequential invoice numbers per tenant with custom prefix

**Status:** ✅ Completed - Schema updated | ✅ db:push executed successfully | ✅ All tables and constraints created | ✅ No LSP errors

---
