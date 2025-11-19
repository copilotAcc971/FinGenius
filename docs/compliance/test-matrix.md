# IFRS Compliance Test Matrix

**Version:** 1.0  
**Last Updated:** 2025-11-19  
**Purpose:** Define end-to-end test scenarios for IFRS compliance features

---

## Test Environment Setup

### Prerequisites:
- Multi-tenant environment with test tenants
- Sample chart of accounts with proper tags
- Test inventory items with varying costs and NRV values
- Multi-currency setup (USD base, EUR/GBP foreign)
- Test users with different permission levels

### Test Data Requirements:
```
Tenants:
  - TenantA: Single currency (USD)
  - TenantB: Multi-currency (USD, EUR, GBP)
  
Users:
  - Admin: Full permissions
  - Accountant: Read all, write accounting
  - Auditor: Read-only
  
Inventory Items:
  - Item001: Cost $100, NRV $120 (no write-down)
  - Item002: Cost $100, NRV $80 (write-down required)
  - Item003: Cost $50, NRV $45 (minimal write-down)
  
Accounts:
  - All accounts tagged with IAS 7 categories
  - P&L accounts tagged with IFRS 18 categories
```

---

## IAS 2 - Inventory NRV Assessment

### Test Scenario 1: NRV Assessment Creation and Approval

**Test ID:** IAS2-001  
**Priority:** High  
**Objective:** Verify end-to-end NRV assessment workflow from identification to journal entry posting

#### Test Steps:

1. **Setup**
   - Login as Accountant
   - Navigate to `/inventory/nrv-assessments`
   - Verify permission `nrv.read` allows page access

2. **Identify Items Requiring Assessment**
   - Check "Items Requiring NRV Assessment" card appears
   - Verify Item002 (Cost $100, NRV $80) is flagged
   - Verify Item001 (Cost $100, NRV $120) is NOT flagged
   - Click "Assess" button on Item002

3. **Create NRV Assessment**
   - Verify NRV Assessment Dialog opens
   - Verify fields auto-populate:
     - Item: Item002
     - Assessment Date: Today
     - Cost Value: $100.00
     - NRV Value: $80.00
     - Write-Down Amount: $20.00 (auto-calculated)
   - Add notes: "Market price declined due to obsolescence"
   - Click "Create Assessment"
   - Verify success toast appears

4. **Review Assessment**
   - Verify new assessment appears in table with status "pending"
   - Verify write-down amount displayed in red
   - Verify "Approve" button is visible (requires `nrv.write` permission)

5. **Approve Assessment**
   - Click "Approve" button
   - Verify confirmation or immediate action
   - Verify status changes to "approved"
   - Verify success toast: "Journal entry has been created"

6. **Verify Journal Entry Created**
   - Navigate to `/journal-entries`
   - Find entry with reference `NRV-[assessmentId]`
   - Verify entry details:
     ```
     DR  Inventory Write-Down Expense    $20.00
         CR  Inventory Asset              $20.00
     ```
   - Verify source document type: "nrv_assessment"
   - Verify entry is auto-generated
   - Verify status is "posted"

7. **Verify Balance Sheet Impact**
   - Navigate to `/reports` → Financial tab → Balance Sheet
   - Verify Inventory Asset reduced by $20.00

8. **Verify P&L Impact**
   - Navigate to `/reports` → Financial tab → P&L
   - Verify "Inventory Write-Down Expense" line appears
   - Verify amount: $20.00

9. **Verify Inventory Valuation Report**
   - Navigate to `/inventory/reports`
   - Export inventory valuation
   - Verify Item002 shows:
     - Cost: $100.00
     - NRV: $80.00
     - Valuation: $80.00 (lower of cost or NRV)
     - Write-Down Flag: Yes

#### Expected Results:
- ✅ Assessment workflow completes successfully
- ✅ Journal entry auto-created with correct accounts and amounts
- ✅ Balance sheet reflects reduced inventory value
- ✅ P&L shows write-down expense
- ✅ Audit trail complete (source document linkage)

#### Edge Cases to Test:
- NRV assessment where write-down = $0 (Cost = NRV)
- Bulk assessment of multiple items
- Assessment rejection/cancellation
- Permission denial for user without `nrv.write`
- Reversal of write-down when NRV recovers

---

