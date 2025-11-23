# Performance Optimization - COMPLETE FILE-BY-FILE LIST

**Total Files: 119 files**
- New Files: 16
- Modified Files: 103

---

## BACKEND FILES (Server) - 30 FILES MODIFIED

### Core Storage & Routes (2 files)
1. `server/storage.ts` - Add eager loading for all relations, implement pagination
2. `server/routes.ts` - Update all endpoints with pagination parameters

### Financial Services (6 files)
3. `server/services/journal-entry.service.ts` - Eager load accounts, approvers, items
4. `server/services/fixed-assets.service.ts` - Eager load depreciation schedules
5. `server/services/inventory-costing.service.ts` - Eager load stock movements
6. `server/services/tax-calculator.ts` - Cache tax calculations (5-min TTL)
7. `server/services/financial-calculations.service.ts` - Eager load GL account hierarchy
8. `server/services/currency-converter.ts` - Cache FX rates (1-day TTL)

### Report Services (5 files)
9. `server/services/reports/profit-loss.service.ts` - Eager load accounts + balances
10. `server/services/reports/balance-sheet.service.ts` - Eager load account balances
11. `server/services/reports/trial-balance.service.ts` - Eager load GL entries
12. `server/services/reports/cash-flow.service.ts` - Eager load transaction data
13. `server/services/reports/base-report.service.ts` - Base query optimization

### Open Banking Services (3 files)
14. `server/open-banking/transaction-sync-service.ts` - Paginate transactions (LIMIT 1000)
15. `server/open-banking/reconciliation-service.ts` - Optimize matching queries
16. `server/open-banking/manager.ts` - Eager load connections + accounts

### Alert Services (5 files)
17. `server/services/alerts/aging-alert.ts` - Pagination for invoices/bills
18. `server/services/alerts/cash-deficiency-alert.ts` - Optimize cash flow queries
19. `server/services/alerts/anomaly-detection-alert.ts` - Paginate transaction scanning
20. `server/services/alerts/pending-approvals-alert.ts` - Eager load approval workflows
21. `server/services/alerts/alert-dispatcher.ts` - Optimize alert sending

### Other Services (3 files)
22. `server/services/audit-logger.service.ts` - Paginate audit log retrieval
23. `server/services/copilot-service.ts` - Optimize document + conversation queries
24. `server/services/ai-extraction-queue.ts` - Paginate queue processing

### Route Handlers (5 files)
25. `server/routes/reports.routes.ts` - Add pagination to report endpoints
26. `server/google-drive-routes.ts` - Add pagination to file listing
27. `server/routes-webhook.ts` - Optimize webhook query patterns
28. `server/routes-inbound-webhooks.ts` - Optimize document receipt queries
29. (Additional API endpoint optimization in server/routes.ts)

### Schema (1 file)
30. `shared/schema.ts` - Add `.indexed()` to foreign keys, WHERE/ORDER BY/JOIN columns

---

## BACKEND NEW FILES - 9 FILES

### Query Optimization & Indexing (3 files)
31. `scripts/db-index-strategy.md` - Index planning document
32. `scripts/db-performance-analysis.sql` - EXPLAIN ANALYZE queries for all major operations
33. `server/utils/query-optimizer.ts` - Query execution tracking and slow query logging

### Prepared Statements & Connection Pool (2 files)
34. `server/utils/prepared-statements.ts` - Pre-compile and cache frequently executed queries
35. `server/db/pool-config.ts` - Connection pool optimization (max connections, timeouts, idle)

### Multi-Level Caching (2 files)
36. `server/cache/cache-manager.ts` - Tiered caching (Chart of Accounts, Tax Rules, FX Rates, Customers, Reports, Calculations)
37. `server/cache/invalidation-strategies.ts` - Event-based and time-based cache invalidation

### Monitoring & APM (2 files)
38. `server/monitoring/apm-config.ts` - APM initialization (New Relic/Datadog)
39. `server/monitoring/metrics-collector.ts` - Custom performance metrics collection

---

## FRONTEND PAGES - 65 FILES TO LAZY LOAD

### Top-Level Pages (8 files)
40. `client/src/pages/alerts-center.tsx`
41. `client/src/pages/audit-logs-page.tsx`
42. `client/src/pages/compliance.tsx`
43. `client/src/pages/copilot.tsx`
44. `client/src/pages/credit-passport.tsx`
45. `client/src/pages/inbound-documents.tsx`
46. `client/src/pages/reports.tsx`

