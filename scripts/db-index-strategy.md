# Database Indexing Strategy - Phase 1 Performance Optimization

## Objective
Reduce N+1 queries and optimize database query execution through strategic indexing.

**Current State:** 500 queries for 50 invoices  
**Target State:** 5 queries for 50 invoices  
**Expected Improvement:** 100x reduction in query count

## Index Strategy

### 1. Foreign Key Indices (Mandatory for all FKs)
All foreign key columns should have indices to optimize JOIN operations:

```sql
-- Tenant isolation (filter every query)
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_bills_tenant_id ON bills(tenant_id);
CREATE INDEX idx_journal_entries_tenant_id ON journal_entries(tenant_id);
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_expenses_tenant_id ON expenses(tenant_id);

-- Entity relations
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_bill_line_items_bill_id ON bill_line_items(bill_id);
CREATE INDEX idx_journal_entry_legs_journal_entry_id ON journal_entry_legs(journal_entry_id);
CREATE INDEX idx_journal_entry_legs_account_id ON journal_entry_legs(account_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
```

### 2. WHERE Clause Indices (Filter optimization)
Columns frequently used in WHERE clauses:

```sql
-- Status filtering
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_payments_status ON payments(status);

-- Date-based queries
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_bills_bill_date ON bills(bill_date);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);

-- Soft deletes
CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at);
CREATE INDEX idx_bills_deleted_at ON bills(deleted_at);
CREATE INDEX idx_payments_deleted_at ON payments(deleted_at);
```

### 3. ORDER BY Indices (Sort optimization)
Columns used in sorting operations:

```sql
-- Common sort columns
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX idx_journal_entries_created_at ON journal_entries(created_at DESC);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

### 4. Composite Indices (Multi-column queries)
For common filter + sort combinations:

```sql
-- Tenant + Status + Date (common filter pattern)
CREATE INDEX idx_invoices_tenant_status_date ON invoices(tenant_id, status, invoice_date DESC);
CREATE INDEX idx_bills_tenant_status_date ON bills(tenant_id, status, bill_date DESC);
CREATE INDEX idx_journal_entries_tenant_status_date ON journal_entries(tenant_id, status, entry_date DESC);

-- Tenant + Date (time-based queries)
CREATE INDEX idx_invoices_tenant_date ON invoices(tenant_id, invoice_date DESC);
CREATE INDEX idx_bills_tenant_date ON bills(tenant_id, bill_date DESC);

-- Customer + Date (AR aging)
CREATE INDEX idx_invoices_customer_date ON invoices(customer_id, invoice_date DESC);

-- Vendor + Date (AP aging)
CREATE INDEX idx_bills_vendor_date ON bills(vendor_id, bill_date DESC);

-- Account + Date (trial balance)
CREATE INDEX idx_journal_entry_legs_account_date ON journal_entry_legs(account_id, created_at DESC);
```

### 5. JOIN Optimization Indices
Ensure all join columns are indexed:

```sql
-- Already covered by FK indices above
-- Verify all is well: SELECT * FROM information_schema.statistics 
-- WHERE table_schema = 'public' AND index_type = 'BTREE'
```

## Implementation Plan

### Phase 1: Mandatory Indices (High Impact)
1. **Tenant isolation** - First 8 indices (tenant_id columns)
2. **Foreign keys** - Entity relations (customer_id, vendor_id, account_id, etc.)
3. **Composite indices** - tenant_status_date combinations

**Expected improvement:** 70-80% query reduction

### Phase 2: Optimization Indices (Medium Impact)
1. **Status and date indices** - Single column filters
2. **ORDER BY indices** - Sort optimization

**Expected improvement:** 10-15% additional reduction

### Phase 3: Advanced Indices (Fine-tuning)
1. **Partial indices** - For specific conditions (e.g., WHERE deleted_at IS NULL)
2. **Expression indices** - For computed columns
3. **GiST/GIN indices** - For JSONB and full-text search

**Expected improvement:** 5-10% additional reduction

## Monitoring & Verification

### Index Usage Monitoring
```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indices
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pk_%'
  AND indexname NOT LIKE 'unique_%';
```

### Query Performance Analysis
See `scripts/db-performance-analysis.sql` for EXPLAIN ANALYZE templates.

## Performance Expectations

### Before Optimization
- 50 invoices with line items: **500+ queries**
- Response time: **2-5 seconds**
- Database CPU: **High**

### After Phase 1 Optimization
- 50 invoices with line items: **5-10 queries** (with eager loading)
- Response time: **200-500ms**
- Database CPU: **Low**

### Calculation
N+1 problem sources:
- 1 query for invoices list
- 50 queries for each invoice's customer (N+1 = 51)
- 50 queries for each invoice's line items (N+1 = 51)
- 150 queries for each line item's tax (N+1 = 150)
- Total: ~250+ queries

With eager loading:
- 1 query for invoices with customers
- 1 query for line items with taxes
- 1 query for journal entries (if needed)
- Total: ~5 queries

## Eager Loading Implementation

See `server/storage.ts` for eager loading patterns using Drizzle's `with: {}` syntax.

```typescript
// Example: Get invoices with all relations
const invoices = await db.query.invoices.findMany({
  where: eq(invoices.tenantId, tenantId),
  with: {
    customer: true,
    lineItems: {
      with: {
        tax: true,
      },
    },
    payments: true,
  },
  limit: 50,
  offset: 0,
});
```

## Pagination Implementation

All list endpoints should support pagination:

```typescript
// In storage.ts
interface PaginationOptions {
  limit: number;  // Default 50, max 1000
  offset: number; // For keyset pagination use cursor
  page?: number;  // Alternative: page-based (1-indexed)
}

// Example usage
const result = await storage.getInvoicesByTenant(tenantId, {
  limit: 50,
  offset: 100,
});
```

## Testing & Validation

1. **Unit Tests**: Ensure all methods return correct data
2. **Query Count Tests**: Use query profiling to verify reduction
3. **Performance Tests**: Load test with 1000+ records
4. **Financial Tests**: Ensure calculations remain accurate

See test matrices in `docs/compliance/test-matrix.md`.

## References

- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Drizzle ORM Eager Loading](https://orm.drizzle.team/docs/rqb#left-join)
- [Query Optimization](https://www.postgresql.org/docs/current/using-explain.html)