### Test Scenario 2: NRV Write-Down Reversal

**Test ID:** IAS2-002  
**Priority:** Medium  
**Objective:** Verify write-down reversal when NRV recovers

#### Test Steps:

1. **Setup** (continuing from IAS2-001)
   - Item002 previously written down from $100 to $80
   - Market conditions improve, NRV now $95

2. **Create Reversal Assessment**
   - Navigate to `/inventory/nrv-assessments`
   - Create new assessment for Item002:
     - Cost Value: $100.00
     - NRV Value: $95.00
     - Write-Down Amount: $5.00 (remaining write-down)
   - Notes: "Partial NRV recovery due to improved market"
   - Approve assessment

3. **Verify Reversal Entry**
   - Find journal entry with reference `NRV-REV-[assessmentId]`
   - Verify entry:
     ```
     DR  Inventory Asset                      $15.00
         CR  Inventory Write-Down Recovery    $15.00
     ```
   - Reversal amount = Previous Write-Down ($20) - New Write-Down ($5) = $15

4. **Verify Reports**
   - Balance Sheet: Inventory increased by $15
   - P&L: "Inventory Write-Down Recovery" income of $15
   - Valuation Report: Item002 valued at $95 (lower of $100 cost or $95 NRV)

#### Expected Results:
- ✅ Partial reversal calculated correctly
- ✅ Cannot reverse more than original write-down
- ✅ Recovery shown as income in P&L

---

## IAS 7 - Cash Flow Classification

### Test Scenario 3: Cash Flow Classification Validation

**Test ID:** IAS7-001  
**Priority:** High  
**Objective:** Verify cash flow transactions properly classified by IAS 7 category

#### Test Steps:

1. **Verify Account Setup**
   - Navigate to `/accounts`
   - Verify all accounts have IAS 7 tags:
     - Cash accounts: "operating"
     - PPE purchases: "investing"
     - Loan receipts/payments: "financing"

2. **Create Test Transactions**
   - **Operating:** Invoice payment received ($1,000)
   - **Investing:** Purchase equipment ($5,000)
   - **Financing:** Loan repayment ($2,000)

3. **Generate Cash Flow Statement**
   - Navigate to `/reports` → Financial tab → Cash Flow
   - Select test period
   - Click "Generate Report"

4. **Verify Classifications**
   - Operating Activities section:
     - Shows invoice payment: +$1,000
   - Investing Activities section:
     - Shows equipment purchase: -$5,000
   - Financing Activities section:
     - Shows loan repayment: -$2,000

5. **Verify Reconciliation**
   - Net Cash Flow = $1,000 - $5,000 - $2,000 = -$6,000
   - Ending Cash = Beginning Cash + Net Cash Flow
   - Verify reconciliation badge shows "Reconciled ✓"

6. **Test Missing Tag Validation**
   - Create new account without IAS 7 tag
   - Attempt to post transaction to this account
   - Verify system prevents posting or shows warning
   - Verify error message guides user to add tag

#### Expected Results:
- ✅ All transactions correctly classified
- ✅ Cash flow statement balances
- ✅ Reconciliation to balance sheet passes
- ✅ Missing tag validation enforced

---

## IAS 21 - Foreign Exchange Translation

### Test Scenario 4: FX Translation and OCI Posting

**Test ID:** IAS21-001  
**Priority:** High  
**Objective:** Verify multi-currency translation and OCI posting for unrealized gains/losses

#### Test Steps:

1. **Setup Multi-Currency Environment**
   - Login as Admin for TenantB (multi-currency)
   - Navigate to `/settings/currencies`
   - Verify functional currency: USD
   - Verify active currencies: EUR, GBP
   - Verify auto-fetch rates enabled

2. **Create Foreign Currency Transaction**
   - Create invoice in EUR: €1,000
   - Exchange rate at invoice date: 1.10 (= $1,100 USD)
   - Verify invoice recorded at $1,100 equivalent

3. **Wait for Exchange Rate Change**
   - Simulate rate change: EUR now 1.15
   - Invoice still unpaid (open AR balance)

4. **Trigger FX Translation**
   - Navigate to `/reports` → FX Translation
   - Click "Run Translation" (or wait for nightly job)
   - Verify translation run status: "Completed"

