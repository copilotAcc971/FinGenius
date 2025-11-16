# Lean Technologies Open Banking Integration Guide

**Version:** 1.0.0  
**Status:** Production Ready ✅  
**Last Updated:** November 16, 2024

---

## 🎯 Overview

Complete Open Banking integration for the UAE market using **Lean Technologies** (UAE Central Bank approved provider covering 98% of UAE retail banking). Features OAuth2 authentication, automated transaction sync, AI-powered reconciliation, and payment initiation.

**Key Capabilities:**
- 🏦 Multi-bank account connections
- 🔄 Automated daily transaction sync
- 🤖 AI-powered bank reconciliation (OpenAI GPT-4o-mini)
- 💳 Payment initiation via Open Banking
- 🔒 Enterprise-grade security (AES-256-GCM encryption, HMAC webhooks)
- 👥 Multi-tenant isolation and RBAC

---

## 📋 Prerequisites

### Required Credentials (Lean Technologies)
1. **Lean Application ID** - From Lean Developer Dashboard
2. **Lean Client ID** - OAuth2 client credentials
3. **Lean Client Secret** - OAuth2 client credentials
4. **Lean Webhook Secret** - For production webhook verification (optional for sandbox)

### Environment Configuration

#### Development/Sandbox Mode
```bash
LEAN_APP_TOKEN=your-app-token
LEAN_CLIENT_ID=your-client-id
LEAN_CLIENT_SECRET=your-client-secret
LEAN_SANDBOX_MODE=true
OPEN_BANKING_ENCRYPTION_KEY=generate-with-openssl  # Optional, auto-generated if missing
```

#### Production Mode
```bash
LEAN_APP_TOKEN=your-production-app-token
LEAN_CLIENT_ID=your-production-client-id
LEAN_CLIENT_SECRET=your-production-client-secret
LEAN_WEBHOOK_SECRET=your-webhook-secret  # REQUIRED for production
OPEN_BANKING_ENCRYPTION_KEY=your-256-bit-key  # REQUIRED for production
```

**Generate encryption key:**
```bash
openssl rand -hex 32
```

---

## 🚀 Quick Start

### 1. Configure Secrets in Replit

Navigate to Secrets tab and add:
- `LEAN_APP_TOKEN`
- `LEAN_CLIENT_ID`
- `LEAN_CLIENT_SECRET`
- `LEAN_SANDBOX_MODE='true'` (for testing)
- `LEAN_WEBHOOK_SECRET` (for production)
- `OPEN_BANKING_ENCRYPTION_KEY` (recommended)

### 2. Verify Installation

**Check permissions:**
```sql
SELECT name FROM permissions WHERE name LIKE 'open_banking.%' ORDER BY name;
```
Should return 8 permissions.

**Check tables:**
```sql
\dt *bank*
```
Should show: `open_banking_connections`, `bank_accounts`, `bank_transactions`, `open_banking_payments`

### 3. Test Connection (Sandbox)

1. Navigate to **Banking → Bank Connections**
2. Click **Connect Bank Account**
3. Select **Lean Technologies**
4. Complete OAuth flow in sandbox
5. Verify account appears with balance and details

### 4. Configure Webhooks (Production)

**Webhook URL:**
```
https://your-app.replit.app/webhooks/lean
```

**In Lean Dashboard:**
1. Go to Webhooks settings
2. Add webhook URL
3. Copy webhook secret
4. Add to Replit secrets as `LEAN_WEBHOOK_SECRET`

**Supported Events:**
- `ACCOUNT_CONNECTED` - New bank connection established
- `ACCOUNT_DISCONNECTED` - Bank connection removed
- `TRANSACTION_UPDATE` - New transactions available
- `PAYMENT_STATUS_CHANGED` - Payment status updated

---

## 🏗️ Architecture

### Provider-Agnostic Design
The integration uses an abstracted provider interface, making it easy to add support for other Open Banking platforms:

```typescript
interface OpenBankingProvider {
  getAuthorizationUrl(): Promise<string>;
  exchangeCodeForTokens(code: string): Promise<Tokens>;
  refreshAccessToken(refreshToken: string): Promise<Tokens>;
  getAccounts(): Promise<Account[]>;
  getTransactions(params): Promise<Transaction[]>;
  initiatePayment(params): Promise<Payment>;
}
```

**Current Implementation:** Lean Technologies  
**Future Support:** Mastercard, card issuers, marketplace connectors

### Database Schema

**4 Core Tables:**

1. **`open_banking_connections`**
   - Stores OAuth tokens (AES-256-GCM encrypted)
   - Connection status and metadata
   - Multi-tenant isolated

2. **`bank_accounts`**
   - Linked to connections via foreign key
   - Account type, currency, balance
   - Last sync timestamp

3. **`bank_transactions`**
   - Unique constraint: (tenant_id, account_id, transaction_id)
   - Reconciliation tracking via `matched_journal_entry_id`
   - 11 foreign keys for referential integrity

