# Verification Safeguard Framework

**Purpose**: Before ANY fix is applied, verify the following across all correlated files.

## Pre-Fix Verification Checklist

### Step 1: Schema Verification
- [ ] Check database table definition in `shared/schema.ts`
- [ ] Verify field names (case-sensitive)
- [ ] Verify field types (decimal, varchar, timestamp, etc.)
- [ ] Verify precision/scale for decimal fields
- [ ] Verify default values
- [ ] List ALL fields that will be affected

### Step 2: Type Definition Verification
- [ ] Check `InsertXXX` schema (Zod validation)
- [ ] Check `XXX` type (TypeScript type)
- [ ] Verify which fields are required vs optional
- [ ] Verify `.omit()` calls that exclude fields
- [ ] Verify `.extend()` calls that add validation

### Step 3: Storage Layer Verification
- [ ] Find the storage method (e.g., `createInvoiceWithItems`)
- [ ] Check what parameters it expects
- [ ] Check how it transforms data before insert
- [ ] Verify transaction handling
- [ ] Check error handling

### Step 4: Route Handler Verification
- [ ] Find where data is parsed (Zod validation)
- [ ] Check what fields are passed to storage
- [ ] Verify request payload structure
- [ ] Check if field transformations are needed

### Step 5: End-to-End Flow Verification
- [ ] Client sends data → validate what fields
- [ ] Route handler receives → validate what is received
- [ ] Route handler transforms → document the transformation
- [ ] Storage layer inserts → verify what fields are written
- [ ] Database stores → verify field types match

### Step 6: Type Compatibility Verification
- [ ] TaxCalculator returns type X → can it be assigned to schema field type Y?
- [ ] Number/Decimal conversion: is `.toFixed(2)` the right approach?
- [ ] String/Decimal conversion: how does Zod parse it?
- [ ] Are there precision/scale issues?

## Applied Fixes Using This Framework

### Fix 1: Invoice Tax Calculation
**Verification:**
- [x] Schema: `taxAmount` (decimal, 12.2)
- [x] Type: Required, no `.omit()` excludes it
- [x] Storage: `createInvoiceWithItems` accepts `invoice` object
- [x] Route: Receives lineItems, must calculate before storage
- [x] TaxCalculator returns: `{totalTax: number}`
- [x] Conversion: `number → decimal(12,2)` via `.toFixed(2)` ✅

**Applied Fix:**
```typescript
taxAmount: taxCalc.totalTax.toFixed(2)  // Changed from "totalTax"
```

### Fix 2: Bills Tax Calculation
**Verification:**
- [x] Schema: `taxAmount` (decimal, 12.2) - identical to invoices
- [x] Type: Required, same as invoices
- [x] Storage: `createBillWithItems` accepts `bill` object
- [x] Route: Same pattern as invoices
- [x] TaxCalculator: Same return type

**Applied Fix:**
```typescript
taxAmount: taxCalc.totalTax.toFixed(2)  // Changed from "totalTax"
```

### Fix 3: Payments Currency Handling
**Verification:**
- [x] Schema: Has `exchangeRate` (decimal, 20.10)
- [x] Schema: Has `currencyCode` (varchar)
- [x] Schema: DOES NOT have `convertedAmount`, `conversionDate`
- [x] Storage: `createPayment` method signature
- [x] Decision: Remove attempt to set non-existent fields ✅

**Applied Fix:**
```typescript
// REMOVED: Attempted to set exchangeRate, convertedAmount, conversionDate
// REASON: exchangeRate exists but other fields don't - schema mismatch
// TODO: Future enhancement - handle multi-currency at different layer
```

## Verification Applied To:
1. ✅ Invoice tax calculation
2. ✅ Bills tax calculation
3. ✅ Payments currency handling

## Future Fixes Must Follow This Framework
- Never assume field names
- Never assume field types
- Never assume optional vs required
- Always verify end-to-end flow
- Always check type compatibility
- Test after each fix with workflow restart
