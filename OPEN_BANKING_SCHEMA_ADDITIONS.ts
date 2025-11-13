// Database Schema Additions for Open Banking Integration
// To be added to shared/schema.ts

import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// OPEN BANKING CONNECTIONS
// ============================================================================

export const openBankingConnections = pgTable("open_banking_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Provider identification
  provider: varchar("provider", { length: 50 }).notNull(), 
  // Enum values: 'lean', 'mastercard', 'nym', 'marketplace', 'other'
  
  // Provider-specific IDs (varies by provider)
  entityId: varchar("entity_id", { length: 255 }), // Lean: entity_id
  customerId: varchar("customer_id", { length: 255 }), // Lean: customer_id
  accountId: varchar("account_id", { length: 255 }), // Primary bank account ID
  
  // OAuth tokens (ENCRYPTED at application layer using AES-256-GCM)
  // Never store plaintext tokens in database
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Encryption metadata (for AES-256-GCM)
  encryptionIV: varchar("encryption_iv", { length: 255 }), // Base64-encoded initialization vector
  encryptionAuthTag: varchar("encryption_auth_tag", { length: 255 }), // Base64-encoded authentication tag
  encryptionKeyVersion: varchar("encryption_key_version", { length: 50 }), // For key rotation tracking
  
  // Bank/Connection metadata
  bankIdentifier: varchar("bank_identifier", { length: 100 }), 
  // e.g., "ENBD_UAE", "ADCB_UAE", "RAKBANK_UAE"
  bankName: varchar("bank_name", { length: 255 }), // e.g., "Emirates NBD"
  accountType: varchar("account_type", { length: 50 }), 
  // 'checking', 'savings', 'business', 'credit_card', 'other'
  accountMask: varchar("account_mask", { length: 10 }), // Last 4 digits for UI display
  currency: varchar("currency", { length: 3 }).default("AED"),
  
  // Connection status
  status: varchar("status", { length: 50 }).notNull().default("active"), 
  // Values: 'active', 'disconnected', 'expired', 'error', 'pending_reauth'
  
  // Sync tracking
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"), // Last attempted sync
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  syncErrors: integer("sync_errors").default(0), // Consecutive error count
  lastSyncError: text("last_sync_error"), // Last error message
  
  // Permissions granted by user
  permissions: jsonb("permissions").$type<string[]>().default([]), 
  // e.g., ['identity', 'accounts', 'balance', 'transactions', 'payments']
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  disconnectedAt: timestamp("disconnected_at"), // Soft delete timestamp
  disconnectedBy: varchar("disconnected_by").references(() => users.id),
}, (table) => [
  index("idx_obc_tenant_provider").on(table.tenantId, table.provider),
  index("idx_obc_entity_id").on(table.entityId),
  index("idx_obc_status").on(table.status),
  index("idx_obc_tenant_status").on(table.tenantId, table.status),
]);

export const insertOpenBankingConnectionSchema = createInsertSchema(openBankingConnections, {
  provider: z.enum(['lean', 'mastercard', 'nym', 'marketplace', 'other']),
  status: z.enum(['active', 'disconnected', 'expired', 'error', 'pending_reauth']),
  accountType: z.enum(['checking', 'savings', 'business', 'credit_card', 'other']).optional(),
  permissions: z.array(z.string()).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  disconnectedAt: true,
});

