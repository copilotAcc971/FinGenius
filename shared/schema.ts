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
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantCompanyProfileSchema = createInsertSchema(tenantCompanyProfiles, {
  legalName: z.string().min(1, "Legal name is required"),
  taxRegistrationNumber: z.string().min(1, "Tax registration number is required"),
  address: addressSchema.optional(),
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
  subtype: varchar("subtype", { length: 100 }), // e.g., current_asset, fixed_asset
  parentId: varchar("parent_id"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Helper to preprocess decimal values (accept both string and number)
const decimalString = z.preprocess(
  (val) => (typeof val === 'number' ? val.toString() : val),
  z.string()
);

// Items/Products
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }),
  rate: decimal("rate", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  type: varchar("type", { length: 50 }).notNull(),
  accountId: varchar("account_id").references(() => accounts.id),
  taxId: varchar("tax_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertItemSchema = createInsertSchema(items, {
  rate: decimalString,
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
  
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
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

// Bills (Purchases from Vendors)
export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  billNumber: varchar("bill_number", { length: 100 }).notNull(),
  billDate: timestamp("bill_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("unpaid"), // unpaid, scheduled, paid, overdue, cancelled
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  documentUrl: varchar("document_url", { length: 500 }), // uploaded document
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBillSchema = createInsertSchema(bills, {
  subtotal: decimalString,
  taxAmount: decimalString,
  total: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, paid, rejected
  documentUrl: varchar("document_url", { length: 500 }), // uploaded receipt
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, scheduled, processing, completed, failed
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  stripeTransferId: varchar("stripe_transfer_id", { length: 255 }), // Stripe transfer/payout ID
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  failureReason: text("failure_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments, {
  amount: decimalString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

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
  taxId: varchar("tax_id").references(() => taxes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCreditNoteLineItemSchema = createInsertSchema(creditNoteLineItems, {
  quantity: decimalString,
  unitPrice: decimalString,
  discount: decimalString,
  amount: decimalString,
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
  notes: text("notes"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_payment_number_tenant").on(table.tenantId, table.paymentNumber),
]);

export const insertCustomerPaymentSchema = createInsertSchema(customerPayments, {
  amount: decimalString,
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

// Retainer Invoices (Advance Payment Invoices)
export const retainerInvoices = pgTable("retainer_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  retainerNumber: varchar("retainer_number", { length: 100 }),
  
  retainerDate: timestamp("retainer_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, paid, partially_used, fully_used, cancelled
  
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceRemaining: decimal("balance_remaining", { precision: 12, scale: 2 }).notNull(),
  
  notes: text("notes"),
  
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_retainer_number_tenant").on(table.tenantId, table.retainerNumber),
]);

export const insertRetainerInvoiceSchema = createInsertSchema(retainerInvoices, {
  amount: decimalString,
  balanceRemaining: decimalString,
}).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  retainerNumber: z.string().max(100).optional(),
});

export type InsertRetainerInvoice = z.infer<typeof insertRetainerInvoiceSchema>;
export type RetainerInvoice = typeof retainerInvoices.$inferSelect;

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
