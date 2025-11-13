-- Migration 4: Invoice Audit Trail and Data Integrity Constraints
-- Adds audit logging, uniqueness constraints, soft delete
-- Date: 2025-11-13
-- Purpose: Implement compliance tracking and data integrity for invoices

-- ============================================================================
-- STEP 1: Add new columns to invoices table
-- ============================================================================

-- Add PO reference field (nullable, can be used for tracking purchase orders)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS po_reference VARCHAR(100);

-- Add soft delete timestamp (nullable, NULL means not deleted)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- STEP 2: Create composite unique constraints
-- ============================================================================
-- Note: These unique constraints will be created by Drizzle db:push
-- They are defined in shared/schema.ts as:
--   unique("unique_invoice_number_tenant").on(table.tenantId, table.invoiceNumber)
--   unique("unique_po_reference_tenant").on(table.tenantId, table.poReference)
--
-- PostgreSQL allows multiple NULL values in UNIQUE constraints, so:
-- - Multiple invoices can have NULL po_reference values
-- - Each tenant can have only one invoice with a specific invoice_number
-- - Each tenant can have only one invoice with a specific po_reference (when not null)

-- ============================================================================
-- STEP 3: New tables (created by db:push)
-- ============================================================================
-- The following tables will be automatically created by running db:push:
--
-- 1. invoice_audit_logs
--    - Tracks all changes to invoices for compliance
--    - Records: created, updated, deleted, sent, paid, cancelled actions
--    - Stores changes as JSONB for detailed audit trail
--
-- 2. invoice_sequences
--    - Manages automatic invoice numbering per tenant
--    - Stores last used number and prefix (e.g., "INV-")
--    - One sequence per tenant

-- ============================================================================
-- STEP 4: Verify schema changes
-- ============================================================================
-- After running db:push, verify:
-- 1. invoices.po_reference column exists
-- 2. invoices.deleted_at column exists
-- 3. unique_invoice_number_tenant constraint exists
-- 4. unique_po_reference_tenant constraint exists (allows NULL)
-- 5. invoice_audit_logs table exists with proper foreign keys
-- 6. invoice_sequences table exists with tenantId as primary key
