# Phase 6: Open Banking Integration with Lean Technologies
## Comprehensive Implementation Plan

**Competitive Advantage**: Enable UAE businesses to connect their bank accounts directly for real-time reconciliation, cash flow visibility, and automated payment processing—something Zoho Books doesn't offer seamlessly.

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Core Components
```
┌─────────────────────────────────────────────────────────┐
│ Frontend: Bank Connection Flow                          │
│ - OAuth2 redirect to Lean Link SDK                      │
│ - Connected banks list + management UI                  │
│ - Transaction view & reconciliation dashboard           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Backend API Layer (routes.ts)                           │
│ - /api/bank-connections (CRUD + OAuth callback)        │
│ - /api/bank-accounts (list, balance, transactions)     │
│ - /api/bank-transactions (filtered, paginated)         │
│ - /api/reconciliation (match, suggest, auto-reconcile) │
│ - /api/payment-instructions (initiate payments)        │
│ - /webhooks/lean (webhook listener)                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Business Logic Services                                 │
│ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ Lean Provider    │ │ Transaction Sync Service     │ │
│ │ - OAuth2 flow    │ │ - Daily sync job (2 AM UTC)  │ │
│ │ - API calls      │ │ - Incremental updates        │ │
│ │ - Encryption     │ │ - Error retry logic          │ │
│ └──────────────────┘ └──────────────────────────────┘ │
│ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ Reconciliation   │ │ Payment Service              │ │
│ │ - AI matching    │ │ - Payment instruction        │ │
│ │ - Variance calc  │ │ - Payment tracking           │
│ │ - Auto-suggest   │ │ - Webhook handling           │ │
│ └──────────────────┘ └──────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Database Schema (shared/schema.ts)                      │
│ - bank_connections (OAuth state + credentials)         │
│ - bank_accounts (connected accounts metadata)          │
│ - bank_transactions (synced transactions)              │
│ - transaction_reconciliation (matching rules + state)  │
│ - payment_instructions (outgoing payments)             │
│ - payment_execution_logs (audit trail)                 │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow - Transaction Sync
```
Daily Job (2 AM UTC)
  ↓
[Transaction Sync Service] - Get last sync date
  ↓
[Lean API] - Fetch new transactions since last sync
  ↓
[Transform & Encrypt] - Normalize data, encrypt credentials
  ↓
[Store in DB] - bank_transactions table
  ↓
[Trigger AI Reconciliation] - Match against journal entries
  ↓
[Create Suggestions] - Store in transaction_reconciliation
  ↓
[Notify via Dashboard] - WebSocket update to UI
```

### 1.3 Data Flow - OAuth2 Connection
```
User clicks "Connect Bank"
  ↓
[Backend] Generate state + PKCE, save in nonce_store
  ↓
[Redirect to Lean] OAuth2 authorization URL
  ↓
[User] Authenticate with Lean, authorize app
  ↓
[Lean] Redirect to /api/bank-connections/callback?code=...&state=...
  ↓
[Backend] Verify state, exchange code for tokens
  ↓
[Backend] Encrypt tokens, save to bank_connections table
  ↓
[Backend] Fetch connected accounts + initial balance
  ↓
