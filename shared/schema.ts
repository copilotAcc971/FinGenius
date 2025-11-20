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
  uniqueIndex,
  date,
  customType,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ====================================
// CENTRALIZED STATUS ENUMS
// Shared across all modules to prevent drift
// ====================================

export const JOURNAL_ENTRY_STATUS = ['draft', 'pending_approval', 'approved', 'posted', 'rejected'] as const;
export const BILL_STATUS = ['unpaid', 'scheduled', 'paid', 'overdue', 'cancelled'] as const;
export const AI_EXTRACTION_STATUS = ['pending_review', 'reviewed', 'corrected'] as const;
export const PAYMENT_APPROVAL_STATUS = ['draft', 'pending_approval', 'approved', 'rejected', 'cancelled'] as const;
export const PAYMENT_AUTHORIZATION_STATUS = ['not_required', 'pending_authorization', 'authorized', 'rejected'] as const;
export const PAYMENT_EXECUTION_STATUS = ['pending', 'queued', 'processing', 'completed', 'failed'] as const;
export const DEBIT_NOTE_STATUS = ['draft', 'issued', 'applied', 'cancelled'] as const;
export const APPROVAL_REQUEST_STATUS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export const FRAUD_CHECK_STATUS = ['not_checked', 'passed', 'flagged', 'blocked'] as const;

// Project Management Status Enums
export const PROJECT_STATUS = ['active', 'on_hold', 'completed', 'cancelled'] as const;
export const PROJECT_BILLING_TYPE = ['time_and_materials', 'fixed_price', 'non_billable'] as const;
export const TIME_ENTRY_STATUS = ['draft', 'submitted', 'approved', 'rejected', 'invoiced'] as const;
export const PROJECT_TASK_STATUS = ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'] as const;
export const PROJECT_TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
export const PROJECT_MILESTONE_STATUS = ['pending', 'in_progress', 'completed', 'missed'] as const;

// AML/KYC Compliance Status Enums
export const KYC_VERIFICATION_STATUS = ['pending', 'in_progress', 'verified', 'rejected', 'expired'] as const;
export const RISK_LEVEL = ['low', 'medium', 'high', 'critical'] as const;
export const SCREENING_RESULT = ['clear', 'potential_match', 'match'] as const;
export const ALERT_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export const ALERT_STATUS = ['open', 'under_review', 'closed', 'escalated_to_sar'] as const;
export const SAR_STATUS = ['draft', 'under_review', 'approved', 'filed', 'rejected'] as const;

// Financial Statement Notes Enums
export const FINANCIAL_STATEMENT_NOTE_TYPE = ['accounting_policy', 'contingent_liability', 'contingent_asset', 'related_party_transaction', 'subsequent_event', 'going_concern', 'significant_accounting_judgment', 'general'] as const;
export const GOING_CONCERN_STATUS = ['positive', 'uncertainty', 'doubt'] as const;

// IAS 2 NRV Assessment Status Enum
export const NRV_ASSESSMENT_STATUS = ['pending', 'approved', 'applied'] as const;

// IAS 21 FX Translation Run Status Enum
export const FX_TRANSLATION_RUN_STATUS = ['running', 'completed', 'failed'] as const;

// IFRS 18 P&L Category Enum
export const IFRS18_CATEGORY = ['operating_income', 'operating_expense', 'investing_income', 'investing_expense', 'financing_income', 'financing_expense', 'none'] as const;

// RAG Document Type Enum
export const DOCUMENT_TYPE = ['invoice', 'bill', 'journal_entry', 'memo', 'customer', 'vendor', 'account', 'other'] as const;

// Push Notification Type Enum
export const PUSH_NOTIFICATION_TYPE = ['overdue_invoice', 'payment_received', 'approval_request', 'compliance_deadline', 'general'] as const;

// Task 7-1: Inbound Documents Status Enums
export const INBOUND_DOCUMENT_STATUS = ['pending', 'processing', 'extracted', 'failed', 'approved', 'rejected'] as const;
export const WEBHOOK_SOURCE = ['email_forwarder', 'twilio_whatsapp', 'custom_api'] as const;
export const DRAFT_ENTRY_TYPE = ['invoice', 'bill', 'journal_entry'] as const;

// Task 7-2: Credit Passport Enums
export const SCORE_GRADE = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'] as const;
export const LOAN_ELIGIBILITY = ['excellent', 'good', 'fair', 'poor', 'not_eligible'] as const;

// Task 7-3: Alerts System Enums
export const NOTIFICATION_RULE_TYPE = ['cash_deficiency', 'aged_ar', 'aged_ap', 'pending_approval', 'accrual_suggestion', 'month_end', 'compliance_deadline', 'anomaly'] as const;
export const NOTIFICATION_PRIORITY = ['critical', 'high', 'medium', 'low'] as const;
export const NOTIFICATION_CHANNEL = ['push', 'email', 'sms', 'websocket'] as const;
export const ALERT_INSTANCE_STATUS = ['new', 'viewed', 'actioned', 'dismissed', 'expired'] as const;
export const CHECKLIST_FREQUENCY = ['monthly', 'quarterly', 'yearly'] as const;
export const CHECKLIST_STATUS = ['not_started', 'in_progress', 'completed'] as const;
export const ANOMALY_DETECTION_TYPE = ['unusual_amount', 'duplicate_transaction', 'payment_pattern', 'vendor_fraud'] as const;
export const ANOMALY_ENTITY_TYPE = ['invoice', 'bill', 'payment', 'journal_entry'] as const;
export const ANOMALY_STATUS = ['new', 'investigating', 'resolved', 'false_positive'] as const;

// Task 8-1: AI Interaction Logs & LLM Multi-Provider Enums
export const LLM_PROVIDER = ['openai', 'kimi', 'qwen', 'deepseek', 'anthropic', 'gemini', 'mcp_custom'] as const;
export const AI_TASK_TYPE = ['chat', 'document_extraction', 'vision_analysis', 'embedding', 'report_generation', 'function_calling', 'code_generation'] as const;
export const AI_LOG_STATUS = ['processing', 'success', 'failed', 'timeout'] as const;
export const DATA_CATEGORY = ['financial', 'personal', 'operational', 'metadata'] as const;
export const DATA_RESIDENCY = ['UAE', 'KSA', 'EU', 'US', 'China', 'global'] as const;
export const LOG_RETENTION_CATEGORY = ['metadata_only', 'encrypted_content', 'audit_trail'] as const;

// Task 8-2: Portable Integration & MCP Enums
export const INTEGRATION_PROVIDER = ['onedrive', 'google_drive', 'stripe', 'twilio', 'lean_technologies', 'custom_api'] as const;
export const INTEGRATION_STATUS = ['connected', 'disconnected', 'expired', 'error'] as const;
export const MCP_SERVER_STATUS = ['running', 'stopped', 'error', 'initializing'] as const;
export const MCP_HEALTH_STATUS = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Phase 8: User preferences for timezone and AI
  timezone: varchar("timezone", { length: 50 }).default("Asia/Dubai"), // User's preferred timezone for alerts
  llmPreferences: jsonb("llm_preferences"), // { preferredProviders: { chat: 'qwen', vision: 'kimi', ... }, dataResidency: 'UAE', optOutProviders: ['openai'] }
  aiConsentGiven: boolean("ai_consent_given").default(false), // User has consented to AI processing
  aiConsentDate: timestamp("ai_consent_date"), // When consent was given
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Tenants (Workspaces) - multi-tenant isolation
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  stripeAccountId: varchar("stripe_account_id"), // Stripe Connect account
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Helper to preprocess decimal values (accept both string and number)
const decimalString = z.preprocess(
  (val) => (typeof val === 'number' ? val.toString() : val),
  z.string()
);

// Custom vector type for pgvector extension (vector(1536) for OpenAI text-embedding-3-small)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// ====================================
// MULTI-CURRENCY SUPPORT
// ====================================

// Currencies (ISO 4217 currency codes per tenant)
export const currencies = pgTable("currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  code: varchar("code", { length: 3 }).notNull(), // ISO 4217 (USD, AED, EUR, GBP, etc.)
  name: varchar("name", { length: 100 }).notNull(), // US Dollar, UAE Dirham, Euro, etc.
  symbol: varchar("symbol", { length: 10 }).notNull(), // $, د.إ, €, £, etc.
  decimalPlaces: integer("decimal_places").default(2).notNull(), // Number of decimal places (0-4)
  isBaseCurrency: boolean("is_base_currency").default(false).notNull(), // One base currency per tenant
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_currency_per_tenant").on(table.tenantId, table.code),
  index("currencies_tenant_idx").on(table.tenantId),
  index("currencies_code_idx").on(table.code),
  // Partial unique index - only one base currency per tenant (database-enforced)
  uniqueIndex("unique_base_currency_per_tenant").on(table.tenantId).where(sql`${table.isBaseCurrency} = true`),
]);

export const insertCurrencySchema = createInsertSchema(currencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Currency = typeof currencies.$inferSelect;

// Exchange Rates (historical FX rates for accurate conversion)
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  fromCurrencyCode: varchar("from_currency_code", { length: 3 }).notNull(),
  toCurrencyCode: varchar("to_currency_code", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 20, scale: 10 }).notNull(), // High precision for FX rates
  effectiveDate: timestamp("effective_date").notNull(), // When this rate became effective
  source: varchar("source", { length: 50 }).notNull(), // 'uae_central_bank', 'ecb', 'manual', etc.
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // For manual rates
}, (table) => [
  index("exchange_rates_tenant_idx").on(table.tenantId),
  index("exchange_rates_from_currency_idx").on(table.fromCurrencyCode),
  index("exchange_rates_to_currency_idx").on(table.toCurrencyCode),
  index("exchange_rates_effective_date_idx").on(table.effectiveDate),
]);

export const insertExchangeRateSchema = createInsertSchema(exchangeRates, {
  rate: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// FX Configuration (per tenant settings for exchange rate management)
export const fxConfigs = pgTable('fx_configs', {
  tenantId: varchar('tenant_id').primaryKey().references(() => tenants.id),
  autoRefreshEnabled: boolean('auto_refresh_enabled').default(true).notNull(),
  sourceStrategy: varchar('source_strategy').default('api').notNull(), // 'api' | 'manual' | 'hybrid'
  primaryRateSource: varchar('primary_rate_source').default('cbuae').notNull(), // 'cbuae' | 'ecb' | 'sama' | 'boe' | 'fed' | 'manual'
  primarySourceProvider: varchar('primary_source_provider').default('github').notNull(), // 'github' | 'api' | 'fluentax' | 'manual'
  fallbackRateSource: varchar('fallback_rate_source'), // Optional fallback if primary fails
  lastRefreshAt: timestamp('last_refresh_at'),
  fxTranslationApplied: boolean('fx_translation_applied').default(false).notNull(), // IAS 21: Track if FX translation has been run
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertFXConfigSchema = createInsertSchema(fxConfigs).omit({ tenantId: true });

export type FXConfig = typeof fxConfigs.$inferSelect;
export type InsertFXConfig = typeof fxConfigs.$inferInsert;

// ====================================
// RBAC & TENANT MEMBERS
// ====================================

// Tenant members (users can belong to multiple tenants)
export const tenantMembers = pgTable("tenant_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 50 }).notNull().default("member"), // owner, admin, member
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantMemberSchema = createInsertSchema(tenantMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertTenantMember = z.infer<typeof insertTenantMemberSchema>;
export type TenantMember = typeof tenantMembers.$inferSelect;

// RBAC: Global permissions catalog - shared across all tenants
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("permissions_module_idx").on(table.module),
  index("permissions_action_idx").on(table.action),
]);

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

// RBAC: Tenant-scoped roles (system + custom)
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_role_per_tenant").on(table.tenantId, table.name),
  index("roles_tenant_idx").on(table.tenantId),
]);

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// RBAC: Role-Permission mapping
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: varchar("permission_id").references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_role_permission").on(table.roleId, table.permissionId),
  index("role_permissions_role_idx").on(table.roleId),
  index("role_permissions_permission_idx").on(table.permissionId),
]);

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// RBAC: User-Role assignment (replaces role string in tenantMembers)
export const tenantMemberRoles = pgTable("tenant_member_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantMemberId: varchar("tenant_member_id").references(() => tenantMembers.id, { onDelete: 'cascade' }).notNull(),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'restrict' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_member_role").on(table.tenantMemberId, table.roleId),
  index("tenant_member_roles_member_idx").on(table.tenantMemberId),
  index("tenant_member_roles_role_idx").on(table.roleId),
]);

export const insertTenantMemberRoleSchema = createInsertSchema(tenantMemberRoles).omit({
  id: true,
  createdAt: true,
});

export type InsertTenantMemberRole = z.infer<typeof insertTenantMemberRoleSchema>;
export type TenantMemberRole = typeof tenantMemberRoles.$inferSelect;

// RBAC: Role Permission Overrides (tenant-specific per-user permission customization)
// Allows granting or revoking specific permissions to users, overriding their default role permissions
export const rolePermissionOverrides = pgTable("role_permission_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  granted: boolean("granted").notNull(), // true = grant permission, false = revoke permission
  reason: text("reason"), // Optional: reason for override (audit trail)
  grantedBy: varchar("granted_by").references(() => users.id), // Who created this override
  expiresAt: timestamp("expires_at"), // Optional: auto-revoke after date
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_user_permission_override").on(table.tenantId, table.userId, table.permissionId),
  index("role_permission_overrides_tenant_idx").on(table.tenantId),
  index("role_permission_overrides_user_idx").on(table.userId),
  index("role_permission_overrides_permission_idx").on(table.permissionId),
  index("role_permission_overrides_expires_at_idx").on(table.expiresAt),
]);

export const insertRolePermissionOverrideSchema = createInsertSchema(rolePermissionOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRolePermissionOverride = z.infer<typeof insertRolePermissionOverrideSchema>;
export type RolePermissionOverride = typeof rolePermissionOverrides.$inferSelect;

// ====================================
// AUTHORITY MATRIX & FUNCTION PERMISSIONS (AI Copilot RBAC)
// ====================================

// Authority Matrix: Maps accounting roles to their permissions across modules
// This defines the default permission levels for each role
export const authorityMatrix = pgTable("authority_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: 'cascade' }),
  module: varchar("module", { length: 100 }).notNull(), // e.g., 'invoices', 'bills', 'journal_entries'
  permissionLevel: varchar("permission_level", { length: 50 }).notNull(), // READ, WRITE, EDIT, POST, DELETE, APPROVE
  
  // Constraints define special permissions
  canDelete: boolean("can_delete").default(false).notNull(),
  canApprove: boolean("can_approve").default(false).notNull(),
  canPost: boolean("can_post").default(false).notNull(),
  canReverse: boolean("can_reverse").default(false).notNull(),
  canExecute: boolean("can_execute").default(false).notNull(), // Payment execution
  canAuthorize: boolean("can_authorize").default(false).notNull(), // Payment authorization (dual control)
  readOnly: boolean("read_only").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_authority_matrix_entry").on(table.tenantId, table.roleId, table.module),
  index("authority_matrix_tenant_idx").on(table.tenantId),
  index("authority_matrix_role_idx").on(table.roleId),
  index("authority_matrix_module_idx").on(table.module),
]);

export const insertAuthorityMatrixSchema = createInsertSchema(authorityMatrix).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthorityMatrix = z.infer<typeof insertAuthorityMatrixSchema>;
export type AuthorityMatrix = typeof authorityMatrix.$inferSelect;

// Function Permissions: Defines what AI Copilot functions require for execution
// This maps AI functions (e.g., 'create_invoice', 'post_journal_entry') to required authority levels
export const functionPermissions = pgTable("function_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }), // NULL = global/system function
  functionName: varchar("function_name", { length: 200 }).notNull(), // e.g., 'create_invoice', 'post_journal_entry'
  displayName: varchar("display_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., 'data_creation', 'transaction_posting'
  module: varchar("module", { length: 100 }).notNull(), // Which module this function belongs to
  
  requiredPermissionLevel: varchar("required_permission_level", { length: 50 }).notNull(), // READ, WRITE, EDIT, POST, DELETE, APPROVE
  requiredImpactLevel: varchar("required_impact_level", { length: 50 }).notNull(), // READ_ONLY, CREATE, MODIFY, DELETE, EXECUTE, CRITICAL
  
  // Approval requirements
  requiresApproval: boolean("requires_approval").default(false).notNull(), // AI must get user confirmation
  requiresSecondaryApproval: boolean("requires_secondary_approval").default(false).notNull(), // Needs separate approver
  
  // Special constraints
  requiresReversalAuthority: boolean("requires_reversal_authority").default(false).notNull(),
  requiresPaymentExecutionAuthority: boolean("requires_payment_execution_authority").default(false).notNull(),
  requiresDeleteAuthority: boolean("requires_delete_authority").default(false).notNull(),
  
  description: text("description"),
  examples: text("examples").array(), // Example queries that trigger this function
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_function_permission").on(table.tenantId, table.functionName),
  index("function_permissions_tenant_idx").on(table.tenantId),
  index("function_permissions_function_name_idx").on(table.functionName),
  index("function_permissions_module_idx").on(table.module),
  index("function_permissions_category_idx").on(table.category),
]);

export const insertFunctionPermissionSchema = createInsertSchema(functionPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFunctionPermission = z.infer<typeof insertFunctionPermissionSchema>;
export type FunctionPermission = typeof functionPermissions.$inferSelect;

// Address schema for JSONB fields
export const addressSchema = z.object({
  attention: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
});

// Contact person schema for JSONB fields
export const contactPersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  designation: z.string().optional(),
});