5. **Verify Unrealized FX Gain**
   - Translation adjustment = €1,000 × (1.15 - 1.10) = $50 gain
   - Navigate to `/reports` → Financial → Equity Statement
   - Verify OCI section shows:
     - "Foreign Currency Translation Adjustments": +$50

6. **Settle Invoice (Realize Gain)**
   - Receive payment: €1,000 at rate 1.15 = $1,150
   - Original booking: $1,100
   - Realized gain: $50

7. **Verify Realized FX Gain in P&L**
   - Navigate to `/reports` → Financial → P&L
   - Verify "Realized FX Gains" line item shows $50
   - Verify classified under "Other Income/Expense"

8. **Verify IAS 21 Disclosure**
   - Check P&L report top banner
   - Verify disclosure appears:
     - "This entity operates in multiple currencies"
     - "Functional currency: USD"
     - Link to FX translation history

9. **Test Export**
   - Export P&L to Excel
   - Verify includes "Realized FX Gains/Losses" section
   - Export Equity Statement
   - Verify OCI detail sheet included

#### Expected Results:
- ✅ Unrealized gains/losses posted to OCI
- ✅ Realized gains/losses posted to P&L
- ✅ IAS 21 disclosure banner displays correctly
- ✅ Translation history traceable
- ✅ Exports include FX disclosures

#### Edge Cases:
- Multiple foreign currencies in same transaction
- FX loss scenarios (rate decreases)
- Translation of equity items (historical rate)
- Reversal of OCI when realized

---

## IFRS 18 - Presentation and Disclosure

### Test Scenario 5: IFRS 18 Metadata Enforcement and Subtotals

**Test ID:** IFRS18-001  
**Priority:** High  
**Objective:** Verify IFRS 18 category tagging and subtotal calculations in P&L

#### Test Steps:

1. **Verify Account Tagging**
   - Navigate to `/accounts`
   - Filter to P&L accounts (Revenue, Expenses)
   - Verify each account has IFRS 18 tag:
     - `operating` - Sales Revenue, COGS, Operating Expenses
     - `investing` - Investment Income, Gain on Asset Sale
     - `financing` - Interest Income, Interest Expense
     - `income_tax` - Income Tax Expense

2. **Test Missing Tag Warning**
   - Create new P&L account without IFRS 18 tag
   - Navigate to `/reports` → Financial → P&L
   - Verify warning badge appears: "⚠ Accounts missing IFRS 18 tags"
   - Click warning to see list of untagged accounts

3. **Generate P&L with IFRS 18 Subtotals**
   - Create test transactions:
     - Operating Revenue: $10,000
     - Operating Expenses: $6,000
     - Investment Income: $500
     - Interest Expense: $200
     - Income Tax: $800
   - Generate P&L report

4. **Verify Subtotal Calculations**
   - **Operating Profit**: $10,000 - $6,000 = $4,000
   - **Profit Before Financing**: $4,000 + $500 = $4,500
   - **Profit Before Tax**: $4,500 - $200 = $4,300
   - **Net Profit**: $4,300 - $800 = $3,500

5. **Verify IFRS 18 Structure Panel**
   - Locate collapsible "IFRS 18 Structure" panel
   - Click to expand
   - Verify breakdown by category:
     - Operating: Revenue $10,000, Expenses $(6,000)
     - Investing: Income $500
     - Financing: Expense $(200)
     - Income Tax: $(800)
   - Verify color coding or visual distinction

6. **Test Export with IFRS 18 Metadata**
   - Export P&L to Excel
   - Verify main sheet includes "IFRS 18 Category" column
   - Verify separate "Metadata" sheet exists with:
     - Category summary table
     - Subtotal reconciliation
     - Tagging completeness %

7. **Test CSV Export**
   - Export P&L to CSV
   - Verify "IFRS 18 Category" column included
   - Verify each line item shows its category

#### Expected Results:
- ✅ All subtotals calculate correctly
- ✅ Missing tag warnings functional
- ✅ IFRS 18 structure panel displays properly
- ✅ Excel export includes metadata sheet
- ✅ CSV export includes category column

#### Edge Cases:
- Accounts with no category assigned
- Mixed category transactions in same account (should not occur)
- Period comparison with different tagging
- Drill-down to account detail from subtotal

---

## Integration Test Scenarios

### Test Scenario 6: End-to-End Month-End Close

