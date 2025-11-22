-- Migration: Add soft delete support to line items tables
-- This ensures consistent soft delete across all related entities

-- Add deletedAt to invoice_line_items
ALTER TABLE invoice_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to bill_line_items
ALTER TABLE bill_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to quote_line_items
ALTER TABLE quote_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to sales_order_line_items
ALTER TABLE sales_order_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to purchase_order_line_items
ALTER TABLE purchase_order_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to credit_note_line_items
ALTER TABLE credit_note_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to recurring_invoice_line_items
ALTER TABLE recurring_invoice_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to retainer_invoice_line_items
ALTER TABLE retainer_invoice_line_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to customers if missing
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt to vendors if missing
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes for better soft delete query performance
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_deleted_at ON invoice_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_deleted_at ON bill_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_deleted_at ON quote_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_order_line_items_deleted_at ON sales_order_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_line_items_deleted_at ON purchase_order_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_credit_note_line_items_deleted_at ON credit_note_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_line_items_deleted_at ON recurring_invoice_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_retainer_invoice_line_items_deleted_at ON retainer_invoice_line_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON vendors(deleted_at);