// Tenant Company Profiles (for invoice issuer details, tax compliance)
export const tenantCompanyProfiles = pgTable("tenant_company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  taxRegistrationNumber: varchar("tax_registration_number", { length: 100 }),
  
  // Structured address
  address: jsonb("address").$type<z.infer<typeof addressSchema>>().default({}),
  
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  
  // IFRS Compliance Master Toggle
  ifrsComplianceEnabled: boolean("ifrs_compliance_enabled").default(false).notNull(),
  
  // IFRS Foreign Currency Translation Configuration (only used if ifrsComplianceEnabled = true)
  fxTranslationStandard: varchar("fx_translation_standard", { length: 20 }).default("ifrs-sme"),
  fxIncomeExpenseMethod: varchar("fx_income_expense_method", { length: 20 }).default("transaction-date"),
  fxGainAccountId: varchar("fx_gain_account_id", { length: 255 }),
  fxLossAccountId: varchar("fx_loss_account_id", { length: 255 }),
  
  // E-Invoicing Compliance
  jurisdiction: varchar("jurisdiction", { length: 50 }), // 'UAE', 'KSA', 'UK', 'US', etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantCompanyProfileSchema = createInsertSchema(tenantCompanyProfiles, {
  legalName: z.string().min(1, "Legal name is required"),
  taxRegistrationNumber: z.string().min(1, "Tax registration number is required"),
  address: addressSchema.optional(),
  // CRITICAL: Default to false so value is always present in payload (not stripped as undefined)
  ifrsComplianceEnabled: z.boolean().default(false),
  fxTranslationStandard: z.string().optional(),
  fxIncomeExpenseMethod: z.string().optional(),
  fxGainAccountId: z.string().optional(),
  fxLossAccountId: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTenantCompanyProfileSchema = insertTenantCompanyProfileSchema
  .omit({ tenantId: true })  // CRITICAL: Must exclude tenantId to prevent tampering
  .partial();

export type InsertTenantCompanyProfile = z.infer<typeof insertTenantCompanyProfileSchema>;
export type TenantCompanyProfile = typeof tenantCompanyProfiles.$inferSelect;

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Basic info (existing)
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  
  // NEW FIELDS for Zoho Books integration
  displayName: varchar("display_name", { length: 255 }),
  website: varchar("website", { length: 255 }),
  customerType: varchar("customer_type", { length: 50 }).default("business"),
  paymentTerms: integer("payment_terms").default(30),
  currencyCode: varchar("currency_code", { length: 3 }).default("USD"),
  
  // Structured addresses (JSONB)
  billingAddress: jsonb("billing_address").$type<z.infer<typeof addressSchema>>().default({}),
  shippingAddress: jsonb("shipping_address").$type<z.infer<typeof addressSchema>>().default({}),
  contactPersons: jsonb("contact_persons").$type<z.infer<typeof contactPersonSchema>[]>().default([]),
  
  // Tax compliance
  taxRegistrationNumber: varchar("tax_registration_number", { length: 100 }),
  
  // Keep existing fields
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers, {
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  contactPersons: z.array(contactPersonSchema).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerSchema = insertCustomerSchema.omit({ tenantId: true }).partial();

// Client-side form schema (no tenantId, harmonized with update schema)
export const customerFormSchema = insertCustomerSchema
  .omit({ tenantId: true })
  .extend({
    // Explicitly make all fields optional to match PATCH behavior
    // while still validating structure when present
    billingAddress: addressSchema.optional(),
    shippingAddress: addressSchema.optional(),
    contactPersons: z.array(contactPersonSchema).optional(),
  });

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
export type Customer = typeof customers.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type CustomerWithOptimistic = Customer & {
  isPending?: boolean;
};

// Vendors
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Basic info
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  
  // NEW FIELDS for Zoho Books parity (matching customers)
  displayName: varchar("display_name", { length: 255 }),
  website: varchar("website", { length: 255 }),
  customerType: varchar("customer_type", { length: 50 }).default("business"),
  paymentTerms: integer("payment_terms").default(30),
  currencyCode: varchar("currency_code", { length: 3 }).default("USD"),
  
  // Structured addresses (JSONB) - reuse addressSchema
  billingAddress: jsonb("billing_address").$type<z.infer<typeof addressSchema>>().default({}),
  shippingAddress: jsonb("shipping_address").$type<z.infer<typeof addressSchema>>().default({}),
  contactPersons: jsonb("contact_persons").$type<z.infer<typeof contactPersonSchema>[]>().default([]),
  
  // Tax compliance
  taxRegistrationNumber: varchar("tax_registration_number", { length: 100 }),
  
  // Vendor-specific Stripe fields
  stripeAccountId: varchar("stripe_account_id"),
  bankAccountLast4: varchar("bank_account_last4", { length: 4 }),
  
  // Keep existing fields
  address: text("address"), // DEPRECATED but keep for backward compatibility
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendors, {
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  contactPersons: z.array(contactPersonSchema).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVendorSchema = insertVendorSchema.omit({ tenantId: true }).partial();

export const vendorFormSchema = insertVendorSchema
  .omit({ tenantId: true })
  .extend({
    billingAddress: addressSchema.optional(),
    shippingAddress: addressSchema.optional(),
    contactPersons: z.array(contactPersonSchema).optional(),
  });

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type VendorFormValues = z.infer<typeof vendorFormSchema>;
export type Vendor = typeof vendors.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type VendorWithOptimistic = Vendor & {
  isPending?: boolean;
};

// Chart of Accounts
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // asset, liability, equity, income, expense
  accountCategory: varchar("account_category", { length: 100 }), // Current Assets, Fixed Assets, Current Liabilities, etc.
  subtype: varchar("subtype", { length: 100 }), // e.g., current_asset, fixed_asset
  parentId: varchar("parent_id"),
  description: text("description"),
  isSystemAccount: boolean("is_system_account").default(false),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).default("0"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  
  // IAS 7 Cash Flow Statement classification
  cashFlowClassification: varchar("cash_flow_classification", { length: 50 }).notNull().default("none"), // operating, investing, financing, none
  isCashEquivalent: boolean("is_cash_equivalent").default(false).notNull(), // Short-term highly liquid investments (IAS 7.7)
  cashEquivalentMaturityDays: integer("cash_equivalent_maturity_days"), // Must be <=90 days if isCashEquivalent=true
  
  // IFRS 18 Presentation & Disclosure
  ifrs18Category: varchar("ifrs18_category", { length: 50 }).notNull().default("none"), // operating_income, operating_expense, investing_income, investing_expense, financing_income, financing_expense, none
  requiredSubtotal: varchar("required_subtotal", { length: 100 }), // e.g., "Operating Profit", "Profit Before Financing"
  presentationOrder: integer("presentation_order"), // For P&L ordering
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("accounts_cash_flow_classification_idx").on(table.tenantId, table.cashFlowClassification),
  index("accounts_cash_equivalent_idx").on(table.tenantId, table.isCashEquivalent),
  index("accounts_ifrs18_category_idx").on(table.tenantId, table.ifrs18Category),
]);

export const insertAccountSchema = createInsertSchema(accounts, {
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  openingBalance: decimalString,
  cashFlowClassification: z.enum(['operating', 'investing', 'financing', 'none']).default('none'),
  ifrs18Category: z.enum(['operating_income', 'operating_expense', 'investing_income', 'investing_expense', 'financing_income', 'financing_expense', 'none']).default('none'),
}).omit({
  id: true,
  code: true,
  currentBalance: true, // Omit from insert, will be set by backend
  tenantId: true,
  createdAt: true,
  updatedAt: true,
}).refine((data) => {
  // IAS 7.7: Cash equivalents must have maturity ≤90 days
  if (data.isCashEquivalent && data.cashEquivalentMaturityDays != null && data.cashEquivalentMaturityDays > 90) {
    return false;
  }
  return true;
}, {
  message: "Cash equivalents must have maturity ≤90 days (IAS 7.7)",
  path: ["cashEquivalentMaturityDays"],
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Items/Products (with Inventory Tracking)
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }),
  rate: decimal("rate", { precision: 12, scale: 2 }).notNull(), // Sale price
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }), // Cost/purchase price
  unit: varchar("unit", { length: 50 }),
  type: varchar("type", { length: 50 }).notNull(),
  accountId: varchar("account_id").references(() => accounts.id),
  taxId: varchar("tax_id"),
  
  // Inventory tracking fields
  quantityOnHand: decimal("quantity_on_hand", { precision: 10, scale: 2 }).default("0"),
  reorderLevel: decimal("reorder_level", { precision: 10, scale: 2 }),
  
  // IAS 2 Net Realizable Value (NRV) tracking
  nrvLastAssessed: timestamp("nrv_last_assessed"), // Last NRV assessment date
  nrvValue: decimal("nrv_value", { precision: 12, scale: 2 }), // Current Net Realizable Value
  totalWriteDowns: decimal("total_write_downs", { precision: 12, scale: 2 }).default("0"), // Cumulative write-downs
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertItemSchema = createInsertSchema(items, {
  rate: decimalString,
  purchasePrice: decimalString,
  quantityOnHand: decimalString,
  reorderLevel: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// ====================================
// IAS 2 NET REALIZABLE VALUE (NRV) ASSESSMENTS
// ====================================

// NRV Assessments (IAS 2 - Inventories)
export const nrvAssessments = pgTable("nrv_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  itemId: varchar("item_id").notNull().references(() => items.id),
  assessmentDate: timestamp("assessment_date").notNull(),
  costValue: decimal("cost_value", { precision: 12, scale: 2 }).notNull(), // Item cost at assessment
  nrvValue: decimal("nrv_value", { precision: 12, scale: 2 }).notNull(), // Net realizable value
  writeDownAmount: decimal("write_down_amount", { precision: 12, scale: 2 }).notNull(), // Calculated write-down
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'approved', 'applied'
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("nrv_assessments_tenant_item_idx").on(table.tenantId, table.itemId),
  index("nrv_assessments_tenant_date_idx").on(table.tenantId, table.assessmentDate),
]);

export const insertNrvAssessmentSchema = createInsertSchema(nrvAssessments, {
  costValue: decimalString,
  nrvValue: decimalString,
  writeDownAmount: decimalString,
  status: z.enum(['pending', 'approved', 'applied']).default('pending'),
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNrvAssessment = z.infer<typeof insertNrvAssessmentSchema>;
export type NrvAssessment = typeof nrvAssessments.$inferSelect;

// ====================================
// IAS 21 FX TRANSLATION RUNS
// ====================================

// FX Translation Runs (IAS 21 - Foreign Currency Translation)
export const fxTranslationRuns = pgTable("fx_translation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  runDate: timestamp("run_date").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("running"), // 'running', 'completed', 'failed'
  ociAmount: decimal("oci_amount", { precision: 12, scale: 2 }), // Other Comprehensive Income translation adjustment
  retainedEarningsAmount: decimal("retained_earnings_amount", { precision: 12, scale: 2 }), // RE translation adjustment
  affectedAccounts: jsonb("affected_accounts").$type<string[]>().default([]), // Array of account IDs
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Run details, exchange rates used, etc.
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("fx_translation_runs_tenant_date_idx").on(table.tenantId, table.runDate),
]);

export const insertFxTranslationRunSchema = createInsertSchema(fxTranslationRuns, {
  ociAmount: decimalString,
  retainedEarningsAmount: decimalString,
  status: z.enum(['running', 'completed', 'failed']).default('running'),
  affectedAccounts: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFxTranslationRun = z.infer<typeof insertFxTranslationRunSchema>;
export type FxTranslationRun = typeof fxTranslationRuns.$inferSelect;

// Taxes
export const taxes = pgTable("taxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertTaxSchema = createInsertSchema(taxes, {
  rate: decimalString,
}).omit({
  id: true,
  tenantId: true,
});

export const updateTaxSchema = z.object({
  name: z.string().optional(),
  rate: decimalString.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type InsertTax = z.infer<typeof insertTaxSchema>;
export type Tax = typeof taxes.$inferSelect;

// Invoices (Sales)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  poReference: varchar("po_reference", { length: 100 }), // Purchase Order reference
  
  // Tax compliance fields
  invoiceSubject: varchar("invoice_subject", { length: 500 }),
  issuerTaxId: varchar("issuer_tax_id", { length: 100 }),
  customerTaxId: varchar("customer_tax_id", { length: 100 }),
  
  // Project tracking
  projectName: varchar("project_name", { length: 255 }),
  
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  
  // Email tracking fields
  emailSentAt: timestamp("email_sent_at"),
  emailSentTo: varchar("email_sent_to"),
  emailStatus: varchar("email_status"), // 'pending', 'sent', 'failed'
  emailError: text("email_error"),
  
  // UAE Peppol E-Invoicing Fields
  peppolQrCode: text("peppol_qr_code"), // QR code data
  peppolTransmissionDeadline: timestamp("peppol_transmission_deadline"), // Invoice date + 14 days
  peppolTransmittedAt: timestamp("peppol_transmitted_at"),
  peppolTransmissionStatus: varchar("peppol_transmission_status", { length: 50 }), // pending, transmitted, failed
  peppolAspReference: varchar("peppol_asp_reference", { length: 255 }), // ASP transaction ID
  peppolUblXml: text("peppol_ubl_xml"), // Generated UBL XML (store for audit)
  
  // KSA ZATCA E-Invoicing Fields
  zatcaUuid: varchar("zatca_uuid", { length: 255 }), // Unique invoice UUID
  zatcaHash: varchar("zatca_hash", { length: 512 }), // Cryptographic hash
  zatcaPreviousInvoiceHash: varchar("zatca_previous_invoice_hash", { length: 512 }), // Hash chaining
  zatcaQrCode: text("zatca_qr_code"), // ZATCA-compliant QR code
  zatcaClearanceStatus: varchar("zatca_clearance_status", { length: 50 }), // cleared, rejected, pending
  zatcaClearedAt: timestamp("zatca_cleared_at"),
  zatcaReportedAt: timestamp("zatca_reported_at"),
  zatcaFatoorahXml: text("zatca_fatoorah_xml"), // FATOORAH XML
  
  deletedAt: timestamp("deleted_at"), // Soft delete
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Composite unique constraint: invoice_number must be unique per tenant
  unique("unique_invoice_number_tenant").on(table.tenantId, table.invoiceNumber),
  // Composite unique constraint: po_reference must be unique per tenant (when not null)
  // Note: NULL values don't violate unique constraints in PostgreSQL
  unique("unique_po_reference_tenant").on(table.tenantId, table.poReference),
]);

export const insertInvoiceSchema = createInsertSchema(invoices, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  deletedAt: true, // Managed by soft delete
  createdAt: true,
  updatedAt: true,
}).extend({
  // Explicitly make invoiceNumber optional (server-generated)
  invoiceNumber: z.string().max(100).optional(),
  invoiceSubject: z.string().max(500).optional(),
  issuerTaxId: z.string().max(100).optional(),
  customerTaxId: z.string().max(100).optional(),
  projectName: z.string().max(255).optional(),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type InvoiceWithOptimistic = Invoice & {
  isPending?: boolean;
};

// Invoice Line Items
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  
  // Item catalog reference
  itemId: varchar("item_id").references(() => items.id),
  
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  
  // Item-level discount
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  // Item-level tax
  taxId: varchar("tax_id").references(() => taxes.id),
  
  accountId: varchar("account_id").references(() => accounts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// Invoice Payload (for transactional create/update with line items)
export const invoicePayloadSchema = z.object({
  invoice: insertInvoiceSchema.partial().required({ 
    customerId: true,
    invoiceDate: true,
    dueDate: true,
    status: true,
    subtotal: true,
    taxAmount: true,
    total: true,
  }),
  lineItems: z.array(insertInvoiceLineItemSchema.omit({ invoiceId: true })).min(1, "At least one line item is required"),
});

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>;

// Invoice Audit Logs (for compliance and tracking changes)
export const invoiceAuditLogs = pgTable("invoice_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // created, updated, deleted, sent, paid, cancelled
  changes: jsonb("changes"), // JSON of what changed
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertInvoiceAuditLogSchema = createInsertSchema(invoiceAuditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertInvoiceAuditLog = z.infer<typeof insertInvoiceAuditLogSchema>;
export type InvoiceAuditLog = typeof invoiceAuditLogs.$inferSelect;

// Invoice Number Sequencing (per tenant)
export const invoiceSequences = pgTable("invoice_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("INV-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSequenceSchema = createInsertSchema(invoiceSequences).omit({
  updatedAt: true,
});

export type InsertInvoiceSequence = z.infer<typeof insertInvoiceSequenceSchema>;
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;

// Journal Entry Number Sequencing (per tenant)
export const journalEntrySequences = pgTable("journal_entry_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("JE-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type JournalEntrySequence = typeof journalEntrySequences.$inferSelect;

// Historical Balances (Track account balances by period for accurate reporting)
export const historicalBalances = pgTable("historical_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).notNull().default('0'),
  closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }).notNull().default('0'),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
}, (table) => [
  unique("unique_historical_balance_period").on(table.tenantId, table.accountId, table.periodStart, table.periodEnd),
  index("historical_balances_account_idx").on(table.tenantId, table.accountId),
  index("historical_balances_period_idx").on(table.periodStart, table.periodEnd),
  // PERFORMANCE FIX: Composite index for efficient period lookups by tenant and account
  index("idx_historical_balances_tenant_account_period").on(table.tenantId, table.accountId, table.periodStart),
]);

export const insertHistoricalBalanceSchema = createInsertSchema(historicalBalances, {
  openingBalance: decimalString,
  closingBalance: decimalString,
  exchangeRate: decimalString.optional(),
}).omit({
  id: true,
});

export type InsertHistoricalBalance = z.infer<typeof insertHistoricalBalanceSchema>;
export type HistoricalBalance = typeof historicalBalances.$inferSelect;

// Account Transaction History (Transaction-level balance tracking for audit trail)
export const accountTransactionHistory = pgTable("account_transaction_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  journalEntryId: varchar("journal_entry_id").references(() => journalEntries.id),
  journalEntryLegId: varchar("journal_entry_leg_id").references(() => journalEntryLegs.id),
  
  transactionDate: timestamp("transaction_date").notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'debit', 'credit'
  
  // Source document tracking
  sourceDocumentType: varchar("source_document_type", { length: 50 }), // 'invoice', 'bill', 'payment', etc.
  sourceDocumentId: varchar("source_document_id"),
  
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default('0'),
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default('0'),
  runningBalance: decimal("running_balance", { precision: 15, scale: 2 }).notNull(),
  
  // Multi-currency tracking
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  
  description: text("description"),
}, (table) => [
  index("account_transaction_history_account_idx").on(table.tenantId, table.accountId),
  index("account_transaction_history_date_idx").on(table.transactionDate),
  index("account_transaction_history_source_idx").on(table.sourceDocumentType, table.sourceDocumentId),
  index("account_transaction_history_journal_entry_idx").on(table.journalEntryId),
  // PERFORMANCE FIX: Composite index for efficient chronological queries by tenant, account, and date
  index("idx_account_tx_history_tenant_account_date").on(table.tenantId, table.accountId, table.transactionDate),
  sql`CONSTRAINT check_transaction_type CHECK (transaction_type IN ('debit', 'credit'))`,
]);

export const insertAccountTransactionHistorySchema = createInsertSchema(accountTransactionHistory, {
  debitAmount: decimalString.optional(),
  creditAmount: decimalString.optional(),
  runningBalance: decimalString,
  exchangeRate: decimalString.optional(),
  transactionType: z.enum(['debit', 'credit']),
}).omit({
  id: true,
});

export type InsertAccountTransactionHistory = z.infer<typeof insertAccountTransactionHistorySchema>;
export type AccountTransactionHistory = typeof accountTransactionHistory.$inferSelect;

// Purchase Order Number Sequencing (per tenant)
export const purchaseOrderSequences = pgTable("purchase_order_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("PO-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PurchaseOrderSequence = typeof purchaseOrderSequences.$inferSelect;

// Asset Number Sequencing (per tenant)
export const assetSequences = pgTable("asset_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("ASSET-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AssetSequence = typeof assetSequences.$inferSelect;

// Account Number Sequencing (per tenant)
export const accountSequences = pgTable("account_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("ACC-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AccountSequence = typeof accountSequences.$inferSelect;

// Bills (Purchases from Vendors)
export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  billNumber: varchar("bill_number", { length: 100 }).notNull(),
  
  // Project tracking
  projectName: varchar("project_name", { length: 255 }),
  
  billDate: timestamp("bill_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("unpaid"), // unpaid, scheduled, paid, overdue, cancelled
  
  // AI extraction review (human-in-the-loop verification)
  aiExtractionStatus: varchar("ai_extraction_status", { length: 50 }).default("pending_review"), // 'pending_review', 'reviewed', 'corrected', null (if not AI-extracted)
  aiConfidenceScore: integer("ai_confidence_score"), // 0-100, overall confidence of AI extraction
  aiSuggestedAccounts: jsonb("ai_suggested_accounts"), // JSON array of suggested account mappings with confidence scores
  reviewedBy: varchar("reviewed_by").references(() => users.id), // User who reviewed AI extraction
  reviewedAt: timestamp("reviewed_at"), // When AI extraction was reviewed
  reviewNotes: text("review_notes"), // Notes from human reviewer
  aiCorrectionsMade: boolean("ai_corrections_made").default(false), // true if user corrected AI suggestions
  
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  documentUrl: varchar("document_url", { length: 500 }), // uploaded document
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("bills_ai_extraction_status_idx").on(table.aiExtractionStatus),
  index("bills_reviewed_by_idx").on(table.reviewedBy),
  sql`CONSTRAINT check_ai_extraction_status CHECK (ai_extraction_status IS NULL OR ai_extraction_status IN ('pending_review', 'reviewed', 'corrected'))`,
  sql`CONSTRAINT check_ai_confidence_score CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 100))`,
]);

export const insertBillSchema = createInsertSchema(bills, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  projectName: z.string().max(255).optional(),
});

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof bills.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type BillWithOptimistic = Bill & {
  isPending?: boolean;
};

// Bill Line Items
export const billLineItems = pgTable("bill_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  billId: varchar("bill_id").notNull().references(() => bills.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  accountId: varchar("account_id").references(() => accounts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBillLineItemSchema = createInsertSchema(billLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type InsertBillLineItem = z.infer<typeof insertBillLineItemSchema>;
export type BillLineItem = typeof billLineItems.$inferSelect;

// Bill Payload (for transactional create/update with line items)
export const billPayloadSchema = z.object({
  bill: insertBillSchema.partial().required({ 
    vendorId: true,
    billNumber: true,
    billDate: true,
    dueDate: true,
    status: true,
    subtotal: true,
    taxAmount: true,
    total: true,
  }),
  lineItems: z.array(insertBillLineItemSchema.omit({ billId: true })).min(1, "At least one line item is required"),
});

export type BillPayload = z.infer<typeof billPayloadSchema>;

// Expenses
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  projectId: varchar("project_id").references(() => projects.id),
  date: timestamp("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  accountId: varchar("account_id").references(() => accounts.id),
  
  // Multi-currency transaction tracking
  currencyCode: varchar("currency_code", { length: 3 }).default('USD'),
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, paid, rejected (legacy, use reimbursementStatus)
  documentUrl: varchar("document_url", { length: 500 }), // uploaded receipt
  notes: text("notes"),
  
  // Employee Reimbursement Fields
  employeeId: varchar("employee_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by").references(() => users.id),
  
  // Approval workflow integration
  approvalWorkflowId: varchar("approval_workflow_id").references(() => approvalWorkflows.id),
  approvalRequestId: varchar("approval_request_id").references(() => approvalRequests.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  // Reimbursement tracking
  reimbursementStatus: varchar("reimbursement_status", { length: 50 }).default("pending"),
  reimbursedBy: varchar("reimbursed_by").references(() => users.id),
  reimbursedAt: timestamp("reimbursed_at"),
  paymentReference: varchar("payment_reference", { length: 200 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
  date: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  employeeId: z.string().optional(),
  submittedBy: z.string().optional(),
  submittedAt: z.coerce.date().optional(),
  approvalWorkflowId: z.string().optional(),
  approvalRequestId: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.coerce.date().optional(),
  rejectedBy: z.string().optional(),
  rejectedAt: z.coerce.date().optional(),
  rejectionReason: z.string().optional(),
  reimbursementStatus: z.string().optional().default("pending"),
  reimbursedBy: z.string().optional(),
  reimbursedAt: z.coerce.date().optional(),
  paymentReference: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Payments (Stripe Connect Transfers to Vendors)
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  billId: varchar("bill_id").references(() => bills.id),
  expenseId: varchar("expense_id").references(() => expenses.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (Payment-specific)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  baseAmount: decimal("base_amount", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, scheduled, processing, completed, failed
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  stripeTransferId: varchar("stripe_transfer_id", { length: 255 }), // Stripe transfer/payout ID
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  failureReason: text("failure_reason"),
  notes: text("notes"),
  
  // Approval workflow tracking
  approvalStatus: varchar("approval_status", { length: 50 }).default("draft"), // draft, pending_approval, approved, rejected, cancelled
  approvalWorkflowId: varchar("approval_workflow_id").references(() => approvalWorkflows.id),
  approvalChain: jsonb("approval_chain"), // Array of {userId, timestamp, decision, comments}
  approvedBy: jsonb("approved_by"), // Array of user IDs who approved
  approvedAt: jsonb("approved_at"), // Array of approval timestamps
  rejectionReason: text("rejection_reason"),
  
  // Authorization tracking (dual control for high-value payments)
  authorizationStatus: varchar("authorization_status", { length: 50 }).default("not_required"), // not_required, pending_authorization, authorized, rejected
  authorizedBy: varchar("authorized_by").references(() => users.id),
  authorizedAt: timestamp("authorized_at"),
  
  // Execution tracking
  executedBy: varchar("executed_by").references(() => users.id),
  executedAt: timestamp("executed_at"),
  
  // Fraud detection
  fraudCheckStatus: varchar("fraud_check_status", { length: 50 }).default("not_checked"), // not_checked, passed, flagged, blocked
  fraudFlags: jsonb("fraud_flags"), // JSON array of fraud indicators
  
  // Batch payment support
  paymentBatchId: varchar("payment_batch_id").references(() => paymentBatches.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("payments_approval_status_idx").on(table.tenantId, table.approvalStatus),
  index("payments_batch_idx").on(table.paymentBatchId),
  sql`CONSTRAINT check_approval_status CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled'))`,
  sql`CONSTRAINT check_authorization_status CHECK (authorization_status IN ('not_required', 'pending_authorization', 'authorized', 'rejected'))`,
  sql`CONSTRAINT check_fraud_check_status CHECK (fraud_check_status IN ('not_checked', 'passed', 'flagged', 'blocked'))`,
]);

export const insertPaymentSchema = createInsertSchema(payments, {
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
  baseAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type PaymentWithOptimistic = Payment & {
  isPending?: boolean;
};

// Bill Payment Applications (tracks payment allocations to bills)
export const billPaymentApplications = pgTable("bill_payment_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  paymentId: varchar("payment_id").notNull().references(() => payments.id),
  billId: varchar("bill_id").notNull().references(() => bills.id),
  amountApplied: decimal("amount_applied", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("bill_payment_applications_payment_idx").on(table.paymentId),
  index("bill_payment_applications_bill_idx").on(table.billId),
]);

export const insertBillPaymentApplicationSchema = createInsertSchema(billPaymentApplications, {
  amountApplied: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertBillPaymentApplication = z.infer<typeof insertBillPaymentApplicationSchema>;
export type BillPaymentApplication = typeof billPaymentApplications.$inferSelect;

// Document Uploads (for AI extraction)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  type: varchar("type", { length: 50 }).notNull(), // invoice, bill, receipt
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  extractionStatus: varchar("extraction_status", { length: 50 }).default("pending"), // pending, processing, completed, failed
  extractedData: jsonb("extracted_data"), // AI-extracted fields
  linkedEntityId: varchar("linked_entity_id"), // ID of created invoice/bill/expense
  linkedEntityType: varchar("linked_entity_type", { length: 50 }), // invoice, bill, expense
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Attachments (Universal attachment system for all entities)
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  fileType: varchar("file_type", { length: 100 }).notNull(), // MIME type
  fileData: text("file_data").notNull(), // Base64 encoded file data (for MVP)
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'invoice', 'bill', 'purchase_order', 'credit_note', 'expense', 'payment'
  entityId: varchar("entity_id", { length: 255 }).notNull(), // ID of the related entity
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => [
  index("attachments_tenant_idx").on(table.tenantId),
  index("attachments_entity_idx").on(table.entityType, table.entityId),
]);

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// Quotes (Sales Quotations)
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  quoteNumber: varchar("quote_number", { length: 100 }),
  
  quoteSubject: varchar("quote_subject", { length: 500 }),
  issuerTaxId: varchar("issuer_tax_id", { length: 100 }),
  customerTaxId: varchar("customer_tax_id", { length: 100 }),
  
  quoteDate: timestamp("quote_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, accepted, rejected, expired, converted
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  
  // Conversion tracking
  convertedToInvoiceId: varchar("converted_to_invoice_id").references(() => invoices.id),
  convertedAt: timestamp("converted_at"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_quote_number_tenant").on(table.tenantId, table.quoteNumber),
]);

export const insertQuoteSchema = createInsertSchema(quotes, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  convertedToInvoiceId: true,
  convertedAt: true,
}).extend({
  quoteNumber: z.string().max(100).optional(),
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// Quote Line Items
export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

// Sales Orders
export const salesOrders = pgTable("sales_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  orderNumber: varchar("order_number", { length: 100 }),
  
  orderDate: timestamp("order_date").notNull(),
  shipmentDate: timestamp("shipment_date"),
  deliveryDate: timestamp("delivery_date"),
  
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, confirmed, packed, shipped, delivered, invoiced, cancelled
  fulfillmentStatus: varchar("fulfillment_status", { length: 50 }).default("unfulfilled"), // unfulfilled, partially_fulfilled, fulfilled
  
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  
  // Conversion tracking
  convertedToInvoiceId: varchar("converted_to_invoice_id").references(() => invoices.id),
  convertedAt: timestamp("converted_at"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_order_number_tenant").on(table.tenantId, table.orderNumber),
]);

export const insertSalesOrderSchema = createInsertSchema(salesOrders, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  convertedToInvoiceId: true,
  convertedAt: true,
}).extend({
  orderNumber: z.string().max(100).optional(),
});

export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrder = typeof salesOrders.$inferSelect;

// Sales Order Line Items
export const salesOrderLineItems = pgTable("sales_order_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  salesOrderId: varchar("sales_order_id").notNull().references(() => salesOrders.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  quantityFulfilled: decimal("quantity_fulfilled", { precision: 10, scale: 2 }).default("0"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalesOrderLineItemSchema = createInsertSchema(salesOrderLineItems, {
  quantity: decimalString,
  quantityFulfilled: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertSalesOrderLineItem = z.infer<typeof insertSalesOrderLineItemSchema>;
export type SalesOrderLineItem = typeof salesOrderLineItems.$inferSelect;

// Credit Notes
export const creditNotes = pgTable("credit_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id), // Optional link to invoice
  creditNoteNumber: varchar("credit_note_number", { length: 100 }),
  
  creditNoteDate: timestamp("credit_note_date").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, issued, applied, cancelled
  
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  balanceRemaining: decimal("balance_remaining", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  
  // UAE Peppol E-Invoicing Fields
  peppolQrCode: text("peppol_qr_code"),
  peppolTransmissionDeadline: timestamp("peppol_transmission_deadline"),
  peppolTransmittedAt: timestamp("peppol_transmitted_at"),
  peppolTransmissionStatus: varchar("peppol_transmission_status", { length: 50 }),
  peppolAspReference: varchar("peppol_asp_reference", { length: 255 }),
  peppolUblXml: text("peppol_ubl_xml"),
  
  // KSA ZATCA E-Invoicing Fields
  zatcaUuid: varchar("zatca_uuid", { length: 255 }),
  zatcaHash: varchar("zatca_hash", { length: 512 }),
  zatcaPreviousInvoiceHash: varchar("zatca_previous_invoice_hash", { length: 512 }),
  zatcaQrCode: text("zatca_qr_code"),
  zatcaClearanceStatus: varchar("zatca_clearance_status", { length: 50 }),
  zatcaClearedAt: timestamp("zatca_cleared_at"),
  zatcaReportedAt: timestamp("zatca_reported_at"),
  zatcaFatoorahXml: text("zatca_fatoorah_xml"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_credit_note_number_tenant").on(table.tenantId, table.creditNoteNumber),
]);

export const insertCreditNoteSchema = createInsertSchema(creditNotes, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
  balanceRemaining: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionTotalAmount: decimalString.optional(),
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  creditNoteNumber: z.string().max(100).optional(),
});

export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type CreditNote = typeof creditNotes.$inferSelect;

// Credit Note Line Items
export const creditNoteLineItems = pgTable("credit_note_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  creditNoteId: varchar("credit_note_id").notNull().references(() => creditNotes.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCreditNoteLineItemSchema = createInsertSchema(creditNoteLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCreditNoteLineItem = z.infer<typeof insertCreditNoteLineItemSchema>;
export type CreditNoteLineItem = typeof creditNoteLineItems.$inferSelect;

// Credit Note Payload (for transactional create/update with line items)
export const creditNotePayloadSchema = z.object({
  creditNote: insertCreditNoteSchema.partial().required({ 
    customerId: true,
    creditNoteDate: true,
    status: true,
    subtotal: true,
    taxAmount: true,
    total: true,
    balanceRemaining: true,
  }),
  lineItems: z.array(insertCreditNoteLineItemSchema.omit({ creditNoteId: true })).min(1, "At least one line item is required"),
});

export type CreditNotePayload = z.infer<typeof creditNotePayloadSchema>;

// Customer Payments (Accounts Receivable - payments FROM customers)
// Note: Renamed from 'payments' to avoid conflict with existing vendor payments table
export const customerPayments = pgTable("customer_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  paymentNumber: varchar("payment_number", { length: 100 }),
  
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, check, bank_transfer, credit_card, etc.
  referenceNumber: varchar("reference_number", { length: 100 }),
  
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (Payment-specific)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  baseAmount: decimal("base_amount", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  
  notes: text("notes"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_payment_number_tenant").on(table.tenantId, table.paymentNumber),
]);

export const insertCustomerPaymentSchema = createInsertSchema(customerPayments, {
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
  baseAmount: decimalString.optional(),
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  paymentNumber: z.string().max(100).optional(),
});

export type InsertCustomerPayment = z.infer<typeof insertCustomerPaymentSchema>;
export type CustomerPayment = typeof customerPayments.$inferSelect;

// Client-side extension for optimistic UI - adds optional isPending flag
// This field only exists during optimistic updates and is never persisted to the database
export type CustomerPaymentWithOptimistic = CustomerPayment & {
  isPending?: boolean;
};

// Customer Payment Number Sequencing (per tenant)
export const customerPaymentSequences = pgTable("customer_payment_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("PAY-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerPaymentSequenceSchema = createInsertSchema(customerPaymentSequences).omit({
  updatedAt: true,
});

export type InsertCustomerPaymentSequence = z.infer<typeof insertCustomerPaymentSequenceSchema>;
export type CustomerPaymentSequence = typeof customerPaymentSequences.$inferSelect;

// Customer Payment Applications (tracks payment allocations to invoices)
export const customerPaymentApplications = pgTable("customer_payment_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  paymentId: varchar("payment_id").notNull().references(() => customerPayments.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  amountApplied: decimal("amount_applied", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("customer_payment_applications_payment_idx").on(table.paymentId),
  index("customer_payment_applications_invoice_idx").on(table.invoiceId),
]);

export const insertCustomerPaymentApplicationSchema = createInsertSchema(customerPaymentApplications, {
  amountApplied: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomerPaymentApplication = z.infer<typeof insertCustomerPaymentApplicationSchema>;
export type CustomerPaymentApplication = typeof customerPaymentApplications.$inferSelect;

// Recurring Invoices
export const recurringInvoices = pgTable("recurring_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  recurringInvoiceNumber: varchar("recurring_invoice_number", { length: 50 }).notNull(),
  
  // Frequency settings
  frequency: varchar("frequency", { length: 50 }).notNull(), // daily, weekly, monthly, quarterly, yearly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // nullable for indefinite recurring
  nextInvoiceDate: timestamp("next_invoice_date").notNull(),
  
  // Invoice template data
  issuerTaxId: varchar("issuer_tax_id", { length: 100 }),
  customerTaxId: varchar("customer_tax_id", { length: 100 }),
  invoiceSubject: text("invoice_subject"),
  notes: text("notes"),
  terms: text("terms"),
  
  // Calculated fields (recalculated server-side)
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, paused, completed
  
  // Tracking
  lastInvoiceId: varchar("last_invoice_id").references(() => invoices.id),
  lastInvoiceDate: timestamp("last_invoice_date"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  unique("unique_recurring_invoice_number_tenant").on(table.tenantId, table.recurringInvoiceNumber),
]);

export const insertRecurringInvoiceSchema = createInsertSchema(recurringInvoices, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  recurringInvoiceNumber: true, // Auto-generated
  nextInvoiceDate: true, // Calculated from startDate + frequency
  lastInvoiceId: true,
  lastInvoiceDate: true,
});

export type InsertRecurringInvoice = z.infer<typeof insertRecurringInvoiceSchema>;
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;

// Recurring Invoice Line Items
export const recurringInvoiceLineItems = pgTable("recurring_invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  recurringInvoiceId: varchar("recurring_invoice_id").notNull().references(() => recurringInvoices.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecurringInvoiceLineItemSchema = createInsertSchema(recurringInvoiceLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  tenantId: true,
  recurringInvoiceId: true,
  createdAt: true,
});

export type InsertRecurringInvoiceLineItem = z.infer<typeof insertRecurringInvoiceLineItemSchema>;
export type RecurringInvoiceLineItem = typeof recurringInvoiceLineItems.$inferSelect;

// Retainer Invoices (Advance Payment Invoices with Line Items)
export const retainerInvoices = pgTable("retainer_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  retainerNumber: varchar("retainer_number", { length: 100 }),
  
  // Invoice details
  invoiceDate: timestamp("invoice_date").notNull(),
  invoiceSubject: text("invoice_subject"),
  issuerTaxId: varchar("issuer_tax_id", { length: 100 }),
  customerTaxId: varchar("customer_tax_id", { length: 100 }),
  
  // Financial fields (server-side calculated)
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  
  // Retainer-specific tracking
  amountUsed: decimal("amount_used", { precision: 12, scale: 2 }).notNull().default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  
  // Status: draft, sent, paid, partially_applied, fully_applied
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  
  notes: text("notes"),
  terms: text("terms"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_retainer_number_tenant").on(table.tenantId, table.retainerNumber),
]);

export const insertRetainerInvoiceSchema = createInsertSchema(retainerInvoices, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
  amountUsed: decimalString,
  remainingBalance: decimalString,
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  retainerNumber: z.string().max(100).optional(),
  invoiceSubject: z.string().optional(),
  issuerTaxId: z.string().max(100).optional(),
  customerTaxId: z.string().max(100).optional(),
});

export type InsertRetainerInvoice = z.infer<typeof insertRetainerInvoiceSchema>;
export type RetainerInvoice = typeof retainerInvoices.$inferSelect;

// Retainer Invoice Line Items
export const retainerInvoiceLineItems = pgTable("retainer_invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  retainerInvoiceId: varchar("retainer_invoice_id").notNull().references(() => retainerInvoices.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRetainerInvoiceLineItemSchema = createInsertSchema(retainerInvoiceLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  tenantId: true,
  retainerInvoiceId: true,
  createdAt: true,
});

export type InsertRetainerInvoiceLineItem = z.infer<typeof insertRetainerInvoiceLineItemSchema>;
export type RetainerInvoiceLineItem = typeof retainerInvoiceLineItems.$inferSelect;

// Retainer Drawdowns (usage of retainer balance)
export const retainerDrawdowns = pgTable("retainer_drawdowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  retainerInvoiceId: varchar("retainer_invoice_id").notNull().references(() => retainerInvoices.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  drawdownDate: timestamp("drawdown_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRetainerDrawdownSchema = createInsertSchema(retainerDrawdowns, {
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertRetainerDrawdown = z.infer<typeof insertRetainerDrawdownSchema>;
export type RetainerDrawdown = typeof retainerDrawdowns.$inferSelect;

// AI Copilot Uploads (document uploads for AI processing)
export const aiCopilotUploads = pgTable("ai_copilot_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  filePath: text("file_path").notNull(), // relative path in attached_assets
  virusScanStatus: varchar("virus_scan_status", { length: 20 }).default("pending").notNull(), // pending, clean, infected
  virusScanDetails: text("virus_scan_details"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 24 hours from upload
  deletedAt: timestamp("deleted_at"), // soft delete
}, (table) => [
  index("ai_copilot_uploads_tenant_idx").on(table.tenantId),
  index("ai_copilot_uploads_user_idx").on(table.userId),
  index("ai_copilot_uploads_expires_at_idx").on(table.expiresAt),
]);

export const insertAiCopilotUploadSchema = createInsertSchema(aiCopilotUploads).omit({
  id: true,
  uploadedAt: true,
});

export type InsertAiCopilotUpload = z.infer<typeof insertAiCopilotUploadSchema>;
export type AiCopilotUpload = typeof aiCopilotUploads.$inferSelect;

// Document Embeddings (RAG knowledge base for AI Copilot semantic search)
export const documentEmbeddings = pgTable("document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  documentType: varchar("document_type", { length: 50 }).notNull(), // 'invoice', 'bill', 'journal_entry', 'memo', etc.
  documentId: varchar("document_id").notNull(), // ID of the source document
  content: text("content").notNull(), // Text content/chunk that was embedded
  embedding: vector("embedding").notNull(), // 1536-dimensional vector from OpenAI text-embedding-3-small
  metadata: jsonb("metadata"), // Additional context (customer name, date, amount, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("document_embeddings_tenant_idx").on(table.tenantId),
  index("document_embeddings_document_type_idx").on(table.documentType),
  index("document_embeddings_document_id_idx").on(table.documentId),
  // Note: Vector similarity search index (HNSW) should be created via raw SQL migration
  // CREATE INDEX document_embeddings_embedding_idx ON document_embeddings USING hnsw (embedding vector_cosine_ops);
]);

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddings).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentEmbedding = z.infer<typeof insertDocumentEmbeddingSchema>;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;

// ====================================
// TASK 7-1: DUAL CLOUD STORAGE + INBOUND DOCUMENTS
// ====================================

// Cloud storage preferences per user
export const cloudStoragePreferences = pgTable("cloud_storage_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  googleDriveEnabled: boolean("google_drive_enabled").default(false).notNull(),
  googleDriveFolderId: varchar("google_drive_folder_id"),
  oneDriveEnabled: boolean("onedrive_enabled").default(false).notNull(),
  oneDriveFolderId: varchar("onedrive_folder_id"),
  localStorageEnabled: boolean("local_storage_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cloud_storage_prefs_tenant_idx").on(table.tenantId),
  index("cloud_storage_prefs_user_idx").on(table.userId),
  unique("unique_cloud_storage_user").on(table.tenantId, table.userId),
]);

export const insertCloudStoragePreferenceSchema = createInsertSchema(cloudStoragePreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCloudStoragePreference = z.infer<typeof insertCloudStoragePreferenceSchema>;
export type CloudStoragePreference = typeof cloudStoragePreferences.$inferSelect;

// Inbound documents from webhooks
export const inboundDocuments = pgTable("inbound_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  source: varchar("source", { length: 50 }).notNull(), // 'email', 'whatsapp', 'sms', 'api'
  sourceIdentifier: varchar("source_identifier", { length: 255 }), // email address, phone number, API key
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  localPath: varchar("local_path", { length: 500 }),
  googleDriveFileId: varchar("google_drive_file_id", { length: 255 }),
  oneDriveFileId: varchar("onedrive_file_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'processing', 'extracted', 'failed', 'approved', 'rejected'
  extractedData: jsonb("extracted_data"), // AI extraction results
  draftEntryId: varchar("draft_entry_id", { length: 255 }), // Link to created draft invoice/bill
  draftEntryType: varchar("draft_entry_type", { length: 50 }), // 'invoice', 'bill', 'journal_entry'
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by").references(() => users.id), // user who approved/rejected
  errorMessage: text("error_message"),
  notificationSent: boolean("notification_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("inbound_documents_tenant_idx").on(table.tenantId),
  index("inbound_documents_status_idx").on(table.status),
  index("inbound_documents_source_idx").on(table.source),
  index("inbound_documents_created_at_idx").on(table.createdAt),
]);

export const insertInboundDocumentSchema = createInsertSchema(inboundDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInboundDocument = z.infer<typeof insertInboundDocumentSchema>;
export type InboundDocument = typeof inboundDocuments.$inferSelect;

// Webhook verification logs
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  source: varchar("source", { length: 50 }), // 'email_forwarder', 'twilio_whatsapp', 'custom_api'
  endpoint: varchar("endpoint", { length: 255 }),
  method: varchar("method", { length: 10 }),
  headers: jsonb("headers"),
  body: jsonb("body"),
  hmacValid: boolean("hmac_valid"),
  processed: boolean("processed").default(false).notNull(),
  inboundDocumentId: varchar("inbound_document_id").references(() => inboundDocuments.id),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("webhook_logs_tenant_idx").on(table.tenantId),
  index("webhook_logs_source_idx").on(table.source),
  index("webhook_logs_processed_idx").on(table.processed),
  index("webhook_logs_created_at_idx").on(table.createdAt),
]);

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

// ====================================
// TASK 7-2: CREDIT PASSPORT TABLES
// ====================================

// Snapshot of financial metrics at a point in time
export const financialMetricsSnapshot = pgTable("financial_metrics_snapshot", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  // Liquidity metrics
  currentRatio: decimal("current_ratio", { precision: 10, scale: 4 }),
  quickRatio: decimal("quick_ratio", { precision: 10, scale: 4 }),
  cashRatio: decimal("cash_ratio", { precision: 10, scale: 4 }),
  workingCapital: decimal("working_capital", { precision: 15, scale: 2 }),
  // Leverage metrics
  debtToEquityRatio: decimal("debt_to_equity_ratio", { precision: 10, scale: 4 }),
  debtToAssetsRatio: decimal("debt_to_assets_ratio", { precision: 10, scale: 4 }),
  interestCoverageRatio: decimal("interest_coverage_ratio", { precision: 10, scale: 4 }),
  // Profitability metrics
  grossProfitMargin: decimal("gross_profit_margin", { precision: 10, scale: 4 }),
  netProfitMargin: decimal("net_profit_margin", { precision: 10, scale: 4 }),
  returnOnAssets: decimal("return_on_assets", { precision: 10, scale: 4 }),
  returnOnEquity: decimal("return_on_equity", { precision: 10, scale: 4 }),
  // Cash flow metrics
  operatingCashFlow: decimal("operating_cash_flow", { precision: 15, scale: 2 }),
  freeCashFlow: decimal("free_cash_flow", { precision: 15, scale: 2 }),
  cashFlowVolatility: decimal("cash_flow_volatility", { precision: 10, scale: 4 }), // Std deviation
  // Operational metrics
  daysInReceivables: decimal("days_in_receivables", { precision: 10, scale: 2 }), // DSO
  daysInPayables: decimal("days_in_payables", { precision: 10, scale: 2 }), // DPO
  inventoryTurnover: decimal("inventory_turnover", { precision: 10, scale: 4 }),
  revenueGrowthRate: decimal("revenue_growth_rate", { precision: 10, scale: 4 }), // YoY %
  // Payment behavior
  averagePaymentDelay: decimal("average_payment_delay", { precision: 10, scale: 2 }), // Days
  latePaymentRate: decimal("late_payment_rate", { precision: 10, scale: 4 }), // %
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("financial_metrics_snapshot_tenant_idx").on(table.tenantId),
  index("financial_metrics_snapshot_date_idx").on(table.snapshotDate),
]);

export const insertFinancialMetricsSnapshotSchema = createInsertSchema(financialMetricsSnapshot, {
  currentRatio: decimalString.optional(),
  quickRatio: decimalString.optional(),
  cashRatio: decimalString.optional(),
  workingCapital: decimalString.optional(),
  debtToEquityRatio: decimalString.optional(),
  debtToAssetsRatio: decimalString.optional(),
  interestCoverageRatio: decimalString.optional(),
  grossProfitMargin: decimalString.optional(),
  netProfitMargin: decimalString.optional(),
  returnOnAssets: decimalString.optional(),
  returnOnEquity: decimalString.optional(),
  operatingCashFlow: decimalString.optional(),
  freeCashFlow: decimalString.optional(),
  cashFlowVolatility: decimalString.optional(),
  daysInReceivables: decimalString.optional(),
  daysInPayables: decimalString.optional(),
  inventoryTurnover: decimalString.optional(),
  revenueGrowthRate: decimalString.optional(),
  averagePaymentDelay: decimalString.optional(),
  latePaymentRate: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertFinancialMetricsSnapshot = z.infer<typeof insertFinancialMetricsSnapshotSchema>;
export type FinancialMetricsSnapshot = typeof financialMetricsSnapshot.$inferSelect;

// Bankability scores
export const bankabilityScores = pgTable("bankability_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  scoreDate: timestamp("score_date").defaultNow().notNull(),
  overallScore: integer("overall_score"), // 0-100
  liquidityScore: integer("liquidity_score"), // 0-100
  leverageScore: integer("leverage_score"),
  profitabilityScore: integer("profitability_score"),
  cashFlowScore: integer("cash_flow_score"),
  operationalScore: integer("operational_score"),
  paymentBehaviorScore: integer("payment_behavior_score"),
  // Blocking factors
  blockingFactors: jsonb("blocking_factors"), // Array of {metric, threshold, current, impact}
  recommendations: jsonb("recommendations"), // Array of actionable steps
  scoreGrade: varchar("score_grade", { length: 3 }), // 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'
  loanEligibility: varchar("loan_eligibility", { length: 50 }), // 'excellent', 'good', 'fair', 'poor', 'not_eligible'
  metricsSnapshotId: varchar("metrics_snapshot_id").references(() => financialMetricsSnapshot.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("bankability_scores_tenant_idx").on(table.tenantId),
  index("bankability_scores_date_idx").on(table.scoreDate),
  index("bankability_scores_grade_idx").on(table.scoreGrade),
]);

export const insertBankabilityScoreSchema = createInsertSchema(bankabilityScores).omit({
  id: true,
  createdAt: true,
});

export type InsertBankabilityScore = z.infer<typeof insertBankabilityScoreSchema>;
export type BankabilityScore = typeof bankabilityScores.$inferSelect;

// Score history for trend analysis
export const scoreHistory = pgTable("score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  bankabilityScoreId: varchar("bankability_score_id").notNull().references(() => bankabilityScores.id),
  scoreDate: timestamp("score_date").notNull(),
  overallScore: integer("overall_score"),
  scoreChange: integer("score_change"), // +/- from previous
  significantChanges: jsonb("significant_changes"), // Array of metrics that changed >10%
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("score_history_tenant_idx").on(table.tenantId),
  index("score_history_bankability_score_idx").on(table.bankabilityScoreId),
  index("score_history_date_idx").on(table.scoreDate),
]);

export const insertScoreHistorySchema = createInsertSchema(scoreHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertScoreHistory = z.infer<typeof insertScoreHistorySchema>;
export type ScoreHistory = typeof scoreHistory.$inferSelect;

// ====================================
// TASK 7-3: COMPREHENSIVE ALERTS SYSTEM
// ====================================

// Alert rules configuration
export const notificationRules = pgTable("notification_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  ruleType: varchar("rule_type", { length: 100 }).notNull(), // 'cash_deficiency', 'aged_ar', 'aged_ap', etc.
  enabled: boolean("enabled").default(true).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(), // 'critical', 'high', 'medium', 'low'
  conditions: jsonb("conditions"), // Threshold values, time periods, etc.
  notificationChannels: jsonb("notification_channels"), // ['push', 'email', 'sms', 'websocket']
  targetRoles: jsonb("target_roles"), // Array of role names to notify
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("notification_rules_tenant_idx").on(table.tenantId),
  index("notification_rules_type_idx").on(table.ruleType),
  index("notification_rules_enabled_idx").on(table.enabled),
]);

export const insertNotificationRuleSchema = createInsertSchema(notificationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNotificationRule = z.infer<typeof insertNotificationRuleSchema>;
export type NotificationRule = typeof notificationRules.$inferSelect;

// Alert instances
export const alertInstances = pgTable("alert_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  ruleId: varchar("rule_id").references(() => notificationRules.id),
  alertType: varchar("alert_type", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  actionUrl: varchar("action_url", { length: 500 }), // Deep link to relevant page
  quickActions: jsonb("quick_actions"), // Array of {label, action, params}
  metadata: jsonb("metadata"), // Context data
  status: varchar("status", { length: 50 }).default("new").notNull(), // 'new', 'viewed', 'actioned', 'dismissed', 'expired'
  viewedAt: timestamp("viewed_at"),
  viewedBy: varchar("viewed_by").references(() => users.id),
  actionedAt: timestamp("actioned_at"),
  actionedBy: varchar("actioned_by").references(() => users.id),
  actionTaken: varchar("action_taken", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("alert_instances_tenant_idx").on(table.tenantId),
  index("alert_instances_status_idx").on(table.status),
  index("alert_instances_priority_idx").on(table.priority),
  index("alert_instances_created_at_idx").on(table.createdAt),
]);

export const insertAlertInstanceSchema = createInsertSchema(alertInstances).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertInstance = z.infer<typeof insertAlertInstanceSchema>;
export type AlertInstance = typeof alertInstances.$inferSelect;

// Month-end closing checklist templates
export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  frequency: varchar("frequency", { length: 50 }).notNull(), // 'monthly', 'quarterly', 'yearly'
  items: jsonb("items").notNull(), // Array of {id, title, description, responsible_role, estimated_time}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("checklist_templates_tenant_idx").on(table.tenantId),
  index("checklist_templates_frequency_idx").on(table.frequency),
]);

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

// Checklist instances
export const checklistInstances = pgTable("checklist_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  templateId: varchar("template_id").references(() => checklistTemplates.id),
  period: varchar("period", { length: 50 }).notNull(), // '2025-01', 'Q1-2025', etc.
  status: varchar("status", { length: 50 }).default("not_started").notNull(), // 'not_started', 'in_progress', 'completed'
  itemsCompleted: jsonb("items_completed"), // {item_id: {completed: boolean, completedBy, completedAt}}
  progress: integer("progress").default(0).notNull(), // 0-100%
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("checklist_instances_tenant_idx").on(table.tenantId),
  index("checklist_instances_status_idx").on(table.status),
  index("checklist_instances_period_idx").on(table.period),
  index("checklist_instances_due_date_idx").on(table.dueDate),
]);

export const insertChecklistInstanceSchema = createInsertSchema(checklistInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChecklistInstance = z.infer<typeof insertChecklistInstanceSchema>;
export type ChecklistInstance = typeof checklistInstances.$inferSelect;

// Anomaly detection results
export const anomalyDetection = pgTable("anomaly_detection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  detectionType: varchar("detection_type", { length: 100 }).notNull(), // 'unusual_amount', 'duplicate_transaction', etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'invoice', 'bill', 'payment', 'journal_entry'
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  anomalyScore: decimal("anomaly_score", { precision: 5, scale: 4 }), // 0-1, higher = more suspicious
  description: text("description").notNull(),
  indicators: jsonb("indicators"), // Array of specific red flags
  suggestedAction: varchar("suggested_action", { length: 255 }),
  status: varchar("status", { length: 50 }).default("new").notNull(), // 'new', 'investigating', 'resolved', 'false_positive'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("anomaly_detection_tenant_idx").on(table.tenantId),
  index("anomaly_detection_status_idx").on(table.status),
  index("anomaly_detection_entity_idx").on(table.entityType, table.entityId),
  index("anomaly_detection_created_at_idx").on(table.createdAt),
]);

export const insertAnomalyDetectionSchema = createInsertSchema(anomalyDetection, {
  anomalyScore: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertAnomalyDetection = z.infer<typeof insertAnomalyDetectionSchema>;
export type AnomalyDetection = typeof anomalyDetection.$inferSelect;

// User notification preferences (for DND schedules, opt-outs, channel preferences)
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Opt-out settings (by alert type)
  optOutAlertTypes: jsonb("opt_out_alert_types"), // Array of alert types user has opted out of
  
  // Channel preferences
  preferredChannels: jsonb("preferred_channels"), // ['push', 'email'] - only use these channels
  
  // Do-not-disturb schedule (per day of week)
  dndSchedule: jsonb("dnd_schedule"), // {monday: {start: "22:00", end: "07:00"}, ...}
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(), // User's timezone for DND
  
  // Global opt-out
  globallyOptedOut: boolean("globally_opted_out").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_notification_prefs_tenant_idx").on(table.tenantId),
  index("user_notification_prefs_user_idx").on(table.userId),
  uniqueIndex("user_notification_prefs_tenant_user_idx").on(table.tenantId, table.userId),
]);

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;

// Alert rate limiting tracking
export const alertRateLimits = pgTable("alert_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  alertType: varchar("alert_type", { length: 100 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(), // 'push', 'email', 'sms', 'websocket'
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => [
  index("alert_rate_limits_user_idx").on(table.userId),
  index("alert_rate_limits_sent_at_idx").on(table.sentAt),
  index("alert_rate_limits_tenant_user_type_idx").on(table.tenantId, table.userId, table.alertType),
]);

export const insertAlertRateLimitSchema = createInsertSchema(alertRateLimits).omit({
  id: true,
  sentAt: true,
});

export type InsertAlertRateLimit = z.infer<typeof insertAlertRateLimitSchema>;
export type AlertRateLimit = typeof alertRateLimits.$inferSelect;

// ====================================
// TASK 8-1: AI INTERACTION LOGS (SECURE - GDPR/SOX COMPLIANT)
// ====================================

/**
 * AI Interaction Logs - Security-First Design
 * 
 * CRITICAL SECURITY NOTES:
 * - NO plaintext sensitive data (customer names, amounts, tax IDs)
 * - Stores METADATA ONLY (task type, document IDs, hashes)
 * - Optional encrypted payloads with KMS envelope encryption
 * - RBAC-protected (only compliance officers can read)
 * - Dual retention: 7yr metadata (SOX), 90-day encrypted content (GDPR)
 * - All log access is logged (audit the auditors)
 */
export const aiInteractionLogs = pgTable("ai_interaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // AI Provider Information (ENFORCED with CHECK constraints)
  provider: varchar("provider", { length: 50 }).notNull(), // 'openai', 'kimi', 'qwen', 'deepseek', 'anthropic', 'gemini', 'mcp_custom'
  model: varchar("model", { length: 100 }), // 'gpt-4o', 'moonshot-v1', 'qwen-2.5-72b', etc.
  
  // Task Classification (METADATA ONLY - no sensitive content)
  taskType: varchar("task_type", { length: 100 }).notNull(), // 'chat', 'document_extraction', 'vision_analysis', 'embedding', 'report_generation', 'function_calling', 'code_generation'
  functionName: varchar("function_name", { length: 200 }), // 'create_invoice', 'extract_bill_data', etc.
  actionTaken: varchar("action_taken", { length: 200 }), // What the AI actually did (SOX audit requirement)
  
  // Document/Entity References (IDs only, no content)
  documentId: varchar("document_id", { length: 255 }), // Reference to source document
  entityType: varchar("entity_type", { length: 50 }), // 'invoice', 'bill', 'journal_entry', etc.
  entityId: varchar("entity_id", { length: 255 }), // ID of entity being processed
  documentHash: varchar("document_hash", { length: 64 }), // SHA-256 hash for verification
  
  // Usage & Cost Tracking
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cost: decimal("cost", { precision: 10, scale: 6 }), // USD cost
  
  // ✅ SECURE: KMS Envelope Encryption (proper metadata for provenance)
  encryptedPayload: text("encrypted_payload"), // Encrypted data (base64)
  kmsKeyAlias: varchar("kms_key_alias", { length: 255 }), // KMS master key alias
  encryptedDataKey: text("encrypted_data_key"), // Encrypted DEK (base64)
  encryptionIv: varchar("encryption_iv", { length: 64 }), // Initialization vector
  encryptionAuthTag: varchar("encryption_auth_tag", { length: 64 }), // GCM auth tag
  payloadIntegrityHash: varchar("payload_integrity_hash", { length: 64 }), // SHA-256 of plaintext (for verification)
  
  // Compliance & Consent
  dataCategory: varchar("data_category", { length: 50 }).notNull(), // 'financial', 'personal', 'operational', 'metadata'
  dataResidency: varchar("data_residency", { length: 50 }), // 'UAE', 'KSA', 'EU', 'US', 'China', 'global'
  consentGiven: boolean("consent_given").default(false).notNull(), // User consented to this provider
  consentRevokedAt: timestamp("consent_revoked_at"), // If consent was later revoked
  
  // Timing & Performance
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration_ms"), // Milliseconds
  
  // Status & Error (no sensitive error messages)
  status: varchar("status", { length: 20 }).notNull(), // 'processing', 'success', 'failed', 'timeout'
  errorCode: varchar("error_code", { length: 50 }), // Error code (no sensitive details)
  
  // Retention Policy (GDPR/SOX compliance)
  retentionCategory: varchar("retention_category", { length: 50 }).notNull().default('metadata_only'), // 'metadata_only', 'encrypted_content', 'audit_trail'
  purgeAfter: timestamp("purge_after"), // Auto-delete encrypted content after this date
  userDataRedacted: boolean("user_data_redacted").default(false), // GDPR erasure flag (keeps metadata for SOX)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_logs_tenant_idx").on(table.tenantId),
  index("ai_logs_user_idx").on(table.userId),
  index("ai_logs_provider_idx").on(table.provider),
  index("ai_logs_task_type_idx").on(table.taskType),
  index("ai_logs_started_at_idx").on(table.startedAt),
  index("ai_logs_purge_after_idx").on(table.purgeAfter),
  index("ai_logs_status_idx").on(table.status),
  // CHECK constraints for enum enforcement (SOX audit requirement)
  sql`CONSTRAINT check_ai_log_provider CHECK (provider IN ('openai', 'kimi', 'qwen', 'deepseek', 'anthropic', 'gemini', 'mcp_custom'))`,
  sql`CONSTRAINT check_ai_log_task_type CHECK (task_type IN ('chat', 'document_extraction', 'vision_analysis', 'embedding', 'report_generation', 'function_calling', 'code_generation'))`,
  sql`CONSTRAINT check_ai_log_status CHECK (status IN ('processing', 'success', 'failed', 'timeout'))`,
  sql`CONSTRAINT check_ai_log_data_category CHECK (data_category IN ('financial', 'personal', 'operational', 'metadata'))`,
  sql`CONSTRAINT check_ai_log_data_residency CHECK (data_residency IS NULL OR data_residency IN ('UAE', 'KSA', 'EU', 'US', 'China', 'global'))`,
  sql`CONSTRAINT check_ai_log_retention_category CHECK (retention_category IN ('metadata_only', 'encrypted_content', 'audit_trail'))`,
]);

export const insertAIInteractionLogSchema = createInsertSchema(aiInteractionLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAIInteractionLog = z.infer<typeof insertAIInteractionLogSchema>;
export type AIInteractionLog = typeof aiInteractionLogs.$inferSelect;

// AI Log Access Audits (Append-Only, Tamper-Evident)
/**
 * Separate append-only table to track WHO accessed AI logs
 * Cannot be edited/deleted - only INSERT allowed (SOX compliance)
 * "Audit the auditors" requirement
 */
export const aiLogAccessAudits = pgTable("ai_log_access_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiLogId: varchar("ai_log_id").notNull().references(() => aiInteractionLogs.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Who accessed the log
  accessedBy: varchar("accessed_by").notNull().references(() => users.id),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
  
  // Purpose of access
  purpose: varchar("purpose", { length: 50 }).notNull(), // 'audit', 'compliance', 'troubleshooting', 'export'
  accessMethod: varchar("access_method", { length: 50 }).notNull(), // 'ui', 'api', 'export', 'report'
  
  // What was accessed (for granular auditing)
  accessedFields: jsonb("accessed_fields"), // ['encryptedPayload', 'metadata'] - what was viewed
  decryptionAttempted: boolean("decryption_attempted").default(false), // Did user decrypt payload?
  
  // Client information (for security tracking)
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_log_access_audits_ai_log_idx").on(table.aiLogId),
  index("ai_log_access_audits_tenant_idx").on(table.tenantId),
  index("ai_log_access_audits_accessed_by_idx").on(table.accessedBy),
  index("ai_log_access_audits_accessed_at_idx").on(table.accessedAt),
  // CHECK constraint for purpose enum
  sql`CONSTRAINT check_ai_log_access_purpose CHECK (purpose IN ('audit', 'compliance', 'troubleshooting', 'export', 'report'))`,
  sql`CONSTRAINT check_ai_log_access_method CHECK (access_method IN ('ui', 'api', 'export', 'report', 'batch'))`,
]);

export const insertAILogAccessAuditSchema = createInsertSchema(aiLogAccessAudits).omit({
  id: true,
  createdAt: true,
});

export type InsertAILogAccessAudit = z.infer<typeof insertAILogAccessAuditSchema>;
export type AILogAccessAudit = typeof aiLogAccessAudits.$inferSelect;

// ====================================
// TASK 8-2: PORTABLE INTEGRATION CONNECTIONS
// ====================================

/**
 * Integration Connections - Platform-Agnostic OAuth Storage
 * Works on Replit, AWS, Azure, self-hosted
 * Stores encrypted OAuth tokens with full KMS envelope encryption metadata
 */
export const integrationConnections = pgTable("integration_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id), // Who connected this integration
  
  // Provider Information (ENFORCED with CHECK constraints)
  provider: varchar("provider", { length: 50 }).notNull(), // 'onedrive', 'google_drive', 'stripe', 'twilio', 'lean_technologies', 'custom_api'
  providerUserId: varchar("provider_user_id", { length: 255 }), // User ID at provider (email, account ID, etc.)
  providerAccountName: varchar("provider_account_name", { length: 255 }), // Display name (user@example.com, Acme Corp)
  
  // ✅ SECURE: KMS Envelope Encryption for Access Token
  encryptedAccessToken: text("encrypted_access_token").notNull(), // Encrypted token (base64)
  accessTokenKmsKeyAlias: varchar("access_token_kms_key_alias", { length: 255 }).notNull(), // KMS master key alias
  accessTokenEncryptedDek: text("access_token_encrypted_dek").notNull(), // Encrypted data key
  accessTokenIv: varchar("access_token_iv", { length: 64 }).notNull(), // Initialization vector
  accessTokenAuthTag: varchar("access_token_auth_tag", { length: 64 }).notNull(), // GCM auth tag
  
  // ✅ SECURE: KMS Envelope Encryption for Refresh Token (optional)
  encryptedRefreshToken: text("encrypted_refresh_token"),
  refreshTokenKmsKeyAlias: varchar("refresh_token_kms_key_alias", { length: 255 }),
  refreshTokenEncryptedDek: text("refresh_token_encrypted_dek"),
  refreshTokenIv: varchar("refresh_token_iv", { length: 64 }),
  refreshTokenAuthTag: varchar("refresh_token_auth_tag", { length: 64 }),
  
  // Token Metadata
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: jsonb("scopes"), // Granted OAuth scopes (array of strings)
  
  // Connection Status (ENFORCED with CHECK constraints)
  status: varchar("status", { length: 20 }).notNull().default('connected'), // 'connected', 'disconnected', 'expired', 'error'
  lastVerifiedAt: timestamp("last_verified_at"), // Last successful health check
  lastError: text("last_error"), // Last connection error (no sensitive data)
  
  // Provider-specific metadata
  metadata: jsonb("metadata"), // {folderId, driveId, etc.}
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("integration_connections_tenant_idx").on(table.tenantId),
  index("integration_connections_user_idx").on(table.userId),
  index("integration_connections_provider_idx").on(table.provider),
  index("integration_connections_status_idx").on(table.status),
  unique("unique_integration_tenant_user_provider").on(table.tenantId, table.userId, table.provider),
  // CHECK constraints for enum enforcement
  sql`CONSTRAINT check_integration_provider CHECK (provider IN ('onedrive', 'google_drive', 'stripe', 'twilio', 'lean_technologies', 'custom_api'))`,
  sql`CONSTRAINT check_integration_status CHECK (status IN ('connected', 'disconnected', 'expired', 'error'))`,
]);

export const insertIntegrationConnectionSchema = createInsertSchema(integrationConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;

// ====================================
// TASK 8-3: MCP SERVERS (MODEL CONTEXT PROTOCOL)
// ====================================

/**
 * MCP Servers - Dynamic AI Tool Integration
 * Allows connecting to ANY AI provider or API via MCP protocol
 * Supports custom internal LLMs, OpenAPI-generated tools, etc.
 * WITH SECURITY ISOLATION: Process-level, container, or sandbox isolation
 */
export const mcpServers = pgTable("mcp_servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // NULL = global/system-wide server
  
  // Server Configuration
  name: varchar("name", { length: 255 }).notNull(), // 'stripe-connector', 'internal-llm', 'shopify-api'
  description: text("description"),
  command: varchar("command", { length: 500 }).notNull(), // 'npx', 'python', 'node', 'docker', etc.
  args: jsonb("args").notNull(), // ['-y', '@modelcontextprotocol/server-openapi']
  env: jsonb("env"), // {OPENAPI_URL: '...', API_KEY: '${SECRET_NAME}'}
  
  // ✅ SECURITY: Isolation Controls
  isolationMode: varchar("isolation_mode", { length: 50 }).notNull().default('process'), // 'process', 'container', 'sandbox', 'vm'
  containerImage: varchar("container_image", { length: 500 }), // Docker image (if isolation_mode='container')
  sandboxProfile: varchar("sandbox_profile", { length: 100 }), // Sandbox profile name (if isolation_mode='sandbox')
  allowedCapabilities: jsonb("allowed_capabilities"), // ['network', 'filesystem_read', 'filesystem_write'] - capabilities whitelist
  resourceLimits: jsonb("resource_limits"), // {cpu: '0.5', memory: '512Mi', maxProcesses: 10}
  
  // ✅ SECURITY: Tenant Boundary Enforcement
  trustBoundary: varchar("trust_boundary", { length: 50 }).notNull().default('tenant_scoped'), // 'tenant_scoped', 'global_trusted', 'untrusted'
  allowCrossTenantAccess: boolean("allow_cross_tenant_access").default(false).notNull(), // Can this server access other tenants?
  
  // Health & Status (ENFORCED with CHECK constraints)
  status: varchar("status", { length: 20 }).notNull().default('stopped'), // 'running', 'stopped', 'error', 'initializing'
  healthStatus: varchar("health_status", { length: 20 }).default('unknown'), // 'healthy', 'degraded', 'unhealthy', 'unknown'
  healthCheckUrl: varchar("health_check_url", { length: 500 }), // Optional HTTP health check endpoint
  lastHealthCheck: timestamp("last_health_check"),
  
  // Process Management
  pid: integer("pid"), // Process ID (if running locally without container)
  containerId: varchar("container_id", { length: 255 }), // Container ID (if isolation_mode='container')
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  restartCount: integer("restart_count").default(0).notNull(),
  lastError: text("last_error"),
  
  // Configuration
  enabled: boolean("enabled").default(true).notNull(), // Can be disabled without deletion
  autoRestart: boolean("auto_restart").default(true).notNull(), // Auto-restart on failure
  maxRestarts: integer("max_restarts").default(5).notNull(), // Max restart attempts per hour
  
  // Tools (auto-discovered from MCP server)
  availableTools: jsonb("available_tools"), // [{name, description, parameters}, ...]
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("mcp_servers_tenant_idx").on(table.tenantId),
  index("mcp_servers_status_idx").on(table.status),
  index("mcp_servers_enabled_idx").on(table.enabled),
  index("mcp_servers_trust_boundary_idx").on(table.trustBoundary),
  unique("unique_mcp_server_name_tenant").on(table.tenantId, table.name),
  // CHECK constraints for enum enforcement
  sql`CONSTRAINT check_mcp_status CHECK (status IN ('running', 'stopped', 'error', 'initializing'))`,
  sql`CONSTRAINT check_mcp_health_status CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown'))`,
  sql`CONSTRAINT check_mcp_isolation_mode CHECK (isolation_mode IN ('process', 'container', 'sandbox', 'vm'))`,
  sql`CONSTRAINT check_mcp_trust_boundary CHECK (trust_boundary IN ('tenant_scoped', 'global_trusted', 'untrusted'))`,
]);

export const insertMCPServerSchema = createInsertSchema(mcpServers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  pid: true,
  startedAt: true,
  stoppedAt: true,
  restartCount: true,
  lastHealthCheck: true,
  lastError: true,
  availableTools: true,
});

export type InsertMCPServer = z.infer<typeof insertMCPServerSchema>;
export type MCPServer = typeof mcpServers.$inferSelect;

// ====================================
// TASK 8-5: ENCRYPTION KEYS (KMS/DEK MANAGEMENT)
// ====================================

/**
 * Encryption Keys - Data Encryption Key (DEK) Management for Envelope Encryption
 * 
 * Each tenant has multiple DEKs for different purposes (AI logs, OAuth tokens, etc.)
 * DEKs are encrypted with a master key and rotated every 90 days
 * Supports key versioning for rotation without re-encrypting all data
 */
export const encryptionKeys = pgTable("encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Key Purpose & Versioning
  purpose: varchar("purpose", { length: 50 }).notNull(), // 'ai_logs', 'oauth_tokens', 'documents', 'webhook_signatures'
  version: integer("version").notNull(), // Key version number (1, 2, 3, ...)
  
  // KMS Metadata
  kmsKeyAlias: varchar("kms_key_alias", { length: 512 }).notNull(), // Master key alias/ARN (wider for AWS ARNs)
  encryptedDEK: text("encrypted_dek").notNull(), // Encrypted Data Encryption Key (base64)
  dekAlgorithm: varchar("dek_algorithm", { length: 50 }).notNull().default('AES-256-GCM'), // Encryption algorithm
  dekFingerprint: varchar("dek_fingerprint", { length: 64 }).notNull(), // SHA-256 of plaintext DEK (for verification, NEVER store plaintext)
  
  // Key Lifecycle
  status: varchar("status", { length: 20 }).notNull().default('active'), // 'active', 'rotating', 'deprecated', 'revoked'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"), // When key became active
  expiresAt: timestamp("expires_at"), // When key should be rotated (90 days default, configurable)
  rotatedAt: timestamp("rotated_at"), // When key was actually rotated
  revokedAt: timestamp("revoked_at"), // If key was compromised
  
  // Rotation Tracking
  previousKeyId: varchar("previous_key_id").references((): any => encryptionKeys.id), // Link to previous key version
  rotationReason: text("rotation_reason"), // 'scheduled', 'compromised', 'compliance', 'manual'
  
  // Usage Tracking
  encryptionCount: integer("encryption_count").default(0).notNull(), // How many times used
  lastUsedAt: timestamp("last_used_at"), // Last encryption operation
  
}, (table) => [
  index("encryption_keys_tenant_idx").on(table.tenantId),
  index("encryption_keys_purpose_idx").on(table.purpose),
  index("encryption_keys_status_idx").on(table.status),
  index("encryption_keys_expires_at_idx").on(table.expiresAt), // For rotation job
  // Unique constraint: One active key per tenant/purpose
  unique("unique_encryption_key_tenant_purpose_version").on(table.tenantId, table.purpose, table.version),
  // ✅ CRITICAL: Partial unique index ensures ONLY ONE active key per tenant/purpose
  sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_active_key_per_tenant_purpose ON encryption_keys (tenant_id, purpose) WHERE status = 'active'`,
  // Optional: Also prevent multiple 'rotating' keys
  sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_rotating_key_per_tenant_purpose ON encryption_keys (tenant_id, purpose) WHERE status = 'rotating'`,
  // CHECK constraints for enum enforcement
  sql`CONSTRAINT check_encryption_key_purpose CHECK (purpose IN ('ai_logs', 'oauth_tokens', 'documents', 'webhook_signatures'))`,
  sql`CONSTRAINT check_encryption_key_status CHECK (status IN ('active', 'rotating', 'deprecated', 'revoked'))`,
  sql`CONSTRAINT check_encryption_key_algorithm CHECK (dek_algorithm IN ('AES-256-GCM', 'AES-256-CBC'))`,
]);

export const insertEncryptionKeySchema = createInsertSchema(encryptionKeys).omit({
  id: true,
  createdAt: true,
  encryptionCount: true,
  lastUsedAt: true,
});

export type InsertEncryptionKey = z.infer<typeof insertEncryptionKeySchema>;
export type EncryptionKey = typeof encryptionKeys.$inferSelect;

// ====================================
// TASK 8-26: SYSTEM CONFIGURATION (VAPID KEYS, ETC.)
// ====================================

/**
 * System Configuration - Simple key-value store for system-wide settings
 * Used for storing VAPID keys, system preferences, and other configuration that needs persistence
 * Not encrypted - suitable for public keys and non-sensitive configuration
 */
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("system_config_key_idx").on(table.key),
]);

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

// Relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, {
    fields: [tenants.ownerId],
    references: [users.id],
  }),
  members: many(tenantMembers),
  customers: many(customers),
  vendors: many(vendors),
  accounts: many(accounts),
  invoices: many(invoices),
  bills: many(bills),
  expenses: many(expenses),
  payments: many(payments),
  documents: many(documents),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vendors.tenantId],
    references: [tenants.id],
  }),
  bills: many(bills),
  expenses: many(expenses),
  payments: many(payments),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bills.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [bills.vendorId],
    references: [vendors.id],
  }),
  lineItems: many(billLineItems),
  payments: many(payments),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [expenses.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [expenses.vendorId],
    references: [vendors.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [payments.vendorId],
    references: [vendors.id],
  }),
  bill: one(bills, {
    fields: [payments.billId],
    references: [bills.id],
  }),
  expense: one(expenses, {
    fields: [payments.expenseId],
    references: [expenses.id],
  }),
}));