[Frontend] Show success, display connected accounts
```

---

## 2. DATABASE SCHEMA DESIGN

### 2.1 New Tables Required

#### bank_connections
Stores OAuth connection state and encrypted credentials per tenant/user
```sql
- id (UUID, PK)
- tenantId (UUID, FK)
- userId (UUID, FK)
- provider ('lean_technologies')
- externalEntityId (string) -- Lean's entity_id
- externalCustomerId (string) -- Lean's customer_id
- accessToken (encrypted)
- refreshToken (encrypted)
- tokenExpiresAt (timestamp)
- status ('connected' | 'disconnected' | 'expired' | 'error')
- errorMessage (nullable string)
- connectedAt (timestamp)
- lastSyncedAt (timestamp, nullable)
- disconnectedAt (timestamp, nullable)
- webhookSecret (encrypted, for this connection)
- metadata (JSONB: bank name, country, account count, etc.)
- createdAt, updatedAt
```

#### bank_accounts
Linked bank accounts from connected banks
```sql
- id (UUID, PK)
- bankConnectionId (UUID, FK)
- tenantId (UUID, FK)
- externalAccountId (string) -- Lean's account_id
- accountName (string)
- accountNumber (masked: ****1234)
- accountType ('checking' | 'savings' | 'business' | 'etc')
- currency (string: AED, USD, etc)
- balance (decimal)
- balanceTimestamp (timestamp)
- bankName (string)
- bankCountry (string)
- isActive (boolean)
- lastTransactionDate (timestamp, nullable)
- metadata (JSONB: IBAN, BIC, swift code, etc)
- createdAt, updatedAt
```

#### bank_transactions
Synced transactions from connected banks
```sql
- id (UUID, PK)
- bankAccountId (UUID, FK)
- tenantId (UUID, FK)
- externalTransactionId (string) -- Lean's unique ID
- transactionDate (date)
- amount (decimal)
- currency (string)
- description (string)
- transactionType ('debit' | 'credit')
- category (string, nullable) -- Lean's auto-categorization
- counterpartyName (string, nullable)
- counterpartyAccount (string, nullable)
- referenceNumber (string, nullable)
- status ('completed' | 'pending' | 'cancelled')
- syncedAt (timestamp)
- isReconciled (boolean)
- reconciliationId (UUID, nullable, FK to transaction_reconciliation)
- metadata (JSONB: full Lean response)
- createdAt, updatedAt
- Indexes: bankAccountId, tenantId, transactionDate, externalTransactionId (unique)
```

#### transaction_reconciliation
Matches bank transactions to journal entries
```sql
- id (UUID, PK)
- tenantId (UUID, FK)
- bankTransactionId (UUID, FK, nullable) -- Can have multiple suggestions
- journalEntryId (UUID, FK, nullable) -- NULL = unmatched
- invoiceId (UUID, FK, nullable)
- billId (UUID, FK, nullable)
- customerPaymentId (UUID, FK, nullable)
- vendorPaymentId (UUID, FK, nullable)
- matchType ('auto' | 'suggested' | 'manual' | 'unmatched')
- matchScore (decimal: 0-1) -- AI confidence
- amountVariance (decimal) -- abs(bank_amount - je_amount)
- dateVariance (integer) -- days between dates
- status ('unmatched' | 'suggested' | 'matched' | 'reversed')
- reconciledAt (timestamp, nullable)
- reconciledBy (UUID, nullable, FK to users)
- matchDetails (JSONB: matching criteria, AI reasoning)
- reverseJournalEntryId (UUID, nullable) -- If reversal created
- createdAt, updatedAt
- Indexes: tenantId, bankTransactionId, status, reconciledAt
```

#### payment_instructions
Outbound payments initiated from the system
```sql
- id (UUID, PK)
- tenantId (UUID, FK)
- bankConnectionId (UUID, FK)
- sourceBankAccountId (UUID, FK)
- vendorPaymentId (UUID, FK, nullable)
- invoiceId (UUID, FK, nullable)
- externalPaymentId (string, nullable) -- Lean's payment_id
- recipientName (string)
- recipientAccount (string) -- IBAN
- amount (decimal)
- currency (string)
- description (string)
- paymentDate (date)
- scheduledExecutionDate (date, nullable) -- For scheduled payments
- status ('draft' | 'pending_approval' | 'approved' | 'submitted' | 'executed' | 'failed' | 'cancelled')
- executionStatus ('pending' | 'processing' | 'completed' | 'failed')
- executionResult (JSONB, nullable: { error, lean_response, etc })
- approvedBy (UUID, nullable, FK to users)
- approvedAt (timestamp, nullable)
- executedAt (timestamp, nullable)
- webhookEventId (UUID, nullable, FK to payment_execution_logs)
- createdAt, updatedAt
```

#### payment_execution_logs
Webhook events from Lean for payment status
```sql
- id (UUID, PK)
- tenantId (UUID, FK)
- bankConnectionId (UUID, FK, nullable)
- paymentInstructionId (UUID, FK, nullable)
- externalPaymentId (string)
- eventType ('payment.initiated' | 'payment.confirmed' | 'payment.failed' | 'payment.completed')
- webhookTimestamp (timestamp)
- webhookData (JSONB) -- Full Lean webhook payload
- processed (boolean)
- processedAt (timestamp, nullable)
- auditTrail (JSONB: user, timestamp, action)
- createdAt
```

---

## 3. FEATURE BREAKDOWN

### Phase 6.1: Bank Connection Management
- [ ] OAuth2 flow with Lean (state management, PKCE, token storage)
- [ ] List connected banks
- [ ] Disconnect bank (revoke tokens)
- [ ] Handle token expiration & refresh
- [ ] Error handling & retry logic

### Phase 6.2: Transaction Sync
- [ ] Daily cron job (2 AM UTC)
- [ ] Incremental sync (fetch transactions since last_synced_at)
- [ ] Transform Lean transaction format to standard schema
- [ ] Handle currency conversion (IAS 21)
- [ ] Encrypt sensitive data at rest
- [ ] Duplicate detection (externalTransactionId uniqueness)

### Phase 6.3: AI-Powered Reconciliation
- [ ] Automatic transaction matching algorithm
  - Exact amount + date match (high confidence)
  - Fuzzy amount match (±5%) + similar dates
  - Description parsing (extract invoice/bill numbers)
  - AI suggestion scoring
- [ ] Dashboard UI showing unmatched transactions
- [ ] Manual matching capability
- [ ] Variance reporting (over/under reconciliation)

### Phase 6.4: Payment Initiation
- [ ] Create payment instruction (draft)
- [ ] Approval workflow (RBAC check)
- [ ] Submit to Lean API
- [ ] Track payment status via webhooks
- [ ] Handle payment failures & retries

### Phase 6.5: Webhook Handling
- [ ] Secure webhook endpoint (`/webhooks/lean`)
- [ ] Verify HMAC signature (webhook security)
- [ ] Process payment status updates
- [ ] Audit trail for all webhook events
- [ ] Idempotency handling (duplicate webhooks)

### Phase 6.6: Compliance & Audit
- [ ] SOX §802 audit logging for all bank operations
- [ ] Bank account encryption (at-rest + in-transit)
- [ ] Transaction monitoring (AML/KYC on synced transactions)
- [ ] Dual control for payment approvals
- [ ] Data retention policies

---

## 4. API ENDPOINTS DESIGN

### Bank Connection Management
```
POST   /api/bank-connections/oauth-url
       - Returns Lean authorization URL
       - Input: redirectUri
       - Output: { authUrl, state, nonce }

