# Open Banking Integration Architecture
## Multi-Tenant AI Accounting Application

**Version:** 1.0  
**Date:** November 13, 2025  
**Author:** Architecture Team  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Components](#architecture-components)
4. [Database Schema Design](#database-schema-design)
5. [API Abstraction Layer](#api-abstraction-layer)
6. [Webhook System](#webhook-system)
7. [AI Reconciliation Service](#ai-reconciliation-service)
8. [Integration Workflows](#integration-workflows)
9. [Security Architecture](#security-architecture)
10. [Extensibility Patterns](#extensibility-patterns)
11. [UAE Market Considerations](#uae-market-considerations)
12. [File Structure](#file-structure)
13. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Executive Summary

This document outlines the architectural design for integrating Open Banking capabilities into our multi-tenant AI accounting application, with **Lean Technologies** as the primary provider and extensibility for future platforms (Mastercard Open Banking, nym card, marketplace connectors).

### Key Objectives

- **Autonomous Reconciliation:** Automatically match bank transactions to invoices/bills using AI
- **Real-Time Payments:** Execute AP/AR payments directly from the accounting system
- **Cash Flow Intelligence:** Predictive forecasting using historical patterns + future obligations
- **Provider Agnostic:** Abstract interface supporting multiple Open Banking providers
- **Multi-Tenant Secure:** Strict tenant isolation with encrypted token storage
- **UAE Compliance:** VAT calculation (5%), AED currency, regulatory compliance

### Architecture Principles

1. **Provider Abstraction:** All Open Banking providers implement a common interface
2. **Tenant Isolation:** All data access scoped by `tenantId` with no cross-tenant leakage
3. **Security First:** Encrypted tokens at rest, webhook signature verification, audit logging
4. **Asynchronous Processing:** Webhook-driven data ingestion with queue-based reconciliation
5. **AI-Powered Intelligence:** NLP-based transaction parsing and confidence-scored matching

---

## 2. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │ Banking    │  │ Transactions │  │ Reconciliation Dashboard    │ │
│  │ Connection │  │ Feed         │  │ (AI Match Suggestions)      │ │
│  └────────────┘  └──────────────┘  └─────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS/REST
┌──────────────────────────────┼──────────────────────────────────────┐
│                    Backend (Express + TypeScript)                    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Routes Layer                          │   │
│  │  /api/open-banking/connections                              │   │
│  │  /api/open-banking/transactions                             │   │
│  │  /api/open-banking/payments                                 │   │
│  │  /api/webhooks/lean/* (transaction, payment status)         │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                        │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │          Open Banking Service Layer                          │   │
│  │                                                               │   │
│  │  ┌─────────────────┐    ┌──────────────────────────────┐    │   │
│  │  │ Provider Factory│───▶│  Provider Abstraction Layer  │    │   │
│  │  └─────────────────┘    │                              │    │   │
│  │                         │  • BaseProvider (Interface)  │    │   │
│  │                         │  • LeanProvider              │    │   │
│  │                         │  • MastercardProvider        │    │   │
│  │                         │  • NymCardProvider           │    │   │
│  │                         └──────────────────────────────┘    │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          AI Reconciliation Engine                    │   │   │
│  │  │  • Transaction Parser (NLP)                          │   │   │
│  │  │  • Vendor Matcher (fuzzy matching + AI)              │   │   │
│  │  │  • Confidence Scorer (>95% = auto, 50-95% = suggest)│   │   │
│  │  │  • VAT Calculator (UAE 5% rules)                     │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          Token Manager                               │   │   │
│  │  │  • Encryption/Decryption (AES-256)                   │   │   │
│  │  │  • Token Refresh Logic                               │   │   │
│  │  │  • Tenant-Scoped Access                              │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                      PostgreSQL Database                             │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ openBankingConnections │  bankTransactions │  │ reconciliations │ │
│  │ (encrypted tokens)   │  │ (synced data)    │  │ (match results) │ │
│  └─────────────────────┘  └──────────────────┘  └─────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                  External Open Banking Providers                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ Lean Tech    │  │ Mastercard OB   │  │ Future Providers        │ │
│  │ • Data API   │  │ • Account Info  │  │ • nym card              │ │
│  │ • Payments   │  │ • Payments      │  │ • Marketplace connectors│ │
│  │ • Webhooks   │  │ • Consent Mgmt  │  │ • Card issuers          │ │
│  └──────────────┘  └─────────────────┘  └─────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Components

### 3.1 Provider Abstraction Layer

**Purpose:** Decouple the accounting system from specific Open Banking provider implementations, enabling seamless addition of new providers.

**Design Pattern:** Strategy Pattern + Factory Pattern + Capability-Based Interfaces

**Capability-Based Interface Design:**

To avoid forcing all providers to implement unsupported features (e.g., payments for read-only providers like Mastercard), we use modular capability interfaces:

```typescript
// Base interface with common functionality all providers must implement
interface IOpenBankingBaseProvider {
  // Provider metadata
  readonly providerId: string;
  readonly providerName: string;
  readonly capabilities: ProviderCapabilities; // Feature flags
  
  // OAuth & Connection (required for all providers)
  initiateConnection(tenantId: string, redirectUri: string): Promise<ConnectionInitResult>;
  exchangeAuthCode(code: string, tenantId: string): Promise<ConnectionTokens>;
  refreshAccessToken(connectionId: string): Promise<ConnectionTokens>;
  
  // Webhook handling (required for all providers)
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhook(payload: any): WebhookEvent;
}

// Provider capabilities metadata
interface ProviderCapabilities {
  supportsDataAccess: boolean;
  supportsPayments: boolean;
  supportsIdentityVerification: boolean;
  supportedAccountTypes: ('checking' | 'savings' | 'business' | 'credit_card')[];
  supportedCurrencies: string[]; // e.g., ['AED', 'USD', 'GBP']
}

// Data access capability (account info, balances, transactions)
interface IOpenBankingDataProvider extends IOpenBankingBaseProvider {
  // Account & Balance API
  getAccounts(connectionId: string): Promise<BankAccount[]>;
  getBalance(connectionId: string, accountId: string): Promise<AccountBalance>;
  
  // Transaction history API
  getTransactions(
    connectionId: string, 
    accountId: string, 
    dateRange: DateRange
  ): Promise<Transaction[]>;
  
  // Identity verification API
  getIdentity(connectionId: string): Promise<IdentityData>;
}

// Payment capability (extends data provider since payments require account access)
interface IOpenBankingPaymentProvider extends IOpenBankingDataProvider {
  // Payment initiation
  createPayment(
    connectionId: string, 
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult>;
  
  // Payment status tracking
  getPaymentStatus(
    connectionId: string, 
    paymentId: string
  ): Promise<PaymentStatus>;
  
  // Payment link generation (for customer-facing payments)
  createPaymentLink(
    connectionId: string, 
    paymentLinkRequest: PaymentLinkRequest
  ): Promise<PaymentLink>;
}

// Provider Implementation Examples:
// 
// Lean Technologies (full-featured):
//   implements IOpenBankingPaymentProvider
//   capabilities: { supportsDataAccess: true, supportsPayments: true, ... }
//
// Mastercard Open Banking (read-only):
//   implements IOpenBankingDataProvider
//   capabilities: { supportsDataAccess: true, supportsPayments: false, ... }
//
// Future read-only providers:
//   implements IOpenBankingDataProvider
//   (no need to stub out payment methods)
```

**Provider Factory:**

The factory returns the base interface type and provides type guard helpers to safely narrow to specific capability interfaces. This ensures TypeScript prevents calling unsupported methods at compile-time.

```typescript
type OpenBankingProviderType = 'lean' | 'mastercard' | 'nym' | 'other';

class OpenBankingProviderFactory {
  private providerInstances: Map<string, IOpenBankingBaseProvider> = new Map();
  
  constructor() {
    // Pre-register known providers
    this.registerProvider('lean', new LeanProvider());
    this.registerProvider('mastercard', new MastercardProvider());
    // Additional providers registered as needed
  }
  
  /**
   * Creates or retrieves a provider instance.
   * Returns base interface to enforce capability checking at call sites.
   */
  createProvider(providerId: OpenBankingProviderType): IOpenBankingBaseProvider {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      throw new Error(`Unknown Open Banking provider: ${providerId}`);
    }
    return provider;
  }
  
  /**
   * Type guard: Checks if provider supports data access operations.
   * Use before calling getAccounts(), getTransactions(), etc.
   */
  supportsDataAccess(provider: IOpenBankingBaseProvider): provider is IOpenBankingDataProvider {
    return provider.capabilities.supportsDataAccess &&
           'getAccounts' in provider && 
           typeof provider.getAccounts === 'function';
  }
  
  /**
   * Type guard: Checks if provider supports payment operations.
   * Use before calling createPayment(), getPaymentStatus(), etc.
   */
  supportsPayments(provider: IOpenBankingBaseProvider): provider is IOpenBankingPaymentProvider {
    return provider.capabilities.supportsPayments &&
           'createPayment' in provider && 
           typeof provider.createPayment === 'function';
  }
  
  /**
   * Type guard: Checks if provider supports identity verification.
   * Use before calling getIdentity().
   */
  supportsIdentityVerification(provider: IOpenBankingBaseProvider): provider is IOpenBankingDataProvider {
    return provider.capabilities.supportsIdentityVerification &&
           'getIdentity' in provider &&
           typeof provider.getIdentity === 'function';
  }
  
  /**
   * Register a new provider implementation.
   * Used for dynamic provider addition and testing.
   */
  private registerProvider(providerId: string, provider: IOpenBankingBaseProvider): void {
    this.providerInstances.set(providerId, provider);
  }
  
  /**
   * Get provider capabilities without instantiation.
   * Useful for UI to conditionally render payment buttons, etc.
   */
  getProviderCapabilities(providerId: OpenBankingProviderType): ProviderCapabilities | null {
    const provider = this.providerInstances.get(providerId);
    return provider ? provider.capabilities : null;
  }
}
```

**Usage Example:**

```typescript
const factory = new OpenBankingProviderFactory();
const provider = factory.createProvider('lean');

// Compile-time error prevention: Cannot call createPayment directly
// provider.createPayment(...); // ❌ TypeScript error: Property 'createPayment' does not exist

// Correct pattern: Use type guard
if (factory.supportsPayments(provider)) {
  // ✅ TypeScript now knows provider is IOpenBankingPaymentProvider
  const result = await provider.createPayment({...});
}
```

### 3.2 Token Management System

**Requirements:**
- Encrypt all access tokens and refresh tokens at rest (AES-256-GCM)
- Store encryption key in environment variables (never in code/database)
- Implement automatic token refresh before expiration
- Enforce tenant isolation (users can only access their tenant's tokens)

**Token Lifecycle:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Token Lifecycle Flow                          │
└─────────────────────────────────────────────────────────────────┘

1. CONNECTION INITIATION
   User clicks "Connect Bank" → Frontend redirects to provider OAuth

2. TOKEN EXCHANGE
   Provider redirects back with auth_code
   → Backend exchanges code for access_token + refresh_token
   → Tokens encrypted with AES-256-GCM
   → Stored in openBankingConnections table

3. TOKEN USAGE
   API request needs token
   → TokenManager.getDecryptedToken(connectionId, tenantId)
   → Verify token not expired
   → If expired → Auto-refresh (step 4)
   → Return decrypted token for API call

4. TOKEN REFRESH
   → Call provider's refresh endpoint
   → Get new access_token + refresh_token
   → Re-encrypt and update database
   → Update tokenExpiresAt timestamp

5. TOKEN REVOCATION
   User disconnects bank
   → Mark connection as 'disconnected'
   → Optionally call provider's revoke endpoint
   → Soft delete (keep for audit)
```

### 3.3 Webhook System Architecture

**Design Principles:**
- **Async Processing:** Webhooks trigger background jobs (avoid blocking)
- **Idempotency:** Handle duplicate webhook deliveries gracefully
- **Signature Verification:** Validate all incoming webhooks
- **Dead Letter Queue:** Store failed webhook processing for manual review

**Webhook Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      Webhook Processing Flow                     │
└─────────────────────────────────────────────────────────────────┘

External Provider                     Our Backend
      │                                     │
      │  POST /api/webhooks/lean/transaction│
      ├────────────────────────────────────▶│
      │  {                                  │
      │    type: "transactions.new",        │ 1. VERIFY SIGNATURE
      │    entity_id: "xxx",                │    ├─ Valid → Continue
      │    payload: {...}                   │    └─ Invalid → Return 401
      │  }                                  │
      │                                     │ 2. IDENTIFY TENANT
      │  ◀────────── 200 OK ────────────────│    Query DB by entity_id
      │  (Respond immediately)              │    Get tenantId
      │                                     │
      │                                     │ 3. ENQUEUE JOB
      │                                     │    Add to processing queue
      │                                     │    with tenantId context
      │                                     │
      │                                     ▼
      │                          ┌──────────────────────┐
      │                          │ Background Worker    │
      │                          │                      │
      │                          │ 4. FETCH TRANSACTION │
      │                          │    via Data API      │
      │                          │                      │
      │                          │ 5. AI ENRICHMENT     │
      │                          │    • Parse vendor    │
      │                          │    • Categorize      │
      │                          │    • VAT split       │
      │                          │                      │
      │                          │ 6. AUTO-RECONCILE    │
      │                          │    • Match invoice/  │
      │                          │      bill            │
      │                          │    • Confidence >95% │
      │                          │      → Auto-mark paid│
      │                          │    • 50-95%          │
      │                          │      → Suggest       │
      │                          │                      │
      │                          │ 7. CREATE JOURNAL    │
      │                          │    ENTRY (if matched)│
      │                          │                      │
      │                          └──────────────────────┘
```

### 3.4 Service Layer Design Pattern

**Purpose:** The service layer sits between API routes and provider implementations, enforcing capability checks and providing a clean interface for business logic.

**Design Principles:**
- **Runtime Safety:** Check provider capabilities before method calls
- **Compile-time Safety:** Use TypeScript type guards for narrowing
- **Clear Error Messages:** Surface capability limitations to callers
- **Tenant Isolation:** All operations scoped by tenantId

**Service Layer Architecture:**

```typescript
/**
 * Main service orchestrating Open Banking operations.
 * Enforces capability boundaries through type guards and runtime checks.
 */
class OpenBankingService {
  constructor(
    private factory: OpenBankingProviderFactory,
    private tokenManager: TokenManager,
    private db: Database
  ) {}

  /**
   * Initiate a payment through Open Banking.
   * Validates provider supports payments before attempting.
   */
  async initiatePayment(
    connectionId: string,
    tenantId: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult> {
    // 1. Fetch connection and validate tenant ownership
    const connection = await this.db.getConnection(connectionId, tenantId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    // 2. Get provider instance (returns base interface)
    const provider = this.factory.createProvider(connection.provider);

    // 3. Runtime + Compile-time capability check
    if (!this.factory.supportsPayments(provider)) {
      // Log for debugging
      console.warn(`Payment attempted on read-only provider: ${connection.provider}`);
      
      // Return user-friendly error
      throw new Error(
        `Payment functionality is not available for ${connection.bankName}. ` +
        `This connection only supports viewing transactions and balances.`
      );
    }

    // 4. TypeScript now knows provider is IOpenBankingPaymentProvider
    // Can safely call payment methods
    const result = await provider.createPayment(connectionId, paymentRequest);

    // 5. Audit log
    await this.db.logPaymentAttempt({
      tenantId,
      connectionId,
      paymentId: result.paymentId,
      amount: paymentRequest.amount,
      status: result.status,
    });

    return result;
  }

  /**
   * Fetch transactions from Open Banking provider.
   * All providers support data access, so no capability check needed.
   */
  async getTransactions(
    connectionId: string,
    tenantId: string,
    accountId: string,
    dateRange: DateRange
  ): Promise<Transaction[]> {
    // 1. Validate connection ownership
    const connection = await this.db.getConnection(connectionId, tenantId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    // 2. Get provider instance
    const provider = this.factory.createProvider(connection.provider);

    // 3. All providers implement IOpenBankingDataProvider (extends base)
    // But we still check for safety
    if (!this.factory.supportsDataAccess(provider)) {
      throw new Error(`Provider ${connection.provider} does not support data access`);
    }

    // 4. Fetch transactions
    const transactions = await provider.getTransactions(
      connectionId,
      accountId,
      dateRange
    );

    // 5. Store in local database for reconciliation
    await this.db.upsertTransactions(tenantId, connectionId, transactions);

    return transactions;
  }

  /**
   * Get payment status for a previously initiated payment.
   */
  async getPaymentStatus(
    connectionId: string,
    tenantId: string,
    paymentId: string
  ): Promise<PaymentStatus> {
    const connection = await this.db.getConnection(connectionId, tenantId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    const provider = this.factory.createProvider(connection.provider);

    // Type guard ensures we can call getPaymentStatus
    if (!this.factory.supportsPayments(provider)) {
      throw new Error(
        `Cannot check payment status: ${connection.provider} does not support payments`
      );
    }

    return await provider.getPaymentStatus(connectionId, paymentId);
  }

  /**
   * Get provider capabilities for UI rendering.
   * Frontend uses this to conditionally show/hide payment buttons.
   */
  async getConnectionCapabilities(
    connectionId: string,
    tenantId: string
  ): Promise<ProviderCapabilities> {
    const connection = await this.db.getConnection(connectionId, tenantId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    const capabilities = this.factory.getProviderCapabilities(connection.provider);
    if (!capabilities) {
      throw new Error(`Unknown provider: ${connection.provider}`);
    }

    return capabilities;
  }

  /**
   * Refresh connection tokens if expired.
   * Called automatically before provider API calls.
   */
  private async ensureValidToken(connectionId: string, tenantId: string): Promise<void> {
    const connection = await this.db.getConnection(connectionId, tenantId);
    
    if (!connection.tokenExpiresAt || new Date() >= connection.tokenExpiresAt) {
      const provider = this.factory.createProvider(connection.provider);
      const newTokens = await provider.refreshAccessToken(connectionId);
      
      await this.tokenManager.updateTokens(
        connectionId,
        tenantId,
        newTokens.accessToken,
        newTokens.refreshToken,
        newTokens.expiresAt
      );
    }
  }
}
```

**Error Handling Strategy:**

```typescript
/**
 * Custom error classes for capability mismatches
 */
class CapabilityNotSupportedError extends Error {
  constructor(
    public providerId: string,
    public capability: string,
    public userMessage: string
  ) {
    super(`Provider ${providerId} does not support ${capability}`);
    this.name = 'CapabilityNotSupportedError';
  }
}

/**
 * Express middleware to handle capability errors
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CapabilityNotSupportedError) {
    return res.status(400).json({
      error: 'capability_not_supported',
      message: err.userMessage,
      providerId: err.providerId,
      capability: err.capability,
    });
  }
  next(err);
});
```

**Frontend Integration Pattern:**

```typescript
/**
 * Frontend hook to conditionally render payment UI
 */
function useProviderCapabilities(connectionId: string) {
  const { data: capabilities } = useQuery({
    queryKey: ['connection-capabilities', connectionId],
    queryFn: () => api.getConnectionCapabilities(connectionId),
  });

  return {
    canMakePayments: capabilities?.supportsPayments ?? false,
    canViewTransactions: capabilities?.supportsDataAccess ?? false,
    canVerifyIdentity: capabilities?.supportsIdentityVerification ?? false,
  };
}

/**
 * Usage in React component
 */
function BankConnectionCard({ connection }: Props) {
  const { canMakePayments, canViewTransactions } = useProviderCapabilities(connection.id);

  return (
    <Card>
      <h3>{connection.bankName}</h3>
      
      {canViewTransactions && (
        <Button onClick={viewTransactions}>
          View Transactions
        </Button>
      )}
      
      {canMakePayments && (
        <Button onClick={initiatePayment}>
          Make Payment
        </Button>
      )}
      
      {!canMakePayments && (
        <Tooltip content="This connection only supports viewing data. To make payments, reconnect with payment permissions.">
          <Button disabled>Make Payment</Button>
        </Tooltip>
      )}
    </Card>
  );
}
```

**Capability Checking Best Practices:**

1. **Always check capabilities before provider method calls:**
   ```typescript
   // ❌ BAD: Direct call without checking
   const result = await provider.createPayment({...}); // May fail at runtime
   
   // ✅ GOOD: Type guard + capability check
   if (factory.supportsPayments(provider)) {
     const result = await provider.createPayment({...}); // TypeScript approved
   }
   ```

2. **Use capability flags from database:**
   ```typescript
   // Store capabilities in connection record for quick access
   const connection = await db.getConnection(connectionId);
   if (!connection.permissions.includes('payments')) {
     throw new Error('Payment permission not granted');
   }
   ```

3. **Log capability mismatches for debugging:**
   ```typescript
   if (!factory.supportsPayments(provider)) {
     logger.warn('Payment capability check failed', {
       providerId: provider.providerId,
       connectionId,
       tenantId,
       requestedCapability: 'payments',
       availableCapabilities: provider.capabilities,
     });
   }
   ```

4. **Surface limitations to users:**
   ```typescript
   // API response includes capability information
   return {
     connection: {
       id: '...',
       bankName: 'Mastercard Open Banking',
       capabilities: {
         supportsPayments: false,
         supportsDataAccess: true,
         limitationMessage: 'This connection is read-only. Payments are not supported.',
       },
     },
   };
   ```

---

## 4. Database Schema Design

### 4.1 Open Banking Connections

Stores encrypted OAuth tokens and connection metadata per tenant.

```typescript
export const openBankingConnections = pgTable("open_banking_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Provider identification
  provider: varchar("provider", { length: 50 }).notNull(), // 'lean', 'mastercard', 'nym', 'other'
  
  // Provider-specific IDs
  entityId: varchar("entity_id", { length: 255 }), // Lean: entity_id
  customerId: varchar("customer_id", { length: 255 }), // Lean: customer_id
  accountId: varchar("account_id", { length: 255 }), // Primary account ID
  
  // OAuth tokens (ENCRYPTED at application layer)
  accessToken: text("access_token"), // AES-256-GCM encrypted
  refreshToken: text("refresh_token"), // AES-256-GCM encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Encryption metadata (for AES-256-GCM)
  encryptionIV: varchar("encryption_iv", { length: 255 }), // Base64-encoded initialization vector
  encryptionAuthTag: varchar("encryption_auth_tag", { length: 255 }), // Base64-encoded authentication tag
  encryptionKeyVersion: varchar("encryption_key_version", { length: 50 }), // For key rotation tracking
  
  // Connection metadata
  bankIdentifier: varchar("bank_identifier", { length: 100 }), // e.g., "ENBD_UAE", "ADCB_UAE"
  bankName: varchar("bank_name", { length: 255 }),
  accountType: varchar("account_type", { length: 50 }), // 'checking', 'savings', 'business'
  accountMask: varchar("account_mask", { length: 10 }), // Last 4 digits for display
  currency: varchar("currency", { length: 3 }).default("AED"),
  
  // Status tracking
  status: varchar("status", { length: 50 }).notNull().default("active"), 
  // 'active', 'disconnected', 'expired', 'error', 'pending_reauth'
  
  // Sync metadata
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  syncErrors: integer("sync_errors").default(0), // Consecutive error count
  
  // Permissions granted
  permissions: jsonb("permissions").$type<string[]>().default([]), 
  // ['identity', 'accounts', 'balance', 'transactions', 'payments']
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  disconnectedAt: timestamp("disconnected_at"), // Soft delete
}, (table) => [
  index("idx_obc_tenant_provider").on(table.tenantId, table.provider),
  index("idx_obc_entity_id").on(table.entityId),
  index("idx_obc_status").on(table.status),
]);
```

### 4.2 Bank Accounts

Stores multiple bank accounts associated with each Open Banking connection.

```typescript
export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  
  // Provider account information
  accountId: varchar("account_id", { length: 255 }).notNull(), // Provider's account ID
  accountName: varchar("account_name", { length: 255 }), // e.g., "Business Checking"
  accountType: varchar("account_type", { length: 50 }), // 'checking', 'savings', 'credit', 'business'
  
  // Account balance
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  balance: decimal("balance", { precision: 15, scale: 2 }),
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }),
  balanceAsOf: timestamp("balance_as_of"),
  
  // Account identification
  accountMask: varchar("account_mask", { length: 10 }), // Last 4 digits (e.g., "****1234")
  iban: varchar("iban", { length: 34 }),
  bankCode: varchar("bank_code", { length: 50 }),
  branchCode: varchar("branch_code", { length: 50 }),
  
  // Account status
  status: varchar("status", { length: 50 }).notNull().default("active"),
  // Values: 'active', 'inactive', 'closed', 'suspended'
  
  // Provider-specific metadata
  metadata: jsonb("metadata"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_connection_account").on(table.connectionId, table.accountId),
  index("idx_bank_accounts_tenant").on(table.tenantId),
  index("idx_bank_accounts_connection").on(table.connectionId),
  index("idx_bank_accounts_status").on(table.status),
]);
```

**Key Design Decisions:**

- **Normalized Design:** One connection can have multiple bank accounts (checking, savings, credit)
- **Balance Tracking:** Stores both current and available balance with timestamp
- **Provider Agnostic:** Generic structure works with any Open Banking provider
- **Multi-Tenant Isolation:** All queries scoped by tenantId

### 4.3 Bank Transactions

Stores synced transactions from Open Banking providers.

```typescript
export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  bankAccountId: varchar("bank_account_id").notNull().references(() => bankAccounts.id), // Link to normalized bank account
  
  // Provider transaction ID (for deduplication)
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }).notNull(),
  
  // Transaction details
  date: timestamp("date").notNull(),
  description: text("description").notNull(), // Raw description from bank
  enrichedDescription: text("enriched_description"), // AI-cleaned description
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  
  // Transaction type
  type: varchar("type", { length: 50 }).notNull(), // 'debit', 'credit'
  pending: boolean("pending").default(false),
  
  // Account information
  accountId: varchar("account_id", { length: 255 }).notNull(),
  
  // AI-enhanced fields
  extractedVendor: varchar("extracted_vendor", { length: 255 }), // AI parsed vendor name
  suggestedVendorId: varchar("suggested_vendor_id").references(() => vendors.id),
  suggestedCustomerId: varchar("suggested_customer_id").references(() => customers.id),
  
  // Categorization
  category: varchar("category", { length: 100 }), // AI categorized (e.g., "Utilities", "Payroll")
  accountCode: varchar("account_code", { length: 50 }), // Mapped to Chart of Accounts
  suggestedAccountId: varchar("suggested_account_id").references(() => accounts.id),
  
  // VAT calculation (UAE specific)
  taxableAmount: decimal("taxable_amount", { precision: 12, scale: 2 }), // Amount excluding VAT
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }), // Calculated 5% VAT
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  
  // Reconciliation tracking
  reconciliationStatus: varchar("reconciliation_status", { length: 50 }).default("unmatched"),
  // 'unmatched', 'suggested', 'matched', 'ignored', 'manual_entry_created'
  
  matchedInvoiceId: varchar("matched_invoice_id").references(() => invoices.id),
  matchedBillId: varchar("matched_bill_id").references(() => bills.id),
  matchedPaymentId: varchar("matched_payment_id"), // Link to customer_payments or vendor_payments
  
  matchConfidence: decimal("match_confidence", { precision: 5, 2 }), // 0.00 to 100.00
  matchedAt: timestamp("matched_at"),
  matchedBy: varchar("matched_by").references(() => users.id), // null = AI auto-matched
  
  // Manual override flags
  userReviewed: boolean("user_reviewed").default(false),
  userIgnored: boolean("user_ignored").default(false),
  userNotes: text("user_notes"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_provider_transaction").on(table.tenantId, table.providerTransactionId),
  index("idx_bt_tenant_connection").on(table.tenantId, table.connectionId),
  index("idx_bt_date").on(table.date),
  index("idx_bt_reconciliation").on(table.reconciliationStatus),
  index("idx_bt_matched_invoice").on(table.matchedInvoiceId),
  index("idx_bt_matched_bill").on(table.matchedBillId),
]);
```

### 4.4 Reconciliation Rules

AI-powered matching rules configured per tenant.

```typescript
export const reconciliationRules = pgTable("reconciliation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Rule metadata
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  priority: integer("priority").default(100), // Higher priority = evaluated first
  
  // Matching criteria
  transactionType: varchar("transaction_type", { length: 50 }), // 'debit' or 'credit', null = both
  amountMin: decimal("amount_min", { precision: 12, scale: 2 }),
  amountMax: decimal("amount_max", { precision: 12, scale: 2 }),
  descriptionPattern: text("description_pattern"), // Regex or keyword
  vendorId: varchar("vendor_id").references(() => vendors.id),
  customerId: varchar("customer_id").references(() => customers.id),
  
  // Action when matched
  action: varchar("action", { length: 50 }).notNull(), // 'auto_match', 'suggest', 'categorize'
  targetAccountId: varchar("target_account_id").references(() => accounts.id),
  applyVat: boolean("apply_vat").default(true),
  
  // Rule status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_recon_rules_tenant").on(table.tenantId),
  index("idx_recon_rules_priority").on(table.priority),
]);
```

### 4.5 Payment Intents

Track outgoing payments initiated from the accounting system.

```typescript
export const paymentIntents = pgTable("payment_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  bankAccountId: varchar("bank_account_id").notNull().references(() => bankAccounts.id), // Source bank account
  
  // Provider payment ID
  providerPaymentId: varchar("provider_payment_id", { length: 255 }),
  
  // Payment details
  billId: varchar("bill_id").references(() => bills.id), // Bill being paid
  vendorId: varchar("vendor_id").references(() => vendors.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  reference: varchar("reference", { length: 255 }), // e.g., "BILL-1045"
  
  // Payment status
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  // 'pending', 'authorized', 'processing', 'completed', 'failed', 'cancelled'
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  
  // Audit
  initiatedBy: varchar("initiated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_intents_tenant").on(table.tenantId),
  index("idx_payment_intents_bill").on(table.billId),
  index("idx_payment_intents_status").on(table.status),
]);
```

### 4.6 Webhook Logs

Audit trail for all incoming webhooks.

```typescript
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null if tenant not yet identified
  
  provider: varchar("provider", { length: 50 }).notNull(),
  webhookType: varchar("webhook_type", { length: 100 }).notNull(), // 'transactions.new', 'payment.completed'
  
  // Raw webhook data
  payload: jsonb("payload").notNull(),
  headers: jsonb("headers"),
  
  // Processing status
  status: varchar("status", { length: 50 }).notNull().default("received"),
  // 'received', 'processing', 'processed', 'failed', 'ignored'
  
  signatureValid: boolean("signature_valid"),
  
  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("idx_webhook_logs_tenant").on(table.tenantId),
  index("idx_webhook_logs_status").on(table.status),
  index("idx_webhook_logs_received").on(table.receivedAt),
]);
```

---

## 5. API Abstraction Layer

### 5.1 File Structure

```
server/
├── open-banking/
│   ├── index.ts                       # Main exports
│   ├── provider-factory.ts            # Provider factory implementation
│   ├── token-manager.ts               # Token encryption/decryption
│   ├── types.ts                       # Shared types & interfaces
│   │
│   ├── providers/
│   │   ├── base-provider.ts           # IOpenBankingProvider interface
│   │   ├── lean-provider.ts           # Lean Technologies implementation
│   │   ├── mastercard-provider.ts     # Mastercard Open Banking (future)
│   │   ├── nym-provider.ts            # nym card provider (future)
│   │   └── marketplace-provider.ts    # Generic marketplace connector (future)
│   │
│   ├── services/
│   │   ├── connection-service.ts      # Connection management
│   │   ├── transaction-sync-service.ts# Transaction fetching & storage
│   │   ├── payment-service.ts         # Payment initiation
│   │   └── balance-service.ts         # Balance checking
│   │
│   └── utils/
│       ├── encryption.ts              # AES-256-GCM encryption
│       ├── webhook-validator.ts       # Signature verification
│       └── error-handler.ts           # Custom error types
```

### 5.2 Base Provider Interface (Detailed)

```typescript
// server/open-banking/types.ts

export interface ConnectionInitResult {
  authorizationUrl: string;
  state: string; // CSRF protection
  codeVerifier?: string; // For PKCE flow
}

export interface ConnectionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: string;
  scope: string;
}

