-- Database Performance Analysis - Phase 1 Optimization
-- EXPLAIN ANALYZE queries for major operations
-- Run these to identify query bottlenecks and verify optimization effectiveness

-- ====================================
-- 1. INVOICE OPERATIONS
-- ====================================

-- Get invoices with pagination (BEFORE optimization - N+1 problem)
EXPLAIN ANALYZE
SELECT i.* 
FROM invoices i
WHERE i.tenant_id = 'sample-tenant-id'
ORDER BY i.invoice_date DESC
LIMIT 50 OFFSET 0;

-- Get invoices with eager loading (AFTER optimization)
-- Note: This would be a join in SQL, but Drizzle handles it in ORM
EXPLAIN ANALYZE
SELECT 
  i.id, i.tenant_id, i.customer_id, i.invoice_number, i.status, i.invoice_date,
  c.id as customer_id_full, c.name as customer_name,
  li.id as line_item_id, li.description, li.quantity, li.rate, li.amount,
  t.id as tax_id, t.name as tax_name, t.rate as tax_rate
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
LEFT JOIN invoice_line_items li ON i.id = li.invoice_id
LEFT JOIN taxes t ON li.tax_id = t.id
WHERE i.tenant_id = 'sample-tenant-id'
ORDER BY i.invoice_date DESC
LIMIT 50;

-- ====================================
-- 2. JOURNAL ENTRIES
-- ====================================

-- Get journal entries with legs (common query for trial balance)
EXPLAIN ANALYZE
SELECT 
  je.id, je.tenant_id, je.entry_number, je.entry_date, je.status,
  jel.id as leg_id, jel.account_id, jel.debit, jel.credit,
  a.id as account_id_full, a.code as account_code, a.name as account_name
FROM journal_entries je
LEFT JOIN journal_entry_legs jel ON je.id = jel.journal_entry_id
LEFT JOIN accounts a ON jel.account_id = a.id
WHERE je.tenant_id = 'sample-tenant-id'
  AND je.status = 'posted'
  AND je.entry_date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY je.entry_date DESC
LIMIT 100;

-- ====================================
-- 3. BILLS WITH VENDOR RELATIONS
-- ====================================

-- Get bills with vendor and line items
EXPLAIN ANALYZE
SELECT 
  b.id, b.tenant_id, b.vendor_id, b.bill_number, b.status, b.bill_date,
  v.id as vendor_id_full, v.name as vendor_name,
  bli.id as line_item_id, bli.description, bli.quantity, bli.rate,
  t.id as tax_id, t.name as tax_name
FROM bills b
LEFT JOIN vendors v ON b.vendor_id = v.id
LEFT JOIN bill_line_items bli ON b.id = bli.bill_id
LEFT JOIN taxes t ON bli.tax_id = t.id
WHERE b.tenant_id = 'sample-tenant-id'
ORDER BY b.bill_date DESC
LIMIT 50;

-- ====================================
-- 4. FINANCIAL STATEMENTS
-- ====================================

-- Trial Balance Report (requires all accounts with balances)
EXPLAIN ANALYZE
SELECT 
  a.id, a.code, a.name, a.type,
  COALESCE(SUM(CASE WHEN jel.debit IS NOT NULL THEN jel.debit ELSE 0 END), 0) as total_debit,
  COALESCE(SUM(CASE WHEN jel.credit IS NOT NULL THEN jel.credit ELSE 0 END), 0) as total_credit
FROM accounts a
LEFT JOIN journal_entry_legs jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE a.tenant_id = 'sample-tenant-id'
  AND je.status = 'posted'
  AND je.entry_date <= '2024-12-31'
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;

-- Profit & Loss Report (Operating vs Non-operating)
EXPLAIN ANALYZE
SELECT 
  a.id, a.code, a.name,
  COALESCE(SUM(CASE WHEN jel.credit IS NOT NULL THEN jel.credit ELSE 0 END), 0) as amount
FROM accounts a
LEFT JOIN journal_entry_legs jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE a.tenant_id = 'sample-tenant-id'
  AND a.type IN ('revenue', 'expense', 'cost_of_goods_sold')
  AND je.status = 'posted'
  AND je.entry_date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY a.id, a.code, a.name
ORDER BY a.type, a.code;

-- ====================================
-- 5. AGING REPORTS
-- ====================================

-- AR Aging Report (invoices by customer)
EXPLAIN ANALYZE
SELECT 
  i.id, i.invoice_number, i.invoice_date, i.status,
  c.id as customer_id, c.name as customer_name,
  COALESCE(SUM(i.total_amount), 0) as total,
  COALESCE(SUM(p.amount), 0) as paid_amount,
  (COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(p.amount), 0)) as balance
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
LEFT JOIN payments p ON i.id = p.invoice_id
WHERE i.tenant_id = 'sample-tenant-id'
GROUP BY i.id, i.invoice_number, i.invoice_date, i.status, c.id, c.name
ORDER BY i.invoice_date DESC
LIMIT 100;

