-- Migration: Vendor Schema Parity with Customers
-- Date: 2025-01-13
-- Purpose: Add Zoho Books fields to vendors table matching customer schema
--
-- New fields added:
--   - display_name (varchar)
--   - website (varchar)
--   - customer_type (varchar) with default 'business'
--   - payment_terms (integer) with default 30
--   - currency_code (varchar) with default 'USD'
--   - billing_address (jsonb) with default '{}'
--   - shipping_address (jsonb) with default '{}'
--   - contact_persons (jsonb) with default '[]'
--
-- This migration backfills existing vendors with default values and
-- migrates legacy address field data into structured billing_address.

-- Backfill NULL values with defaults for existing vendors
UPDATE vendors 
SET 
  customer_type = COALESCE(customer_type, 'business'),
  payment_terms = COALESCE(payment_terms, 30),
  currency_code = COALESCE(currency_code, 'USD'),
  billing_address = COALESCE(billing_address, '{}'::jsonb),
  shipping_address = COALESCE(shipping_address, '{}'::jsonb),
  contact_persons = COALESCE(contact_persons, '[]'::jsonb)
WHERE customer_type IS NULL 
   OR payment_terms IS NULL 
   OR currency_code IS NULL
   OR billing_address IS NULL 
   OR shipping_address IS NULL 
   OR contact_persons IS NULL;

-- Backfill billing_address.street from legacy address field
-- Only migrate if address has content and billing_address is empty
UPDATE vendors 
SET billing_address = jsonb_build_object('street', address)
WHERE address IS NOT NULL 
  AND address != '' 
  AND billing_address = '{}'::jsonb;