export interface BankAccount {
  accountId: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'business' | 'other';
  accountMask: string; // Last 4 digits
  currency: string;
  balance?: number;
}

export interface AccountBalance {
  accountId: string;
  available: number;
  current: number;
  currency: string;
  asOfDate: Date;
}

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  pending: boolean;
  accountId: string;
  categoryHint?: string; // Provider's categorization hint
}

export interface IdentityData {
  fullName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postalCode?: string;
  };
  dateOfBirth?: string;
  nationalId?: string;
}

export interface PaymentRequest {
  accountId: string; // Source account
  amount: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryBankCode: string;
  reference: string;
  description?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedCompletionDate?: Date;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'authorized' | 'processing' | 'completed' | 'failed' | 'cancelled';
  completedAt?: Date;
  failureReason?: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  expiresIn?: number; // seconds
}

export interface PaymentLink {
  linkId: string;
  url: string;
  expiresAt: Date;
}

export interface WebhookEvent {
  type: string;
  entityId?: string;
  customerId?: string;
  timestamp: Date;
  data: any;
}
```

### 5.3 Lean Provider Implementation Outline

```typescript
// server/open-banking/providers/lean-provider.ts

export class LeanProvider implements IOpenBankingProvider {
  readonly providerId = 'lean';
  readonly providerName = 'Lean Technologies';
  
