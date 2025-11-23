-- Performance optimization indexes for commonly queried columns
-- Created for Task 8: Database performance optimization

-- ========================
-- TENANT-BASED INDEXES
-- ========================
-- Most queries are filtered by tenantId, so these are critical

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenantId);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenantId, name);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_email ON customers(tenantId, email);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON customers(tenantId, createdAt DESC);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenantId);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_name ON vendors(tenantId, name);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_created ON vendors(tenantId, createdAt DESC);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenantId);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer ON invoices(tenantId, customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON invoices(tenantId, invoiceDate DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due ON invoices(tenantId, dueDate);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoiceNumber);

-- Bills table indexes
CREATE INDEX IF NOT EXISTS idx_bills_tenant_id ON bills(tenantId);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_status ON bills(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_vendor ON bills(tenantId, vendorId);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_date ON bills(tenantId, billDate DESC);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_due ON bills(tenantId, dueDate);

-- Journal entries table indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_id ON journal_entries(tenantId);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date ON journal_entries(tenantId, entryDate DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_type ON journal_entries(tenantId, entryType);
CREATE INDEX IF NOT EXISTS idx_journal_entries_number ON journal_entries(entryNumber);

-- Chart of accounts indexes
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_id ON chart_of_accounts(tenantId);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_code ON chart_of_accounts(tenantId, accountCode);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_type ON chart_of_accounts(tenantId, accountType);

-- Items table indexes
CREATE INDEX IF NOT EXISTS idx_items_tenant_id ON items(tenantId);
CREATE INDEX IF NOT EXISTS idx_items_tenant_sku ON items(tenantId, sku);
CREATE INDEX IF NOT EXISTS idx_items_tenant_type ON items(tenantId, itemType);

-- ========================
-- USER-BASED INDEXES
-- ========================

-- User activity and audit trails
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user ON audit_logs(tenantId, userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entityType, entityId);

-- ========================
-- DATE-BASED INDEXES
-- ========================
-- For reports and time-based queries

-- Transaction date indexes
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions(tenantId, transactionDate DESC);

-- ========================
-- COMPOSITE INDEXES FOR JOINS
-- ========================

-- Invoice line items composite index
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoiceId, lineOrder);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_item ON invoice_line_items(itemId);

-- Bill line items composite index
CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill ON bill_line_items(billId, lineOrder);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_item ON bill_line_items(itemId);

-- Journal entry lines composite index
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entryId, lineNumber);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(accountId);

-- ========================
-- SEARCH OPTIMIZATION
-- ========================

-- Full text search indexes for common search fields
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));
CREATE INDEX IF NOT EXISTS idx_vendors_search ON vendors USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(sku, '')));

-- ========================
-- PAYMENT STATUS INDEXES
-- ========================

-- Accounts receivable optimization
CREATE INDEX IF NOT EXISTS idx_invoices_outstanding ON invoices(tenantId, status) 
  WHERE status IN ('draft', 'sent', 'overdue', 'partial');

-- Accounts payable optimization  
CREATE INDEX IF NOT EXISTS idx_bills_outstanding ON bills(tenantId, status)
  WHERE status IN ('draft', 'pending', 'overdue', 'partial');

-- ========================
-- FOREIGN KEY PERFORMANCE
-- ========================

-- Ensure all foreign key columns have indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoiceId);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment ON invoice_payments(paymentId);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(billId);
CREATE INDEX IF NOT EXISTS idx_bill_payments_payment ON bill_payments(paymentId);

-- ========================
-- REPORTING INDEXES
-- ========================

-- Financial reporting optimization
CREATE INDEX IF NOT EXISTS idx_trial_balance_tenant_period ON journal_entry_lines(tenantId, accountId, entryDate);
CREATE INDEX IF NOT EXISTS idx_profit_loss_tenant_period ON journal_entry_lines(tenantId, entryDate) 
  WHERE accountType IN ('revenue', 'expense');
CREATE INDEX IF NOT EXISTS idx_balance_sheet_tenant ON journal_entry_lines(tenantId, accountId)
  WHERE accountType IN ('asset', 'liability', 'equity');

-- ========================
-- ANALYZE TABLES
-- ========================
-- Update table statistics for query optimizer

ANALYZE customers;
ANALYZE vendors;
ANALYZE invoices;
ANALYZE bills;
ANALYZE journal_entries;
ANALYZE journal_entry_lines;
ANALYZE chart_of_accounts;
ANALYZE items;
ANALYZE transactions;
ANALYZE audit_logs;