export type InsertOpenBankingConnection = z.infer<typeof insertOpenBankingConnectionSchema>;
export type OpenBankingConnection = typeof openBankingConnections.$inferSelect;

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  
  // Provider account information
  accountId: varchar("account_id", { length: 255 }).notNull(), // Provider's account ID
  accountName: varchar("account_name", { length: 255 }), // e.g., "Business Checking", "Savings Account"
  accountType: varchar("account_type", { length: 50 }), // 'checking', 'savings', 'credit', 'business'
  
  // Account balance
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  balance: decimal("balance", { precision: 15, scale: 2 }), // Current balance
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }), // Available balance (may differ from current)
  balanceAsOf: timestamp("balance_as_of"), // Timestamp of last balance update
  
  // Account identification
  accountMask: varchar("account_mask", { length: 10 }), // Last 4 digits for display (e.g., "****1234")
  iban: varchar("iban", { length: 34 }), // International Bank Account Number
  bankCode: varchar("bank_code", { length: 50 }), // Bank identifier code
  branchCode: varchar("branch_code", { length: 50 }), // Branch identifier code
  
  // Account status
  status: varchar("status", { length: 50 }).notNull().default("active"),
  // Values: 'active', 'inactive', 'closed', 'suspended'
  
  // Provider-specific metadata
  metadata: jsonb("metadata"), // Additional provider-specific account data
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: One account per provider accountId per connection
  unique("unique_connection_account").on(table.connectionId, table.accountId),
  
  // Performance indexes
  index("idx_bank_accounts_tenant").on(table.tenantId),
  index("idx_bank_accounts_connection").on(table.connectionId),
  index("idx_bank_accounts_status").on(table.status),
]);

export const insertBankAccountSchema = createInsertSchema(bankAccounts, {
  balance: decimalString.optional(),
  availableBalance: decimalString.optional(),
  accountType: z.enum(['checking', 'savings', 'credit', 'business']).optional(),
  status: z.enum(['active', 'inactive', 'closed', 'suspended']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;

// ============================================================================
// BANK TRANSACTIONS
// ============================================================================

export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  bankAccountId: varchar("bank_account_id").notNull().references(() => bankAccounts.id), // Link to normalized bank account
  
  // Provider's unique transaction ID (for deduplication)
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }).notNull(),
  
  // Core transaction details
  date: timestamp("date").notNull(),
  description: text("description").notNull(), // Raw description from bank
  enrichedDescription: text("enriched_description"), // AI-cleaned/enhanced description
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  
  // Transaction metadata
  type: varchar("type", { length: 50 }).notNull(), // 'debit', 'credit'
  pending: boolean("pending").default(false), // Is transaction still pending?
  accountId: varchar("account_id", { length: 255 }).notNull(), // Provider's account ID
  
  // AI-enhanced fields
  extractedVendor: varchar("extracted_vendor", { length: 255 }), // AI-parsed vendor name
  extractedReference: varchar("extracted_reference", { length: 255 }), // AI-parsed reference #
  extractedLocation: varchar("extracted_location", { length: 255 }), // AI-parsed location
  
  // Suggested matches (populated by AI)
  suggestedVendorId: varchar("suggested_vendor_id").references(() => vendors.id),
  suggestedCustomerId: varchar("suggested_customer_id").references(() => customers.id),
  suggestedAccountId: varchar("suggested_account_id").references(() => accounts.id),
  
  // Categorization
  category: varchar("category", { length: 100 }), 
  // e.g., "Utilities", "Payroll", "Office Supplies", "Client Payment"
  accountCode: varchar("account_code", { length: 50 }), // Mapped Chart of Accounts code
  
  // UAE VAT calculation (5% standard rate)
  taxableAmount: decimal("taxable_amount", { precision: 12, scale: 2 }), // Amount excluding VAT
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }), // Calculated VAT portion
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"), // Usually 5% in UAE
  vatStatus: varchar("vat_status", { length: 50 }), 
  // 'standard', 'exempt', 'zero-rated', 'out-of-scope', 'unknown'
  
  // Reconciliation tracking
  reconciliationStatus: varchar("reconciliation_status", { length: 50 }).default("unmatched"),
  // Values: 'unmatched', 'suggested', 'matched', 'ignored', 'manual_entry_created'
  
  // Matched records (when reconciled)
  matchedInvoiceId: varchar("matched_invoice_id").references(() => invoices.id),
  matchedBillId: varchar("matched_bill_id").references(() => bills.id),
  matchedPaymentId: varchar("matched_payment_id"), // Link to customer_payments or payment_intents
  
  // AI confidence and matching
  matchConfidence: decimal("match_confidence", { precision: 5, scale: 2 }), // 0.00 to 100.00
  matchedAt: timestamp("matched_at"),
  matchedBy: varchar("matched_by").references(() => users.id), // null = AI auto-matched
  
  // User actions
  userReviewed: boolean("user_reviewed").default(false),
  userIgnored: boolean("user_ignored").default(false),
  userNotes: text("user_notes"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: prevent duplicate transactions from same provider
  unique("unique_provider_transaction").on(table.tenantId, table.providerTransactionId),
  
  // Performance indexes
  index("idx_bt_tenant_connection").on(table.tenantId, table.connectionId),
  index("idx_bt_bank_account").on(table.bankAccountId),
  index("idx_bt_date").on(table.date),
  index("idx_bt_reconciliation").on(table.reconciliationStatus),
  index("idx_bt_matched_invoice").on(table.matchedInvoiceId),
  index("idx_bt_matched_bill").on(table.matchedBillId),
  index("idx_bt_pending").on(table.pending),
]);