  private appToken: string;
  private apiBaseUrl: string;
  private authBaseUrl: string;
  
  constructor(config: LeanConfig) {
    this.appToken = config.appToken;
    this.apiBaseUrl = config.sandbox 
      ? 'https://sandbox.leantech.me' 
      : 'https://api.leantech.me';
    this.authBaseUrl = config.sandbox
      ? 'https://auth.sandbox.leantech.me'
      : 'https://auth.leantech.me';
  }
  
  async initiateConnection(tenantId: string, redirectUri: string): Promise<ConnectionInitResult> {
    // 1. Create Lean customer for this tenant
    // 2. Generate Link SDK initialization URL
    // 3. Return authorization URL with state parameter
  }
  
  async exchangeAuthCode(code: string, tenantId: string): Promise<ConnectionTokens> {
    // 1. Exchange auth code for access_token
    // 2. Store entity_id and customer_id
    // 3. Return tokens for encryption
  }
  
  async refreshAccessToken(connectionId: string): Promise<ConnectionTokens> {
    // 1. Get current refresh token from DB (decrypt)
    // 2. Call OAuth2 refresh endpoint
    // 3. Return new tokens
  }
  
  async getAccounts(connectionId: string): Promise<BankAccount[]> {
    // GET /v2/accounts?entity_id={entityId}
  }
  