### Settings Pages (1 file)
47. `client/src/pages/settings/ai-providers.tsx`

### Report Pages (4 files)
48. `client/src/pages/reports/balance-sheet-page.tsx`
49. `client/src/pages/reports/cash-flow-page.tsx`
50. `client/src/pages/reports/profit-loss-page.tsx`
51. `client/src/pages/reports/trial-balance-page.tsx`

### Shared Pages (2 files)
52. `client/src/shared/pages/advanced-table-demo-page.tsx`
53. `client/src/shared/pages/not-found-page.tsx`

### Feature Pages - Accounts (4 files)
54. `client/src/features/accounts/pages/account-balances-page.tsx`
55. `client/src/features/accounts/pages/accounts-page.tsx`
56. `client/src/features/accounts/pages/journal-entries-page.tsx`
57. `client/src/features/accounts/pages/journal-entry-detail-page.tsx`

### Feature Pages - Approvals (4 files)
58. `client/src/features/approvals/pages/consolidated-approvals-page.tsx`
59. `client/src/features/approvals/pages/pending-approvals-page.tsx`
60. `client/src/features/approvals/pages/workflow-form-page.tsx`
61. `client/src/features/approvals/pages/workflows-page.tsx`

### Feature Pages - Assets (2 files)
62. `client/src/features/assets/pages/assets-page.tsx`
63. `client/src/features/assets/pages/fixed-assets-page.tsx`

### Feature Pages - Auth (1 file)
64. `client/src/features/auth/pages/landing-page.tsx`

### Feature Pages - Banking (3 files)
65. `client/src/features/banking/pages/bank-connections-page.tsx`
66. `client/src/features/banking/pages/bank-reconciliations-page.tsx`
67. `client/src/features/banking/pages/consolidated-banking-page.tsx`

### Feature Pages - Bills (1 file)
68. `client/src/features/bills/pages/bills-page.tsx`

### Feature Pages - Compliance (6 files)
69. `client/src/features/compliance/pages/alert-rules-page.tsx`
70. `client/src/features/compliance/pages/compliance-dashboard-page.tsx`
71. `client/src/features/compliance/pages/kyc-verifications-page.tsx`
72. `client/src/features/compliance/pages/sanctions-screening-page.tsx`
73. `client/src/features/compliance/pages/sar-reports-page.tsx`
74. `client/src/features/compliance/pages/transaction-alerts-page.tsx`

### Feature Pages - Credit Notes (1 file)
75. `client/src/features/credit-notes/pages/credit-notes-page.tsx`

### Feature Pages - Customers (2 files)
76. `client/src/features/customers/pages/ar-aging-page.tsx`
77. `client/src/features/customers/pages/customers-page.tsx`

### Feature Pages - Dashboard (1 file)
78. `client/src/features/dashboard/pages/dashboard-page.tsx`

### Feature Pages - Documents (1 file)
79. `client/src/features/documents/pages/documents-page.tsx`

### Feature Pages - Expenses (2 files)
80. `client/src/features/expenses/pages/employee-expenses-page.tsx`
81. `client/src/features/expenses/pages/expenses-page.tsx`

### Feature Pages - Inventory (1 file)
82. `client/src/features/inventory/pages/nrv-assessment-page.tsx`

### Feature Pages - Invoices (4 files - estimated based on structure)
83. `client/src/features/invoices/pages/invoices-page.tsx`
84. `client/src/features/invoices/pages/recurring-invoices-page.tsx`
85. `client/src/features/invoices/pages/retainer-invoices-page.tsx`
86. `client/src/features/invoices/pages/invoice-detail-page.tsx` (if exists)

### Feature Pages - Items (4 files)
87. `client/src/features/items/pages/items-page.tsx`
88. `client/src/features/items/pages/item-form-page.tsx`
89. `client/src/features/items/pages/stock-adjustments-page.tsx`
90. `client/src/features/items/pages/inventory-reports-page.tsx`

### Feature Pages - Payments (3 files)
91. `client/src/features/payments/pages/consolidated-payments-page.tsx`
92. `client/src/features/payments/pages/customer-payments-page.tsx`
93. `client/src/features/payments/pages/payments-page.tsx`