POST   /api/bank-connections/callback
       - Handles OAuth2 redirect from Lean
       - Input: code, state, nonce
       - Output: { connectionId, accounts[] }

GET    /api/bank-connections
       - List all bank connections for tenant
       - Output: connection[] with status + metadata

GET    /api/bank-connections/:id
       - Get single connection details
       - Output: connection + accounts[]

PATCH  /api/bank-connections/:id
       - Refresh tokens, update webhook secret, etc
       - Input: { action: 'refresh_token' | 'reset_webhook' }

DELETE /api/bank-connections/:id
       - Disconnect bank (revoke tokens)
       - Audit: log disconnection
```

### Bank Accounts
```
GET    /api/bank-accounts
       - List all connected bank accounts for tenant
       - Query: ?connectionId=xxx (filter by connection)
       - Output: account[] with balance, lastSync

GET    /api/bank-accounts/:id/balance
       - Get real-time balance from Lean
       - Output: { balance, currency, timestamp }
```

### Bank Transactions
```
GET    /api/bank-transactions
       - Paginated list of synced transactions
       - Query: ?accountId=xxx&from=2024-01-01&to=2024-01-31&status=unmatched
       - Output: { transactions[], total, page, hasMore }

GET    /api/bank-transactions/:id
       - Single transaction details

POST   /api/bank-transactions/:id/reconcile
       - Manually match transaction to journal entry
       - Input: { journalEntryId | invoiceId | billId }
       - Output: reconciliation record + reverse entry if needed

POST   /api/bank-transactions/bulk-reconcile
       - Bulk reconciliation action
       - Input: { transactionIds[], action: 'match' | 'unmatched' }
```

### Reconciliation
```
GET    /api/reconciliation/dashboard
       - Summary: total synced, matched, unmatched, variance
       - Output: { totalTransactions, matched, unmatched, totalVariance, topVariances[] }