  async getBalance(connectionId: string, accountId: string): Promise<AccountBalance> {
    // POST /data/v1/balance/
    // { entity_id, account_id }
  }
  
  async getTransactions(
    connectionId: string, 
    accountId: string, 
    dateRange: DateRange
  ): Promise<Transaction[]> {
    // POST /data/v1/transactions/
    // { entity_id, account_id, from_date, to_date }
  }
  
  async getIdentity(connectionId: string): Promise<IdentityData> {
    // POST /data/v1/identity/
    // { entity_id }
  }
  
  async createPayment(
    connectionId: string, 
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult> {
    // 1. Create payment intent via POST /payments/v1/intents/
    // 2. Execute payment via Link SDK (requires frontend interaction)
    // Note: This is async - status comes via webhook
  }
  
  async getPaymentStatus(
    connectionId: string, 
    paymentId: string
  ): Promise<PaymentStatus> {
    // GET /payments/v1/intents/{paymentId}
  }
  
  async createPaymentLink(
    connectionId: string, 
    paymentLinkRequest: PaymentLinkRequest
  ): Promise<PaymentLink> {
    // Lean-specific payment link creation
    // Returns URL for customer to authorize payment
  }
  
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Verify HMAC signature (if Lean provides)
    // Or validate using other method per Lean docs
  }
  
  parseWebhook(payload: any): WebhookEvent {
    // Map Lean webhook format to standard WebhookEvent
    // Handle types: 'entity.created', 'transactions.new', 'payment.completed'
  }
}
```

---

## 6. Webhook System

### 6.1 Webhook Endpoints

```typescript
// server/routes.ts (webhook routes)

// Lean webhooks
app.post('/api/webhooks/lean/transaction', leanWebhookHandler);
app.post('/api/webhooks/lean/payment', leanWebhookHandler);
app.post('/api/webhooks/lean/entity', leanWebhookHandler);

// Future: Mastercard webhooks
app.post('/api/webhooks/mastercard/account-update', mastercardWebhookHandler);
```

### 6.2 Webhook Handler Implementation

```typescript
// server/webhooks/lean-webhook-handler.ts

export async function leanWebhookHandler(req: Request, res: Response) {
  try {
    // 1. IMMEDIATE RESPONSE (within 5 seconds)
    res.status(200).json({ received: true });
    
    // 2. LOG WEBHOOK
    const webhookLog = await db.insert(webhookLogs).values({
      provider: 'lean',
      webhookType: req.body.type,
      payload: req.body,
      headers: req.headers,
      status: 'received',
    }).returning();
    
    // 3. VALIDATE SIGNATURE (if applicable)
    const isValid = validateLeanWebhookSignature(req);
    await db.update(webhookLogs)
      .set({ signatureValid: isValid })
      .where(eq(webhookLogs.id, webhookLog[0].id));
    
    if (!isValid) {
      logger.error('Invalid webhook signature', { webhookLogId: webhookLog[0].id });
      return;
    }
    
    // 4. ENQUEUE BACKGROUND JOB
    // Using in-memory queue or job processor (e.g., BullMQ, pg-boss)
    await webhookQueue.add('process-lean-webhook', {
      webhookLogId: webhookLog[0].id,
      webhookType: req.body.type,
      entityId: req.body.payload?.entity_id,
      customerId: req.body.payload?.customer_id,
    });
    
  } catch (error) {
    logger.error('Webhook handler error', { error });
    // Already responded with 200, so errors are logged but don't block
  }
}
```

### 6.3 Background Webhook Processor

```typescript
// server/webhooks/webhook-processor.ts

export async function processLeanWebhook(job: WebhookJob) {
  const { webhookLogId, webhookType, entityId } = job.data;
  
  try {
    // 1. Identify tenant from entityId
    const connection = await db.query.openBankingConnections.findFirst({
      where: eq(openBankingConnections.entityId, entityId),
    });
    
    if (!connection) {
      throw new Error(`No connection found for entityId: ${entityId}`);
    }
    
    const tenantId = connection.tenantId;
    
    // Update webhook log with tenantId
    await db.update(webhookLogs)
      .set({ tenantId, status: 'processing' })
      .where(eq(webhookLogs.id, webhookLogId));
    
    // 2. Process based on webhook type
    switch (webhookType) {
      case 'entity.created':
        await handleEntityCreated(connection, job.data.payload);
        break;
        
      case 'entity.data.refresh.updated':
        await handleDataRefresh(connection, job.data.payload);
        break;
        
      case 'transactions.new':
        await handleNewTransactions(connection, tenantId);
        break;
        
      case 'payment.status_changed':
        await handlePaymentStatusChange(connection, job.data.payload, tenantId);
        break;
        
      default:
        logger.warn('Unknown webhook type', { webhookType });
    }
    
    // 3. Mark as processed
    await db.update(webhookLogs)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(webhookLogs.id, webhookLogId));
    
  } catch (error) {
    logger.error('Webhook processing failed', { webhookLogId, error });
    
    // Mark as failed and increment retry count
    await db.update(webhookLogs)
      .set({ 
        status: 'failed', 
        errorMessage: error.message,
        retryCount: sql`${webhookLogs.retryCount} + 1`,
      })
      .where(eq(webhookLogs.id, webhookLogId));
    
    throw error; // Re-throw for job queue retry mechanism
  }
}