// ====================================
// ACCOUNTING MODULES
// ====================================

// Journal Entries (Double-Entry Bookkeeping)
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  journalEntryNumber: varchar("journal_entry_number", { length: 100 }), // Auto-generated server-side
  entryDate: timestamp("entry_date").notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  description: text("description"),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, pending_approval, approved, posted, rejected
  
  // Multi-currency support (for FX gain/loss entries)
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (for foreign currency journals)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  
  // Source document tracking for automatic journal entries
  sourceDocumentType: varchar("source_document_type", { length: 50 }), // 'invoice', 'bill', 'payment', 'credit_note', 'debit_note', 'expense', 'fixed_asset', 'stock_adjustment', 'opening_stock', 'expense_approval', 'expense_reimbursement'
  sourceDocumentId: varchar("source_document_id"), // ID of source document
  isAutoGenerated: boolean("is_auto_generated").default(false), // true if automatically created by system
  modificationLocked: boolean("modification_locked").default(false), // true if entry cannot be edited (auto-generated entries are locked)
  reversedEntryId: varchar("reversed_entry_id").references((): any => journalEntries.id), // If this entry reverses another entry
  reversalReason: text("reversal_reason"), // Reason for reversal (required for reversals)
  
  // Workflow tracking fields
  workflowRequestId: varchar("workflow_request_id"), // Links to approvalRequests table for multi-stage approval
  preparedBy: varchar("prepared_by").references(() => users.id), // Who created/prepared the entry
  preparedAt: timestamp("prepared_at"), // When entry was initially prepared
  postedBy: varchar("posted_by").references(() => users.id), // Who posted the entry
  postedAt: timestamp("posted_at"), // When entry was posted
  
  createdBy: varchar("created_by").references(() => users.id),
  lastModifiedBy: varchar("last_modified_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_journal_entry_number_tenant").on(table.tenantId, table.journalEntryNumber),
  index("journal_entries_source_document_idx").on(table.sourceDocumentType, table.sourceDocumentId),
  index("journal_entries_tenant_date_idx").on(table.tenantId, table.entryDate),
  index("journal_entries_reversed_entry_idx").on(table.reversedEntryId),
  index("journal_entries_workflow_request_idx").on(table.workflowRequestId),
  sql`CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_prevent_duplicate_posts ON journal_entries (tenant_id, source_document_type, source_document_id) WHERE status = 'posted' AND is_auto_generated = true`,
  sql`CONSTRAINT check_journal_entry_status CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected'))`,
  sql`CONSTRAINT check_source_document_type CHECK (source_document_type IS NULL OR source_document_type IN ('invoice', 'bill', 'payment', 'customer_payment', 'credit_note', 'debit_note', 'expense', 'fixed_asset', 'inventory_adjustment', 'depreciation', 'payment_batch', 'approval', 'stock_adjustment', 'opening_stock', 'expense_approval', 'expense_reimbursement'))`,
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntries, {
  status: z.enum(['draft', 'pending_approval', 'approved', 'posted', 'rejected']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  journalEntryNumber: true, // Auto-generated
  preparedAt: true, // Set by system
  postedAt: true, // Set by system
}).extend({
  entryDate: z.coerce.date(),
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

// Journal Entry Legs (Debit/Credit Lines)
export const journalEntryLegs = pgTable("journal_entry_legs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  journalEntryId: varchar("journal_entry_id").notNull().references(() => journalEntries.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  type: varchar("type", { length: 10 }).notNull(), // 'Debit' or 'Credit'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // Base currency amount
  
  // CRITICAL: Multi-currency transaction tracking (dual currency for debits/credits)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmountDebit: decimal("transaction_amount_debit", { precision: 20, scale: 10 }),
  transactionAmountCredit: decimal("transaction_amount_credit", { precision: 20, scale: 10 }),
  
  projectId: varchar("project_id").references(() => projects.id),
  
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("journal_entry_legs_project_idx").on(table.projectId),
  // Database-level constraint: type must be 'Debit' or 'Credit'
  sql`CONSTRAINT check_leg_type CHECK (type IN ('Debit', 'Credit'))`,
]);

export const insertJournalEntryLegSchema = createInsertSchema(journalEntryLegs, {
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmountDebit: decimalString.optional(),
  transactionAmountCredit: decimalString.optional(),
  type: z.enum(['Debit', 'Credit']), // Enforce at Zod level too
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type InsertJournalEntryLeg = z.infer<typeof insertJournalEntryLegSchema>;
export type JournalEntryLeg = typeof journalEntryLegs.$inferSelect;

// Journal Entry Payload (for transactional create/update with legs)
export const journalEntryPayloadSchema = z.object({
  journalEntry: insertJournalEntrySchema.partial().required({ 
    entryDate: true,
    status: true,
  }),
  legs: z.array(insertJournalEntryLegSchema.omit({ journalEntryId: true })).min(2, "At least two legs are required for double-entry"),
}).refine((data) => {
  // Validate double-entry: debits must equal credits
  const debits = data.legs.filter(leg => leg.type === 'Debit').reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
  const credits = data.legs.filter(leg => leg.type === 'Credit').reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
  return Math.abs(debits - credits) < 0.01; // Allow for floating point rounding
}, {
  message: "Debits must equal credits in double-entry bookkeeping",
  path: ["legs"],
});

export type JournalEntryPayload = z.infer<typeof journalEntryPayloadSchema>;

// Database Trigger: Double-Entry Validation
// This trigger ensures SUM(debits) = SUM(credits) for each journal entry at the database level
export const journalEntryBalanceTriggerFunction = sql`
  CREATE OR REPLACE FUNCTION check_journal_entry_balance()
  RETURNS TRIGGER AS $$
  DECLARE
    debit_total DECIMAL;
    credit_total DECIMAL;
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO debit_total
    FROM journal_entry_legs
    WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
    AND type = 'Debit';
    
    SELECT COALESCE(SUM(amount), 0) INTO credit_total
    FROM journal_entry_legs
    WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
    AND type = 'Credit';
    
    IF ABS(debit_total - credit_total) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry debits (%) must equal credits (%)', debit_total, credit_total;
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

export const journalEntryBalanceTrigger = sql`
  DROP TRIGGER IF EXISTS check_journal_entry_balance_trigger ON journal_entry_legs;
  
  CREATE TRIGGER check_journal_entry_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_legs
  FOR EACH ROW
  EXECUTE FUNCTION check_journal_entry_balance();
`;

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  poNumber: varchar("po_number", { length: 100 }),
  orderDate: timestamp("order_date").notNull(),
  expectedDate: timestamp("expected_date"),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, pending_approval, approved, partially_received, fully_received, closed, cancelled
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  terms: text("terms"),
  
  // Approval workflow fields
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Conversion tracking (for convert-to-bill functionality)
  convertedToBillId: varchar("converted_to_bill_id").references(() => bills.id),
  convertedAt: timestamp("converted_at"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_po_number_tenant").on(table.tenantId, table.poNumber),
]);

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionTotalAmount: decimalString.optional(),
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  poNumber: true, // Auto-generated
  convertedToBillId: true,
  convertedAt: true,
}).extend({
  orderDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional(),
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// Purchase Order Line Items
export const purchaseOrderLineItems = pgTable("purchase_order_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  itemId: varchar("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  taxId: varchar("tax_id").references(() => taxes.id),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseOrderLineItemSchema = createInsertSchema(purchaseOrderLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  amount: decimalString,
  receivedQuantity: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type InsertPurchaseOrderLineItem = z.infer<typeof insertPurchaseOrderLineItemSchema>;
export type PurchaseOrderLineItem = typeof purchaseOrderLineItems.$inferSelect;

// Purchase Order Payload
export const purchaseOrderPayloadSchema = z.object({
  purchaseOrder: insertPurchaseOrderSchema.partial().required({ 
    vendorId: true,
    orderDate: true,
    status: true,
    subtotal: true,
    taxAmount: true,
    total: true,
  }),
  lineItems: z.array(insertPurchaseOrderLineItemSchema.omit({ purchaseOrderId: true })).min(1, "At least one line item is required"),
});

export type PurchaseOrderPayload = z.infer<typeof purchaseOrderPayloadSchema>;

// Asset Management (Fixed Assets)
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  assetNumber: varchar("asset_number", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  
  // Financial details
  purchaseDate: timestamp("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  salvageValue: decimal("salvage_value", { precision: 12, scale: 2 }).default("0"),
  
  // Depreciation
  depreciationMethod: varchar("depreciation_method", { length: 50 }).notNull(), // straight_line, declining_balance, units_of_production
  usefulLife: integer("useful_life"), // in months or units
  accumulatedDepreciation: decimal("accumulated_depreciation", { precision: 12, scale: 2 }).default("0"),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, disposed, sold
  disposalDate: timestamp("disposal_date"),
  disposalAmount: decimal("disposal_amount", { precision: 12, scale: 2 }),
  
  // Accounting
  assetAccountId: varchar("asset_account_id").references(() => accounts.id),
  depreciationAccountId: varchar("depreciation_account_id").references(() => accounts.id),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_asset_number_tenant").on(table.tenantId, table.assetNumber),
  sql`CONSTRAINT check_asset_status CHECK (status IN ('active', 'disposed', 'sold'))`,
  sql`CONSTRAINT check_asset_depreciation_method CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'units_of_production'))`,
]);

export const insertAssetSchema = createInsertSchema(assets, {
  status: z.enum(['active', 'disposed', 'sold']),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'units_of_production']),
  purchasePrice: decimalString,
  salvageValue: decimalString,
  accumulatedDepreciation: decimalString,
  disposalAmount: decimalString.nullable().optional(),
}).omit({
  id: true,
  assetNumber: true,
  tenantId: true, // Injected server-side
  accumulatedDepreciation: true, // Will be defaulted server-side
  createdAt: true,
  updatedAt: true,
}).extend({
  purchaseDate: z.coerce.date(),
  disposalDate: z.coerce.date().nullable().optional(),
});

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Asset Depreciation Schedule
export const assetDepreciationSchedules = pgTable("asset_depreciation_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  periodDate: timestamp("period_date").notNull(),
  depreciationAmount: decimal("depreciation_amount", { precision: 12, scale: 2 }).notNull(),
  bookValue: decimal("book_value", { precision: 12, scale: 2 }).notNull(),
  journalEntryId: varchar("journal_entry_id").references(() => journalEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssetDepreciationScheduleSchema = createInsertSchema(assetDepreciationSchedules, {
  depreciationAmount: decimalString,
  bookValue: decimalString,
}).omit({
  id: true,
  createdAt: true,
}).extend({
  periodDate: z.coerce.date(),
});

export type InsertAssetDepreciationSchedule = z.infer<typeof insertAssetDepreciationScheduleSchema>;
export type AssetDepreciationSchedule = typeof assetDepreciationSchedules.$inferSelect;

// Bank Reconciliation
export const bankReconciliations = pgTable("bank_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  reconciliationDate: timestamp("reconciliation_date").notNull(),
  statementDate: timestamp("statement_date").notNull(),
  statementBalance: decimal("statement_balance", { precision: 12, scale: 2 }).notNull(),
  bookBalance: decimal("book_balance", { precision: 12, scale: 2 }).notNull(),
  difference: decimal("difference", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("in_progress"), // in_progress, reconciled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBankReconciliationSchema = createInsertSchema(bankReconciliations, {
  statementBalance: decimalString,
  bookBalance: decimalString,
  difference: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  reconciliationDate: z.coerce.date(),
  statementDate: z.coerce.date(),
});

export type InsertBankReconciliation = z.infer<typeof insertBankReconciliationSchema>;
export type BankReconciliation = typeof bankReconciliations.$inferSelect;

// Bank Reconciliation Items (matched journal entries)
export const bankReconciliationItems = pgTable("bank_reconciliation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  reconciliationId: varchar("reconciliation_id").notNull().references(() => bankReconciliations.id),
  journalEntryId: varchar("journal_entry_id").references(() => journalEntries.id),
  transactionDate: timestamp("transaction_date").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  isMatched: boolean("is_matched").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankReconciliationItemSchema = createInsertSchema(bankReconciliationItems, {
  amount: decimalString,
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
}).extend({
  transactionDate: z.coerce.date(),
});

export type InsertBankReconciliationItem = z.infer<typeof insertBankReconciliationItemSchema>;
export type BankReconciliationItem = typeof bankReconciliationItems.$inferSelect;

// Bank Reconciliation Payload (for transactional create/update with items)
export const bankReconciliationPayloadSchema = z.object({
  reconciliation: insertBankReconciliationSchema.partial().required({
    accountId: true,
    reconciliationDate: true,
    statementDate: true,
    statementBalance: true,
    bookBalance: true,
    status: true,
  }),
  items: z.array(insertBankReconciliationItemSchema.omit({ reconciliationId: true })),
});

export type BankReconciliationPayload = z.infer<typeof bankReconciliationPayloadSchema>;

// ====================================
// HISTORICAL BALANCE TRACKING (IAS 21 COMPLIANCE)
// ====================================

// Opening Balances (for period opening balances tracking)
export const openingBalances = pgTable("opening_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 10 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  source: varchar("source", { length: 50 }).notNull(), // 'manual', 'migration', 'period_close'
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
  capturedBy: varchar("captured_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("opening_balances_tenant_idx").on(table.tenantId),
  index("opening_balances_account_idx").on(table.accountId),
  index("opening_balances_period_idx").on(table.periodStart, table.periodEnd),
]);

export const insertOpeningBalanceSchema = createInsertSchema(openingBalances, {
  amount: decimalString,
}).omit({
  id: true,
  capturedAt: true,
  createdAt: true,
});

export type InsertOpeningBalance = z.infer<typeof insertOpeningBalanceSchema>;
export type OpeningBalance = typeof openingBalances.$inferSelect;

// Account Balance Snapshots (periodic balance snapshots for reporting)
export const accountBalanceSnapshots = pgTable("account_balance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  periodKey: varchar("period_key", { length: 50 }).notNull(), // 'YYYY-MM' or 'YYYY-Q1', 'YYYY'
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  openingBalance: decimal("opening_balance", { precision: 20, scale: 10 }).notNull(),
  debitMovements: decimal("debit_movements", { precision: 20, scale: 10 }).default("0").notNull(),
  creditMovements: decimal("credit_movements", { precision: 20, scale: 10 }).default("0").notNull(),
  closingBalance: decimal("closing_balance", { precision: 20, scale: 10 }).notNull(),
  baseCurrencyClosingBalance: decimal("base_currency_closing_balance", { precision: 20, scale: 10 }).notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_snapshot_per_account_period_currency").on(table.tenantId, table.accountId, table.periodKey, table.currencyCode),
  index("account_balance_snapshots_tenant_idx").on(table.tenantId),
  index("account_balance_snapshots_account_idx").on(table.accountId),
  index("account_balance_snapshots_period_idx").on(table.periodKey),
]);

export const insertAccountBalanceSnapshotSchema = createInsertSchema(accountBalanceSnapshots, {
  openingBalance: decimalString,
  debitMovements: decimalString,
  creditMovements: decimalString,
  closingBalance: decimalString,
  baseCurrencyClosingBalance: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertAccountBalanceSnapshot = z.infer<typeof insertAccountBalanceSnapshotSchema>;
export type AccountBalanceSnapshot = typeof accountBalanceSnapshots.$inferSelect;

// Fiscal Periods (period management for accounting close)
export const fiscalPeriods = pgTable("fiscal_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  periodKey: varchar("period_key", { length: 50 }).notNull(), // 'YYYY-MM', 'YYYY-Q1', 'YYYY'
  periodType: varchar("period_type", { length: 20 }).notNull(), // 'monthly', 'quarterly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status", { length: 20 }).default("open").notNull(), // 'open', 'closing', 'closed'
  lockState: varchar("lock_state", { length: 20 }).default("unlocked").notNull(), // 'unlocked', 'locked', 'hard_locked'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_period_per_tenant").on(table.tenantId, table.periodKey),
  index("fiscal_periods_tenant_idx").on(table.tenantId),
  index("fiscal_periods_status_idx").on(table.status),
]);

export const insertFiscalPeriodSchema = createInsertSchema(fiscalPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFiscalPeriod = z.infer<typeof insertFiscalPeriodSchema>;
export type FiscalPeriod = typeof fiscalPeriods.$inferSelect;

// Period Closures (tracking period close/reopen actions)
export const periodClosures = pgTable("period_closures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  periodKey: varchar("period_key", { length: 50 }).notNull(),
  fiscalPeriodId: varchar("fiscal_period_id").notNull().references(() => fiscalPeriods.id),
  closedBy: varchar("closed_by").notNull().references(() => users.id),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
  closingRateSetId: varchar("closing_rate_set_id"), // References batch of exchange rates used
  reopenedBy: varchar("reopened_by").references(() => users.id),
  reopenedAt: timestamp("reopened_at"),
  reopenReason: text("reopen_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("period_closures_tenant_idx").on(table.tenantId),
  index("period_closures_period_idx").on(table.fiscalPeriodId),
]);

export const insertPeriodClosureSchema = createInsertSchema(periodClosures).omit({
  id: true,
  closedAt: true,
  createdAt: true,
});

export type InsertPeriodClosure = z.infer<typeof insertPeriodClosureSchema>;
export type PeriodClosure = typeof periodClosures.$inferSelect;

// Exchange Difference Journals (FX gain/loss tracking for IAS 21)
export const exchangeDifferenceJournals = pgTable("exchange_difference_journals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  journalEntryId: varchar("journal_entry_id").notNull().references(() => journalEntries.id),
  differenceType: varchar("difference_type", { length: 20 }).notNull(), // 'realized', 'unrealized'
  sourceTransactionId: varchar("source_transaction_id"), // Invoice/Bill/Payment ID
  sourceTransactionType: varchar("source_transaction_type", { length: 50 }), // 'invoice', 'bill', 'payment'
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  originalAmount: decimal("original_amount", { precision: 20, scale: 10 }).notNull(),
  originalRate: decimal("original_rate", { precision: 20, scale: 10 }).notNull(),
  revaluationRate: decimal("revaluation_rate", { precision: 20, scale: 10 }).notNull(),
  gainLossAmount: decimal("gain_loss_amount", { precision: 20, scale: 10 }).notNull(),
  periodKey: varchar("period_key", { length: 50 }).notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("exchange_difference_journals_tenant_idx").on(table.tenantId),
  index("exchange_difference_journals_journal_idx").on(table.journalEntryId),
  index("exchange_difference_journals_period_idx").on(table.periodKey),
  index("exchange_difference_journals_account_idx").on(table.accountId),
]);

export const insertExchangeDifferenceJournalSchema = createInsertSchema(exchangeDifferenceJournals, {
  originalAmount: decimalString,
  originalRate: decimalString,
  revaluationRate: decimalString,
  gainLossAmount: decimalString,
}).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export type InsertExchangeDifferenceJournal = z.infer<typeof insertExchangeDifferenceJournalSchema>;
export type ExchangeDifferenceJournal = typeof exchangeDifferenceJournals.$inferSelect;

// ====================================
// FINANCIAL REPORTS (READ-ONLY)
// ====================================

// Account line item for reports
export const reportAccountLineSchema = z.object({
  accountId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  balance: z.string(),
});

export type ReportAccountLine = z.infer<typeof reportAccountLineSchema>;

// Profit & Loss Report (Income Statement)
export const profitLossReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  
  // Revenue accounts (income type)
  revenueAccounts: z.array(reportAccountLineSchema),
  totalRevenue: z.string(),
  
  // Expense accounts
  expenseAccounts: z.array(reportAccountLineSchema),
  totalExpenses: z.string(),
  
  // Net profit/loss
  netProfit: z.string(),
});

export type ProfitLossReport = z.infer<typeof profitLossReportSchema>;

// Balance Sheet Report
export const balanceSheetReportSchema = z.object({
  tenantId: z.string(),
  asOfDate: z.date(),
  
  // Assets
  assetAccounts: z.array(reportAccountLineSchema),
  totalAssets: z.string(),
  
  // Liabilities
  liabilityAccounts: z.array(reportAccountLineSchema),
  totalLiabilities: z.string(),
  
  // Equity
  equityAccounts: z.array(reportAccountLineSchema),
  totalEquity: z.string(),
  
  // Balance check (Assets = Liabilities + Equity)
  totalLiabilitiesAndEquity: z.string(),
  isBalanced: z.boolean(),
});

export type BalanceSheetReport = z.infer<typeof balanceSheetReportSchema>;

// Enhanced Balance Sheet Report with hierarchical breakdown and period comparison
export const balanceSheetAccountLineSchema = z.object({
  accountId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  accountCategory: z.string(),
  currentAmount: z.string(),
  comparisonAmount: z.string().optional(),
  variance: z.string().optional(),
  variancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
});

export type BalanceSheetAccountLine = z.infer<typeof balanceSheetAccountLineSchema>;

export const balanceSheetCategorySchema = z.object({
  category: z.string(),
  accounts: z.array(balanceSheetAccountLineSchema),
  subtotal: z.string(),
  comparisonSubtotal: z.string().optional(),
  variance: z.string().optional(),
  variancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
});

export type BalanceSheetCategory = z.infer<typeof balanceSheetCategorySchema>;

export const enhancedBalanceSheetReportSchema = z.object({
  tenantId: z.string(),
  asOfDate: z.date(),
  comparisonDate: z.date().optional(),
  
  // Hierarchical structure
  assetCategories: z.array(balanceSheetCategorySchema),
  liabilityCategories: z.array(balanceSheetCategorySchema),
  equityCategories: z.array(balanceSheetCategorySchema),
  
  // Totals
  totalAssets: z.string(),
  totalLiabilities: z.string(),
  totalEquity: z.string(),
  
  // Comparison totals (if comparison date provided)
  comparisonTotalAssets: z.string().optional(),
  comparisonTotalLiabilities: z.string().optional(),
  comparisonTotalEquity: z.string().optional(),
  
  // Variance
  assetVariance: z.string().optional(),
  assetVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
  liabilityVariance: z.string().optional(),
  liabilityVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
  equityVariance: z.string().optional(),
  equityVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
  
  isBalanced: z.boolean(),
  comparisonIsBalanced: z.boolean().optional(),
});

export type EnhancedBalanceSheetReport = z.infer<typeof enhancedBalanceSheetReportSchema>;

// Trial Balance Report (All accounts with debit/credit balances)
export const trialBalanceAccountLineSchema = z.object({
  accountId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  debit: z.string(),
  credit: z.string(),
  
  // Comparison period fields (optional)
  comparisonDebit: z.string().optional(),
  comparisonCredit: z.string().optional(),
  varianceDebit: z.string().optional(),
  varianceCredit: z.string().optional(),
});

export type TrialBalanceAccountLine = z.infer<typeof trialBalanceAccountLineSchema>;

export const trialBalanceReportSchema = z.object({
  tenantId: z.string(),
  asOfDate: z.date(),
  
  // Optional comparison period
  comparisonDate: z.date().optional(),
  
  accounts: z.array(trialBalanceAccountLineSchema),
  
  totalDebits: z.string(),
  totalCredits: z.string(),
  isBalanced: z.boolean(),
  
  // Comparison totals (if comparison date provided)
  comparisonTotalDebits: z.string().optional(),
  comparisonTotalCredits: z.string().optional(),
  comparisonIsBalanced: z.boolean().optional(),
  
  // Variance totals
  totalDebitsVariance: z.string().optional(),
  totalCreditsVariance: z.string().optional(),
  
  baseCurrency: z.string(),
  ifrsComplianceEnabled: z.boolean(),
  fxTranslationStandard: z.string().nullable(),
  translationMethod: z.string().optional(),
  fxTranslationApplied: z.boolean(),
});

export type TrialBalanceReport = z.infer<typeof trialBalanceReportSchema>;

// Cash Flow Report (IAS 7 Compliant)
export const cashFlowActivityLineSchema = z.object({
  accountName: z.string(),
  amount: z.string(),
});

export type CashFlowActivityLine = z.infer<typeof cashFlowActivityLineSchema>;

export const cashFlowSectionSchema = z.object({
  accounts: z.array(reportAccountLineSchema),
  total: z.string(),
});

export type CashFlowSection = z.infer<typeof cashFlowSectionSchema>;

export const cashFlowReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  
  // Beginning balance (IAS 7 - Cash and Cash Equivalents)
  beginningCash: z.string(),
  beginningCashEquivalents: z.string(),
  beginningCashAndEquivalents: z.string(),
  
  // Operating activities
  operatingActivities: z.array(cashFlowActivityLineSchema),
  netCashFromOperating: z.string(),
  
  // Investing activities
  investingActivities: z.array(cashFlowActivityLineSchema),
  netCashFromInvesting: z.string(),
  
  // Financing activities
  financingActivities: z.array(cashFlowActivityLineSchema),
  netCashFromFinancing: z.string(),
  
  // Ending balance
  netChangeInCash: z.string(),
  endingCash: z.string(),
  endingCashEquivalents: z.string(),
  endingCashAndEquivalents: z.string(),
  
  // Reconciliation (IAS 7 - ensure beginning + changes = ending)
  isReconciled: z.boolean(),
  
  // Legacy section-based structure (deprecated, for backwards compatibility)
  operatingActivitiesSection: cashFlowSectionSchema.optional(),
  investingActivitiesSection: cashFlowSectionSchema.optional(),
  financingActivitiesSection: cashFlowSectionSchema.optional(),
  netCashFlow: z.string().optional(),
});

export type CashFlowReport = z.infer<typeof cashFlowReportSchema>;

// Enhanced Cash Flow Report (Indirect Method)
export const cashFlowActivitySchema = z.object({
  activity: z.string(),
  amount: z.number(),
});

export type CashFlowActivity = z.infer<typeof cashFlowActivitySchema>;

export const enhancedCashFlowReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  
  // Operating Activities (Indirect Method)
  operating: z.array(cashFlowActivitySchema),
  netOperating: z.number(),
  
  // Investing Activities
  investing: z.array(cashFlowActivitySchema),
  netInvesting: z.number(),
  
  // Financing Activities
  financing: z.array(cashFlowActivitySchema),
  netFinancing: z.number(),
  
  // Net Cash Flow
  netCashFlow: z.number(),
  
  // Comparison period (optional)
  comparisonStartDate: z.string().optional(),
  comparisonEndDate: z.string().optional(),
  comparisonData: z.object({
    operating: z.array(cashFlowActivitySchema),
    netOperating: z.number(),
    investing: z.array(cashFlowActivitySchema),
    netInvesting: z.number(),
    financing: z.array(cashFlowActivitySchema),
    netFinancing: z.number(),
    netCashFlow: z.number(),
  }).optional(),
  
  // Variance calculations
  operatingVariance: z.number().optional(),
  investingVariance: z.number().optional(),
  financingVariance: z.number().optional(),
  netVariance: z.number().optional(),
  
  // IFRS Compliance & FX Translation (IAS 7)
  baseCurrency: z.string(),
  ifrsComplianceEnabled: z.boolean(),
  fxTranslationStandard: z.string().nullable(),
  translationMethod: z.string().optional(),
  fxTranslationApplied: z.boolean(),
});

export type EnhancedCashFlowReport = z.infer<typeof enhancedCashFlowReportSchema>;

// AR/AP Aging Report Customer/Vendor Line
export const agingReportLineSchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  current: z.string(),
  days_1_30: z.string(),
  days_31_60: z.string(),
  days_61_90: z.string(),
  days_91_120: z.string(),
  days_120_plus: z.string(),
  total: z.string(),
});

export type AgingReportLine = z.infer<typeof agingReportLineSchema>;

// Invoice-wise Aging Report Line
export const agingReportInvoiceLineSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string().optional(), // for AR
  customerName: z.string().optional(), // for AR
  vendorId: z.string().optional(), // for AP
  vendorName: z.string().optional(), // for AP
  invoiceDate: z.date(),
  dueDate: z.date(),
  daysOverdue: z.number(),
  totalAmount: decimalString,
  paidAmount: decimalString,
  outstandingAmount: decimalString,
  bucket: z.enum(["current", "1-30", "31-60", "61-90", "91-120", "120+"]),
  projectName: z.string().nullable().optional(),
});

export type AgingReportInvoiceLine = z.infer<typeof agingReportInvoiceLineSchema>;

// Project-wise Aging Report Line
export const agingReportProjectLineSchema = z.object({
  projectName: z.string(),
  current: decimalString,
  days_1_30: decimalString,
  days_31_60: decimalString,
  days_61_90: decimalString,
  days_91_120: decimalString,
  days_120_plus: decimalString,
  total: decimalString,
});

export type AgingReportProjectLine = z.infer<typeof agingReportProjectLineSchema>;

// AR Aging Report (Accounts Receivable)
export const arAgingReportSchema = z.object({
  tenantId: z.string(),
  asOfDate: z.date(),
  groupBy: z.enum(['customer', 'invoice', 'project']),
  summary: z.object({
    current: z.string(),
    days_1_30: z.string(),
    days_31_60: z.string(),
    days_61_90: z.string(),
    days_91_120: z.string(),
    days_120_plus: z.string(),
    total: z.string(),
  }),
  customers: z.array(agingReportLineSchema).optional(), // For customer grouping
  invoices: z.array(agingReportInvoiceLineSchema).optional(), // For invoice grouping
  projects: z.array(agingReportProjectLineSchema).optional(), // For project grouping
});

export type ARAgingReport = z.infer<typeof arAgingReportSchema>;

// AP Aging Report (Accounts Payable)
export const apAgingReportSchema = z.object({
  tenantId: z.string(),
  asOfDate: z.date(),
  groupBy: z.enum(['vendor', 'invoice', 'project']),
  summary: z.object({
    current: z.string(),
    days_1_30: z.string(),
    days_31_60: z.string(),
    days_61_90: z.string(),
    days_91_120: z.string(),
    days_120_plus: z.string(),
    total: z.string(),
  }),
  vendors: z.array(agingReportLineSchema).optional(), // For vendor grouping
  invoices: z.array(agingReportInvoiceLineSchema).optional(), // For invoice grouping (bills)
  projects: z.array(agingReportProjectLineSchema).optional(), // For project grouping
});

export type APAgingReport = z.infer<typeof apAgingReportSchema>;

// ====================================
// STATEMENT OF CHANGES IN EQUITY (SOCE) - IAS 1 Compliance
// ====================================

// Equity component line (for a specific equity account)
export const equityComponentLineSchema = z.object({
  accountId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  accountCategory: z.string(),
  openingBalance: z.string(),
  netProfitLoss: z.string(),
  dividends: z.string(),
  shareCapitalChanges: z.string(),
  otherComprehensiveIncome: z.string(),
  otherMovements: z.string(),
  closingBalance: z.string(),
  
  // Comparison period (optional)
  comparisonOpeningBalance: z.string().optional(),
  comparisonNetProfitLoss: z.string().optional(),
  comparisonDividends: z.string().optional(),
  comparisonShareCapitalChanges: z.string().optional(),
  comparisonOtherComprehensiveIncome: z.string().optional(),
  comparisonOtherMovements: z.string().optional(),
  comparisonClosingBalance: z.string().optional(),
  
  // Variance calculations
  openingBalanceVariance: z.string().optional(),
  netProfitLossVariance: z.string().optional(),
  dividendsVariance: z.string().optional(),
  shareCapitalChangesVariance: z.string().optional(),
  otherComprehensiveIncomeVariance: z.string().optional(),
  otherMovementsVariance: z.string().optional(),
  closingBalanceVariance: z.string().optional(),
  closingBalanceVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
});

export type EquityComponentLine = z.infer<typeof equityComponentLineSchema>;

// Equity statement category (grouping of equity accounts)
export const equityStatementCategorySchema = z.object({
  category: z.string(),
  components: z.array(equityComponentLineSchema),
  subtotalOpeningBalance: z.string(),
  subtotalNetProfitLoss: z.string(),
  subtotalDividends: z.string(),
  subtotalShareCapitalChanges: z.string(),
  subtotalOtherComprehensiveIncome: z.string(),
  subtotalOtherMovements: z.string(),
  subtotalClosingBalance: z.string(),
  
  // Comparison period subtotals
  comparisonSubtotalOpeningBalance: z.string().optional(),
  comparisonSubtotalNetProfitLoss: z.string().optional(),
  comparisonSubtotalDividends: z.string().optional(),
  comparisonSubtotalShareCapitalChanges: z.string().optional(),
  comparisonSubtotalOtherComprehensiveIncome: z.string().optional(),
  comparisonSubtotalOtherMovements: z.string().optional(),
  comparisonSubtotalClosingBalance: z.string().optional(),
  
  // Variance
  closingBalanceVariance: z.string().optional(),
  closingBalanceVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
});

export type EquityStatementCategory = z.infer<typeof equityStatementCategorySchema>;

// Statement of Changes in Equity (SOCE) Report
export const equityStatementReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  
  // Optional comparison period
  comparisonStartDate: z.date().optional(),
  comparisonEndDate: z.date().optional(),
  
  // Equity categories (Share Capital, Retained Earnings, Reserves, etc.)
  equityCategories: z.array(equityStatementCategorySchema),
  
  // Total equity movements
  totalOpeningBalance: z.string(),
  totalNetProfitLoss: z.string(),
  totalDividends: z.string(),
  totalShareCapitalChanges: z.string(),
  totalOtherComprehensiveIncome: z.string(),
  totalOtherMovements: z.string(),
  totalClosingBalance: z.string(),
  
  // Comparison period totals
  comparisonTotalOpeningBalance: z.string().optional(),
  comparisonTotalNetProfitLoss: z.string().optional(),
  comparisonTotalDividends: z.string().optional(),
  comparisonTotalShareCapitalChanges: z.string().optional(),
  comparisonTotalOtherComprehensiveIncome: z.string().optional(),
  comparisonTotalOtherMovements: z.string().optional(),
  comparisonTotalClosingBalance: z.string().optional(),
  
  // Variance
  closingBalanceVariance: z.string().optional(),
  closingBalanceVariancePercentage: z.union([z.number(), z.literal("Infinity"), z.literal("-Infinity")]).optional(),
  
  // Reconciliation check
  reconcilesWithBalanceSheet: z.boolean(),
  comparisonReconcilesWithBalanceSheet: z.boolean().optional(),
  
  // IFRS Compliance & Multi-currency
  baseCurrency: z.string(),
  ifrsComplianceEnabled: z.boolean(),
  fxTranslationStandard: z.string().nullable(),
  fxTranslationApplied: z.boolean(),
});

export type EquityStatementReport = z.infer<typeof equityStatementReportSchema>;

// ====================================
// OPEN BANKING INTEGRATION
// ====================================

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
  // Access token encryption metadata
  encryptionIV: varchar("encryption_iv", { length: 255 }), // Base64-encoded initialization vector
  encryptionAuthTag: varchar("encryption_auth_tag", { length: 255 }), // Base64-encoded authentication tag
  encryptionKeyVersion: varchar("encryption_key_version", { length: 50 }), // For key rotation tracking
  
  // Refresh token encryption metadata (separate IV/authTag required for each encrypted value)
  refreshTokenIV: varchar("refresh_token_iv", { length: 255 }),
  refreshTokenAuthTag: varchar("refresh_token_auth_tag", { length: 255 }),
  refreshTokenKeyVersion: varchar("refresh_token_key_version", { length: 50 }).default("v1"),
  
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
  
  // Transaction sync tracking
  lastSyncedAt: timestamp("last_synced_at"), // Track last successful sync for incremental updates
  
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
// OPEN BANKING PAYMENTS
// ============================================================================

export const openBankingPayments = pgTable('open_banking_payments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id),
  connectionId: varchar('connection_id').notNull().references(() => openBankingConnections.id),
  provider: varchar('provider', { length: 50 }).notNull(), // 'lean', etc
  providerPaymentId: varchar('provider_payment_id').notNull(), // Lean payment ID
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('AED'),
  recipientAccountId: varchar('recipient_account_id').notNull(),
  reference: text('reference'),
  status: varchar('status', { length: 50 }).notNull(), // 'pending', 'completed', 'failed', etc
  invoiceId: varchar('invoice_id').references(() => invoices.id),
  billId: varchar('bill_id').references(() => bills.id),
  initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('open_banking_payments_tenant_idx').on(table.tenantId),
  connectionIdx: index('open_banking_payments_connection_idx').on(table.connectionId),
  statusIdx: index('open_banking_payments_status_idx').on(table.status),
  uniqueProviderPayment: unique('unique_provider_payment').on(table.tenantId, table.provider, table.providerPaymentId),
}));

export const insertOpenBankingPaymentSchema = createInsertSchema(openBankingPayments, {
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OpenBankingPayment = typeof openBankingPayments.$inferSelect;
export type InsertOpenBankingPayment = z.infer<typeof insertOpenBankingPaymentSchema>;

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
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  
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
  matchedJournalEntryId: varchar("matched_journal_entry_id").references(() => journalEntries.id), // Link to journal entry for reconciliation
  
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
  // Unique constraint: prevent duplicate transactions from same provider account
  // Must include tenantId, accountId (provider's account ID), and providerTransactionId
  unique("unique_provider_transaction").on(table.tenantId, table.accountId, table.providerTransactionId),
  
  // Performance indexes
  index("idx_bt_tenant_connection").on(table.tenantId, table.connectionId),
  index("idx_bt_bank_account").on(table.bankAccountId),
  index("idx_bt_date").on(table.date),
  index("idx_bt_reconciliation").on(table.reconciliationStatus),
  index("idx_bt_matched_invoice").on(table.matchedInvoiceId),
  index("idx_bt_matched_bill").on(table.matchedBillId),
  index("idx_bt_pending").on(table.pending),
]);

export const insertBankTransactionSchema = createInsertSchema(bankTransactions, {
  amount: decimalString,
  taxableAmount: decimalString.optional(),
  vatAmount: decimalString.optional(),
  vatRate: decimalString.optional(),
  matchConfidence: decimalString.optional(),
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
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
// OPEN BANKING WEBHOOK LOGS
// ============================================================================

export const openBankingWebhookLogs = pgTable("open_banking_webhook_logs", {
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
  index("idx_ob_webhook_logs_tenant").on(table.tenantId),
  index("idx_ob_webhook_logs_provider").on(table.provider),
  index("idx_ob_webhook_logs_status").on(table.status),
  index("idx_ob_webhook_logs_received").on(table.receivedAt),
  index("idx_ob_webhook_logs_type").on(table.webhookType),
]);

export const insertOpenBankingWebhookLogSchema = createInsertSchema(openBankingWebhookLogs, {
  status: z.enum(['received', 'processing', 'processed', 'failed', 'ignored', 'duplicate']),
}).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

export type InsertOpenBankingWebhookLog = z.infer<typeof insertOpenBankingWebhookLogSchema>;
export type OpenBankingWebhookLog = typeof openBankingWebhookLogs.$inferSelect;

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
// PAYMENT BATCHES (for batch payment processing)
// ============================================================================

export const paymentBatches = pgTable("payment_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  batchNumber: varchar("batch_number", { length: 100 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentCount: integer("payment_count").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, pending_approval, approved, processing, completed, partially_failed
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedBy: varchar("executed_by").references(() => users.id),
  executedAt: timestamp("executed_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_payment_batch_number_tenant").on(table.tenantId, table.batchNumber),
  index("payment_batches_status_idx").on(table.tenantId, table.status),
]);

export const insertPaymentBatchSchema = createInsertSchema(paymentBatches, {
  totalAmount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentBatch = z.infer<typeof insertPaymentBatchSchema>;
export type PaymentBatch = typeof paymentBatches.$inferSelect;

// ============================================================================
// APPROVAL WORKFLOWS (for multi-step approval processes)
// ============================================================================

export const approvalWorkflows = pgTable("approval_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(), // purchase_orders, vendor_payments, debit_notes, bills, etc.
  conditions: jsonb("conditions").notNull(), // JSON: {amountThreshold: 10000, department: 'IT', etc.}
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("approval_workflows_entity_type_idx").on(table.tenantId, table.entityType, table.isActive),
]);

export const insertApprovalWorkflowSchema = createInsertSchema(approvalWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApprovalWorkflow = z.infer<typeof insertApprovalWorkflowSchema>;
export type ApprovalWorkflow = typeof approvalWorkflows.$inferSelect;

// ============================================================================
// APPROVAL STEPS (workflow step definitions)
// ============================================================================

export const approvalSteps = pgTable("approval_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  workflowId: varchar("workflow_id").notNull().references(() => approvalWorkflows.id, { onDelete: 'cascade' }),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3 for sequential
  approverRole: varchar("approver_role", { length: 100 }), // Role that can approve this step
  approverUserId: varchar("approver_user_id").references(() => users.id), // Specific user (optional)
  requiresAll: boolean("requires_all").default(false), // If multiple approvers, all must approve
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("approval_steps_workflow_idx").on(table.workflowId, table.stepOrder),
]);

export const insertApprovalStepSchema = createInsertSchema(approvalSteps).omit({
  id: true,
  createdAt: true,
});

export type InsertApprovalStep = z.infer<typeof insertApprovalStepSchema>;
export type ApprovalStep = typeof approvalSteps.$inferSelect;

// ============================================================================
// APPROVAL REQUESTS (active approval requests)
// ============================================================================

export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  workflowId: varchar("workflow_id").references(() => approvalWorkflows.id),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id").notNull(),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  currentStep: integer("current_step").default(1),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, rejected, cancelled
  approvalDeadline: timestamp("approval_deadline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("approval_requests_entity_idx").on(table.entityType, table.entityId),
  index("approval_requests_status_idx").on(table.tenantId, table.status),
  sql`CONSTRAINT check_approval_request_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))`,
]);

export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;

// ============================================================================
// APPROVAL HISTORY (immutable audit trail of approval decisions)
// ============================================================================

export const approvalHistory = pgTable("approval_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  approvalRequestId: varchar("approval_request_id").notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  stepOrder: integer("step_order").notNull(),
  approverUserId: varchar("approver_user_id").notNull().references(() => users.id),
  decision: varchar("decision", { length: 20 }).notNull(), // approved, rejected
  comments: text("comments"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("approval_history_request_idx").on(table.approvalRequestId),
  sql`CONSTRAINT check_approval_decision CHECK (decision IN ('approved', 'rejected'))`,
]);

export const insertApprovalHistorySchema = createInsertSchema(approvalHistory).omit({
  id: true,
  timestamp: true,
});

export type InsertApprovalHistory = z.infer<typeof insertApprovalHistorySchema>;
export type ApprovalHistory = typeof approvalHistory.$inferSelect;

// ============================================================================
// DEBIT NOTES (vendor returns, AP adjustments)
// ============================================================================

export const debitNotes = pgTable("debit_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  billId: varchar("bill_id").references(() => bills.id), // Optional - link to specific bill
  debitNoteNumber: varchar("debit_note_number", { length: 100 }),
  debitNoteDate: timestamp("debit_note_date").notNull(),
  reason: text("reason").notNull(), // Required: why issuing debit note
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, issued, applied, cancelled
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  appliedAmount: decimal("applied_amount", { precision: 12, scale: 2 }).default("0"), // How much has been applied to payments
  
  // Multi-currency support
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 10 }).notNull().default('1.0'),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 15, scale: 2 }),
  
  // Multi-currency transaction tracking (IAS 21 compliance)
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateSource: varchar("transaction_rate_source", { length: 50 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  exchangeRateId: varchar("exchange_rate_id").references(() => exchangeRates.id),
  transactionTotalAmount: decimal("transaction_total_amount", { precision: 20, scale: 10 }),
  
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_debit_note_number_tenant").on(table.tenantId, table.debitNoteNumber),
  index("debit_notes_vendor_idx").on(table.vendorId),
  index("debit_notes_bill_idx").on(table.billId),
  sql`CONSTRAINT check_debit_note_status CHECK (status IN ('draft', 'issued', 'applied', 'cancelled'))`,
]);

export const insertDebitNoteSchema = createInsertSchema(debitNotes, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
  appliedAmount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionTotalAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDebitNote = z.infer<typeof insertDebitNoteSchema>;
export type DebitNote = typeof debitNotes.$inferSelect;

// ============================================================================
// DEBIT NOTE LINE ITEMS
// ============================================================================

export const debitNoteLineItems = pgTable("debit_note_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  debitNoteId: varchar("debit_note_id").notNull().references(() => debitNotes.id, { onDelete: 'cascade' }),
  accountId: varchar("account_id").notNull().references(() => accounts.id), // Expense/Inventory account to reverse
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Multi-currency transaction tracking
  transactionCurrencyCode: varchar("transaction_currency_code", { length: 3 }),
  transactionRateValue: decimal("transaction_rate_value", { precision: 20, scale: 10 }),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 10 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDebitNoteLineItemSchema = createInsertSchema(debitNoteLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  amount: decimalString,
  transactionRateValue: decimalString.optional(),
  transactionAmount: decimalString.optional(),
}).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type InsertDebitNoteLineItem = z.infer<typeof insertDebitNoteLineItemSchema>;
export type DebitNoteLineItem = typeof debitNoteLineItems.$inferSelect;

// ============================================================================
// DEBIT NOTE SEQUENCES
// ============================================================================

export const debitNoteSequences = pgTable("debit_note_sequences", {
  tenantId: varchar("tenant_id").primaryKey().references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: varchar("prefix", { length: 20 }).default("DN-"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DebitNoteSequence = typeof debitNoteSequences.$inferSelect;

// ============================================================================
// CUSTOM REPORT CONFIGS
// ============================================================================

export const REPORT_TYPES = ['general_ledger', 'transaction_list', 'invoice_list', 'bill_list', 'account_details'] as const;

export const customReportConfigs = pgTable("custom_report_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(), // 'general_ledger', 'transaction_list', etc.
  selectedColumns: jsonb("selected_columns").notNull().$type<string[]>(), // Array of column IDs
  filters: jsonb("filters").notNull().$type<Record<string, any>>(), // Filter criteria object
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("custom_report_configs_tenant_idx").on(table.tenantId),
  index("custom_report_configs_created_by_idx").on(table.createdBy),
]);

export const insertCustomReportConfigSchema = createInsertSchema(customReportConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomReportConfig = z.infer<typeof insertCustomReportConfigSchema>;
export type CustomReportConfig = typeof customReportConfigs.$inferSelect;

// Type for custom report result
export interface CustomReportResult {
  columns: string[];
  rows: any[];
  totalRows: number;
}

// ============================================================================
// SCHEDULED REPORTS
// ============================================================================

export const SCHEDULED_REPORT_TYPES = ['profit_loss', 'balance_sheet', 'cash_flow', 'trial_balance', 'custom'] as const;
export const SCHEDULED_REPORT_RUN_STATUS = ['success', 'failed'] as const;

export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(), // 'profit_loss', 'balance_sheet', 'cash_flow', 'trial_balance', 'custom'
  customReportId: varchar("custom_report_id").references(() => customReportConfigs.id), // null if not custom
  schedule: varchar("schedule", { length: 100 }).notNull(), // cron expression: '0 9 * * 1'
  recipients: text("recipients").array().notNull(), // array of email addresses
  emailSubject: varchar("email_subject", { length: 500 }).notNull(),
  emailBody: text("email_body"), // optional text
  includeComparison: boolean("include_comparison").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
}, (table) => [
  index("scheduled_reports_tenant_idx").on(table.tenantId),
  index("scheduled_reports_created_by_idx").on(table.createdBy),
  index("scheduled_reports_is_active_idx").on(table.isActive),
]);

export const insertScheduledReportSchema = createInsertSchema(scheduledReports, {
  recipients: z.array(z.string().email()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
});

export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

export const scheduledReportRuns = pgTable("scheduled_report_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  scheduledReportId: varchar("scheduled_report_id").notNull().references(() => scheduledReports.id, { onDelete: 'cascade' }),
  runAt: timestamp("run_at").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull(), // 'success', 'failed'
  errorMessage: text("error_message"),
  reportData: jsonb("report_data"), // cached report results
  emailSent: boolean("email_sent").default(false).notNull(),
  recipientCount: integer("recipient_count").default(0).notNull(),
}, (table) => [
  index("scheduled_report_runs_tenant_idx").on(table.tenantId),
  index("scheduled_report_runs_scheduled_report_id_idx").on(table.scheduledReportId),
  index("scheduled_report_runs_run_at_idx").on(table.runAt),
  index("scheduled_report_runs_status_idx").on(table.status),
]);

export const insertScheduledReportRunSchema = createInsertSchema(scheduledReportRuns).omit({
  id: true,
});

export type InsertScheduledReportRun = z.infer<typeof insertScheduledReportRunSchema>;
export type ScheduledReportRun = typeof scheduledReportRuns.$inferSelect;

// ============================================================================
// FINANCIAL STATEMENT NOTES (IAS 1 Compliance)
// ============================================================================

export const financialStatementNotes = pgTable("financial_statement_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  noteType: varchar("note_type", { length: 100 }).notNull(), // 'accounting_policy', 'contingent_liability', etc.
  noteTitle: varchar("note_title", { length: 500 }).notNull(),
  noteContent: text("note_content").notNull(), // Rich text/markdown content
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(), // Soft delete
  
  // Going Concern specific fields (only for going_concern type)
  goingConcernStatus: varchar("going_concern_status", { length: 50 }), // 'positive', 'uncertainty', 'doubt'
  goingConcernAssessmentDate: timestamp("going_concern_assessment_date"),
  goingConcernReviewedBy: varchar("going_concern_reviewed_by").references(() => users.id),
  
  // Version control
  versionNumber: integer("version_number").default(1).notNull(),
  previousVersionId: varchar("previous_version_id"), // Self-reference to previous version
  
  // Audit fields
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("financial_statement_notes_tenant_period_idx").on(table.tenantId, table.reportingPeriodStart, table.reportingPeriodEnd),
  index("financial_statement_notes_tenant_type_idx").on(table.tenantId, table.noteType),
  index("financial_statement_notes_tenant_active_idx").on(table.tenantId, table.isActive),
  index("financial_statement_notes_created_by_idx").on(table.createdBy),
]);

export const insertFinancialStatementNoteSchema = createInsertSchema(financialStatementNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  versionNumber: true,
  previousVersionId: true,
});

export type InsertFinancialStatementNote = z.infer<typeof insertFinancialStatementNoteSchema>;
export type FinancialStatementNote = typeof financialStatementNotes.$inferSelect;

// ============================================================================
// AUDIT LOGS (immutable audit trail for all entities)
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // null if system action
  action: varchar("action", { length: 100 }).notNull(), // create, update, delete, approve, reject, post, reverse, etc.
  entityType: varchar("entity_type", { length: 100 }).notNull(), // invoice, bill, payment, journal_entry, etc.
  entityId: varchar("entity_id").notNull(),
  changes: jsonb("changes"), // Before/after state (redacted sensitive fields)
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6
  userAgent: text("user_agent"),
  wasSuccessful: boolean("was_successful").default(true),
  errorMessage: text("error_message"), // If action failed
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("audit_logs_tenant_entity_idx").on(table.tenantId, table.entityType, table.entityId),
  index("audit_logs_user_idx").on(table.userId),
  index("audit_logs_timestamp_idx").on(table.timestamp),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

// Push Subscriptions (Web Push API subscriptions for PWA notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Authentication secret
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("push_subscriptions_tenant_user_idx").on(table.tenantId, table.userId),
  index("push_subscriptions_user_idx").on(table.userId),
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Push Notification Log (Track sent notifications for debugging and compliance)
export const pushNotificationLog = pgTable("push_notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  subscriptionId: varchar("subscription_id").references(() => pushSubscriptions.id),
  notificationType: varchar("notification_type", { length: 50 }).notNull(), // 'overdue_invoice', 'payment_received', 'approval_request', 'compliance_deadline', 'general'
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  data: jsonb("data"), // Additional notification data (invoice ID, etc.)
  wasSent: boolean("was_sent").default(false).notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("push_notification_log_tenant_idx").on(table.tenantId),
  index("push_notification_log_user_idx").on(table.userId),
  index("push_notification_log_type_idx").on(table.notificationType),
  index("push_notification_log_sent_at_idx").on(table.sentAt),
]);

export const insertPushNotificationLogSchema = createInsertSchema(pushNotificationLog).omit({
  id: true,
  createdAt: true,
});

export type InsertPushNotificationLog = z.infer<typeof insertPushNotificationLogSchema>;
export type PushNotificationLog = typeof pushNotificationLog.$inferSelect;

// ============================================================================
// AML/KYC COMPLIANCE SYSTEM
// ============================================================================

// KYC Verifications (Customer identity verification and due diligence)
export const kycVerifications = pgTable("kyc_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  
  // Verification Status
  status: varchar("status", { length: 50 }).notNull(), // 'pending', 'in_progress', 'verified', 'rejected', 'expired'
  riskLevel: varchar("risk_level", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  
  // Verification Details
  verificationMethod: varchar("verification_method", { length: 100 }), // 'lean_identity', 'manual_review', 'onfido', etc.
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"), // userId
  expiresAt: timestamp("expires_at"), // Re-verification date
  
  // Document Collection
  documentsCollected: jsonb("documents_collected").$type<string[]>().default(sql`'[]'::jsonb`), // ['passport', 'trade_license', 'utility_bill']
  documentsVerified: boolean("documents_verified").default(false),
  
  // Identity Verification (Lean Integration)
  leanEntityId: varchar("lean_entity_id"), // Lean Technologies entity ID
  leanVerificationStatus: varchar("lean_verification_status", { length: 50 }),
  leanVerificationDate: timestamp("lean_verification_date"),
  
  // Enhanced Due Diligence (EDD)
  eddRequired: boolean("edd_required").default(false),
  eddCompleted: boolean("edd_completed").default(false),
  eddCompletedAt: timestamp("edd_completed_at"),
  eddNotes: text("edd_notes"),
  
  // Review & Notes
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("kyc_verifications_tenant_idx").on(table.tenantId),
  index("kyc_verifications_customer_idx").on(table.customerId),
  index("kyc_verifications_status_idx").on(table.status),
  index("kyc_verifications_risk_level_idx").on(table.riskLevel),
]);

export const insertKYCVerificationSchema = createInsertSchema(kycVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKYCVerification = z.infer<typeof insertKYCVerificationSchema>;
export type KYCVerification = typeof kycVerifications.$inferSelect;

// Beneficial Owners (Ultimate beneficial ownership tracking for corporate customers)
export const beneficialOwners = pgTable("beneficial_owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  
  // Owner Details
  fullName: varchar("full_name", { length: 255 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  nationality: varchar("nationality", { length: 100 }),
  countryOfResidence: varchar("country_of_residence", { length: 100 }),
  
  // Ownership
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }).notNull(), // e.g., 25.50
  ownershipType: varchar("ownership_type", { length: 50 }), // 'direct', 'indirect', 'control'
  
  // Identification
  identificationType: varchar("identification_type", { length: 50 }), // 'passport', 'national_id', 'drivers_license'
  identificationNumber: varchar("identification_number", { length: 100 }),
  identificationExpiryDate: date("identification_expiry_date"),
  
  // PEP Status
  isPEP: boolean("is_pep").default(false),
  pepCategory: varchar("pep_category", { length: 100 }), // 'senior_official', 'family_member', 'close_associate'
  pepDetails: text("pep_details"),
  
  // Verification
  verificationStatus: varchar("verification_status", { length: 50 }).default('pending'), // 'pending', 'verified', 'rejected'
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"), // userId
  
  // Sanctions Screening
  lastScreenedAt: timestamp("last_screened_at"),
  screeningStatus: varchar("screening_status", { length: 50 }), // 'clear', 'potential_match', 'match'
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("beneficial_owners_tenant_idx").on(table.tenantId),
  index("beneficial_owners_customer_idx").on(table.customerId),
  index("beneficial_owners_is_pep_idx").on(table.isPEP),
]);

export const insertBeneficialOwnerSchema = createInsertSchema(beneficialOwners, {
  ownershipPercentage: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBeneficialOwner = z.infer<typeof insertBeneficialOwnerSchema>;
export type BeneficialOwner = typeof beneficialOwners.$inferSelect;

// Customer Risk Profiles (Risk assessment and scoring for AML compliance)
export const customerRiskProfiles = pgTable("customer_risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  
  // Risk Assessment
  overallRiskLevel: varchar("overall_risk_level", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  riskScore: integer("risk_score").notNull(), // 0-100
  
  // Risk Factors (each scored 0-20)
  geographicRisk: integer("geographic_risk").default(0),
  industryRisk: integer("industry_risk").default(0),
  productServiceRisk: integer("product_service_risk").default(0),
  transactionRisk: integer("transaction_risk").default(0),
  customerTypeRisk: integer("customer_type_risk").default(0),
  
  // Risk Details
  highRiskCountries: jsonb("high_risk_countries").$type<string[]>().default(sql`'[]'::jsonb`),
  sanctionedCountryExposure: boolean("sanctioned_country_exposure").default(false),
  cashIntensiveBusiness: boolean("cash_intensive_business").default(false),
  politicallyExposed: boolean("politically_exposed").default(false),
  
  // Review Cycle
  nextReviewDate: date("next_review_date").notNull(),
  reviewFrequency: varchar("review_frequency", { length: 20 }).default('annual'), // 'monthly', 'quarterly', 'semi_annual', 'annual'
  lastReviewedAt: timestamp("last_reviewed_at"),
  lastReviewedBy: varchar("last_reviewed_by"), // userId
  
  // Approval
  approvedBy: varchar("approved_by"), // userId
  approvedAt: timestamp("approved_at"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("customer_risk_profiles_tenant_idx").on(table.tenantId),
  index("customer_risk_profiles_customer_idx").on(table.customerId),
  index("customer_risk_profiles_risk_level_idx").on(table.overallRiskLevel),
  index("customer_risk_profiles_next_review_idx").on(table.nextReviewDate),
]);

export const insertCustomerRiskProfileSchema = createInsertSchema(customerRiskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerRiskProfile = z.infer<typeof insertCustomerRiskProfileSchema>;
export type CustomerRiskProfile = typeof customerRiskProfiles.$inferSelect;

// Sanctions Screenings (OFAC, UN, EU sanctions list screening)
export const sanctionsScreenings = pgTable("sanctions_screenings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Entity Being Screened
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'customer', 'vendor', 'beneficial_owner'
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  entityName: varchar("entity_name", { length: 255 }).notNull(),
  
  // Screening Details
  screeningType: varchar("screening_type", { length: 50 }).notNull(), // 'onboarding', 'daily_batch', 'transaction', 'manual'
  screeningDate: timestamp("screening_date").notNull().defaultNow(),
  
  // Results
  overallResult: varchar("overall_result", { length: 50 }).notNull(), // 'clear', 'potential_match', 'match'
  
  // Sanctions Lists Checked
  ofacResult: varchar("ofac_result", { length: 50 }), // 'clear', 'match'
  ofacConfidence: decimal("ofac_confidence", { precision: 5, scale: 2 }),
  ofacMatchDetails: jsonb("ofac_match_details"),
  
  unResult: varchar("un_result", { length: 50 }),
  unConfidence: decimal("un_confidence", { precision: 5, scale: 2 }),
  unMatchDetails: jsonb("un_match_details"),
  
  euResult: varchar("eu_result", { length: 50 }),
  euConfidence: decimal("eu_confidence", { precision: 5, scale: 2 }),
  euMatchDetails: jsonb("eu_match_details"),
  
  ukResult: varchar("uk_result", { length: 50 }),
  ukConfidence: decimal("uk_confidence", { precision: 5, scale: 2 }),
  ukMatchDetails: jsonb("uk_match_details"),
  
  // PEP Screening
  pepResult: varchar("pep_result", { length: 50 }), // 'clear', 'match'
  pepConfidence: decimal("pep_confidence", { precision: 5, scale: 2 }),
  pepMatchDetails: jsonb("pep_match_details"),
  
  // Resolution
  requiresReview: boolean("requires_review").default(false),
  reviewStatus: varchar("review_status", { length: 50 }).default('pending'), // 'pending', 'false_positive', 'true_positive', 'escalated'
  reviewedBy: varchar("reviewed_by"), // userId
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Actions Taken
  actionTaken: varchar("action_taken", { length: 100 }), // 'approved', 'blocked', 'sar_filed', 'escalated'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sanctions_screenings_tenant_idx").on(table.tenantId),
  index("sanctions_screenings_entity_idx").on(table.entityType, table.entityId),
  index("sanctions_screenings_overall_result_idx").on(table.overallResult),
  index("sanctions_screenings_requires_review_idx").on(table.requiresReview),
]);

export const insertSanctionsScreeningSchema = createInsertSchema(sanctionsScreenings, {
  ofacConfidence: decimalString.optional(),
  unConfidence: decimalString.optional(),
  euConfidence: decimalString.optional(),
  ukConfidence: decimalString.optional(),
  pepConfidence: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSanctionsScreening = z.infer<typeof insertSanctionsScreeningSchema>;
export type SanctionsScreening = typeof sanctionsScreenings.$inferSelect;

// Transaction Alerts (AML transaction monitoring alerts)
export const transactionAlerts = pgTable("transaction_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").references(() => customers.id),
  
  // Alert Details
  alertType: varchar("alert_type", { length: 100 }).notNull(), // 'threshold_exceeded', 'structuring', 'velocity', 'geographic_anomaly', 'round_amount'
  severity: varchar("severity", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  alertDate: timestamp("alert_date").notNull().defaultNow(),
  
  // Transaction Reference
  transactionType: varchar("transaction_type", { length: 50 }), // 'invoice', 'payment', 'bank_transaction'
  transactionId: varchar("transaction_id", { length: 255 }),
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }),
  transactionCurrency: varchar("transaction_currency", { length: 3 }),
  transactionDate: timestamp("transaction_date"),
  
  // Alert Rule Triggered
  ruleId: varchar("rule_id"),
  ruleName: varchar("rule_name", { length: 255 }),
  ruleThreshold: jsonb("rule_threshold"),
  
  // Pattern Detection
  patternDescription: text("pattern_description"),
  relatedTransactions: jsonb("related_transactions").$type<string[]>().default(sql`'[]'::jsonb`),
  
  // Risk Score
  riskScore: integer("risk_score"), // 0-100
  riskFactors: jsonb("risk_factors"),
  
  // Review & Resolution
  status: varchar("status", { length: 50 }).default('open'), // 'open', 'under_review', 'closed', 'escalated_to_sar'
  assignedTo: varchar("assigned_to"), // userId
  reviewedBy: varchar("reviewed_by"), // userId
  reviewedAt: timestamp("reviewed_at"),
  resolution: varchar("resolution", { length: 100 }), // 'false_positive', 'legitimate', 'suspicious', 'sar_filed'
  resolutionNotes: text("resolution_notes"),
  
  // SAR Link
  sarId: varchar("sar_id"), // Link to suspiciousActivityReports if SAR was filed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("transaction_alerts_tenant_idx").on(table.tenantId),
  index("transaction_alerts_customer_idx").on(table.customerId),
  index("transaction_alerts_status_idx").on(table.status),
  index("transaction_alerts_severity_idx").on(table.severity),
  index("transaction_alerts_alert_date_idx").on(table.alertDate),
]);

export const insertTransactionAlertSchema = createInsertSchema(transactionAlerts, {
  transactionAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransactionAlert = z.infer<typeof insertTransactionAlertSchema>;
export type TransactionAlert = typeof transactionAlerts.$inferSelect;

// Suspicious Activity Reports (SAR filings to regulatory authorities)
export const suspiciousActivityReports = pgTable("suspicious_activity_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // SAR Identification
  sarNumber: varchar("sar_number", { length: 100 }).notNull().unique(), // Auto-generated
  status: varchar("status", { length: 50 }).notNull().default('draft'), // 'draft', 'under_review', 'approved', 'filed', 'rejected'
  
  // Subject Information
  subjectType: varchar("subject_type", { length: 50 }).notNull(), // 'customer', 'vendor', 'beneficial_owner', 'transaction'
  subjectId: varchar("subject_id", { length: 255 }).notNull(),
  subjectName: varchar("subject_name", { length: 255 }).notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  
  // Suspicious Activity Details
  activityType: varchar("activity_type", { length: 100 }).notNull(), // 'structuring', 'money_laundering', 'terrorism_financing', 'fraud'
  activityDescription: text("activity_description").notNull(),
  activityStartDate: date("activity_start_date"),
  activityEndDate: date("activity_end_date"),
  totalAmountInvolved: decimal("total_amount_involved", { precision: 15, scale: 2 }),
  currencyCode: varchar("currency_code", { length: 3 }),
  
  // Supporting Evidence
  relatedAlertIds: jsonb("related_alert_ids").$type<string[]>().default(sql`'[]'::jsonb`),
  relatedTransactionIds: jsonb("related_transaction_ids").$type<string[]>().default(sql`'[]'::jsonb`),
  attachments: jsonb("attachments").$type<string[]>().default(sql`'[]'::jsonb`),
  
  // Investigation
  investigationNotes: text("investigation_notes"),
  investigatorId: varchar("investigator_id"), // userId
  investigationStartDate: timestamp("investigation_start_date"),
  investigationCompletedDate: timestamp("investigation_completed_date"),
  
  // Approval Workflow
  submittedBy: varchar("submitted_by"), // userId
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"), // userId
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: varchar("approved_by"), // userId (compliance officer)
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Regulatory Filing
  filedToAuthority: varchar("filed_to_authority", { length: 100 }), // 'UAE_FIU', 'KSA_SAMA', etc.
  filedAt: timestamp("filed_at"),
  filingConfirmation: varchar("filing_confirmation", { length: 255 }), // Confirmation number from authority
  filingMethod: varchar("filing_method", { length: 50 }), // 'electronic', 'manual'
  
  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: date("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("suspicious_activity_reports_tenant_idx").on(table.tenantId),
  index("suspicious_activity_reports_customer_idx").on(table.customerId),
  index("suspicious_activity_reports_status_idx").on(table.status),
  index("suspicious_activity_reports_sar_number_idx").on(table.sarNumber),
]);

export const insertSuspiciousActivityReportSchema = createInsertSchema(suspiciousActivityReports, {
  totalAmountInvolved: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSuspiciousActivityReport = z.infer<typeof insertSuspiciousActivityReportSchema>;
export type SuspiciousActivityReport = typeof suspiciousActivityReports.$inferSelect;

// Alert Rules (Configurable AML monitoring rules)
export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  ruleType: varchar("rule_type", { length: 100 }).notNull(), // 'threshold', 'velocity', 'pattern', 'geographic'
  description: text("description"),
  
  // Rule Configuration
  isActive: boolean("is_active").default(true),
  severity: varchar("severity", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  
  // Threshold Configuration
  thresholdAmount: decimal("threshold_amount", { precision: 15, scale: 2 }),
  thresholdCurrency: varchar("threshold_currency", { length: 3 }),
  thresholdPeriod: varchar("threshold_period", { length: 50 }), // 'transaction', 'daily', 'weekly', 'monthly'
  
  // Advanced Configuration
  conditions: jsonb("conditions"), // Complex rule conditions
  
  createdBy: varchar("created_by"), // userId
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("alert_rules_tenant_idx").on(table.tenantId),
  index("alert_rules_is_active_idx").on(table.isActive),
  index("alert_rules_rule_type_idx").on(table.ruleType),
]);

export const insertAlertRuleSchema = createInsertSchema(alertRules, {
  thresholdAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

// Transaction History (Dedicated table for storing all transactions for AML analysis)
// NOTE: This table stores ALL transactions regardless of whether they triggered alerts
// This prevents data commingling between transactional history and alert records
export const transactionHistory = pgTable("transaction_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").references(() => customers.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  
  // Transaction Details
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'invoice', 'payment', 'bill', 'customer_payment'
  transactionId: varchar("transaction_id", { length: 255 }).notNull(),
  amount: varchar("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  transactionDate: date("transaction_date").notNull(),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional transaction details
  
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => [
  index("transaction_history_tenant_idx").on(table.tenantId),
  index("transaction_history_tenant_customer_idx").on(table.tenantId, table.customerId),
  index("transaction_history_tenant_vendor_idx").on(table.tenantId, table.vendorId),
  index("transaction_history_tenant_date_idx").on(table.tenantId, table.transactionDate),
  index("transaction_history_type_idx").on(table.transactionType),
  index("transaction_history_transaction_id_idx").on(table.transactionId),
]);

export const insertTransactionHistorySchema = createInsertSchema(transactionHistory).omit({
  id: true,
  recordedAt: true,
});

export type InsertTransactionHistory = z.infer<typeof insertTransactionHistorySchema>;
export type TransactionHistory = typeof transactionHistory.$inferSelect;

// ============================================================================
// COMPLIANCE DASHBOARD & REPORTING
// ============================================================================

// Compliance Metrics (calculated compliance metrics for dashboard)
export const complianceMetrics = pgTable("compliance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  complianceArea: varchar("compliance_area", { length: 50 }).notNull(), // 'sox', 'pci_dss', 'gdpr', 'aml_kyc', 'psd2'
  metricType: varchar("metric_type", { length: 100 }).notNull(), // 'audit_logs_count', 'kyc_pending', 'training_completion_rate', etc.
  metricValue: varchar("metric_value", { length: 255 }).notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_compliance_metrics_tenant_area").on(table.tenantId, table.complianceArea),
  index("idx_compliance_metrics_calculated_at").on(table.calculatedAt),
]);

export const insertComplianceMetricSchema = createInsertSchema(complianceMetrics).omit({
  id: true,
  calculatedAt: true,
});

export type InsertComplianceMetric = z.infer<typeof insertComplianceMetricSchema>;
export type ComplianceMetric = typeof complianceMetrics.$inferSelect;

// Compliance Training (training assignments and completion tracking)
export const complianceTraining = pgTable("compliance_training", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  trainingModule: varchar("training_module", { length: 100 }).notNull(), // 'sox_basics', 'aml_procedures', 'gdpr_awareness', etc.
  status: varchar("status", { length: 50 }).notNull(), // 'not_started', 'in_progress', 'completed', 'expired'
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  score: integer("score"), // 0-100
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_training_tenant_user").on(table.tenantId, table.userId),
  index("idx_compliance_training_status").on(table.status),
  index("idx_compliance_training_due_date").on(table.dueDate),
]);

export const insertComplianceTrainingSchema = createInsertSchema(complianceTraining).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComplianceTraining = z.infer<typeof insertComplianceTrainingSchema>;
export type ComplianceTraining = typeof complianceTraining.$inferSelect;

// Compliance Deadlines (regulatory and internal compliance deadlines)
export const complianceDeadlines = pgTable("compliance_deadlines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  complianceArea: varchar("compliance_area", { length: 50 }).notNull(), // 'sox', 'pci_dss', 'gdpr', 'aml_kyc', 'psd2', 'tax', 'general'
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'upcoming', 'overdue', 'completed'
  priority: varchar("priority", { length: 50 }).notNull(), // 'low', 'medium', 'high', 'critical'
  assignedTo: varchar("assigned_to").references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_deadlines_tenant").on(table.tenantId),
  index("idx_compliance_deadlines_due_date").on(table.dueDate),
  index("idx_compliance_deadlines_status").on(table.status),
  index("idx_compliance_deadlines_assigned_to").on(table.assignedTo),
]);

export const insertComplianceDeadlineSchema = createInsertSchema(complianceDeadlines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComplianceDeadline = z.infer<typeof insertComplianceDeadlineSchema>;
export type ComplianceDeadline = typeof complianceDeadlines.$inferSelect;

// ============================================================================
// PROJECT MANAGEMENT & TIME TRACKING
// ============================================================================

// Projects (client projects for time tracking and billing)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  projectNumber: varchar("project_number", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  billingType: varchar("billing_type", { length: 50 }).notNull().default("time_and_materials"),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }),
  budgetHours: decimal("budget_hours", { precision: 10, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  projectManagerId: varchar("project_manager_id").references(() => users.id),
  revenueAccountId: varchar("revenue_account_id").references(() => accounts.id),
  defaultCostAccountId: varchar("default_cost_account_id").references(() => accounts.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_project_number_per_tenant").on(table.tenantId, table.projectNumber),
  index("projects_tenant_idx").on(table.tenantId),
  index("projects_customer_idx").on(table.customerId),
  index("projects_project_manager_idx").on(table.projectManagerId),
  index("projects_status_idx").on(table.status),
  sql`CONSTRAINT check_project_status CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled'))`,
  sql`CONSTRAINT check_project_billing_type CHECK (billing_type IN ('time_and_materials', 'fixed_price', 'non_billable'))`,
]);

