-- Migration: Add Tax Registration Numbers for Tax Compliance
-- Adds taxRegistrationNumber to customers and vendors
-- Creates tenant_company_profiles for invoice issuer details

-- Add tax registration to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS tax_registration_number VARCHAR(100);

-- Add tax registration to vendors
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS tax_registration_number VARCHAR(100);

-- Backfill: Set defaults to NULL (tax numbers are optional)
UPDATE customers SET tax_registration_number = NULL WHERE tax_registration_number IS NULL;
UPDATE vendors SET tax_registration_number = NULL WHERE tax_registration_number IS NULL;

-- Note: tenant_company_profiles will be created by db:push