async function handleNewTransactions(connection: Connection, tenantId: string) {
  // 1. Fetch latest transactions from Lean Data API
  const provider = providerFactory.getProvider('lean');
  const accounts = await provider.getAccounts(connection.id);
  
  for (const account of accounts) {
    const transactions = await provider.getTransactions(
      connection.id,
      account.accountId,
      { from: lastSyncDate, to: new Date() }
    );
    
    // 2. Store transactions in database
    for (const txn of transactions) {
      await upsertBankTransaction(txn, tenantId, connection.id);
    }
  }
  
  // 3. Trigger AI reconciliation
  await triggerReconciliation(tenantId);
  
  // 4. Update last sync timestamp
  await db.update(openBankingConnections)
    .set({ lastSyncAt: new Date(), lastSuccessfulSyncAt: new Date() })
    .where(eq(openBankingConnections.id, connection.id));
}
```

---

## 7. AI Reconciliation Service

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  AI Reconciliation Pipeline                      │
└─────────────────────────────────────────────────────────────────┘

INPUT: New bank transaction
  │
  ├─▶ 1. TRANSACTION PARSER (NLP)
  │     • Clean raw description
  │     • Extract vendor name
  │     • Extract reference numbers
  │     • Extract location/date hints
  │
  ├─▶ 2. VENDOR MATCHER
  │     • Fuzzy match against vendors table
  │     • UAE business name variations (e.g., "DEWA" → "Dubai Electricity & Water Authority")
  │     • Confidence score (0-100)
  │
  ├─▶ 3. CATEGORIZER
  │     • OpenAI GPT-4 categorization
  │     • Map to tenant's Chart of Accounts
  │     • Apply reconciliation rules
  │
  ├─▶ 4. VAT CALCULATOR (UAE specific)
  │     • Identify if transaction includes VAT
  │     • Calculate VAT component (5%)
  │     • Split taxableAmount vs vatAmount
  │
  ├─▶ 5. INVOICE/BILL MATCHER
  │     • Amount matching (exact or within tolerance)
  │     • Vendor/customer matching
  │     • Date proximity (within payment terms window)
  │     • Reference number matching
  │     • Confidence score calculation
  │
  └─▶ 6. ACTION EXECUTOR
        • >95% confidence → AUTO-RECONCILE
        │   ├─ Mark invoice/bill as "paid"
        │   ├─ Create journal entry
        │   └─ Link transaction to payment
        │
        • 50-95% confidence → SUGGEST
        │   ├─ Create suggestion record
        │   └─ Notify user for review
        │
        • <50% confidence → FLAG FOR REVIEW
            ├─ Create unmatched transaction entry
            └─ User manual matching required
```

### 7.2 Implementation Outline

```typescript
// server/services/reconciler.ts

export class AIReconciliationService {
  private openai: OpenAI;
  private tenantId: string;
  
  async reconcileTransaction(transaction: BankTransaction): Promise<ReconciliationResult> {
    // 1. Parse transaction description
    const parsed = await this.parseTransaction(transaction);
    
    // 2. Match vendor/customer
    const vendorMatch = await this.matchVendor(parsed);
    
    // 3. Categorize
    const category = await this.categorizeTransaction(parsed, vendorMatch);
    
    // 4. Calculate VAT
    const vatSplit = this.calculateVAT(transaction.amount, category);
    
    // 5. Find matching invoice/bill
    const matches = await this.findMatches(transaction, vendorMatch);
    
    // 6. Execute action based on confidence
    if (matches.length > 0 && matches[0].confidence > 95) {
      return await this.autoReconcile(transaction, matches[0]);
    } else if (matches.length > 0 && matches[0].confidence > 50) {
      return await this.createSuggestion(transaction, matches);
    } else {
      return await this.flagForReview(transaction);
    }
  }
  
  private async parseTransaction(transaction: BankTransaction): Promise<ParsedTransaction> {
    // Use OpenAI to extract structured data from description
    const prompt = `
      Parse this bank transaction description and extract vendor name, 
      reference numbers, and any other relevant details:
      
      Description: "${transaction.description}"
      Amount: ${transaction.amount} ${transaction.currency}
      Date: ${transaction.date}
      
      Return JSON: { vendorName: string, referenceNumber: string, location: string }
    `;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  private async matchVendor(parsed: ParsedTransaction): Promise<VendorMatch> {
    // 1. Exact match on vendor name
    let vendor = await db.query.vendors.findFirst({
      where: and(
        eq(vendors.tenantId, this.tenantId),
        eq(vendors.name, parsed.vendorName)
      ),
    });
    
    if (vendor) {
      return { vendor, confidence: 100 };
    }
    
    // 2. Fuzzy match using Levenshtein distance or embeddings
    const allVendors = await db.query.vendors.findMany({
      where: eq(vendors.tenantId, this.tenantId),
    });
    
    const fuzzyMatches = allVendors.map(v => ({
      vendor: v,
      confidence: calculateSimilarity(parsed.vendorName, v.name),
    })).sort((a, b) => b.confidence - a.confidence);
    
    return fuzzyMatches[0] || { vendor: null, confidence: 0 };
  }
  
  private async findMatches(
    transaction: BankTransaction, 
    vendorMatch: VendorMatch
  ): Promise<Match[]> {
    const matches: Match[] = [];
    
    // Match against unpaid bills (for debit transactions)
    if (transaction.type === 'debit' && vendorMatch.vendor) {
      const unpaidBills = await db.query.bills.findMany({
        where: and(
          eq(bills.tenantId, this.tenantId),
          eq(bills.vendorId, vendorMatch.vendor.id),
          eq(bills.status, 'unpaid')
        ),
      });
      
      for (const bill of unpaidBills) {
        const amountMatch = Math.abs(parseFloat(bill.total) - Math.abs(transaction.amount)) < 1.0;
        const dateMatch = isWithinPaymentWindow(transaction.date, bill.dueDate);
        
        if (amountMatch && dateMatch) {
          matches.push({
            type: 'bill',
            record: bill,
            confidence: this.calculateMatchConfidence({
              amountMatch: 100,
              vendorMatch: vendorMatch.confidence,
              dateMatch: dateMatch ? 80 : 50,
            }),
          });
        }
      }
    }
    
    // Match against unpaid invoices (for credit transactions)
    if (transaction.type === 'credit') {
      // Similar logic for invoices
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
  private async autoReconcile(
    transaction: BankTransaction, 
    match: Match
  ): Promise<ReconciliationResult> {
    // 1. Update transaction record
    await db.update(bankTransactions)
      .set({
        reconciliationStatus: 'matched',
        matchedBillId: match.type === 'bill' ? match.record.id : null,
        matchedInvoiceId: match.type === 'invoice' ? match.record.id : null,
        matchConfidence: match.confidence,
        matchedAt: new Date(),
        matchedBy: null, // AI auto-matched
      })
      .where(eq(bankTransactions.id, transaction.id));
    
    // 2. Mark bill/invoice as paid
    if (match.type === 'bill') {
      await db.update(bills)
        .set({ status: 'paid' })
        .where(eq(bills.id, match.record.id));
    }
    
    // 3. Create journal entry
    await this.createReconciliationJournalEntry(transaction, match);
    
    return { status: 'auto_reconciled', match };
  }
  
  private calculateVAT(amount: number, category: string): VATSplit {
    // UAE VAT rules: 5% on most goods/services
    // Some categories are exempt or zero-rated
    
    const exemptCategories = ['healthcare', 'education', 'financial_services'];
    
    if (exemptCategories.includes(category)) {
      return {
        taxableAmount: amount,
        vatAmount: 0,
        vatRate: 0,
      };
    }
    
    // Amount includes VAT, so we reverse calculate
    // If total = 105, then taxable = 100, VAT = 5
    const taxableAmount = amount / 1.05;
    const vatAmount = amount - taxableAmount;
    
    return {
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      vatRate: 5.0,
    };
  }
}
```

---

## 8. Integration Workflows

### 8.1 User Connects Bank Account

```
USER ACTION: Clicks "Connect Bank" in Banking dashboard

FRONTEND:
  ├─ GET /api/open-banking/providers
  │   Returns: [{ id: 'lean', name: 'Lean Technologies', logo: '...' }]
  │
  ├─ User selects "Lean Technologies"
  │
  └─ POST /api/open-banking/connections/initiate
      Body: { provider: 'lean', redirectUri: 'https://app.com/banking/callback' }

BACKEND:
  ├─ LeanProvider.initiateConnection()
  │   ├─ Create Lean customer for tenant
  │   ├─ Generate Link SDK authorization URL
  │   └─ Return { authUrl, state }
  │
  └─ Response: { authorizationUrl: 'https://link.leantech.me/...' }

FRONTEND:
  └─ window.location.href = authorizationUrl (redirect to Lean)

LEAN LINK SDK:
  ├─ User selects bank (e.g., Emirates NBD)
  ├─ User authenticates with bank credentials
  ├─ User grants permissions (identity, accounts, transactions, payments)
  └─ Lean redirects back: https://app.com/banking/callback?code=AUTH_CODE&state=STATE

FRONTEND:
  └─ POST /api/open-banking/connections/complete
      Body: { provider: 'lean', code: 'AUTH_CODE', state: 'STATE' }

BACKEND:
  ├─ Verify state (CSRF protection)
  │
  ├─ LeanProvider.exchangeAuthCode()
  │   ├─ POST to Lean OAuth2 endpoint
  │   ├─ Receive: { access_token, refresh_token, entity_id, customer_id }
  │   └─ Fetch account details
  │
  ├─ TokenManager.encryptTokens()
  │   └─ AES-256-GCM encryption
  │
  ├─ Insert into openBankingConnections table
  │   {
  │     tenantId,
  │     provider: 'lean',
  │     entityId,
  │     customerId,
  │     accessToken: ENCRYPTED,
  │     refreshToken: ENCRYPTED,
  │     status: 'active',
  │     connectedAt: NOW()
  │   }
  │
  └─ Response: { connectionId, bankName, accountMask }

FRONTEND:
  └─ Show success: "Emirates NBD account ****1234 connected successfully"

WEBHOOK (async, minutes later):
  ├─ Lean sends 'entity.created' webhook
  │
  └─ Backend triggers initial data sync
      ├─ Fetch account list
      ├─ Fetch balances
      ├─ Fetch transaction history (last 90 days)
      └─ Trigger AI reconciliation
```