export const insertProjectSchema = createInsertSchema(projects, {
  budgetAmount: decimalString.optional(),
  budgetHours: decimalString.optional(),
  revenueAccountId: z.string().optional(),
  defaultCostAccountId: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Project Members (team members assigned to projects)
export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 100 }),
  billableRate: decimal("billable_rate", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_project_member").on(table.tenantId, table.projectId, table.userId),
  index("project_members_tenant_idx").on(table.tenantId),
  index("project_members_project_idx").on(table.projectId),
  index("project_members_user_idx").on(table.userId),
]);

export const insertProjectMemberSchema = createInsertSchema(projectMembers, {
  billableRate: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// Time Entries (time tracking for projects and tasks)
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  taskId: varchar("task_id").references(() => projectTasks.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  date: date("date").notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(),
  minutes: integer("minutes").default(0).notNull(),
  isBillable: boolean("is_billable").default(true).notNull(),
  billableRate: decimal("billable_rate", { precision: 10, scale: 2 }),
  billableAmount: decimal("billable_amount", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  projectInvoiceId: varchar("project_invoice_id").references(() => projectInvoices.id),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("time_entries_tenant_idx").on(table.tenantId),
  index("time_entries_project_idx").on(table.projectId),
  index("time_entries_user_idx").on(table.userId),
  index("time_entries_task_idx").on(table.taskId),
  index("time_entries_date_idx").on(table.date),
  index("time_entries_status_idx").on(table.status),
  index("time_entries_invoice_idx").on(table.invoiceId),
  index("time_entries_project_invoice_idx").on(table.projectInvoiceId),
  index("time_entries_tenant_status_idx").on(table.tenantId, table.status),
  sql`CONSTRAINT check_time_entry_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'invoiced'))`,
]);

export const insertTimeEntrySchema = createInsertSchema(timeEntries, {
  hours: decimalString,
  billableRate: decimalString.optional(),
  billableAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// Project Tasks (individual tasks within projects)
export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("not_started"),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 10, scale: 2 }).default("0").notNull(),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_tasks_tenant_idx").on(table.tenantId),
  index("project_tasks_project_idx").on(table.projectId),
  index("project_tasks_assigned_to_idx").on(table.assignedTo),
  index("project_tasks_status_idx").on(table.status),
  index("project_tasks_due_date_idx").on(table.dueDate),
  sql`CONSTRAINT check_project_task_status CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'))`,
  sql`CONSTRAINT check_project_task_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))`,
]);