-- AP Aging Report (bills by vendor)
EXPLAIN ANALYZE
SELECT 
  b.id, b.bill_number, b.bill_date, b.status,
  v.id as vendor_id, v.name as vendor_name,
  COALESCE(SUM(b.total_amount), 0) as total,
  COALESCE(SUM(p.amount), 0) as paid_amount
FROM bills b
LEFT JOIN vendors v ON b.vendor_id = v.id
LEFT JOIN payments p ON b.id = p.bill_id
WHERE b.tenant_id = 'sample-tenant-id'
GROUP BY b.id, b.bill_number, b.bill_date, b.status, v.id, v.name
ORDER BY b.bill_date DESC;

-- ====================================
-- 6. CASH FLOW STATEMENT
-- ====================================

-- Cash flow by classification
EXPLAIN ANALYZE
SELECT 
  a.id, a.code, a.name, a.cash_flow_classification,
  COALESCE(SUM(CASE WHEN jel.debit IS NOT NULL THEN jel.debit ELSE 0 END), 0) as debit_total,
  COALESCE(SUM(CASE WHEN jel.credit IS NOT NULL THEN jel.credit ELSE 0 END), 0) as credit_total
FROM accounts a
LEFT JOIN journal_entry_legs jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE a.tenant_id = 'sample-tenant-id'
  AND a.cash_flow_classification IN ('operating', 'investing', 'financing')
  AND je.status = 'posted'
  AND je.entry_date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY a.id, a.code, a.name, a.cash_flow_classification
ORDER BY a.cash_flow_classification, a.code;

-- ====================================
-- 7. CUSTOMER/VENDOR LISTS
-- ====================================

-- Get customers with summary stats
EXPLAIN ANALYZE
SELECT 
  c.id, c.name, c.email, c.phone,
  COUNT(DISTINCT i.id) as total_invoices,
  COALESCE(SUM(i.total_amount), 0) as total_invoiced
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
WHERE c.tenant_id = 'sample-tenant-id'
GROUP BY c.id, c.name, c.email, c.phone
ORDER BY total_invoiced DESC
LIMIT 50;

-- Get vendors with summary stats
EXPLAIN ANALYZE
SELECT 
  v.id, v.name, v.email, v.phone,
  COUNT(DISTINCT b.id) as total_bills,
  COALESCE(SUM(b.total_amount), 0) as total_billed
FROM vendors v
LEFT JOIN bills b ON v.id = b.vendor_id
WHERE v.tenant_id = 'sample-tenant-id'
GROUP BY v.id, v.name, v.email, v.phone
ORDER BY total_billed DESC
LIMIT 50;

-- ====================================
-- 8. PAYMENT TRACKING
-- ====================================

-- Get payments with invoice details
EXPLAIN ANALYZE
SELECT 
  p.id, p.payment_date, p.amount, p.payment_method,
  i.id as invoice_id, i.invoice_number, i.total_amount,
  c.id as customer_id, c.name as customer_name
FROM payments p
LEFT JOIN invoices i ON p.invoice_id = i.id
LEFT JOIN customers c ON i.customer_id = c.id
WHERE p.tenant_id = 'sample-tenant-id'
  AND p.payment_date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY p.payment_date DESC
LIMIT 100;

-- ====================================
-- 9. INDEX VERIFICATION
-- ====================================

-- Check if critical indices exist
EXPLAIN ANALYZE
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find missing indices on foreign keys
SELECT 
  t.table_name,
  c.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.columns c 
  ON c.table_name = kcu.table_name
  AND c.column_name = kcu.column_name
JOIN information_schema.tables t 
  ON t.table_name = kcu.table_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY t.table_name;

-- ====================================
-- 10. QUERY STATISTICS
-- ====================================

-- Current query statistics (reset periodically)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE query NOT LIKE 'pg_stat%'
  AND query NOT LIKE 'information_schema%'
ORDER BY total_time DESC
LIMIT 20;

-- ====================================
-- NOTES FOR OPTIMIZATION
-- ====================================
-- 1. After creating indices, run: ANALYZE;
-- 2. Clear query cache: pg_stat_statements_reset();
-- 3. Re-run EXPLAIN ANALYZE to compare execution plans
-- 4. Target: Sequential scans should be 0-1, Index scans should be primary
-- 5. Row counts should match expected pagination limits
-- 6. Total query time should reduce to <100ms for list operations