### 8.2 Automatic Transaction Reconciliation

```
TRIGGER: Lean webhook 'transactions.new' received

WEBHOOK HANDLER:
  ├─ Respond 200 OK immediately
  ├─ Log webhook in webhookLogs table
  ├─ Validate signature
  └─ Enqueue job: 'process-lean-webhook'

BACKGROUND WORKER:
  ├─ Identify tenant from entityId
  │
  ├─ Fetch new transactions from Lean Data API
  │   GET /data/v1/transactions/
  │
  ├─ For each transaction:
  │   │
  │   ├─ Check if already exists (deduplication by providerTransactionId)
  │   │
  │   ├─ If new → Insert into bankTransactions table
  │   │   {
  │   │     tenantId,
  │   │     connectionId,
  │   │     providerTransactionId,
  │   │     date,
  │   │     description: "DEWA 20OCT 100384 DUBAI",
  │   │     amount: -1050.00,
  │   │     currency: "AED",
  │   │     type: "debit",
  │   │     reconciliationStatus: "unmatched"
  │   │   }
  │   │
  │   └─ Trigger AI Reconciliation:
  │       │
  │       ├─ AIReconciliationService.reconcileTransaction()
  │       │   │
  │       │   ├─ NLP Parse:
  │       │   │   Input: "DEWA 20OCT 100384 DUBAI"
  │       │   │   Output: {
  │       │   │     vendorName: "Dubai Electricity & Water Authority",
  │       │   │     referenceNumber: "100384",
  │       │   │     location: "Dubai"
  │       │   │   }
  │       │   │
  │       │   ├─ Match Vendor:
  │       │   │   Search vendors where name ≈ "Dubai Electricity & Water Authority"
  │       │   │   Found: Vendor ID = "vendor_dewa_123" (Confidence: 98%)
  │       │   │
  │       │   ├─ Categorize:
  │       │   │   OpenAI: "This is a utility bill"
  │       │   │   Map to Chart of Accounts: "Utilities Expense" (Account: 5100)
  │       │   │
  │       │   ├─ Calculate VAT:
  │       │   │   Total: AED 1,050
  │       │   │   Taxable Amount: AED 1,000 (1050 / 1.05)
  │       │   │   VAT Amount: AED 50 (5%)
  │       │   │
  │       │   ├─ Find Matches:
  │       │   │   Search unpaid bills where:
  │       │   │     - vendorId = "vendor_dewa_123"
  │       │   │     - total ≈ 1050
  │       │   │     - status = 'unpaid'
  │       │   │   
  │       │   │   Found: Bill #BILL-1089 (Total: AED 1,050.00, Due: Oct 25)
  │       │   │   
  │       │   │   Confidence Calculation:
  │       │   │     - Amount match: 100% (exact)
  │       │   │     - Vendor match: 98%
  │       │   │     - Date proximity: 90% (within due date window)
  │       │   │     → Overall Confidence: 96%
  │       │   │
  │       │   └─ Action: AUTO-RECONCILE (confidence > 95%)
  │       │       │
  │       │       ├─ Update bankTransactions:
  │       │       │   SET reconciliationStatus = 'matched'
  │       │       │       matchedBillId = 'BILL-1089'
  │       │       │       matchConfidence = 96
  │       │       │       extractedVendor = 'Dubai Electricity & Water Authority'
  │       │       │       taxableAmount = 1000.00
  │       │       │       vatAmount = 50.00
  │       │       │
  │       │       ├─ Update bills:
  │       │       │   SET status = 'paid'
  │       │       │   WHERE id = 'BILL-1089'
  │       │       │
  │       │       └─ Create Journal Entry:
  │       │           DR  Utilities Expense (5100)    AED 1,000
  │       │           DR  VAT Input (1400)            AED    50
  │       │               CR  Cash (1000)                 AED 1,050
  │       │           
  │       │           Reference: "Auto-reconciled: Bank txn matched to BILL-1089"
  │
  └─ Update openBankingConnections:
      SET lastSyncAt = NOW()
          lastSuccessfulSyncAt = NOW()

NOTIFICATION (optional):
  └─ Send in-app notification to user:
      "✓ Automatically reconciled AED 1,050 payment to DEWA (Bill #BILL-1089)"
```

### 8.3 Pay Bill via Open Banking

```
USER ACTION: Clicks "Pay" button on unpaid bill

FRONTEND:
  ├─ GET /api/open-banking/balance
  │   Params: { connectionId: 'conn_123' }
  │
  └─ Response: { available: 45000, currency: 'AED', accountMask: '****1234' }

FRONTEND (Payment Confirmation Dialog):
  ┌────────────────────────────────────────┐
  │ Pay Bill #BILL-1045                    │
  ├────────────────────────────────────────┤
  │ Vendor: Acme Supplies LLC              │
  │ Amount: AED 10,000.00                  │
  │                                        │
  │ Pay from: Emirates NBD ****1234        │
  │ Current Balance: AED 45,000.00         │
  │ Remaining after payment: AED 35,000.00 │
  │                                        │
  │ ✓ Sufficient funds available           │
  │                                        │
  │ [Cancel]  [Confirm Payment]            │
  └────────────────────────────────────────┘

USER: Clicks "Confirm Payment"

FRONTEND:
  └─ POST /api/open-banking/payments/initiate
      Body: {
        connectionId: 'conn_123',
        billId: 'BILL-1045',
        amount: 10000,
        currency: 'AED'
      }

BACKEND:
  ├─ Verify tenant owns connection and bill
  │
  ├─ Double-check balance via LeanProvider.getBalance()
  │   If insufficient → Return 400 error
  │
  ├─ Create payment intent record:
  │   INSERT INTO paymentIntents {
  │     tenantId,
  │     connectionId,
  │     billId: 'BILL-1045',
  │     amount: 10000,
  │     currency: 'AED',
  │     reference: 'BILL-1045',
  │     status: 'pending',
  │     initiatedBy: userId
  │   }
  │
  ├─ LeanProvider.createPayment()
  │   ├─ POST /payments/v1/intents/
  │   │   Body: {
  │   │     customer_id,
  │   │     amount: 10000,
  │   │     currency: 'AED',
  │   │     description: 'Payment for Bill #BILL-1045 - Acme Supplies LLC'
  │   │   }
  │   │
  │   └─ Response: { payment_intent_id: 'pi_xyz123' }
  │
  ├─ Update paymentIntents:
  │   SET providerPaymentId = 'pi_xyz123'
  │       status = 'authorized'
  │
  └─ Response: { 
      paymentIntentId: 'pi_xyz123',
      requiresUserAction: true,
      sdkAuthUrl: 'lean://pay/pi_xyz123'
    }

FRONTEND:
  └─ Initialize Lean.pay() SDK
      Lean.pay({
        app_token: LEAN_APP_TOKEN,
        payment_intent_id: 'pi_xyz123',
        sandbox: false
      })

LEAN LINK SDK:
  ├─ User selects payment source account
  ├─ User confirms payment details
  ├─ User authenticates with bank (OTP, etc.)
  └─ Payment submitted to bank

LEAN → BANK:
  └─ Instant account-to-account transfer initiated

WEBHOOK (async, when payment completes):
  ├─ Lean sends 'payment.status_changed' webhook
  │   Body: {
  │     type: 'payment.status_changed',
  │     payment_intent_id: 'pi_xyz123',
  │     status: 'COMPLETED',
  │     timestamp: '2025-11-13T14:30:00Z'
  │   }
  │
  └─ Backend processes webhook:
      │
      ├─ Find paymentIntent by providerPaymentId
      │
      ├─ Update paymentIntents:
      │   SET status = 'completed'
      │       completedAt = NOW()
      │
      ├─ Update bills:
      │   SET status = 'paid'
      │   WHERE id = 'BILL-1045'
      │
      ├─ Create Journal Entry:
      │   DR  Accounts Payable (2100)     AED 10,000
      │       CR  Cash (1000)                  AED 10,000
      │   
      │   Reference: "Payment via Lean: BILL-1045"
      │
      └─ Trigger transaction sync (to capture the debit in bank feed)

FRONTEND (real-time update via WebSocket or polling):
  └─ Show success notification:
      "✓ Payment of AED 10,000 to Acme Supplies LLC completed successfully"
```

---

## 9. Security Architecture

### 9.1 Token Security

**Encryption Algorithm:**
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Length:** 256 bits (32 bytes)
- **IV Length:** 128 bits (16 bytes) - unique per encryption operation
- **Authentication Tag:** 128 bits (16 bytes) - for integrity verification

**Encryption Metadata Persistence:**

To support key rotation and ensure proper decryption, we persist encryption metadata alongside encrypted tokens:

```typescript
// Database columns in openBankingConnections table:
accessToken: text("access_token"),                              // Base64-encoded ciphertext
refreshToken: text("refresh_token"),                            // Base64-encoded ciphertext
encryptionIV: varchar("encryption_iv", { length: 255 }),        // Base64-encoded IV
encryptionAuthTag: varchar("encryption_auth_tag", { length: 255 }), // Base64-encoded auth tag
encryptionKeyVersion: varchar("encryption_key_version", { length: 50 }), // Key version for rotation
```

**Key Management Strategy:**

**Development/Staging:**
- Master encryption key stored in environment variable: `OPEN_BANKING_ENCRYPTION_KEY`
- 32-byte (256-bit) key generated using: `openssl rand -hex 32`
- Stored in Replit Secrets or .env file (never committed to git)

**Production:**
- **Recommended:** AWS KMS (Key Management Service) or equivalent HSM
- **Key Hierarchy:**
  - **Master Key:** Stored in KMS/HSM (never leaves the service)
  - **Data Encryption Key (DEK):** Generated per tenant or per key rotation period
  - **Envelope Encryption:** DEK encrypted by Master Key, stored with encrypted data

**Production KMS Integration Example:**