4. **`open_banking_payments`**
   - Payment lifecycle tracking
   - Webhook status updates
   - Method and reference storage

### Security Architecture

**Multi-Layer Security:**
1. **Token Encryption** - AES-256-GCM with key rotation support
2. **Webhook HMAC** - SHA256 signature verification with timing-safe comparison
3. **Multi-Tenant Isolation** - All queries enforce `tenant_id`
4. **RBAC** - 8 granular permissions for access control
5. **DoS Prevention** - Buffer validation before HMAC
6. **Payload Limits** - 1MB max webhook payload

---

## 🔐 RBAC Permissions

**8 Open Banking Permissions:**

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `open_banking.connect` | Connect new bank accounts | Owner, Admin, CFO |
| `open_banking.disconnect` | Disconnect accounts | Owner, Admin, CFO |
| `open_banking.view_connections` | View bank connections | Owner, Admin, CFO, Accountant |
| `open_banking.view_transactions` | View synced transactions | Owner, Admin, CFO, Accountant |
| `open_banking.sync_transactions` | Trigger manual sync | Owner, Admin, CFO, Accountant |
| `open_banking.reconcile` | Match transactions | Owner, Admin, CFO, Accountant |
| `open_banking.initiate_payment` | Create payments | Owner, Admin, CFO |
| `open_banking.view_payments` | View payment history | Owner, Admin, CFO, Accountant |

**Total System Permissions:** 157 (149 existing + 8 Open Banking)

---

## 🔄 Transaction Sync System