export const insertProjectTaskSchema = createInsertSchema(projectTasks, {
  estimatedHours: decimalString.optional(),
  actualHours: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;

// Project Budgets (budget categories for projects)
export const projectBudgets = pgTable("project_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  category: varchar("category", { length: 100 }).notNull(),
  budgetedAmount: decimal("budgeted_amount", { precision: 15, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  laborBudget: decimal("labor_budget", { precision: 15, scale: 2 }),
  materialsBudget: decimal("materials_budget", { precision: 15, scale: 2 }),
  overheadBudget: decimal("overhead_budget", { precision: 15, scale: 2 }),
  otherBudget: decimal("other_budget", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_budgets_tenant_idx").on(table.tenantId),
  index("project_budgets_project_idx").on(table.projectId),
]);

export const insertProjectBudgetSchema = createInsertSchema(projectBudgets, {
  budgetedAmount: decimalString,
  actualAmount: decimalString.optional(),
  laborBudget: decimalString.optional(),
  materialsBudget: decimalString.optional(),
  overheadBudget: decimalString.optional(),
  otherBudget: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type ProjectBudget = typeof projectBudgets.$inferSelect;

// Project Cost Accounts (GL account mappings for project cost categories)
export const projectCostAccounts = pgTable("project_cost_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  costCategory: varchar("cost_category", { length: 50 }).notNull(), // 'labor', 'materials', 'overhead', 'other'
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_project_cost_category").on(table.tenantId, table.projectId, table.costCategory),
  index("project_cost_accounts_tenant_idx").on(table.tenantId),
  index("project_cost_accounts_project_idx").on(table.projectId),
  index("project_cost_accounts_account_idx").on(table.accountId),
]);

export const insertProjectCostAccountSchema = createInsertSchema(projectCostAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectCostAccount = z.infer<typeof insertProjectCostAccountSchema>;
export type ProjectCostAccount = typeof projectCostAccounts.$inferSelect;

// Project Expenses (expenses linked to projects)
export const projectExpenses = pgTable("project_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  expenseId: varchar("expense_id"), // Forward reference to employeeExpenses (if exists)
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  isBillable: boolean("is_billable").default(true).notNull(),
  isInvoiced: boolean("is_invoiced").default(false).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_expenses_tenant_idx").on(table.tenantId),
  index("project_expenses_project_idx").on(table.projectId),
  index("project_expenses_expense_idx").on(table.expenseId),
  index("project_expenses_invoice_idx").on(table.invoiceId),
]);

export const insertProjectExpenseSchema = createInsertSchema(projectExpenses, {
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectExpense = z.infer<typeof insertProjectExpenseSchema>;
export type ProjectExpense = typeof projectExpenses.$inferSelect;

// Project Milestones (key milestones for project tracking)
export const projectMilestones = pgTable("project_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: date("due_date").notNull(),
  completedDate: date("completed_date"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  billingPercentage: decimal("billing_percentage", { precision: 5, scale: 2 }),
  invoiceableAmount: decimal("invoiceable_amount", { precision: 15, scale: 2 }),
  invoicedAmount: decimal("invoiced_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  isFullyInvoiced: boolean("is_fully_invoiced").default(false).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("project_milestones_tenant_idx").on(table.tenantId),
  index("project_milestones_project_idx").on(table.projectId),
  index("project_milestones_status_idx").on(table.status),
  index("project_milestones_due_date_idx").on(table.dueDate),
  sql`CONSTRAINT check_project_milestone_status CHECK (status IN ('pending', 'in_progress', 'completed', 'missed'))`,
]);

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones, {
  billingPercentage: decimalString.optional(),
  invoiceableAmount: decimalString.optional(),
  invoicedAmount: decimalString.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;

// Project Invoices (linking projects to invoices for billing)
export const projectInvoices = pgTable("project_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  billingMode: varchar("billing_mode", { length: 50 }).notNull(),
  milestoneId: varchar("milestone_id").references(() => projectMilestones.id),
  percentageComplete: decimal("percentage_complete", { precision: 5, scale: 2 }),
  sourceSummary: text("source_summary"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_project_invoice").on(table.tenantId, table.invoiceId),
  index("project_invoices_tenant_idx").on(table.tenantId),
  index("project_invoices_project_idx").on(table.projectId),
  index("project_invoices_invoice_idx").on(table.invoiceId),
  index("project_invoices_milestone_idx").on(table.milestoneId),
]);

export const insertProjectInvoiceSchema = createInsertSchema(projectInvoices, {
  percentageComplete: decimalString.optional(),
  totalHours: decimalString.optional(),
  totalAmount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectInvoice = z.infer<typeof insertProjectInvoiceSchema>;
export type ProjectInvoice = typeof projectInvoices.$inferSelect;

// Project Invoice Time Entries (junction table for time-based billing)
export const projectInvoiceTimeEntries = pgTable("project_invoice_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectInvoiceId: varchar("project_invoice_id").notNull().references(() => projectInvoices.id),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_project_invoice_time_entry").on(table.tenantId, table.projectInvoiceId, table.timeEntryId),
  index("project_invoice_time_entries_tenant_idx").on(table.tenantId),
  index("project_invoice_time_entries_project_invoice_idx").on(table.projectInvoiceId),
]);

export const insertProjectInvoiceTimeEntrySchema = createInsertSchema(projectInvoiceTimeEntries, {
  hours: decimalString,
  rate: decimalString,
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectInvoiceTimeEntry = z.infer<typeof insertProjectInvoiceTimeEntrySchema>;
export type ProjectInvoiceTimeEntry = typeof projectInvoiceTimeEntries.$inferSelect;

// Project Invoice Milestones (junction table for milestone-based billing)
export const projectInvoiceMilestones = pgTable("project_invoice_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  projectInvoiceId: varchar("project_invoice_id").notNull().references(() => projectInvoices.id),
  milestoneId: varchar("milestone_id").notNull().references(() => projectMilestones.id),
  invoicedAmount: decimal("invoiced_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_project_invoice_milestone").on(table.tenantId, table.projectInvoiceId, table.milestoneId),
  index("project_invoice_milestones_tenant_idx").on(table.tenantId),
  index("project_invoice_milestones_project_invoice_idx").on(table.projectInvoiceId),
]);

export const insertProjectInvoiceMilestoneSchema = createInsertSchema(projectInvoiceMilestones, {
  invoicedAmount: decimalString,
}).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectInvoiceMilestone = z.infer<typeof insertProjectInvoiceMilestoneSchema>;
export type ProjectInvoiceMilestone = typeof projectInvoiceMilestones.$inferSelect;

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

export const paymentBatchesRelations = relations(paymentBatches, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [paymentBatches.tenantId],
    references: [tenants.id],
  }),
  payments: many(payments),
  approvedByUser: one(users, {
    fields: [paymentBatches.approvedBy],
    references: [users.id],
  }),
  executedByUser: one(users, {
    fields: [paymentBatches.executedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [paymentBatches.createdBy],
    references: [users.id],
  }),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [approvalWorkflows.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [approvalWorkflows.createdBy],
    references: [users.id],
  }),
  steps: many(approvalSteps),
  requests: many(approvalRequests),
}));

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalSteps.tenantId],
    references: [tenants.id],
  }),
  workflow: one(approvalWorkflows, {
    fields: [approvalSteps.workflowId],
    references: [approvalWorkflows.id],
  }),
  approverUser: one(users, {
    fields: [approvalSteps.approverUserId],
    references: [users.id],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [approvalRequests.tenantId],
    references: [tenants.id],
  }),
  workflow: one(approvalWorkflows, {
    fields: [approvalRequests.workflowId],
    references: [approvalWorkflows.id],
  }),
  requestedByUser: one(users, {
    fields: [approvalRequests.requestedBy],
    references: [users.id],
  }),
  history: many(approvalHistory),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalHistory.tenantId],
    references: [tenants.id],
  }),
  approvalRequest: one(approvalRequests, {
    fields: [approvalHistory.approvalRequestId],
    references: [approvalRequests.id],
  }),
  approverUser: one(users, {
    fields: [approvalHistory.approverUserId],
    references: [users.id],
  }),
}));

export const debitNotesRelations = relations(debitNotes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [debitNotes.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [debitNotes.vendorId],
    references: [vendors.id],
  }),
  bill: one(bills, {
    fields: [debitNotes.billId],
    references: [bills.id],
  }),
  createdByUser: one(users, {
    fields: [debitNotes.createdBy],
    references: [users.id],
  }),
  lineItems: many(debitNoteLineItems),
}));

export const debitNoteLineItemsRelations = relations(debitNoteLineItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [debitNoteLineItems.tenantId],
    references: [tenants.id],
  }),
  debitNote: one(debitNotes, {
    fields: [debitNoteLineItems.debitNoteId],
    references: [debitNotes.id],
  }),
  account: one(accounts, {
    fields: [debitNoteLineItems.accountId],
    references: [accounts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pushSubscriptions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const pushNotificationLogRelations = relations(pushNotificationLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pushNotificationLog.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [pushNotificationLog.userId],
    references: [users.id],
  }),
  subscription: one(pushSubscriptions, {
    fields: [pushNotificationLog.subscriptionId],
    references: [pushSubscriptions.id],
  }),
}));