GET    /api/reconciliation/suggestions
       - Get AI suggestions for unmatched transactions
       - Query: ?limit=20&minScore=0.7
       - Output: suggestion[] with matchScore + reasoning

POST   /api/reconciliation/accept-suggestion/:id
       - Accept an AI-generated suggestion
       - Output: created reconciliation record
```

### Payment Initiation
```
POST   /api/payment-instructions
       - Create new payment instruction (draft)
       - Input: { bankConnectionId, recipientName, recipientAccount, amount, currency, description }
       - Output: paymentInstruction { id, status: 'draft' }

PATCH  /api/payment-instructions/:id
       - Edit draft payment
       - Input: partial payment object

POST   /api/payment-instructions/:id/submit-for-approval
       - Move from draft to pending_approval
       - Audit: log submission

POST   /api/payment-instructions/:id/approve
       - Dual control: approve payment
       - Input: { approverPin: '****' } (optional 2FA)
       - Output: { status: 'approved' }
       - Triggers Lean API submission

POST   /api/payment-instructions/:id/reject
       - Reject payment (requires dual control)

GET    /api/payment-instructions
       - List all payment instructions for tenant
       - Query: ?status=pending|approved|executed|failed

DELETE /api/payment-instructions/:id
       - Delete draft payment only
```

### Webhooks
```
POST   /webhooks/lean
       - Lean webhook listener for bank status updates
       - Verify HMAC signature (webhook secret)
       - Handle: payment.initiated, payment.confirmed, payment.failed, payment.completed
       - Response: { acknowledged: true }