```typescript
// server/open-banking/utils/kms-encryption.ts

import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });
const KMS_KEY_ID = process.env.KMS_KEY_ID; // AWS KMS key ARN

// Encrypt data encryption key (DEK) using KMS master key
async function encryptDEK(dekPlaintext: Buffer): Promise<string> {
  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: dekPlaintext,
  });
  
  const { CiphertextBlob } = await kmsClient.send(command);
  return Buffer.from(CiphertextBlob!).toString('base64');
}

// Decrypt data encryption key using KMS master key
async function decryptDEK(encryptedDEK: string): Promise<Buffer> {
  const command = new DecryptCommand({
    KeyId: KMS_KEY_ID,
    CiphertextBlob: Buffer.from(encryptedDEK, 'base64'),
  });
  
  const { Plaintext } = await kmsClient.send(command);
  return Buffer.from(Plaintext!);
}
```

**Key Rotation Policy:**

**Frequency:**
- Master encryption key: Rotate every 365 days (annual rotation)
- Data encryption keys: Rotate every 90 days (quarterly rotation)
- Immediate rotation on suspected compromise

**Rotation Process:**

```
1. PREPARATION
   ├─ Generate new encryption key (version: v2)
   ├─ Store in KMS with new key ID
   └─ Update encryptionKeyVersion in code config

2. DUAL-KEY OPERATION (transition period: 30 days)
   ├─ New tokens encrypted with v2 key
   ├─ Existing tokens decrypted with v1 key (based on encryptionKeyVersion column)
   └─ Background job re-encrypts active connections with v2 key

3. BACKGROUND RE-ENCRYPTION
   ├─ Query all active openBankingConnections where encryptionKeyVersion = 'v1'
   ├─ For each connection:
   │   ├─ Decrypt tokens using v1 key
   │   ├─ Re-encrypt tokens using v2 key
   │   ├─ Update encryptionKeyVersion = 'v2'
   │   └─ Update encryptionIV and encryptionAuthTag
   └─ Monitor progress, retry failures

4. DECOMMISSION OLD KEY
   ├─ Verify all active connections use v2 key
   ├─ Disable v1 key in KMS (keep for audit/rollback)
   └─ Schedule v1 key deletion after 90-day retention period
```

**Rotation Script Example:**

```typescript
// server/scripts/rotate-encryption-keys.ts

async function rotateTokenEncryption(
  oldKeyVersion: string, 
  newKeyVersion: string
): Promise<void> {
  // Fetch all active connections using old key
  const connections = await db.query.openBankingConnections.findMany({
    where: and(
      eq(openBankingConnections.status, 'active'),
      eq(openBankingConnections.encryptionKeyVersion, oldKeyVersion)
    ),
  });

  console.log(`Found ${connections.length} connections to re-encrypt`);

  for (const conn of connections) {
    try {
      // Decrypt with old key
      const decryptedAccessToken = await decryptToken(
        conn.accessToken,
        conn.encryptionIV,
        conn.encryptionAuthTag,
        oldKeyVersion
      );
      
      const decryptedRefreshToken = await decryptToken(
        conn.refreshToken,
        conn.encryptionIV,
        conn.encryptionAuthTag,
        oldKeyVersion
      );

      // Re-encrypt with new key
      const { ciphertext: newAccessToken, iv: newIV, authTag: newAuthTag } 
        = await encryptToken(decryptedAccessToken, newKeyVersion);
      
      const { ciphertext: newRefreshToken } 
        = await encryptToken(decryptedRefreshToken, newKeyVersion);

      // Update database
      await db.update(openBankingConnections)
        .set({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          encryptionIV: newIV,
          encryptionAuthTag: newAuthTag,
          encryptionKeyVersion: newKeyVersion,
          updatedAt: new Date(),
        })
        .where(eq(openBankingConnections.id, conn.id));

      console.log(`✓ Re-encrypted connection ${conn.id}`);
    } catch (error) {
      console.error(`✗ Failed to re-encrypt connection ${conn.id}:`, error);
      // Log to audit table for manual intervention
    }
  }
}
```

**Implementation:**

```typescript
// server/open-banking/utils/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_KEY_VERSION = process.env.ENCRYPTION_KEY_VERSION || 'v1';

// Support multiple key versions for rotation
const ENCRYPTION_KEYS: Record<string, Buffer> = {
  v1: Buffer.from(process.env.OPEN_BANKING_ENCRYPTION_KEY_V1!, 'hex'),
  v2: Buffer.from(process.env.OPEN_BANKING_ENCRYPTION_KEY_V2 || '', 'hex'),
};

interface EncryptionResult {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

export function encryptToken(plaintext: string, keyVersion?: string): EncryptionResult {
  const version = keyVersion || CURRENT_KEY_VERSION;
  const key = ENCRYPTION_KEYS[version];
  
  if (!key) {
    throw new Error(`Encryption key version ${version} not found`);
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: version,
  };
}

export function decryptToken(
  ciphertext: string, 
  ivBase64: string, 
  authTagBase64: string,
  keyVersion: string
): string {
  const key = ENCRYPTION_KEYS[keyVersion];
  
  if (!key) {
    throw new Error(`Decryption key version ${keyVersion} not found`);
  }
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 9.2 Multi-Tenant Isolation

**Middleware Enforcement:**

```typescript
// server/middleware/tenant-context.ts

export function enforceTenantContext(req: Request, res: Response, next: NextFunction) {
  // 1. Extract tenantId from authenticated session
  const tenantId = req.session?.tenantId;
  
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }
  
  // 2. Attach to request object
  req.tenantId = tenantId;
  
  // 3. CRITICAL: All database queries must filter by tenantId
  next();
}

// Applied to all Open Banking routes
app.use('/api/open-banking/*', enforceTenantContext);
```

**Database Query Pattern:**

```typescript
// ALWAYS include tenantId in WHERE clause

// ✓ CORRECT
const connection = await db.query.openBankingConnections.findFirst({
  where: and(
    eq(openBankingConnections.id, connectionId),
    eq(openBankingConnections.tenantId, req.tenantId) // REQUIRED
  ),
});

// ✗ WRONG - Missing tenantId check (security vulnerability!)
const connection = await db.query.openBankingConnections.findFirst({
  where: eq(openBankingConnections.id, connectionId),
});
```

### 9.3 Webhook Security

**Signature Verification:**

```typescript
// server/open-banking/utils/webhook-validator.ts

export function verifyLeanWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Rate Limiting:**

```typescript
// Prevent webhook flooding attacks
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 webhooks per minute per IP
  message: 'Too many webhook requests',
});

app.post('/api/webhooks/lean/*', webhookLimiter, leanWebhookHandler);
```

### 9.4 Audit Logging

**All sensitive operations must be logged:**

```typescript
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  
  action: varchar("action", { length: 100 }).notNull(),
  // 'connection.created', 'connection.disconnected', 'payment.initiated', etc.
  
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id"),
  
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  timestamp: timestamp("timestamp").defaultNow(),
});
```

---

## 10. Extensibility Patterns

### 10.1 Adding a New Provider

To add Mastercard Open Banking or any other provider:

**Step 1: Implement Provider Interface**

```typescript
// server/open-banking/providers/mastercard-provider.ts

export class MastercardProvider implements IOpenBankingProvider {
  readonly providerId = 'mastercard';
  readonly providerName = 'Mastercard Open Banking';
  
  // Implement all interface methods using Mastercard's API
  
  async initiateConnection(tenantId: string, redirectUri: string): Promise<ConnectionInitResult> {
    // Mastercard-specific OAuth flow
  }
  
  async getTransactions(
    connectionId: string, 
    accountId: string, 
    dateRange: DateRange
  ): Promise<Transaction[]> {
    // Map Mastercard transaction format to standard Transaction interface
  }
  
  // ... implement all other methods
}
```

**Step 2: Register Provider**

```typescript
// server/open-banking/provider-factory.ts

const providerFactory = new OpenBankingProviderFactory();

providerFactory.registerProvider(new LeanProvider(leanConfig));
providerFactory.registerProvider(new MastercardProvider(mastercardConfig));
providerFactory.registerProvider(new NymProvider(nymConfig));
```

**Step 3: Add Provider-Specific Webhooks**

```typescript
// server/routes.ts

app.post('/api/webhooks/mastercard/account-info', mastercardWebhookHandler);
app.post('/api/webhooks/mastercard/payment-status', mastercardWebhookHandler);
```

**Step 4: Update Frontend Provider List**

```typescript
// Frontend automatically fetches available providers
GET /api/open-banking/providers

Response:
[
  { id: 'lean', name: 'Lean Technologies', logo: '...', regions: ['UAE', 'KSA'] },
  { id: 'mastercard', name: 'Mastercard Open Banking', logo: '...', regions: ['Global'] },
  { id: 'nym', name: 'nym card', logo: '...', regions: ['UAE'] }
]
```

### 10.2 Provider-Specific Configuration

Store provider configurations in environment variables:

```bash
# .env

# Lean Technologies
LEAN_APP_TOKEN=xxx
LEAN_CLIENT_ID=xxx
LEAN_CLIENT_SECRET=xxx
LEAN_WEBHOOK_SECRET=xxx
LEAN_SANDBOX=true

# Mastercard Open Banking
MASTERCARD_CLIENT_ID=xxx
MASTERCARD_CLIENT_SECRET=xxx
MASTERCARD_API_KEY=xxx
MASTERCARD_SANDBOX=true

# nym card
NYM_API_KEY=xxx
NYM_WEBHOOK_SECRET=xxx
```

### 10.3 Provider Feature Flags

Not all providers support all features. Use capability detection:

```typescript
interface ProviderCapabilities {
  supportsPayments: boolean;
  supportsPaymentLinks: boolean;
  supportsIdentityVerification: boolean;
  supportsBalanceChecks: boolean;
  supportsTransactionCategorization: boolean;
}

export class LeanProvider implements IOpenBankingProvider {
  readonly capabilities: ProviderCapabilities = {
    supportsPayments: true,
    supportsPaymentLinks: true,
    supportsIdentityVerification: true,
    supportsBalanceChecks: true,
    supportsTransactionCategorization: false, // We do this in-house with AI
  };
}
```

---

## 11. UAE Market Considerations

### 11.1 VAT Compliance (5%)

**Standard Rate:** 5% on most goods and services  
**Zero-Rated:** Exports, international transport, certain food items  
**Exempt:** Residential properties, financial services, healthcare, education

**VAT Calculation in Reconciliation:**

