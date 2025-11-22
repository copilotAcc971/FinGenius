-- Add creditLimit field to customers table for business rule enforcement
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10, 2) DEFAULT 50000.00;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_customers_credit_limit 
ON customers(tenant_id, credit_limit);

-- Add comment for documentation
COMMENT ON COLUMN customers.credit_limit IS 'Maximum credit limit allowed for the customer in base currency';