```

---

## 5. SECURITY REQUIREMENTS

### 5.1 Authentication & Authorization
- [ ] OAuth2 via Lean (user authenticates with their bank)
- [ ] RBAC: Only users with `open_banking.connect` can authorize banks
- [ ] RBAC: Only users with `payments.approve` can approve payments
- [ ] Dual control for payments > 10,000 AED (configurable per tenant)

### 5.2 Encryption
- [ ] Tokens encrypted at rest (AES-256-GCM)
- [ ] Tokens encrypted in transit (HTTPS only)
- [ ] Encryption key per tenant (prevent cross-tenant access)
- [ ] Key rotation policy (tokens re-encrypted quarterly)

### 5.3 Webhook Security
- [ ] HMAC-SHA256 signature verification
- [ ] Webhook URL must be HTTPS
- [ ] Rate limiting on webhook endpoint
- [ ] Idempotency key handling (prevent duplicate processing)
- [ ] Webhook event logging (audit trail)

### 5.4 Data Privacy
- [ ] Bank account numbers masked in UI (****1234)
- [ ] PII never logged (names, account numbers)
- [ ] Transaction data classified as financial (SOX, AML/KYC)
- [ ] GDPR: Right to delete bank connection data
- [ ] No data sharing with third parties (Lean API only)

---

## 6. TESTING STRATEGY

### 6.1 Unit Tests
- [ ] Lean provider: token exchange, API calls, error handling
- [ ] Reconciliation algorithm: matching logic, score calculation
- [ ] Encryption/decryption: token storage, retrieval

### 6.2 Integration Tests
- [ ] OAuth2 flow: callback handling, token storage
- [ ] Transaction sync: fetch, transform, store in DB
- [ ] Reconciliation: match bank tx to journal entry
- [ ] Payment submission: draft → approved → submitted

### 6.3 E2E Tests (Sandbox)
- [ ] Full flow: connect bank → sync transactions → reconcile → pay
- [ ] Webhook handling: payment status update via webhook
- [ ] Error scenarios: token expiration, failed payments, retry logic

### 6.4 Lean Sandbox Environment
- Use `LEAN_SANDBOX_MODE=true` for testing
- Mock bank accounts with realistic transactions
- Test all payment statuses (success, failure, pending)
- Verify webhook delivery

---

## 7. IMPLEMENTATION ROADMAP

### Week 1: Core Infrastructure
- [x] Design database schema
- [ ] Create Drizzle migrations for 6 new tables
- [ ] Extend shared/schema.ts with bank connection schemas
- [ ] Implement Lean provider OAuth2 flow

### Week 2: Transaction Sync
- [ ] Complete LeanProvider methods (getAccounts, getTransactions, etc)
- [ ] Implement TransactionSyncService (daily cron job)
- [ ] Create transaction sync routes (/api/bank-accounts, /api/bank-transactions)
- [ ] Implement encryption layer for token storage

### Week 3: Reconciliation & Matching
- [ ] Implement AI reconciliation algorithm
- [ ] Create reconciliation routes + dashboard
- [ ] Implement suggestion engine
- [ ] Build reconciliation UI

### Week 4: Payment & Webhooks
- [ ] Implement payment instruction routes
- [ ] Implement Lean payment submission
- [ ] Create webhook listener (/webhooks/lean)
- [ ] Implement payment status tracking

### Week 5: Compliance & Audit
- [ ] Wire transaction monitoring for synced transactions
- [ ] Implement SOX audit logging
- [ ] Add RBAC enforcement (open_banking.*, payments.*)
- [ ] Implement encryption key rotation

### Week 6: Testing & Hardening
- [ ] E2E test suite with Lean sandbox
- [ ] Performance testing (concurrent syncs, large transaction volumes)
- [ ] Security audit (penetration testing, encryption verification)
- [ ] Error handling & retry logic refinement

---

## 8. COMPETITIVE ADVANTAGES

✅ **Real-time Cash Flow Visibility**
- Daily bank sync with transaction reconciliation
- Variance detection (invoice amount ≠ payment received)
- Aged AR/AP alerts from bank data

✅ **Automated Reconciliation**
- AI-powered matching (AI Copilot integration in Phase 8)
- Fuzzy matching for data quality issues
- Variance analysis & anomaly detection

✅ **Direct Payment Processing**
- Pay vendors directly from bank
- Dual control for high-value payments
- Immediate settlement visibility

✅ **Middle East First**
- Lean Technologies focus (UAE primary market)
- Future: Mastercard, other Open Banking providers
- IFRS compliance (IAS 21 for multi-currency)

✅ **Enterprise Security**
- SOX audit trail for all bank operations
- AML/KYC monitoring on synced transactions
- Encrypted credential storage + key rotation

---

## 9. RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Token leakage | Encrypt at rest + in transit, key rotation quarterly |
| Failed reconciliation | Manual matching UI, variance alerts, audit trail |
| Webhook failures | Retry logic, idempotency keys, dead-letter queue |
| Payment fraud | Dual control, RBAC, transaction monitoring |
| Rate limiting (Lean API) | Batch requests, caching, backoff strategy |
| Data consistency | Atomic transactions, idempotent endpoints |

---

## 10. SUCCESS CRITERIA

✅ **Phase 6 Complete When**:
1. Users can connect UAE banks via Lean OAuth2
2. Daily transaction sync completes without errors
3. AI reconciliation matches 80%+ of transactions
4. Payment initiation with dual control working
5. Webhook handling with 100% uptime
6. All operations audit-logged per SOX §802
7. E2E test suite passing with 95%+ coverage
8. Production-ready error handling + retry logic
9. Documentation complete (API, webhook, security)
10. Zero security vulnerabilities (OWASP Top 10)

---

## 11. ESTIMATED EFFORT

- **Database Schema**: 4 hours (design + migrations)
- **Lean Provider**: 6 hours (OAuth2, API calls, encryption)
- **Transaction Sync**: 8 hours (cron job, transform, storage)
- **Reconciliation**: 10 hours (algorithm, AI integration, UI)
- **Payment Initiation**: 6 hours (routes, submission, tracking)
- **Webhooks**: 4 hours (listener, verification, audit)
- **Compliance & Audit**: 4 hours (SOX logging, RBAC)
- **Testing**: 8 hours (unit, integration, E2E)
- **Documentation**: 3 hours (API, webhook, security)

**Total: ~53 hours** (2-3 weeks depending on team size)

---

## NEXT STEPS

1. **Obtain Lean Credentials** (user to provide)
2. **Create Database Migrations** (schema implementation)
3. **Build Lean Provider** (OAuth2 + API integration)
4. **Implement Transaction Sync** (daily job)
5. **Build Reconciliation Engine** (AI matching)
6. **Implement Payments** (submission + tracking)
7. **Add Webhooks** (payment status)
8. **Compliance & Testing** (SOX + E2E)