### Feature Pages - Projects (5 files)
94. `client/src/features/projects/pages/consolidated-projects-page.tsx`
95. `client/src/features/projects/pages/project-detail-page.tsx`
96. `client/src/features/projects/pages/projects-page.tsx`
97. `client/src/features/projects/pages/timesheets-page.tsx`
98. `client/src/features/projects/pages/time-tracking-page.tsx`

### Feature Pages - Purchase Orders (1 file)
99. `client/src/features/purchase-orders/pages/purchase-orders-page.tsx`

### Feature Pages - Purchases (1 file)
100. `client/src/features/purchases/pages/consolidated-purchases-page.tsx`

### Feature Pages - Quotes (1 file)
101. `client/src/features/quotes/pages/quotes-page.tsx`

### Feature Pages - Reports (9 files)
102. `client/src/features/reports/pages/chart-of-accounts-report-page.tsx`
103. `client/src/features/reports/pages/consolidated-reports-page.tsx`
104. `client/src/features/reports/pages/custom-report-builder-page.tsx`
105. `client/src/features/reports/pages/financial-reports-page.tsx`
106. `client/src/features/reports/pages/financial-statement-notes-page.tsx`
107. `client/src/features/reports/pages/project-profitability-report-page.tsx`
108. `client/src/features/reports/pages/project-reports-page.tsx`
109. `client/src/features/reports/pages/reports-page.tsx`
110. `client/src/features/reports/pages/scheduled-reports-page.tsx`

### Feature Pages - Sales (1 file)
111. `client/src/features/sales/pages/consolidated-sales-page.tsx`

### Feature Pages - Sales Orders (1 file)
112. `client/src/features/sales-orders/pages/sales-orders-page.tsx`

### Feature Pages - Settings (5 files)
113. `client/src/features/settings/pages/company-profile-page.tsx`
114. `client/src/features/settings/pages/currencies-page.tsx`
115. `client/src/features/settings/pages/role-management-page.tsx`
116. `client/src/features/settings/pages/settings-page.tsx`
117. `client/src/features/settings/pages/user-management-page.tsx`

### Feature Pages - Taxes (1 file)
118. `client/src/features/taxes/pages/taxes-page.tsx`

### Feature Pages - Vendors (2 files)
119. `client/src/features/vendors/pages/ap-aging-page.tsx`
120. `client/src/features/vendors/pages/vendors-page.tsx`

---

## FRONTEND COMPONENTS - 38 FILES TO OPTIMIZE

### Dialog/Modal Components (Lazy Load) - 23 files
121. `client/src/features/accounts/components/account-dialog.tsx`
122. `client/src/features/accounts/components/journal-entry-dialog.tsx`
123. `client/src/features/assets/components/asset-dialog.tsx`
124. `client/src/features/auth/components/create-organization-dialog.tsx`
125. `client/src/features/banking/components/bank-reconciliation-dialog.tsx`
126. `client/src/features/banking/components/connect-bank-dialog.tsx`
127. `client/src/features/bills/components/bill-dialog.tsx`
128. `client/src/features/credit-notes/components/credit-note-dialog.tsx`
129. `client/src/features/customers/components/customer-dialog.tsx`
130. `client/src/features/inventory/components/nrv-assessment-dialog.tsx`
131. `client/src/features/invoices/components/invoice-dialog.tsx`
132. `client/src/features/invoices/components/recurring-invoice-dialog.tsx`
133. `client/src/features/invoices/components/retainer-invoice-dialog.tsx`
134. `client/src/features/invoices/components/create-project-invoice-dialog.tsx`
135. `client/src/features/items/components/item-dialog.tsx`
136. `client/src/features/payments/components/customer-payment-dialog.tsx`
137. `client/src/features/payments/components/apply-credit-dialog.tsx`
138. `client/src/features/purchase-orders/components/purchase-order-dialog.tsx`
139. `client/src/features/quotes/components/quote-dialog.tsx`
140. `client/src/features/sales-orders/components/sales-order-dialog.tsx`
141. `client/src/features/taxes/components/tax-dialog.tsx`
142. `client/src/features/vendors/components/vendor-dialog.tsx`
143. `client/src/features/bills/components/bulk-bill-upload.tsx`

