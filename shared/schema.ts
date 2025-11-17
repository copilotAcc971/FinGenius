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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts, {
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  openingBalance: decimalString,
}).omit({
  id: true,
  code: true,
  currentBalance: true, // Omit from insert, will be set by backend
  tenantId: true,
  createdAt: true,
  updatedAt: true,
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
  
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
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

// Cash Flow Report (Simplified)
export const cashFlowSectionSchema = z.object({
  accounts: z.array(reportAccountLineSchema),
  total: z.string(),
});

export type CashFlowSection = z.infer<typeof cashFlowSectionSchema>;

export const cashFlowReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  
  // Operating activities (revenue and expenses)
  operatingActivities: cashFlowSectionSchema,
  
  // Investing activities (asset purchases/sales)
  investingActivities: cashFlowSectionSchema,
  
  // Financing activities (equity, loans)
  financingActivities: cashFlowSectionSchema,
  
  // Net cash flow
  netCashFlow: z.string(),
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