```typescript
function calculateUAEVAT(amount: number, category: string): VATBreakdown {
  const zeroRatedCategories = ['exports', 'international_transport'];
  const exemptCategories = ['residential_rent', 'healthcare', 'education', 'financial_services'];
  
  if (exemptCategories.includes(category)) {
    return { taxableAmount: amount, vatAmount: 0, vatRate: 0, vatStatus: 'exempt' };
  }
  
  if (zeroRatedCategories.includes(category)) {
    return { taxableAmount: amount, vatAmount: 0, vatRate: 0, vatStatus: 'zero-rated' };
  }
  
  // Standard 5% VAT - amount is inclusive
  const taxableAmount = amount / 1.05;
  const vatAmount = amount - taxableAmount;
  
  return {
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    vatAmount: parseFloat(vatAmount.toFixed(2)),
    vatRate: 5.0,
    vatStatus: 'standard'
  };
}
```

### 11.2 Supported UAE Banks (Lean)

- Abu Dhabi Commercial Bank (ADCB)
- Dubai Islamic Bank (DIB)
- Emirates NBD
- RAKBANK
- First Abu Dhabi Bank (FAB)
- Mashreq Bank
- Commercial Bank of Dubai (CBD)

### 11.3 Currency Handling

**Primary:** AED (UAE Dirham)  
**Multi-Currency Support:** Store all amounts in original currency, display AED equivalent

```typescript
export const bankTransactions = pgTable("bank_transactions", {
  // ...
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  
  // Optional: Exchange rate tracking for multi-currency
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
  amountInBaseCurrency: decimal("amount_in_base_currency", { precision: 12, scale: 2 }),
});
```

### 11.4 Regulatory Compliance

- **Central Bank of UAE Open Finance Framework (2025):** Lean Technologies has In-Principle Approval
- **ADGM FSRA Regulated:** Abu Dhabi Global Market regulatory compliance
- **Data Residency:** Consider storing UAE tenant data in UAE region (if using cloud infrastructure)

---

## 12. File Structure

### Complete Server-Side Structure

```
server/
├── index.ts                           # Main Express server
├── routes.ts                          # API routes (includes webhook endpoints)
├── db.ts                              # Database connection
├── storage.ts                         # Storage interface
│
├── open-banking/
│   ├── index.ts                       # Main exports
│   ├── provider-factory.ts            # Provider factory pattern
│   ├── token-manager.ts               # Token encryption/decryption
│   ├── types.ts                       # Shared TypeScript interfaces
│   │
│   ├── providers/
│   │   ├── base-provider.ts           # IOpenBankingProvider interface
│   │   ├── lean-provider.ts           # Lean Technologies implementation
│   │   ├── mastercard-provider.ts     # Mastercard (placeholder/future)
│   │   ├── nym-provider.ts            # nym card (placeholder/future)
│   │   └── marketplace-provider.ts    # Generic marketplace (placeholder/future)
│   │
│   ├── services/
│   │   ├── connection-service.ts      # Manage connections (CRUD)
│   │   ├── transaction-sync-service.ts# Sync transactions from providers
│   │   ├── payment-service.ts         # Initiate and track payments
│   │   ├── balance-service.ts         # Fetch account balances
│   │   └── reconciliation-service.ts  # AI-powered reconciliation logic
│   │
│   └── utils/
│       ├── encryption.ts              # AES-256-GCM token encryption
│       ├── webhook-validator.ts       # Webhook signature verification
│       ├── error-handler.ts           # Custom error classes
│       └── logger.ts                  # Structured logging
│
├── webhooks/
│   ├── lean-webhook-handler.ts        # Lean webhook endpoint handler
│   ├── webhook-processor.ts           # Background webhook processing
│   ├── webhook-queue.ts               # Job queue configuration
│   └── handlers/
│       ├── entity-created.ts          # Handle entity.created event
│       ├── transactions-new.ts        # Handle transactions.new event
│       └── payment-status-changed.ts  # Handle payment.status_changed event
│
└── services/
    ├── reconciler.ts                  # AI Reconciliation Engine
    ├── nlp-parser.ts                  # Transaction description parsing
    ├── vendor-matcher.ts              # Fuzzy vendor matching
    └── vat-calculator.ts              # UAE VAT calculation rules
```

### Frontend Structure

```
client/src/
├── pages/
│   ├── banking.tsx                    # Banking dashboard (connections list)
│   ├── banking-connect.tsx            # Connect new bank flow
│   ├── banking-callback.tsx           # OAuth callback handler
│   ├── transactions.tsx               # Bank transactions feed
│   └── reconciliation.tsx             # AI match suggestions review
│
├── components/
│   ├── banking/
│   │   ├── connection-card.tsx        # Display bank connection
│   │   ├── provider-selector.tsx      # Select Open Banking provider
│   │   ├── transaction-list.tsx       # List of bank transactions
│   │   ├── reconciliation-match.tsx   # Single match suggestion card
│   │   └── payment-dialog.tsx         # Initiate payment from bill
│   │
│   └── ui/
│       └── ...                        # Existing shadcn components
│
└── hooks/
    ├── useOpenBanking.ts              # Custom hook for OB operations
    └── useReconciliation.ts           # Custom hook for reconciliation
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

- [ ] **Database Schema**
  - Create all new tables (openBankingConnections, bankTransactions, etc.)
  - Add migrations
  - Create Zod schemas and TypeScript types

- [ ] **Provider Abstraction**
  - Define IOpenBankingProvider interface
  - Implement provider factory
  - Create token manager with encryption

### Phase 2: Lean Integration (Weeks 3-5)

- [ ] **Lean Provider Implementation**
  - OAuth2 flow (connection initiation, code exchange, token refresh)
  - Data API methods (getAccounts, getBalance, getTransactions, getIdentity)
  - Payments API methods (createPayment, getPaymentStatus, createPaymentLink)

- [ ] **Webhook System**
  - Webhook endpoints for Lean
  - Signature verification
  - Background job processing
  - Event handlers (entity.created, transactions.new, payment.status_changed)

### Phase 3: AI Reconciliation (Weeks 6-8)

- [ ] **Transaction Parser**
  - OpenAI integration for NLP parsing
  - Vendor name extraction
  - Reference number extraction

- [ ] **Matching Engine**
  - Fuzzy vendor matching algorithm
  - Invoice/Bill matching logic
  - Confidence score calculation

- [ ] **Auto-Reconciliation**
  - High-confidence auto-matching (>95%)
  - Medium-confidence suggestions (50-95%)
  - Journal entry creation

- [ ] **VAT Calculator**
  - UAE 5% VAT calculation
  - Exempt category handling
  - Zero-rated category handling

### Phase 4: Frontend UI (Weeks 9-11)

- [ ] **Banking Dashboard**
  - Connected accounts list
  - Connection status indicators
  - Account balance display

- [ ] **Bank Connection Flow**
  - Provider selection
  - OAuth redirect handling
  - Success/error states

- [ ] **Transactions Feed**
  - Paginated transaction list
  - Filter by date, type, status
  - Reconciliation status badges

- [ ] **Reconciliation Dashboard**
  - AI match suggestions
  - Accept/reject match actions
  - Manual matching interface

- [ ] **Payment Initiation**
  - "Pay" button on bills
  - Balance check confirmation
  - Lean SDK integration

### Phase 5: Testing & Refinement (Weeks 12-14)

- [ ] **Integration Testing**
  - Lean sandbox testing
  - Webhook delivery testing
  - End-to-end payment flow

- [ ] **Security Audit**
  - Token encryption verification
  - Tenant isolation testing
  - Webhook signature validation

- [ ] **Performance Optimization**
  - Transaction sync batching
  - Database query optimization
  - Webhook processing queue tuning

### Phase 6: Production Launch (Week 15)

- [ ] **Production Setup**
  - Lean production credentials
  - mTLS certificate setup
  - Production webhook URL

- [ ] **Monitoring**
  - Error tracking (Sentry or similar)
  - Webhook delivery monitoring
  - Reconciliation accuracy metrics

- [ ] **Documentation**
  - User guide for connecting banks
  - Admin guide for troubleshooting
  - API documentation for future providers

### Future Enhancements

- [ ] **Provider Expansion**
  - Mastercard Open Banking integration
  - nym card integration
  - Marketplace connectors

- [ ] **Advanced Features**
  - Recurring payment scheduling
  - Multi-account consolidation
  - Cash flow forecasting dashboard
  - Predictive analytics

- [ ] **Compliance**
  - Automated VAT return preparation
  - Audit trail export
  - Regulatory reporting

---

## Conclusion

This architecture provides a robust, secure, and extensible foundation for Open Banking integration in our multi-tenant AI accounting application. The provider abstraction pattern ensures we can easily add new Open Banking platforms, while the AI-powered reconciliation engine delivers intelligent automation that reduces manual data entry and improves financial accuracy.

**Key Success Factors:**
1. **Security First:** Encrypted tokens, tenant isolation, webhook validation
2. **AI-Powered:** NLP transaction parsing, confidence-scored matching, automated VAT calculation
3. **Extensible:** Provider abstraction enables future integrations
4. **UAE Optimized:** VAT compliance, AED currency, supported local banks

**Next Steps:**
1. Review and approve this architecture document
2. Set up Lean Technologies sandbox account
3. Begin Phase 1 implementation (database schema)
4. Schedule weekly architecture review meetings

---

**Appendix A: Glossary**

- **Open Banking:** Regulated framework allowing third-party providers to access bank account data with user consent
- **Entity:** Lean's representation of a user's connection to a specific bank
- **Webhook:** HTTP callback from provider to our system for asynchronous event notifications
- **mTLS:** Mutual TLS - both client and server authenticate each other using certificates
- **PKCE:** Proof Key for Code Exchange - OAuth2 security extension
- **Reconciliation:** Matching bank transactions to accounting records (invoices/bills)
- **NLP:** Natural Language Processing - AI technique for understanding text

**Appendix B: References**

- Lean Technologies Documentation: https://docs.leantech.me
- UAE Central Bank Open Finance Framework: https://www.centralbank.ae
- UAE VAT Guide: https://tax.gov.ae
- OpenID Connect Specification: https://openid.net/connect/
- OAuth2 RFC 6749: https://tools.ietf.org/html/rfc6749
