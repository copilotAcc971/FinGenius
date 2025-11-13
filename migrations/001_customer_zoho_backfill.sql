-- Migration: Customer Schema - Zoho Books Compatibility
-- Purpose: Backfill existing customer address data into structured billingAddress
-- Date: 2025-01-13

-- Set defaults for existing rows
UPDATE customers 
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

-- Backfill billingAddress.street from legacy address field
UPDATE customers 
SET billing_address = jsonb_build_object('street', address)
WHERE address IS NOT NULL 
  AND address != '' 
  AND billing_address = '{}'::jsonb;
