# IFRS Compliance Checklist

**Version:** 1.0  
**Last Updated:** 2025-11-19  
**Effective Date:** FY 2025

---

## Overview

This checklist provides a comprehensive framework for ensuring IFRS compliance across the Copilot Accountant application. Each standard is documented with implementation status, key requirements, and verification steps.

---

## IAS 1 - Presentation of Financial Statements

### Status: ✅ **IMPLEMENTED**

### Key Requirements:
- [x] Complete set of financial statements
- [x] Statement of Financial Position (Balance Sheet)
- [x] Statement of Profit or Loss and Other Comprehensive Income (P&L)
- [x] Statement of Changes in Equity
- [x] Statement of Cash Flows
- [x] Notes to Financial Statements

### Implementation Details:
1. **Statement of Changes in Equity** - `/reports → Equity Statement tab`
   - Opening balances by equity component
   - Profit/Loss for the period
   - OCI items (FX translation adjustments)
   - Dividends and other distributions
   - Closing balances

2. **Financial Statement Notes** - `/reports/financial-statement-notes`
   - Accounting policies
   - Contingent liabilities and assets
   - Related party transactions
   - Subsequent events
   - Going concern assessments
   - Significant accounting judgments

### Verification Steps:
- [ ] Generate all five financial statements for a test period
- [ ] Verify cross-references between statements
- [ ] Confirm note disclosure completeness
- [ ] Review accounting policy disclosures

---

## IAS 2 - Inventories

### Status: ✅ **IMPLEMENTED**

### Key Requirements:
- [x] Measure inventory at lower of cost and Net Realizable Value (NRV)
- [x] Systematic NRV assessment process
- [x] Write-down recognition in P&L
- [x] Reversal of write-downs when NRV recovers
- [x] Inventory valuation disclosure

### Implementation Details:
1. **NRV Assessment Workflow** - `/inventory/nrv-assessments`
   - Identify items requiring NRV assessment
   - Calculate NRV (selling price - costs to complete - selling costs)
   - Compare cost vs. NRV
   - Flag items for write-down (Cost > NRV)
   - Create assessment records with justification

2. **Automated Journal Entries**
   - Write-Down Entry:
     ```
     DR  Inventory Write-Down Expense (P&L)    [amount]
         CR  Inventory Asset                   [amount]
     ```
   - Reversal Entry (when NRV recovers):
     ```
     DR  Inventory Asset                       [amount]
         CR  Inventory Write-Down Recovery     [amount]
     ```

3. **Inventory Valuation Reports** - `/inventory/reports`
   - Cost per unit
   - NRV per unit
   - Valuation amount (lower of cost or NRV)
   - Write-down indicators
   - Total inventory value

### Verification Steps:
- [ ] Create NRV assessment for an item where Cost > NRV
- [ ] Approve assessment and verify journal entry created
- [ ] Check P&L shows write-down expense
- [ ] Verify inventory asset reduced on balance sheet
- [ ] Export inventory valuation report
- [ ] Confirm write-down disclosure in notes

### Related Permissions:
- `nrv.read` - View NRV assessments
- `nrv.write` - Create and approve NRV assessments

---

## IAS 7 - Statement of Cash Flows

### Status: ✅ **IMPLEMENTED**

### Key Requirements:
- [x] Classify cash flows into Operating, Investing, and Financing activities
- [x] Reconcile opening and closing cash balances
- [x] Indirect method for operating activities
- [x] IAS 7 tag enforcement on accounts

### Implementation Details:
1. **Account Classification** - Chart of Accounts setup
   - Each account tagged with IAS 7 category:
     - `operating` - Operating activities
     - `investing` - Investing activities (PPE, investments)
     - `financing` - Financing activities (loans, equity)
   - System prevents posting to accounts without IAS 7 tag

2. **Cash Flow Statement** - `/reports → Cash Flow tab`
   - Net cash from operating activities
   - Net cash from investing activities
   - Net cash from financing activities
   - Net change in cash
   - Reconciliation to cash on balance sheet

3. **Validation Rules**
   - Beginning Cash + Net Change = Ending Cash
   - Red warning badge if reconciliation fails
   - All cash-impacting accounts must have IAS 7 classification

### Verification Steps:
- [ ] Create journal entries impacting each activity type
- [ ] Generate cash flow statement
- [ ] Verify correct classification of transactions
- [ ] Confirm reconciliation to balance sheet cash
- [ ] Test validation warnings for missing tags

---

## IAS 21 - The Effects of Changes in Foreign Exchange Rates

### Status: ✅ **IMPLEMENTED**

### Key Requirements:
- [x] Multi-currency transaction support
- [x] Automatic FX translation at closing rates
- [x] Translation adjustments in OCI (for equity items)
- [x] Realized FX gains/losses in P&L
- [x] Unrealized FX gains/losses in OCI
- [x] IAS 21 disclosure in financial reports

### Implementation Details:
1. **Multi-Currency Setup** - `/settings/currencies`
   - Define functional currency
   - Add foreign currencies
   - Auto-fetch exchange rates (daily)
   - Manual rate overrides allowed