### Automated Daily Sync
**Schedule:** 2:00 AM UTC daily  
**Implementation:** Node.js cron job  
**Features:**
- 90-day historical backfill on first connection
- Incremental sync using `lastSyncedAt` timestamp
- Pagination (500 transactions per request)
- Duplicate detection via unique constraint
- Background processing (doesn't block webhooks)

### Manual Sync
Users can trigger sync via UI:
1. Navigate to Bank Connections
2. Find account
3. Click "Sync Transactions"
4. API endpoint: `POST /api/open-banking/sync`

### Sync Process Flow
```
1. Retrieve bank accounts for tenant
2. For each account:
   a. Get lastSyncedAt timestamp
   b. Request transactions since lastSyncedAt
   c. Handle pagination (max 500/request)
   d. Insert new transactions (unique constraint prevents duplicates)
   e. Update lastSyncedAt
3. Log sync results
```

---

## 🤖 AI-Powered Reconciliation

### Two-Tier Matching System

**Tier 1: AI Matching (OpenAI GPT-4o-mini)**
- Analyzes transaction description, amount, date
- Matches against journal entries
- Returns confidence score (0-100)
- Gracefully falls back if OpenAI unavailable

**Tier 2: Rule-Based Fallback**
- Exact amount match on same date: 95% confidence
- Exact amount ±3 days: 80% confidence
- Exact amount ±7 days: 70% confidence
- Similar amount (±5%) same date: 60% confidence
- Similar amount ±3 days: 50% confidence

### Reconciliation API
```typescript
POST /api/open-banking/reconcile
{
  "transactionId": "string",
  "journalEntryId": "string" // Optional for auto-match
}
```

**Response:**
```json
{
  "matched": true,
  "confidence": 95,
  "journalEntryId": "uuid",
  "method": "ai" | "rule_based"
}
```

---

## 💳 Payment Initiation

### Creating Payments

**API Endpoint:** `POST /api/open-banking/payments`

**Request:**
```json
{
  "connectionId": "integer",
  "amount": 1500.00,
  "currency": "AED",
  "recipientName": "Vendor Name",
  "recipientAccount": "AE123456789",
  "reference": "Invoice #INV-001",
  "description": "Payment for services"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "initiated",
  "paymentId": "lean-payment-id",
  "createdAt": "2024-11-16T12:00:00Z"
}
```

### Payment Status Updates
- Real-time updates via Lean webhooks
- Event: `PAYMENT_STATUS_CHANGED`
- Statuses: `initiated` → `completed` / `failed`
- Tracked in `open_banking_payments` table

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LEAN_APP_TOKEN` | ✅ Yes | - | Lean application token |
| `LEAN_CLIENT_ID` | ✅ Yes | - | OAuth2 client ID |
| `LEAN_CLIENT_SECRET` | ✅ Yes | - | OAuth2 client secret |
| `LEAN_SANDBOX_MODE` | ❌ No | `false` | Enable sandbox mode |
| `LEAN_WEBHOOK_SECRET` | ⚠️ Production | - | Webhook HMAC secret |
| `OPEN_BANKING_ENCRYPTION_KEY` | ⚠️ Recommended | Auto-generated | AES-256 encryption key |

### Webhook Configuration

**Sandbox Mode (Testing):**
- Set `LEAN_SANDBOX_MODE='true'`
- Webhook secret NOT required
- HMAC verification skipped
- Console logs show "Sandbox mode enabled"

**Production Mode:**
- `LEAN_SANDBOX_MODE` unset or `'false'`
- `LEAN_WEBHOOK_SECRET` REQUIRED
- HMAC verification enforced
- Returns 401 if signature invalid

---

## 🐛 Troubleshooting

### Common Issues

**1. "Role not found" 404 Error**
- **Cause:** Express route ordering bug (fixed)
- **Solution:** `/me` routes now come before `/:id` routes
- **Verification:** `GET /api/rbac/roles/me` should return 200

**2. Server Crash on User Login**
- **Cause:** Duplicate email constraint violation (fixed)
- **Solution:** `upsertUser()` now handles existing users gracefully
- **Verification:** Re-login with same email should succeed

**3. Webhook 401 Unauthorized**
- **Cause:** Missing or invalid `LEAN_WEBHOOK_SECRET`
- **Solution:** Add secret from Lean dashboard to Replit secrets
- **Test:** Send test webhook from Lean dashboard

**4. "Missing encryption key" Warning**
- **Cause:** `OPEN_BANKING_ENCRYPTION_KEY` not set
- **Impact:** Uses temp key (lost on restart)
- **Solution:** Generate and set permanent key
- **Command:** `openssl rand -hex 32`

**5. No Transactions Syncing**
- **Check:** Connection status = 'connected'
- **Check:** Token not expired (tokenExpiresAt > now)
- **Check:** Cron job running (logs show "Daily transaction sync")
- **Manual:** Trigger sync via UI or API

**6. Duplicate Transaction Error**
- **Expected:** Unique constraint prevents duplicates
- **Check:** Query for duplicates:
  ```sql
  SELECT transaction_id, COUNT(*)
  FROM bank_transactions
  WHERE tenant_id = 'your-tenant-id'
  GROUP BY transaction_id
  HAVING COUNT(*) > 1;
  ```

---

## 📊 Monitoring & Logs

### Application Logs

**Key Log Patterns:**
```
[Lean Webhook] Received event: ACCOUNT_CONNECTED
[Lean Webhook] Signature verified successfully
[Lean Webhook] Sandbox mode enabled - signature verification skipped
[TransactionSync] Daily transaction sync started
[TransactionSync] Synced 45 transactions for account acct-123
[TokenEncryption] Token encrypted successfully
```

### Database Queries

**Check connection status:**
```sql
SELECT id, provider, entity_id, status, token_expires_at
FROM open_banking_connections
WHERE tenant_id = 'your-tenant-id';
```

**Count transactions by category:**
```sql
SELECT category, COUNT(*), SUM(amount) as total
FROM bank_transactions
WHERE tenant_id = 'your-tenant-id'
GROUP BY category;
```

**Find unreconciled transactions:**
```sql
SELECT id, transaction_id, amount, description, transaction_date
FROM bank_transactions
WHERE tenant_id = 'your-tenant-id'
  AND matched_journal_entry_id IS NULL
ORDER BY transaction_date DESC;
```

---

## 🚢 Production Deployment Checklist

- [ ] Set `LEAN_WEBHOOK_SECRET` from Lean production dashboard
- [ ] Set `OPEN_BANKING_ENCRYPTION_KEY` (256-bit hex)
- [ ] Remove or set `LEAN_SANDBOX_MODE='false'`
- [ ] Update Lean webhook URL to production domain
- [ ] Verify RBAC permissions assigned to roles
- [ ] Test OAuth flow end-to-end
- [ ] Test webhook delivery with test event
- [ ] Monitor first sync for errors
- [ ] Verify token encryption/decryption
- [ ] Check multi-tenant isolation
- [ ] Enable production logging
- [ ] Set up monitoring alerts

---

## 📚 Additional Resources

**Lean Technologies Documentation:**
- Developer Portal: https://developer.leantech.me
- API Reference: https://docs.leantech.me
- Webhook Events: https://docs.leantech.me/webhooks

**Related Documentation:**
- `replit.md` - Complete project architecture
- `server/open-banking/README.md` - Technical implementation details
- `server/rbac/permissions.ts` - Full permission list

**Support:**
- Lean Support: support@leantech.me
- Replit Support: https://replit.com/support

---

## 📝 Changelog

### Version 1.0.0 (November 16, 2024)
- ✅ Complete Lean Technologies integration
- ✅ OAuth2 authentication flow
- ✅ Automated daily transaction sync
- ✅ AI-powered reconciliation
- ✅ Payment initiation
- ✅ 8 RBAC permissions
- ✅ Webhook handler with HMAC verification
- ✅ Multi-tenant isolation
- ✅ Token encryption (AES-256-GCM)
- ✅ Bug fixes: RBAC routing, duplicate email handling
- ✅ Production-ready security
- ✅ Architect approved

---

**Integration Status:** ✅ **Production Ready**  
**Total Development Time:** Phase 3 Complete  
**Security Audit:** Passed  
**Data Integrity:** Verified  
**Performance:** Optimized