**Test ID:** INT-001  
**Priority:** Critical  
**Objective:** Verify complete month-end close workflow with all IFRS features

#### Test Steps:

1. **Pre-Close Preparation**
   - Run NRV assessment for all inventory items
   - Approve all pending write-downs
   - Trigger FX translation (if multi-currency)
   - Review and post all pending journal entries
   - Verify all accounts have required tags (IAS 7, IFRS 18)

2. **Generate Financial Statement Package**
   - Balance Sheet
   - P&L with IFRS 18 subtotals
   - Cash Flow Statement with IAS 7 classification
   - Statement of Changes in Equity (with OCI)
   - Financial Statement Notes

3. **Quality Validation**
   - Balance Sheet balances (Assets = Liabilities + Equity)
   - Cash Flow reconciles to Balance Sheet
   - P&L Net Profit matches Equity Statement
   - All disclosures present (IAS 21 banner, IFRS 18 structure)
   - No missing tag warnings

4. **Export Package**
   - Export all reports to Excel
   - Verify cross-references work
   - Verify metadata sheets included
   - Generate PDF versions

5. **Audit Trail Verification**
   - Extract audit logs for period
   - Verify all NRV approvals logged
   - Verify all FX translations logged
   - Verify all manual journal entries logged
   - Confirm SOX compliance

#### Expected Results:
- ✅ Complete financial statement package generated
- ✅ All IFRS requirements met
- ✅ Cross-statement reconciliations pass
- ✅ Audit trail complete and traceable
- ✅ Reports suitable for external audit

---

## Performance Test Scenarios

### Test Scenario 7: Large Dataset Performance

**Test ID:** PERF-001  
**Priority:** Medium  
**Objective:** Verify IFRS features perform with production-scale data

#### Test Data Scale:
- 10,000 inventory items
- 500 items requiring NRV assessment
- 50,000 journal entry lines
- Multi-currency: 10 foreign currencies
- 3 years of historical data

#### Tests:
1. NRV assessment list page load time < 2 seconds
2. FX translation run completes in < 5 minutes
3. P&L with IFRS 18 subtotals renders in < 3 seconds
4. Excel export of large report < 10 seconds
5. Cash flow statement generation < 3 seconds

---

## Regression Test Checklist

Run after any code changes affecting IFRS features:

### IAS 2:
- [ ] NRV assessment creation
- [ ] Journal entry auto-generation
- [ ] Write-down approval workflow
- [ ] Valuation report accuracy

### IAS 7:
- [ ] Cash flow classification
- [ ] Reconciliation validation
- [ ] Missing tag prevention
- [ ] Report export

### IAS 21:
- [ ] FX translation execution
- [ ] OCI posting for unrealized gains/losses
- [ ] P&L posting for realized gains/losses
- [ ] Disclosure banner display

### IFRS 18:
- [ ] Account tagging validation
- [ ] Subtotal calculations
- [ ] Structure panel display
- [ ] Export metadata inclusion

---

## Test Execution Log Template

| Test ID | Date | Tester | Status | Notes |
|---------|------|--------|--------|-------|
| IAS2-001 | | | | |
| IAS2-002 | | | | |
| IAS7-001 | | | | |
| IAS21-001 | | | | |
| IFRS18-001 | | | | |
| INT-001 | | | | |
| PERF-001 | | | | |

**Status Values:** Pass ✅ | Fail ❌ | Blocked 🚫 | Skipped ⊘

---

## Defect Tracking

Template for documenting test failures:

```
Defect ID: DEF-XXXX
Test ID: [Test that failed]
Severity: Critical | High | Medium | Low
Steps to Reproduce:
  1. ...
  2. ...
Expected Result: ...
Actual Result: ...
Screenshots/Logs: [attach]
Assigned To: ...
Status: Open | In Progress | Fixed | Closed
```

---

## Sign-Off

### Test Completion Criteria:
- [ ] All High priority tests executed and passed
- [ ] All Critical defects resolved
- [ ] Performance benchmarks met
- [ ] Documentation reviewed and approved
- [ ] External auditor consulted (if applicable)

### Approvals:
- **Tested By:** ________________ Date: ________
- **Reviewed By:** ________________ Date: ________
- **Approved By:** ________________ Date: ________

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-19 | Initial test matrix creation | System |