2. **FX Translation Engine** - Automated nightly job
   - Monetary items: Closing rate
   - Non-monetary items: Historical rate
   - Equity items: Historical rate
   - Translation adjustments → OCI

3. **FX Gains/Losses**
   - **Realized** (settled transactions) → P&L, Other Income/Expense
   - **Unrealized** (open balances) → OCI, Equity section
   - Automatic calculation on translation run

4. **Disclosure Banner** - P&L Report
   - Shows if tenant uses multiple currencies
   - Displays functional currency
   - Links to FX translation history
   - Warns about rate volatility

### Verification Steps:
- [ ] Set up multi-currency environment
- [ ] Create invoice in foreign currency
- [ ] Run FX translation
- [ ] Verify P&L shows realized FX gain/loss line item
- [ ] Verify OCI shows unrealized translation adjustments
- [ ] Check IAS 21 disclosure banner appears
- [ ] Export equity statement with OCI items

### Related Permissions:
- `fx.read` - View FX rates and translations
- `fx.write` - Trigger manual FX translation
- `fx.admin` - Override exchange rates

---

## IFRS 18 - Presentation and Disclosure in Financial Statements

### Status: ✅ **IMPLEMENTED** (Early Adoption)

**Effective Date:** January 1, 2027 (Early adoption permitted)

### Key Requirements:
- [x] Categorize P&L line items by nature
- [x] Calculate defined subtotals
- [x] Operating Profit disclosure
- [x] Profit Before Financing disclosure
- [x] Enhanced operating vs. investing/financing distinction

### Implementation Details:
1. **IFRS 18 Account Tagging** - Chart of Accounts
   - Tag each P&L account with category:
     - `operating` - Operating activities
     - `investing` - Investing activities
     - `financing` - Financing activities
     - `income_tax` - Income tax expense
   - Warning system for accounts without tags

2. **Subtotal Calculations** - P&L Report
   - **Operating Profit**: Operating Revenue - Operating Expenses
   - **Profit Before Financing**: Operating Profit + Investing Income/Expense
   - **Profit Before Tax**: Profit Before Financing + Financing Income/Expense
   - **Net Profit**: Profit Before Tax - Income Tax

3. **IFRS 18 Structure Panel** - Collapsible section in P&L
   - Visual breakdown by category
   - Color-coded subtotals
   - Comparison to previous period
   - Missing tag warnings

4. **Export Enhancements**
   - Excel: Includes "IFRS 18 Category" column
   - Excel: Separate metadata sheet with category summary
   - CSV: Category column in main export

### Verification Steps:
- [ ] Tag all P&L accounts with IFRS 18 categories
- [ ] Generate P&L report
- [ ] Verify all three subtotals display correctly
- [ ] Expand IFRS 18 Structure panel
- [ ] Check for missing tag warnings
- [ ] Export to Excel and verify metadata sheet
- [ ] Validate subtotal calculations manually

### Related Permissions:
- `accounts.read` - View account metadata
- `accounts.write` - Update IFRS 18 tags
- `reports.read` - View IFRS 18 disclosures

---

## Compliance Verification Workflow

### Monthly Close Checklist:
1. **Pre-Close**
   - [ ] Run NRV assessment for all inventory items
   - [ ] Approve required write-downs
   - [ ] Trigger FX translation (if multi-currency)
   - [ ] Review and post all pending journal entries

2. **Report Generation**
   - [ ] Balance Sheet (verify equity section)
   - [ ] P&L Statement (check IFRS 18 subtotals)
   - [ ] Cash Flow Statement (verify reconciliation)
   - [ ] Equity Statement (review OCI items)
   - [ ] Financial Statement Notes (update as needed)

3. **Quality Checks**
   - [ ] All accounts have IAS 7 tags
   - [ ] All P&L accounts have IFRS 18 tags
   - [ ] No pending NRV assessments
   - [ ] Cash flow reconciliation passes
   - [ ] FX translation complete (if applicable)

4. **Export & Archive**
   - [ ] Export all reports to Excel/PDF
   - [ ] Save audit trail extracts
   - [ ] Document significant judgments
   - [ ] Archive month-end package

### Quarterly Review:
- [ ] Review NRV assessment trends
- [ ] Analyze FX exposure and volatility
- [ ] Update accounting policy notes
- [ ] Review subsequent events
- [ ] Update going concern assessment

### Annual Audit Preparation:
- [ ] Complete all monthly close items
- [ ] Prepare comprehensive note disclosures
- [ ] Document all significant estimates
- [ ] Extract full audit trail
- [ ] Prepare IFRS compliance summary
- [ ] Review all journal entry reversals

---

## Change Log

| Date       | Change Description                      | Updated By |
|------------|-----------------------------------------|------------|
| 2025-11-19 | Initial checklist creation              | System     |
| 2025-11-19 | Added IAS 2 NRV assessment workflow     | System     |
| 2025-11-19 | Added IAS 21 FX disclosure requirements | System     |
| 2025-11-19 | Added IFRS 18 early adoption details    | System     |

---

## Notes

- This checklist should be reviewed and updated quarterly
- All implementation changes require audit trail documentation
- Permissions must be properly configured before month-end close
- Consult with external auditors before early adopting new standards