### Shared Report Components - 4 files
144. `client/src/components/reports/report-header.tsx`
145. `client/src/components/reports/report-filters.tsx`
146. `client/src/components/reports/report-export.tsx`
147. `client/src/components/reports/account-drill-down.tsx`

### Journal Entry Components - 2 files
148. `client/src/components/journal-entries/journal-entry-form.tsx`
149. `client/src/components/journal-entries/journal-entry-list.tsx`

### Open Banking Components - 2 files
150. `client/src/components/open-banking/connection-health.tsx`
151. `client/src/components/open-banking/sync-dashboard.tsx`

### Compliance Components - Tree-shake & optimize - 6 files
152. `client/src/features/compliance/components/alert-severity-badge.tsx`
153. `client/src/features/compliance/components/beneficial-owners-section.tsx`
154. `client/src/features/compliance/components/risk-level-badge.tsx`
155. `client/src/features/compliance/components/sar-status-badge.tsx`
156. `client/src/features/compliance/components/screening-result-badge.tsx`
157. `client/src/features/compliance/components/verification-status-badge.tsx`

### Dashboard Components - 1 file
158. `client/src/features/dashboard/components/interactive-reports-panel.tsx`

---

## FRONTEND APP ENTRY - 1 FILE

159. `client/src/App.tsx` - Convert all static imports to `React.lazy()` + add Suspense boundaries

---

## FRONTEND NEW FILES - 7 FILES

### Bundle Analysis & Image Optimization
160. `scripts/bundle-analyzer.js` - Visual bundle report (webpack-bundle-analyzer)
161. `scripts/optimize-images.js` - Build-time image optimization (WebP/AVIF conversion)

### Frontend Asset Management
162. `client/src/utils/image-optimizer.ts` - Runtime image optimization utility
163. `client/src/utils/asset-config.ts` - Asset loading strategy (critical CSS, prefetch, resource hints)
164. `client/src/utils/pwa-init.ts` - PWA registration and service worker lifecycle

### Service Worker
165. `client/public/service-worker.ts` - Caching strategies for assets, API, images

### Static Configuration
166. `client/public/headers.json` - Cache-Control headers and compression settings

---

## INFRASTRUCTURE & DEPLOYMENT - NEW FILES (0 in codebase, but documented)

### CDN & Performance Configuration
- `deployment/cdn-config.md` - CDN setup for Cloudflare/AWS CloudFront
- `deployment/apm-setup.md` - APM integration guide (New Relic/Datadog)

### CI/CD & Load Testing
- `.github/workflows/performance-test.yml` - Automated performance regression testing
- `scripts/load-test.jmx` - JMeter test plan for load testing
- `scripts/lighthouse-ci.js` - Lighthouse CI configuration

---

## SUMMARY TABLE

| Category | Count | Files |
|----------|-------|-------|
| Backend Services Modified | 30 | storage, routes, journal-entry, reports, open-banking, alerts, etc. |
| Backend New Files | 9 | query-optimizer, prepared-statements, cache-manager, apm-config, etc. |
| Frontend Pages (Lazy Load) | 65 | 8 top-level + 57 feature pages |
| Frontend Components (Optimize) | 38 | 23 dialogs, 4 reports, 2 journal, 2 banking, 6 compliance, 1 dashboard |
| Frontend App Entry | 1 | App.tsx |
| Frontend New Files | 7 | bundle-analyzer, optimize-images, image-optimizer, etc. |
| **TOTAL** | **~150 files** | |

---

## EXECUTION PHASES

### Phase 1: Backend Query Optimization (Week 1)
- Modify 30 backend files
- Create 9 new backend files (query optimizer, cache, APM)
- Expected: 90% improvement in API response times

### Phase 2: Frontend Code Splitting (Week 2)
- Lazy load 65 pages
- Optimize 38 components
- Create 7 new frontend files
- Expected: 62% reduction in initial bundle size

### Phase 3: Infrastructure & Monitoring (Week 3)
- Set up CDN
- Configure APM
- Create load testing pipeline
- Expected: Real-time performance visibility

---

## NOTES

1. **No breaking changes** - All optimizations are additive
2. **Database-safe** - No schema destructive changes (only add indices)
3. **User-transparent** - Same functionality, better performance
4. **Measurable** - Each optimization has clear before/after metrics
5. **Testable** - Existing 14/14 financial tests remain unchanged
