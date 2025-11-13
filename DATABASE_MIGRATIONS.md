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