const decimalString = z.preprocess(
  (val) => (typeof val === 'number' ? val.toString() : val),
  z.string()
);

export const insertBankTransactionSchema = createInsertSchema(bankTransactions, {
  amount: decimalString,
  taxableAmount: decimalString.optional(),
  vatAmount: decimalString.optional(),
  vatRate: decimalString.optional(),
  matchConfidence: decimalString.optional(),
  type: z.enum(['debit', 'credit']),
  reconciliationStatus: z.enum(['unmatched', 'suggested', 'matched', 'ignored', 'manual_entry_created']),
  vatStatus: z.enum(['standard', 'exempt', 'zero-rated', 'out-of-scope', 'unknown']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type BankTransaction = typeof bankTransactions.$inferSelect;

// ============================================================================
// RECONCILIATION RULES
// ============================================================================

export const reconciliationRules = pgTable("reconciliation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Rule metadata
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  priority: integer("priority").default(100), // Higher = evaluated first
  
  // Matching criteria (all optional - null means "any")
  transactionType: varchar("transaction_type", { length: 50 }), // 'debit', 'credit', null = both
  amountMin: decimal("amount_min", { precision: 12, scale: 2 }),
  amountMax: decimal("amount_max", { precision: 12, scale: 2 }),
  descriptionPattern: text("description_pattern"), // Regex pattern or keywords
  vendorId: varchar("vendor_id").references(() => vendors.id),
  customerId: varchar("customer_id").references(() => customers.id),
  categoryPattern: varchar("category_pattern", { length: 255 }), // Match on AI category
  
  // Action when rule matches
  action: varchar("action", { length: 50 }).notNull(), 
  // 'auto_match', 'suggest', 'categorize', 'ignore'
  targetAccountId: varchar("target_account_id").references(() => accounts.id),
  applyVat: boolean("apply_vat").default(true),
  
  // Rule status
  isActive: boolean("is_active").default(true),
  
  // Statistics
  matchCount: integer("match_count").default(0), // How many times rule has matched
  lastMatchedAt: timestamp("last_matched_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_recon_rules_tenant").on(table.tenantId),
  index("idx_recon_rules_priority").on(table.priority),
  index("idx_recon_rules_active").on(table.isActive),
]);

export const insertReconciliationRuleSchema = createInsertSchema(reconciliationRules, {
  amountMin: decimalString.optional(),
  amountMax: decimalString.optional(),
  transactionType: z.enum(['debit', 'credit']).optional(),
  action: z.enum(['auto_match', 'suggest', 'categorize', 'ignore']),
}).omit({
  id: true,
  matchCount: true,
  lastMatchedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReconciliationRule = z.infer<typeof insertReconciliationRuleSchema>;
export type ReconciliationRule = typeof reconciliationRules.$inferSelect;

// ============================================================================
// PAYMENT INTENTS
// ============================================================================

export const paymentIntents = pgTable("payment_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  connectionId: varchar("connection_id").notNull().references(() => openBankingConnections.id),
  bankAccountId: varchar("bank_account_id").notNull().references(() => bankAccounts.id), // Source bank account for payment
  
  // Provider's payment ID
  providerPaymentId: varchar("provider_payment_id", { length: 255 }),
  
  // Payment details
  billId: varchar("bill_id").references(() => bills.id), // Bill being paid (if applicable)
  vendorId: varchar("vendor_id").references(() => vendors.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AED"),
  reference: varchar("reference", { length: 255 }), // e.g., "BILL-1045"
  description: text("description"),
  
  // Beneficiary details (for payments not linked to existing vendor)
  beneficiaryName: varchar("beneficiary_name", { length: 255 }),
  beneficiaryAccount: varchar("beneficiary_account", { length: 255 }),
  beneficiaryBankCode: varchar("beneficiary_bank_code", { length: 50 }),
  
  // Payment status
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  // Values: 'pending', 'authorized', 'processing', 'completed', 'failed', 'cancelled'
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  authorizedAt: timestamp("authorized_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  
  // Error tracking
  errorCode: varchar("error_code", { length: 100 }),
  errorMessage: text("error_message"),
  
  // Audit
  initiatedBy: varchar("initiated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_intents_tenant").on(table.tenantId),
  index("idx_payment_intents_connection").on(table.connectionId),
  index("idx_payment_intents_bank_account").on(table.bankAccountId),
  index("idx_payment_intents_bill").on(table.billId),
  index("idx_payment_intents_status").on(table.status),
  index("idx_payment_intents_provider").on(table.providerPaymentId),
]);

export const insertPaymentIntentSchema = createInsertSchema(paymentIntents, {
  amount: decimalString,
  status: z.enum(['pending', 'authorized', 'processing', 'completed', 'failed', 'cancelled']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type PaymentIntent = typeof paymentIntents.$inferSelect;

// ============================================================================
// WEBHOOK LOGS
// ============================================================================

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null until tenant identified
  
  // Webhook metadata
  provider: varchar("provider", { length: 50 }).notNull(),
  webhookType: varchar("webhook_type", { length: 100 }).notNull(), 
  // e.g., 'transactions.new', 'payment.status_changed', 'entity.created'
  
  // Raw webhook data
  payload: jsonb("payload").notNull(),
  headers: jsonb("headers"),
  
  // Processing status
  status: varchar("status", { length: 50 }).notNull().default("received"),
  // Values: 'received', 'processing', 'processed', 'failed', 'ignored', 'duplicate'
  
  // Security
  signatureValid: boolean("signature_valid"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  
  // Processing duration (milliseconds)
  processingDuration: integer("processing_duration"),
}, (table) => [
  index("idx_webhook_logs_tenant").on(table.tenantId),
  index("idx_webhook_logs_provider").on(table.provider),
  index("idx_webhook_logs_status").on(table.status),
  index("idx_webhook_logs_received").on(table.receivedAt),
  index("idx_webhook_logs_type").on(table.webhookType),
]);

export const insertWebhookLogSchema = createInsertSchema(webhookLogs, {
  status: z.enum(['received', 'processing', 'processed', 'failed', 'ignored', 'duplicate']),
}).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

// ============================================================================
// AUDIT LOGS (Open Banking specific)
// ============================================================================

export const openBankingAuditLogs = pgTable("open_banking_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Action details
  action: varchar("action", { length: 100 }).notNull(),
  // e.g., 'connection.created', 'connection.disconnected', 'payment.initiated', 
  //      'transaction.matched', 'token.refreshed'
  
  resourceType: varchar("resource_type", { length: 50 }),
  // 'connection', 'transaction', 'payment', 'reconciliation'
  resourceId: varchar("resource_id"),
  
  // Change details
  details: jsonb("details"), // JSON object with action-specific data
  
  // Request context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_ob_audit_tenant").on(table.tenantId),
  index("idx_ob_audit_user").on(table.userId),
  index("idx_ob_audit_action").on(table.action),
  index("idx_ob_audit_timestamp").on(table.timestamp),
]);

export const insertOpenBankingAuditLogSchema = createInsertSchema(openBankingAuditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertOpenBankingAuditLog = z.infer<typeof insertOpenBankingAuditLogSchema>;
export type OpenBankingAuditLog = typeof openBankingAuditLogs.$inferSelect;

// ============================================================================
// RELATIONS (for Drizzle ORM queries)
// ============================================================================

export const openBankingConnectionsRelations = relations(openBankingConnections, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [openBankingConnections.tenantId],
    references: [tenants.id],
  }),
  bankAccounts: many(bankAccounts),
  bankTransactions: many(bankTransactions),
  paymentIntents: many(paymentIntents),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bankAccounts.tenantId],
    references: [tenants.id],
  }),
  connection: one(openBankingConnections, {
    fields: [bankAccounts.connectionId],
    references: [openBankingConnections.id],
  }),
  bankTransactions: many(bankTransactions),
  paymentIntents: many(paymentIntents),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [bankTransactions.tenantId],
    references: [tenants.id],
  }),
  connection: one(openBankingConnections, {
    fields: [bankTransactions.connectionId],
    references: [openBankingConnections.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  matchedInvoice: one(invoices, {
    fields: [bankTransactions.matchedInvoiceId],
    references: [invoices.id],
  }),
  matchedBill: one(bills, {
    fields: [bankTransactions.matchedBillId],
    references: [bills.id],
  }),
  suggestedVendor: one(vendors, {
    fields: [bankTransactions.suggestedVendorId],
    references: [vendors.id],
  }),
  suggestedCustomer: one(customers, {
    fields: [bankTransactions.suggestedCustomerId],
    references: [customers.id],
  }),
  matchedByUser: one(users, {
    fields: [bankTransactions.matchedBy],
    references: [users.id],
  }),
}));

export const paymentIntentsRelations = relations(paymentIntents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentIntents.tenantId],
    references: [tenants.id],
  }),
  connection: one(openBankingConnections, {
    fields: [paymentIntents.connectionId],
    references: [openBankingConnections.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [paymentIntents.bankAccountId],
    references: [bankAccounts.id],
  }),
  bill: one(bills, {
    fields: [paymentIntents.billId],
    references: [bills.id],
  }),
  vendor: one(vendors, {
    fields: [paymentIntents.vendorId],
    references: [vendors.id],
  }),
  initiatedByUser: one(users, {
    fields: [paymentIntents.initiatedBy],
    references: [users.id],
  }),
}));

export const reconciliationRulesRelations = relations(reconciliationRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reconciliationRules.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [reconciliationRules.vendorId],
    references: [vendors.id],
  }),
  customer: one(customers, {
    fields: [reconciliationRules.customerId],
    references: [customers.id],
  }),
  targetAccount: one(accounts, {
    fields: [reconciliationRules.targetAccountId],
    references: [accounts.id],
  }),
  createdByUser: one(users, {
    fields: [reconciliationRules.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// MIGRATION NOTES
// ============================================================================

/*
To apply this schema to your database:

1. Add this file's contents to shared/schema.ts

2. Generate migration:
   npx drizzle-kit generate:pg

3. Review migration file in migrations/

4. Apply migration:
   npx drizzle-kit push:pg

5. Verify tables created successfully

IMPORTANT SECURITY NOTES:
- accessToken and refreshToken fields store ENCRYPTED data
- Never log or expose these fields in API responses
- Use TokenManager utility for encryption/decryption
- Rotate OPEN_BANKING_ENCRYPTION_KEY periodically
- Implement token refresh before expiration
- All queries must filter by tenantId for multi-tenant isolation
*/
