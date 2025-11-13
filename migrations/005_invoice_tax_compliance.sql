-- Migration 005: Invoice Tax Compliance Fields
-- Adds tax compliance fields to invoices and enhanced line items

-- Add tax compliance fields to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_subject VARCHAR(500),
ADD COLUMN IF NOT EXISTS issuer_tax_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_tax_id VARCHAR(100);

-- Add enhanced fields to invoice_line_items
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS item_id VARCHAR REFERENCES items(id),
ADD COLUMN IF NOT EXISTS discount DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR REFERENCES taxes(id);

-- Backfill discount with 0 for existing records
UPDATE invoice_line_items SET discount = 0 WHERE discount IS NULL;
