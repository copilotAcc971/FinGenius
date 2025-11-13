import {
  users,
  tenants,
  tenantMembers,
  tenantCompanyProfiles,
  customers,
  vendors,
  accounts,
  items,
  taxes,
  invoices,
  invoiceLineItems,
  invoiceSequences,
  invoiceAuditLogs,
  bills,
  billLineItems,
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderSequences,
  expenses,
  payments,
  documents,
  quotes,
  quoteLineItems,
  salesOrders,
  salesOrderLineItems,
  creditNotes,
  creditNoteLineItems,
  customerPayments,
  customerPaymentSequences,
  recurringInvoices,
  recurringInvoiceLineItems,
  retainerInvoices,
  retainerInvoiceLineItems,
  journalEntries,
  journalEntryLegs,
  journalEntrySequences,
  assets,
  assetDepreciationSchedules,
  assetSequences,
  accountSequences,
  bankReconciliations,
  bankReconciliationItems,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type TenantCompanyProfile,
  type InsertTenantCompanyProfile,
  type Customer,
  type InsertCustomer,
  type Vendor,
  type InsertVendor,
  type Account,
  type InsertAccount,
  type Item,
  type InsertItem,
  type Tax,
  type InsertTax,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type InvoicePayload,
  type InsertInvoiceAuditLog,
  type Bill,
  type InsertBill,
  type BillLineItem,
  type InsertBillLineItem,
  type BillPayload,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderLineItem,
  type InsertPurchaseOrderLineItem,
  type PurchaseOrderPayload,
  type Expense,
  type InsertExpense,
  type Payment,
  type InsertPayment,
  type Document,
  type InsertDocument,
  type Quote,
  type InsertQuote,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type SalesOrder,
  type InsertSalesOrder,
  type SalesOrderLineItem,
  type InsertSalesOrderLineItem,
  type CreditNote,
  type InsertCreditNote,
  type CreditNoteLineItem,
  type InsertCreditNoteLineItem,
  type CustomerPayment,
  type InsertCustomerPayment,
  type RecurringInvoice,
  type InsertRecurringInvoice,
  type RecurringInvoiceLineItem,
  type InsertRecurringInvoiceLineItem,
  type RetainerInvoice,
  type InsertRetainerInvoice,
  type RetainerInvoiceLineItem,
  type InsertRetainerInvoiceLineItem,
  type JournalEntry,
  type InsertJournalEntry,
  type JournalEntryLeg,
  type InsertJournalEntryLeg,
  type JournalEntryPayload,
  type Asset,
  type InsertAsset,
  type AssetDepreciationSchedule,
  type InsertAssetDepreciationSchedule,
  type BankReconciliation,
  type InsertBankReconciliation,
  type BankReconciliationItem,
  type InsertBankReconciliationItem,
  type BankReconciliationPayload,
  type ProfitLossReport,
  type BalanceSheetReport,
  type TrialBalanceReport,
  type CashFlowReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ne, isNull, sum, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantsByUserId(userId: string): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, userId: string, tenant: Partial<InsertTenant>): Promise<Tenant>;
  isTenantMember(tenantId: string, userId: string): Promise<boolean>;

  // Company Profile operations
  getCompanyProfile(tenantId: string): Promise<TenantCompanyProfile | null>;
  createCompanyProfile(profile: InsertTenantCompanyProfile): Promise<TenantCompanyProfile>;
  updateCompanyProfile(tenantId: string, data: Partial<Omit<InsertTenantCompanyProfile, 'tenantId'>>): Promise<TenantCompanyProfile>;

  // Customer operations
  getCustomersByTenant(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerById(id: string, tenantId: string): Promise<Customer | null>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, tenantId: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string, tenantId: string): Promise<void>;

  // Vendor operations
  getVendorsByTenant(tenantId: string): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, tenantId: string, vendor: Partial<InsertVendor>): Promise<Vendor>;
  deleteVendor(id: string, tenantId: string): Promise<void>;

  // Account operations
  getAccounts(tenantId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount & { tenantId: string }): Promise<Account>;
  updateAccount(id: string, tenantId: string, account: Partial<InsertAccount>): Promise<Account>;
  deleteAccount(id: string, tenantId: string): Promise<void>;
  getNextAccountNumber(tenantId: string): Promise<string>;

  // Item operations
  getItems(tenantId: string): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem & { tenantId: string }): Promise<Item>;
  updateItem(id: string, tenantId: string, item: Partial<InsertItem>): Promise<Item>;
  deleteItem(id: string, tenantId: string): Promise<void>;

  // Tax operations
  getTaxes(tenantId: string): Promise<Tax[]>;
  getTax(id: string): Promise<Tax | undefined>;
  createTax(tax: InsertTax & { tenantId: string }): Promise<Tax>;
  updateTax(id: string, tenantId: string, tax: Partial<InsertTax>): Promise<Tax>;
  deleteTax(id: string, tenantId: string): Promise<void>;

  // Invoice operations
  getInvoicesByTenant(tenantId: string, includeDeleted?: boolean): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceById(id: string, tenantId: string): Promise<Invoice | null>;
  getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]>;
  getInvoiceLineItemsWithTax(invoiceId: string, tenantId: string): Promise<Array<{
    id: string;
    description: string;
    quantity: string;
    rate: string;
    amount: string;
    discount: string | null;
    taxName: string | null;
    taxRate: string | null;
  }>>;
  createInvoiceWithItems(payload: InvoicePayload): Promise<Invoice>;
  updateInvoice(id: string, tenantId: string, data: Partial<InsertInvoice>): Promise<Invoice>;
  updateInvoiceWithItems(id: string, tenantId: string, payload: InvoicePayload): Promise<Invoice>;
  deleteInvoice(id: string, tenantId: string): Promise<boolean>;
  
  // Invoice sequencing
  getNextInvoiceNumber(tenantId: string): Promise<string>;
  
  // Audit logging
  logInvoiceAudit(log: InsertInvoiceAuditLog): Promise<void>;

  // Bill operations
  getBillsByTenant(tenantId: string): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  getBillById(id: string, tenantId: string): Promise<Bill | null>;
  getBillLineItems(billId: string): Promise<BillLineItem[]>;
  createBillWithItems(payload: BillPayload, tenantId: string): Promise<Bill>;
  updateBillWithItems(id: string, tenantId: string, payload: BillPayload): Promise<Bill>;
  deleteBill(id: string, tenantId: string): Promise<void>;

  // Purchase Order operations
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderLineItems(purchaseOrderId: string, tenantId: string): Promise<PurchaseOrderLineItem[]>;
  createPurchaseOrderWithItems(payload: PurchaseOrderPayload): Promise<PurchaseOrder>;
  updatePurchaseOrderWithItems(id: string, tenantId: string, payload: PurchaseOrderPayload): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: string, tenantId: string): Promise<void>;
  getNextPurchaseOrderNumber(tenantId: string): Promise<string>;

  // Expense operations
  getExpensesByTenant(tenantId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, tenantId: string, expense: Partial<InsertExpense>): Promise<Expense>;

  // Payment operations
  getPaymentsByTenant(tenantId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, tenantId: string, payment: Partial<InsertPayment>): Promise<Payment>;

  // Document operations
  getDocumentsByTenant(tenantId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, tenantId: string, document: Partial<InsertDocument>): Promise<Document>;

  // Quote operations
  getQuotes(tenantId: string): Promise<Quote[]>;
  getQuoteById(id: string, tenantId: string): Promise<Quote | null>;
  createQuote(quote: InsertQuote, lineItems: InsertQuoteLineItem[]): Promise<Quote>;
  updateQuote(id: string, tenantId: string, quote: Partial<InsertQuote>, lineItems?: InsertQuoteLineItem[]): Promise<Quote>;
  deleteQuote(id: string, tenantId: string): Promise<void>;
  getQuoteLineItems(quoteId: string, tenantId: string): Promise<QuoteLineItem[]>;
  convertQuoteToInvoice(quoteId: string, tenantId: string): Promise<Invoice>;

  // Sales Order operations
  getSalesOrders(tenantId: string): Promise<SalesOrder[]>;
  getSalesOrderById(id: string, tenantId: string): Promise<SalesOrder | null>;
  createSalesOrder(order: InsertSalesOrder, lineItems: InsertSalesOrderLineItem[]): Promise<SalesOrder>;
  updateSalesOrder(id: string, tenantId: string, order: Partial<InsertSalesOrder>, lineItems?: InsertSalesOrderLineItem[]): Promise<SalesOrder>;
  deleteSalesOrder(id: string, tenantId: string): Promise<void>;
  getSalesOrderLineItems(salesOrderId: string, tenantId: string): Promise<SalesOrderLineItem[]>;
  convertSalesOrderToInvoice(salesOrderId: string, tenantId: string): Promise<Invoice>;

  // Credit Note operations
  getCreditNotes(tenantId: string): Promise<CreditNote[]>;
  getCreditNoteById(id: string, tenantId: string): Promise<CreditNote | null>;
  createCreditNote(note: InsertCreditNote, lineItems: InsertCreditNoteLineItem[]): Promise<CreditNote>;
  updateCreditNote(id: string, tenantId: string, note: Partial<InsertCreditNote>, lineItems?: InsertCreditNoteLineItem[]): Promise<CreditNote>;
  deleteCreditNote(id: string, tenantId: string): Promise<void>;
  getCreditNoteLineItems(noteId: string, tenantId: string): Promise<CreditNoteLineItem[]>;
  applyCreditNoteToInvoice(noteId: string, invoiceId: string, amount: string, tenantId: string): Promise<void>;

  // Customer Payment operations
  getCustomerPayments(tenantId: string): Promise<CustomerPayment[]>;
  getCustomerPaymentById(id: string, tenantId: string): Promise<CustomerPayment | null>;
  createCustomerPayment(payment: InsertCustomerPayment): Promise<CustomerPayment>;
  updateCustomerPayment(id: string, tenantId: string, payment: Partial<InsertCustomerPayment>): Promise<CustomerPayment>;
  deleteCustomerPayment(id: string, tenantId: string): Promise<void>;
  getNextCustomerPaymentNumber(tenantId: string): Promise<string>;

  // Recurring Invoice operations
  getRecurringInvoices(tenantId: string): Promise<RecurringInvoice[]>;
  getRecurringInvoiceById(id: string, tenantId: string): Promise<RecurringInvoice | null>;
  createRecurringInvoice(data: InsertRecurringInvoice, lineItems: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice>;
  updateRecurringInvoice(id: string, tenantId: string, data: Partial<InsertRecurringInvoice>, lineItems?: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice>;
  deleteRecurringInvoice(id: string, tenantId: string): Promise<void>;
  getRecurringInvoiceLineItems(recurringInvoiceId: string, tenantId: string): Promise<RecurringInvoiceLineItem[]>;
  generateInvoiceFromRecurring(recurringId: string, tenantId: string): Promise<Invoice>;
  processRecurringInvoices(tenantId: string): Promise<Invoice[]>;

  // Retainer Invoice operations
  getRetainerInvoices(tenantId: string): Promise<RetainerInvoice[]>;
  getRetainerInvoiceById(id: string, tenantId: string): Promise<RetainerInvoice | null>;
  createRetainerInvoice(data: InsertRetainerInvoice, lineItems: InsertRetainerInvoiceLineItem[]): Promise<RetainerInvoice>;
  updateRetainerInvoice(id: string, tenantId: string, data: Partial<InsertRetainerInvoice>, lineItems?: InsertRetainerInvoiceLineItem[]): Promise<RetainerInvoice>;
  deleteRetainerInvoice(id: string, tenantId: string): Promise<void>;
  getRetainerInvoiceLineItems(retainerInvoiceId: string, tenantId: string): Promise<RetainerInvoiceLineItem[]>;
  getNextRetainerNumber(tenantId: string): Promise<string>;

  // Journal Entry operations
  getJournalEntries(tenantId: string): Promise<JournalEntry[]>;
  getJournalEntry(id: string): Promise<JournalEntry | undefined>;
  getJournalEntryLegs(journalEntryId: string, tenantId: string): Promise<JournalEntryLeg[]>;
  createJournalEntryWithLegs(payload: JournalEntryPayload): Promise<JournalEntry>;
  updateJournalEntryWithLegs(id: string, tenantId: string, payload: JournalEntryPayload): Promise<JournalEntry>;
  deleteJournalEntry(id: string, tenantId: string): Promise<void>;
  getNextJournalEntryNumber(tenantId: string): Promise<string>;

  // Asset operations
  getAssets(tenantId: string): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  getAssetDepreciationSchedules(assetId: string, tenantId: string): Promise<AssetDepreciationSchedule[]>;
  createAsset(asset: InsertAsset & { tenantId: string }): Promise<Asset>;
  updateAsset(id: string, tenantId: string, asset: Partial<InsertAsset>): Promise<Asset>;
  deleteAsset(id: string, tenantId: string): Promise<void>;
  getNextAssetNumber(tenantId: string): Promise<string>;

  // Bank Reconciliation operations
  getBankReconciliations(tenantId: string): Promise<BankReconciliation[]>;
  getBankReconciliation(id: string): Promise<BankReconciliation | undefined>;
  getBankReconciliationItems(reconciliationId: string, tenantId: string): Promise<BankReconciliationItem[]>;
  createBankReconciliationWithItems(payload: BankReconciliationPayload): Promise<BankReconciliation>;
  updateBankReconciliationWithItems(id: string, tenantId: string, payload: BankReconciliationPayload): Promise<BankReconciliation>;
  deleteBankReconciliation(id: string, tenantId: string): Promise<void>;
  matchReconciliationItem(itemId: string, journalEntryId: string, tenantId: string): Promise<void>;

  // Financial Reports (READ-ONLY)
  getProfitLossReport(tenantId: string, startDate: Date, endDate: Date): Promise<ProfitLossReport>;
  getBalanceSheetReport(tenantId: string, asOfDate: Date): Promise<BalanceSheetReport>;
  getTrialBalanceReport(tenantId: string, asOfDate: Date): Promise<TrialBalanceReport>;
  getCashFlowReport(tenantId: string, startDate: Date, endDate: Date): Promise<CashFlowReport>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantsByUserId(userId: string): Promise<Tenant[]> {
    const userTenants = await db
      .select({ tenant: tenants })
      .from(tenants)
      .where(eq(tenants.ownerId, userId));
    
    return userTenants.map(t => t.tenant);
  }

  async createTenant(tenantData: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(tenantData)
      .returning();
    
    await db.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: tenantData.ownerId,
      role: "owner",
    });
    
    return tenant;
  }

  async updateTenant(id: string, userId: string, tenantData: Partial<InsertTenant>): Promise<Tenant> {
    const tenant = await this.getTenant(id);
    if (!tenant || tenant.ownerId !== userId) {
      throw new Error("Tenant not found");
    }
    
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...tenantData, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }

  async isTenantMember(tenantId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, userId)
        )
      )
      .limit(1);
    
    return !!member;
  }

  // Company Profile operations
  async getCompanyProfile(tenantId: string): Promise<TenantCompanyProfile | null> {
    const [profile] = await db
      .select()
      .from(tenantCompanyProfiles)
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .limit(1);
    
    return profile || null;
  }

  async createCompanyProfile(profileData: InsertTenantCompanyProfile): Promise<TenantCompanyProfile> {
    const [profile] = await db
      .insert(tenantCompanyProfiles)
      .values(profileData)
      .returning();
    return profile;
  }

  async updateCompanyProfile(
    tenantId: string,
    data: Partial<Omit<InsertTenantCompanyProfile, 'tenantId'>>
  ): Promise<TenantCompanyProfile> {
    const existing = await this.getCompanyProfile(tenantId);
    if (!existing) {
      throw new Error("Company profile not found");
    }
    
    const [updatedProfile] = await db
      .update(tenantCompanyProfiles)
      .set({
        ...data,
        // SECURITY: Never allow tenantId to be overwritten
        // Explicitly exclude it from the update
        updatedAt: new Date(),
      })
      .where(eq(tenantCompanyProfiles.tenantId, tenantId))
      .returning();
    
    if (!updatedProfile) {
      throw new Error("Company profile not found");
    }
    
    return updatedProfile;
  }

  // Customer operations
  async getCustomersByTenant(tenantId: string): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerById(id: string, tenantId: string): Promise<Customer | null> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId)
        )
      )
      .limit(1);
    
    return customer || null;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(customerData)
      .returning();
    return customer;
  }

  async updateCustomer(id: string, tenantId: string, customerData: Partial<InsertCustomer>): Promise<Customer> {
    const customer = await this.getCustomer(id);
    if (!customer || customer.tenantId !== tenantId) {
      throw new Error("Customer not found");
    }
    
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string, tenantId: string): Promise<void> {
    const customer = await this.getCustomer(id);
    if (!customer || customer.tenantId !== tenantId) {
      throw new Error("Customer not found");
    }
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Vendor operations
  async getVendorsByTenant(tenantId: string): Promise<Vendor[]> {
    return await db
      .select()
      .from(vendors)
      .where(eq(vendors.tenantId, tenantId))
      .orderBy(desc(vendors.createdAt));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor;
  }

  async createVendor(vendorData: InsertVendor): Promise<Vendor> {
    const [vendor] = await db
      .insert(vendors)
      .values(vendorData)
      .returning();
    return vendor;
  }

  async updateVendor(id: string, tenantId: string, vendorData: Partial<InsertVendor>): Promise<Vendor> {
    const vendor = await this.getVendor(id);
    if (!vendor || vendor.tenantId !== tenantId) {
      throw new Error("Vendor not found");
    }
    
    const [updatedVendor] = await db
      .update(vendors)
      .set({ ...vendorData, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: string, tenantId: string): Promise<void> {
    const vendor = await this.getVendor(id);
    if (!vendor || vendor.tenantId !== tenantId) {
      throw new Error("Vendor not found");
    }
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // Account operations
  async getAccounts(tenantId: string): Promise<Account[]> {
    return await db
      .select()
      .from(accounts)
      .where(eq(accounts.tenantId, tenantId))
      .orderBy(desc(accounts.createdAt));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(accountData: InsertAccount & { tenantId: string }): Promise<Account> {
    // Generate account code
    const accountCode = await this.getNextAccountNumber(accountData.tenantId);
    
    const newAccount = {
      ...accountData,
      currentBalance: "0", // Always start at 0 for new accounts
      code: accountCode,
    };
    
    const [account] = await db
      .insert(accounts)
      .values(newAccount)
      .returning();
    return account;
  }

  async updateAccount(id: string, tenantId: string, accountData: Partial<InsertAccount>): Promise<Account> {
    const account = await this.getAccount(id);
    if (!account || account.tenantId !== tenantId) {
      throw new Error("Account not found");
    }
    
    const [updatedAccount] = await db
      .update(accounts)
      .set({ ...accountData, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId)))
      .returning();
    return updatedAccount;
  }

  async deleteAccount(id: string, tenantId: string): Promise<void> {
    const account = await this.getAccount(id);
    if (!account || account.tenantId !== tenantId) {
      throw new Error("Account not found");
    }
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId)));
  }

  async getNextAccountNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence (transaction provides basic isolation)
      let [sequence] = await tx
        .select()
        .from(accountSequences)
        .where(eq(accountSequences.tenantId, tenantId))
        .limit(1);
      
      if (!sequence) {
        // Create initial sequence
        [sequence] = await tx
          .insert(accountSequences)
          .values({
            tenantId,
            lastNumber: 1,
            prefix: "ACC-",
          })
          .returning();
        
        return `${sequence.prefix}${String(sequence.lastNumber).padStart(4, '0')}`;
      }
      
      // Increment sequence
      const nextNumber = sequence.lastNumber + 1;
      await tx
        .update(accountSequences)
        .set({ 
          lastNumber: nextNumber,
          updatedAt: new Date(),
        })
        .where(eq(accountSequences.tenantId, tenantId));
      
      return `${sequence.prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  // Item operations
  async getItems(tenantId: string): Promise<Item[]> {
    return await db
      .select()
      .from(items)
      .where(eq(items.tenantId, tenantId))
      .orderBy(desc(items.createdAt));
  }

  async getItem(id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(itemData: InsertItem & { tenantId: string }): Promise<Item> {
    const [item] = await db
      .insert(items)
      .values(itemData)
      .returning();
    return item;
  }

  async updateItem(id: string, tenantId: string, itemData: Partial<InsertItem>): Promise<Item> {
    const item = await this.getItem(id);
    if (!item || item.tenantId !== tenantId) {
      throw new Error("Item not found");
    }
    
    const [updatedItem] = await db
      .update(items)
      .set({ ...itemData, updatedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.tenantId, tenantId)))
      .returning();
    return updatedItem;
  }

  async deleteItem(id: string, tenantId: string): Promise<void> {
    const item = await this.getItem(id);
    if (!item || item.tenantId !== tenantId) {
      throw new Error("Item not found");
    }
    await db.delete(items).where(and(eq(items.id, id), eq(items.tenantId, tenantId)));
  }

  // Tax operations
  async getTaxes(tenantId: string): Promise<Tax[]> {
    return await db
      .select()
      .from(taxes)
      .where(eq(taxes.tenantId, tenantId));
  }

  async getTax(id: string): Promise<Tax | undefined> {
    const [tax] = await db.select().from(taxes).where(eq(taxes.id, id));
    return tax;
  }

  async createTax(taxData: InsertTax & { tenantId: string }): Promise<Tax> {
    return await db.transaction(async (tx) => {
      // If setting this tax as default, clear other defaults first
      if (taxData.isDefault === true) {
        await tx
          .update(taxes)
          .set({ isDefault: false })
          .where(eq(taxes.tenantId, taxData.tenantId));
      }
      
      // Now create the new tax
      const [tax] = await tx
        .insert(taxes)
        .values(taxData)
        .returning();
      
      return tax;
    });
  }

  async updateTax(id: string, tenantId: string, taxData: Partial<InsertTax>): Promise<Tax> {
    return await db.transaction(async (tx) => {
      // Verify tax exists and belongs to tenant
      const [tax] = await tx
        .select()
        .from(taxes)
        .where(and(eq(taxes.id, id), eq(taxes.tenantId, tenantId)))
        .limit(1);
      
      if (!tax) {
        throw new Error("Tax not found");
      }
      
      // If setting this tax as default, clear other defaults first
      if (taxData.isDefault === true) {
        await tx
          .update(taxes)
          .set({ isDefault: false })
          .where(and(
            eq(taxes.tenantId, tenantId),
            ne(taxes.id, id)
          ));
      }
      
      // Now update this tax
      const [updatedTax] = await tx
        .update(taxes)
        .set(taxData)
        .where(and(eq(taxes.id, id), eq(taxes.tenantId, tenantId)))
        .returning();
      
      if (!updatedTax) {
        throw new Error("Tax not found");
      }
      
      return updatedTax;
    });
  }

  async deleteTax(id: string, tenantId: string): Promise<void> {
    const tax = await this.getTax(id);
    if (!tax || tax.tenantId !== tenantId) {
      throw new Error("Tax not found");
    }
    await db.delete(taxes).where(and(eq(taxes.id, id), eq(taxes.tenantId, tenantId)));
  }

  // Invoice operations
  async getInvoicesByTenant(tenantId: string, includeDeleted: boolean = false): Promise<Invoice[]> {
    const conditions = [eq(invoices.tenantId, tenantId)];
    
    if (!includeDeleted) {
      conditions.push(isNull(invoices.deletedAt));
    }
    
    return await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.invoiceDate));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceById(id: string, tenantId: string): Promise<Invoice | null> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1);
    
    return invoice || null;
  }

  async getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]> {
    const result = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.tenantId, tenantId)
        )
      );
    return result;
  }

  async getInvoiceLineItemsWithTax(invoiceId: string, tenantId: string): Promise<Array<{
    id: string;
    description: string;
    quantity: string;
    rate: string;
    amount: string;
    discount: string | null;
    taxName: string | null;
    taxRate: string | null;
  }>> {
    const result = await db
      .select({
        id: invoiceLineItems.id,
        description: invoiceLineItems.description,
        quantity: invoiceLineItems.quantity,
        rate: invoiceLineItems.unitPrice,
        amount: invoiceLineItems.amount,
        discount: invoiceLineItems.discount,
        taxName: taxes.name,
        taxRate: taxes.rate,
      })
      .from(invoiceLineItems)
      .leftJoin(taxes, eq(invoiceLineItems.taxId, taxes.id))
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.tenantId, tenantId)
        )
      );
    return result;
  }

  async createInvoiceWithItems(payload: InvoicePayload): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      // Validate tenantId exists
      const tenantId = payload.invoice.tenantId;
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }
      
      const customer = await tx.select().from(customers)
        .where(and(
          eq(customers.id, payload.invoice.customerId),
          eq(customers.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!customer.length) {
        throw new Error("Customer not found or doesn't belong to this tenant");
      }
      
      // ALWAYS generate invoice number server-side (ignore client-provided value)
      const invoiceNumber = await this.getNextInvoiceNumber(tenantId);
      
      // Automatically populate customerTaxId from customer's taxRegistrationNumber
      const customerTaxId = customer[0].taxRegistrationNumber || null;
      
      const [invoice] = await tx
        .insert(invoices)
        .values({
          ...payload.invoice,
          tenantId,
          invoiceNumber,
          // Ensure new Phase 1-3 fields are persisted
          invoiceSubject: payload.invoice.invoiceSubject,
          issuerTaxId: payload.invoice.issuerTaxId,
          // Use customer's TRN for tax compliance
          customerTaxId,
        })
        .returning();
      
      if (payload.lineItems.length > 0) {
        const lineItemsWithInvoiceId = payload.lineItems.map(item => ({
          ...item,
          invoiceId: invoice.id,
          tenantId,
          // Ensure new Phase 1-3 fields are persisted
          itemId: item.itemId,
          discount: item.discount || "0",
          taxId: item.taxId,
        }));
        await tx.insert(invoiceLineItems).values(lineItemsWithInvoiceId);
      }
      
      // Log creation with full invoice data
      await tx.insert(invoiceAuditLogs).values({
        tenantId,
        invoiceId: invoice.id,
        userId: null,
        action: "created",
        changes: {
          after: invoice,
          lineItemsCount: payload.lineItems.length,
        },
      });
      
      return invoice;
    });
  }

  async updateInvoice(id: string, tenantId: string, data: Partial<InsertInvoice>): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id, tenantId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    
    if (!updatedInvoice) {
      throw new Error("Invoice not found");
    }
    
    return updatedInvoice;
  }

  async updateInvoiceWithItems(id: string, tenantId: string, payload: InvoicePayload): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      // Fetch BEFORE state
      const [existingInvoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.tenantId, tenantId),
            isNull(invoices.deletedAt)
          )
        )
        .limit(1);
      
      if (!existingInvoice) {
        throw new Error("Invoice not found or has been deleted");
      }
      
      const customer = await tx.select().from(customers)
        .where(and(
          eq(customers.id, payload.invoice.customerId),
          eq(customers.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!customer.length) {
        throw new Error("Customer not found or doesn't belong to this tenant");
      }
      
      const { tenantId: _, ...safeInvoiceData } = payload.invoice;
      
      // Automatically populate customerTaxId from customer's taxRegistrationNumber
      const customerTaxId = customer[0].taxRegistrationNumber || null;
      
      // Update invoice
      const [updatedInvoice] = await tx
        .update(invoices)
        .set({ 
          ...safeInvoiceData,
          tenantId: existingInvoice.tenantId,
          // Ensure new Phase 1-3 fields are persisted
          invoiceSubject: payload.invoice.invoiceSubject,
          issuerTaxId: payload.invoice.issuerTaxId,
          // Use customer's TRN for tax compliance
          customerTaxId,
          updatedAt: new Date() 
        })
        .where(eq(invoices.id, id))
        .returning();
      
      if (!updatedInvoice) {
        throw new Error("Invoice was deleted during update");
      }
      
      await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
      
      if (payload.lineItems.length > 0) {
        const lineItemsWithInvoiceId = payload.lineItems.map(item => ({
          ...item,
          invoiceId: id,
          tenantId: existingInvoice.tenantId,
          // Ensure new Phase 1-3 fields are persisted
          itemId: item.itemId,
          discount: item.discount || "0",
          taxId: item.taxId,
        }));
        await tx.insert(invoiceLineItems).values(lineItemsWithInvoiceId);
      }
      
      // Log update with before/after
      await tx.insert(invoiceAuditLogs).values({
        tenantId: existingInvoice.tenantId,
        invoiceId: id,
        userId: null,
        action: "updated",
        changes: {
          before: existingInvoice,
          after: updatedInvoice,
        },
      });
      
      return updatedInvoice;
    });
  }

  async deleteInvoice(id: string, tenantId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Use getInvoiceById which filters soft-deleted invoices
      const existingInvoice = await this.getInvoiceById(id, tenantId);
      
      if (!existingInvoice) {
        // Already deleted or doesn't exist
        return false;
      }
      
      // Soft delete
      await tx
        .update(invoices)
        .set({ deletedAt: new Date() })
        .where(eq(invoices.id, id));
      
      // Log deletion with before state
      await tx.insert(invoiceAuditLogs).values({
        tenantId,
        invoiceId: id,
        userId: null,
        action: "deleted",
        changes: {
          before: existingInvoice,
        },
      });
      
      return true;
    });
  }

  // Bill operations
  async getBillsByTenant(tenantId: string): Promise<Bill[]> {
    return await db
      .select()
      .from(bills)
      .where(eq(bills.tenantId, tenantId))
      .orderBy(desc(bills.billDate));
  }

  async getBill(id: string): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill;
  }

  async getBillById(id: string, tenantId: string): Promise<Bill | null> {
    const [bill] = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.tenantId, tenantId)
        )
      )
      .limit(1);
    
    return bill || null;
  }

  async getBillLineItems(billId: string): Promise<BillLineItem[]> {
    return await db
      .select()
      .from(billLineItems)
      .where(eq(billLineItems.billId, billId));
  }

  async createBillWithItems(payload: BillPayload, tenantId: string): Promise<Bill> {
    return await db.transaction(async (tx) => {
      const vendor = await tx.select().from(vendors)
        .where(and(
          eq(vendors.id, payload.bill.vendorId),
          eq(vendors.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!vendor.length) {
        throw new Error("Vendor not found or doesn't belong to this tenant");
      }

      // Auto-generate bill number
      const lastBill = await tx
        .select({ billNumber: bills.billNumber })
        .from(bills)
        .where(eq(bills.tenantId, tenantId))
        .orderBy(desc(bills.billNumber))
        .limit(1);
      
      const nextNumber = lastBill.length > 0 
        ? parseInt(lastBill[0].billNumber.split('-')[1]) + 1 
        : 1;
      const billNumber = `BILL-${String(nextNumber).padStart(4, '0')}`;
      
      // SERVER-SIDE CALCULATIONS - NEVER trust client totals
      let subtotal = 0;
      let taxAmount = 0;
      
      // Calculate from line items
      for (const item of payload.lineItems) {
        const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += lineAmount;
        
        // Fetch tax rate from database if taxId provided
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (lineAmount * taxRate / 100);
          }
        }
      }
      
      const total = subtotal + taxAmount;
      
      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safeBillData } = payload.bill;
      
      // Create bill with SERVER-CALCULATED totals (ignore client values)
      const [newBill] = await tx.insert(bills).values({
        ...safeBillData,
        tenantId: tenantId, // FORCE server tenantId
        billNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      }).returning();
      
      // Insert line items with calculated amounts
      if (payload.lineItems.length > 0) {
        const lineItemsWithAmounts = payload.lineItems.map(item => {
          // SECURITY: Strip tenantId from payload, FORCE server tenantId
          const { tenantId: _itemTenantId, ...safeItemData } = item;
          return {
            ...safeItemData,
            billId: newBill.id,
            tenantId: tenantId, // FORCE server tenantId
            amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
          };
        });
        
        await tx.insert(billLineItems).values(lineItemsWithAmounts);
      }
      
      return newBill;
    });
  }

  async updateBillWithItems(id: string, tenantId: string, payload: BillPayload): Promise<Bill> {
    const bill = await this.getBill(id);
    if (!bill || bill.tenantId !== tenantId) {
      throw new Error("Bill not found");
    }
    
    return await db.transaction(async (tx) => {
      const vendor = await tx.select().from(vendors)
        .where(and(
          eq(vendors.id, payload.bill.vendorId),
          eq(vendors.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!vendor.length) {
        throw new Error("Vendor not found or doesn't belong to this tenant");
      }
      
      // SERVER-SIDE CALCULATIONS - NEVER trust client totals
      let subtotal = 0;
      let taxAmount = 0;
      
      // Calculate from line items
      for (const item of payload.lineItems) {
        const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += lineAmount;
        
        // Fetch tax rate from database if taxId provided
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (lineAmount * taxRate / 100);
          }
        }
      }
      
      const total = subtotal + taxAmount;
      
      // STRIP tenantId from payload - NEVER trust client
      const { tenantId: _, ...safeBillData } = payload.bill;
      
      // Update bill with SERVER-CALCULATED totals (ignore client values)
      const [updatedBill] = await tx
        .update(bills)
        .set({ 
          ...safeBillData,
          tenantId: bill.tenantId,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          updatedAt: new Date() 
        })
        .where(eq(bills.id, id))
        .returning();
      
      if (!updatedBill) {
        throw new Error("Bill was deleted during update");
      }
      
      // Delete old line items
      await tx.delete(billLineItems).where(eq(billLineItems.billId, id));
      
      // Insert new line items with calculated amounts
      if (payload.lineItems.length > 0) {
        const lineItemsWithAmounts = payload.lineItems.map(item => {
          // SECURITY: Strip tenantId from payload, FORCE server tenantId
          const { tenantId: _itemTenantId, ...safeItemData } = item;
          return {
            ...safeItemData,
            billId: id,
            tenantId: bill.tenantId, // FORCE server tenantId
            amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
          };
        });
        await tx.insert(billLineItems).values(lineItemsWithAmounts);
      }
      
      return updatedBill;
    });
  }

  async deleteBill(id: string, tenantId: string): Promise<void> {
    const bill = await this.getBill(id);
    if (!bill || bill.tenantId !== tenantId) {
      throw new Error("Bill not found");
    }
    
    await db.transaction(async (tx) => {
      await tx.delete(billLineItems).where(eq(billLineItems.billId, id));
      await tx.delete(bills).where(eq(bills.id, id));
    });
  }

  // Purchase Order operations
  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
    return await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          isNull(purchaseOrders.deletedAt)
        )
      )
      .orderBy(desc(purchaseOrders.orderDate));
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          isNull(purchaseOrders.deletedAt)
        )
      );
    return po;
  }

  async getPurchaseOrderLineItems(purchaseOrderId: string, tenantId: string): Promise<PurchaseOrderLineItem[]> {
    return await db
      .select()
      .from(purchaseOrderLineItems)
      .where(
        and(
          eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId),
          eq(purchaseOrderLineItems.tenantId, tenantId)
        )
      );
  }

  async createPurchaseOrderWithItems(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    // Extract tenantId from payload - it's part of purchaseOrder
    const tenantId = payload.purchaseOrder.tenantId;
    if (!tenantId) {
      throw new Error("tenantId is required");
    }

    return await db.transaction(async (tx) => {
      // Verify vendor belongs to tenant
      const vendor = await tx.select().from(vendors)
        .where(and(
          eq(vendors.id, payload.purchaseOrder.vendorId),
          eq(vendors.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!vendor.length) {
        throw new Error("Vendor not found or doesn't belong to this tenant");
      }

      // Auto-generate PO number using sequences table
      const poNumber = await this.getNextPurchaseOrderNumber(tenantId);
      
      // SERVER-SIDE CALCULATIONS - NEVER trust client totals
      let subtotal = 0;
      let taxAmount = 0;
      
      // Calculate from line items
      for (const item of payload.lineItems) {
        const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += lineAmount;
        
        // Fetch tax rate from database if taxId provided
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (lineAmount * taxRate / 100);
          }
        }
      }
      
      const total = subtotal + taxAmount;
      
      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safePOData } = payload.purchaseOrder;
      
      // Create PO with SERVER-CALCULATED totals (ignore client values)
      const [newPO] = await tx.insert(purchaseOrders).values({
        ...safePOData,
        tenantId: tenantId, // FORCE server tenantId
        poNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      }).returning();
      
      // Insert line items with calculated amounts
      if (payload.lineItems.length > 0) {
        const lineItemsWithAmounts = payload.lineItems.map(item => {
          // SECURITY: Strip tenantId from payload, FORCE server tenantId
          const { tenantId: _itemTenantId, ...safeItemData } = item;
          return {
            ...safeItemData,
            purchaseOrderId: newPO.id,
            tenantId: tenantId, // FORCE server tenantId
            amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
          };
        });
        
        await tx.insert(purchaseOrderLineItems).values(lineItemsWithAmounts);
      }
      
      return newPO;
    });
  }

  async updatePurchaseOrderWithItems(id: string, tenantId: string, payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if (!po || po.tenantId !== tenantId) {
      throw new Error("Purchase Order not found");
    }
    
    return await db.transaction(async (tx) => {
      // Verify vendor belongs to tenant
      const vendor = await tx.select().from(vendors)
        .where(and(
          eq(vendors.id, payload.purchaseOrder.vendorId),
          eq(vendors.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!vendor.length) {
        throw new Error("Vendor not found or doesn't belong to this tenant");
      }
      
      // SERVER-SIDE CALCULATIONS - NEVER trust client totals
      let subtotal = 0;
      let taxAmount = 0;
      
      // Calculate from line items
      for (const item of payload.lineItems) {
        const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += lineAmount;
        
        // Fetch tax rate from database if taxId provided
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (lineAmount * taxRate / 100);
          }
        }
      }
      
      const total = subtotal + taxAmount;
      
      // STRIP tenantId from payload - NEVER trust client
      const { tenantId: _, ...safePOData } = payload.purchaseOrder;
      
      // Update PO with SERVER-CALCULATED totals (ignore client values)
      const [updatedPO] = await tx
        .update(purchaseOrders)
        .set({ 
          ...safePOData,
          tenantId: po.tenantId,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          updatedAt: new Date() 
        })
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
        .returning();
      
      if (!updatedPO) {
        throw new Error("Purchase Order was deleted during update");
      }
      
      // Delete old line items
      await tx.delete(purchaseOrderLineItems).where(eq(purchaseOrderLineItems.purchaseOrderId, id));
      
      // Insert new line items with calculated amounts
      if (payload.lineItems.length > 0) {
        const lineItemsWithAmounts = payload.lineItems.map(item => {
          // SECURITY: Strip tenantId from payload, FORCE server tenantId
          const { tenantId: _itemTenantId, ...safeItemData } = item;
          return {
            ...safeItemData,
            purchaseOrderId: id,
            tenantId: po.tenantId, // FORCE server tenantId
            amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
          };
        });
        await tx.insert(purchaseOrderLineItems).values(lineItemsWithAmounts);
      }
      
      return updatedPO;
    });
  }

  async deletePurchaseOrder(id: string, tenantId: string): Promise<void> {
    const po = await this.getPurchaseOrder(id);
    if (!po || po.tenantId !== tenantId) {
      throw new Error("Purchase Order not found");
    }
    
    // Soft delete
    await db
      .update(purchaseOrders)
      .set({ deletedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
  }

  async getNextPurchaseOrderNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence for this tenant (transaction provides basic isolation)
      let [sequence] = await tx
        .select()
        .from(purchaseOrderSequences)
        .where(eq(purchaseOrderSequences.tenantId, tenantId))
        .limit(1);

      if (!sequence) {
        // Create new sequence starting at 1
        [sequence] = await tx
          .insert(purchaseOrderSequences)
          .values({ tenantId, currentNumber: 1 })
          .returning();
      } else {
        // Increment sequence
        [sequence] = await tx
          .update(purchaseOrderSequences)
          .set({ currentNumber: sequence.currentNumber + 1 })
          .where(eq(purchaseOrderSequences.tenantId, tenantId))
          .returning();
      }

      // Generate PO number: PO-0001, PO-0002, etc.
      return `PO-${String(sequence.currentNumber).padStart(4, '0')}`;
    });
  }

  // Expense operations
  async getExpensesByTenant(tenantId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.tenantId, tenantId))
      .orderBy(desc(expenses.date));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expenseData: InsertExpense): Promise<Expense> {
    const [expense] = await db
      .insert(expenses)
      .values(expenseData)
      .returning();
    return expense;
  }

  async updateExpense(id: string, tenantId: string, expenseData: Partial<InsertExpense>): Promise<Expense> {
    const expense = await this.getExpense(id);
    if (!expense || expense.tenantId !== tenantId) {
      throw new Error("Expense not found");
    }
    
    const [updatedExpense] = await db
      .update(expenses)
      .set({ ...expenseData, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return updatedExpense;
  }

  // Payment operations
  async getPaymentsByTenant(tenantId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(paymentData)
      .returning();
    return payment;
  }

  async updatePayment(id: string, tenantId: string, paymentData: Partial<InsertPayment>): Promise<Payment> {
    const payment = await db.select().from(payments).where(eq(payments.id, id)).then(rows => rows[0]);
    if (!payment || payment.tenantId !== tenantId) {
      throw new Error("Payment not found");
    }
    
    const [updatedPayment] = await db
      .update(payments)
      .set({ ...paymentData, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment;
  }

  // Document operations
  async getDocumentsByTenant(tenantId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.tenantId, tenantId))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async updateDocument(id: string, tenantId: string, documentData: Partial<InsertDocument>): Promise<Document> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    if (!document || document.tenantId !== tenantId) {
      throw new Error("Document not found");
    }
    
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...documentData, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  // Invoice sequencing
  async getNextInvoiceNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence
      let [sequence] = await tx
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.tenantId, tenantId))
        .limit(1);
      
      if (!sequence) {
        // Create initial sequence
        [sequence] = await tx
          .insert(invoiceSequences)
          .values({
            tenantId,
            lastNumber: 1,
            prefix: "INV-",
          })
          .returning();
        
        return `${sequence.prefix}${String(sequence.lastNumber).padStart(4, '0')}`;
      }
      
      // Increment sequence
      const nextNumber = sequence.lastNumber + 1;
      await tx
        .update(invoiceSequences)
        .set({ 
          lastNumber: nextNumber,
          updatedAt: new Date(),
        })
        .where(eq(invoiceSequences.tenantId, tenantId));
      
      return `${sequence.prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  // Audit logging
  async logInvoiceAudit(log: InsertInvoiceAuditLog): Promise<void> {
    await db.insert(invoiceAuditLogs).values(log);
  }

  // Quote operations
  async getQuotes(tenantId: string): Promise<Quote[]> {
    return await db
      .select()
      .from(quotes)
      .where(and(
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ))
      .orderBy(desc(quotes.createdAt));
  }

  async getQuoteById(id: string, tenantId: string): Promise<Quote | null> {
    const results = await db
      .select()
      .from(quotes)
      .where(and(
        eq(quotes.id, id),
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ));
    return results[0] || null;
  }

  async createQuote(quote: InsertQuote, lineItems: InsertQuoteLineItem[]): Promise<Quote> {
    const result = await db.transaction(async (tx) => {
      // Generate quote number if not provided
      let quoteNumber = quote.quoteNumber;
      if (!quoteNumber) {
        const lastQuote = await tx
          .select({ quoteNumber: quotes.quoteNumber })
          .from(quotes)
          .where(eq(quotes.tenantId, quote.tenantId))
          .orderBy(desc(quotes.createdAt))
          .limit(1);
        
        const lastNumber = lastQuote[0]?.quoteNumber;
        const nextNumber = lastNumber 
          ? parseInt(lastNumber.replace('QUO-', '')) + 1 
          : 1;
        quoteNumber = `QUO-${nextNumber.toString().padStart(4, '0')}`;
      }

      // SECURITY: Calculate each line item's amount from quantity, price, discount
      // Don't trust client-provided amounts
      const lineItemsWithCalculatedAmounts = lineItems.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || "0");
        
        // Calculate amount: (quantity * unitPrice) - discount
        const calculatedAmount = (quantity * unitPrice) - discount;
        
        return {
          ...item,
          amount: calculatedAmount.toFixed(2), // Override client amount
        };
      });

      // Calculate subtotal from calculated amounts (not client amounts)
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax from calculated amounts
      const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
        if (!item.taxId) return 0;
        const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
        if (!tax) return 0;
        const amount = parseFloat(item.amount); // Use calculated amount
        const rate = parseFloat(tax.rate);
        return (amount * rate) / 100;
      }));
      const taxAmount = taxCalculations.reduce((sum, amt) => sum + amt, 0);

      const total = subtotal + taxAmount;

      // Override client-provided totals with server-calculated values
      const quoteDataWithCalculatedTotals = {
        ...quote,
        quoteNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      };

      // Create quote with calculated totals
      const [newQuote] = await tx
        .insert(quotes)
        .values(quoteDataWithCalculatedTotals)
        .returning();

      // Create line items with calculated amounts
      if (lineItemsWithCalculatedAmounts.length > 0) {
        await tx.insert(quoteLineItems).values(
          lineItemsWithCalculatedAmounts.map(item => ({
            ...item,
            quoteId: newQuote.id,
            tenantId: quote.tenantId,
          }))
        );
      }

      return newQuote;
    });

    return result;
  }

  async updateQuote(
    id: string, 
    tenantId: string, 
    quote: Partial<InsertQuote>, 
    lineItems?: InsertQuoteLineItem[]
  ): Promise<Quote> {
    const result = await db.transaction(async (tx) => {
      // Always determine line items with recalculated amounts
      let lineItemsWithCalculatedAmounts: Array<InsertQuoteLineItem & { amount: string }>;
      
      if (lineItems !== undefined) {
        // New line items provided - calculate their amounts
        if (lineItems.length === 0) {
          throw new Error('At least one line item is required');
        }
        
        lineItemsWithCalculatedAmounts = lineItems.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            ...item,
            amount: calculatedAmount.toFixed(2),
          };
        });
      } else {
        // Fetch existing - recalculate their amounts
        const existing = await tx
          .select()
          .from(quoteLineItems)
          .where(and(
            eq(quoteLineItems.quoteId, id),
            eq(quoteLineItems.tenantId, tenantId)
          ));
        
        lineItemsWithCalculatedAmounts = existing.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            tenantId: item.tenantId,
            itemId: item.itemId || undefined,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || "0",
            amount: calculatedAmount.toFixed(2),
            taxId: item.taxId || undefined,
          };
        });
      }

      // Calculate subtotal from calculated amounts
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax from calculated amounts
      const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
        if (!item.taxId) return 0;
        const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
        if (!tax) return 0;
        const amount = parseFloat(item.amount);
        const rate = parseFloat(tax.rate);
        return (amount * rate) / 100;
      }));
      const taxAmount = taxCalculations.reduce((sum, amt) => sum + amt, 0);

      const total = subtotal + taxAmount;

      // Override client-provided totals with calculated values
      const updatedQuote = {
        ...quote,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date(),
      };

      // Update quote
      const [updated] = await tx
        .update(quotes)
        .set(updatedQuote)
        .where(and(
          eq(quotes.id, id),
          eq(quotes.tenantId, tenantId),
          isNull(quotes.deletedAt)
        ))
        .returning();

      if (!updated) {
        throw new Error('Quote not found');
      }

      // ✅ ALWAYS persist recalculated line items
      await tx
        .delete(quoteLineItems)
        .where(and(
          eq(quoteLineItems.quoteId, id),
          eq(quoteLineItems.tenantId, tenantId)
        ));

      await tx.insert(quoteLineItems).values(
        lineItemsWithCalculatedAmounts.map(item => ({
          ...item,
          quoteId: id,
          tenantId,
        }))
      );

      return updated;
    });

    return result;
  }

  async deleteQuote(id: string, tenantId: string): Promise<void> {
    await db
      .update(quotes)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(quotes.id, id),
        eq(quotes.tenantId, tenantId)
      ));
  }

  async getQuoteLineItems(quoteId: string, tenantId: string): Promise<QuoteLineItem[]> {
    return await db
      .select()
      .from(quoteLineItems)
      .where(and(
        eq(quoteLineItems.quoteId, quoteId),
        eq(quoteLineItems.tenantId, tenantId)
      ));
  }

  async convertQuoteToInvoice(quoteId: string, tenantId: string): Promise<Invoice> {
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx
        .select()
        .from(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.tenantId, tenantId),
          isNull(quotes.deletedAt)
        ));

      if (!quote) {
        throw new Error('Quote not found');
      }

      if (quote.status === 'converted') {
        throw new Error('Quote already converted to invoice');
      }

      const lineItems = await tx
        .select()
        .from(quoteLineItems)
        .where(and(
          eq(quoteLineItems.quoteId, quoteId),
          eq(quoteLineItems.tenantId, tenantId)
        ));

      const lastInvoice = await tx
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .orderBy(desc(invoices.createdAt))
        .limit(1);
      
      const lastNumber = lastInvoice[0]?.invoiceNumber;
      const nextNumber = lastNumber 
        ? parseInt(lastNumber.replace('INV-', '')) + 1 
        : 1;
      const invoiceNumber = `INV-${nextNumber.toString().padStart(4, '0')}`;

      const [newInvoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          customerId: quote.customerId,
          invoiceNumber,
          invoiceSubject: quote.quoteSubject || undefined,
          issuerTaxId: quote.issuerTaxId || undefined,
          customerTaxId: quote.customerTaxId || undefined,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          total: quote.total,
          notes: quote.notes || undefined,
        })
        .returning();

      if (lineItems.length > 0) {
        await tx.insert(invoiceLineItems).values(
          lineItems.map(item => ({
            tenantId,
            invoiceId: newInvoice.id,
            itemId: item.itemId || undefined,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || '0',
            amount: item.amount,
            taxId: item.taxId || undefined,
            accountId: undefined,
          }))
        );
      }

      await tx
        .update(quotes)
        .set({
          status: 'converted',
          convertedToInvoiceId: newInvoice.id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId));

      return newInvoice;
    });

    return result;
  }

  // Sales Order operations
  async getSalesOrders(tenantId: string): Promise<SalesOrder[]> {
    return await db
      .select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.tenantId, tenantId),
        isNull(salesOrders.deletedAt)
      ))
      .orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrderById(id: string, tenantId: string): Promise<SalesOrder | null> {
    const results = await db
      .select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.id, id),
        eq(salesOrders.tenantId, tenantId),
        isNull(salesOrders.deletedAt)
      ));
    return results[0] || null;
  }

  async createSalesOrder(order: InsertSalesOrder, lineItems: InsertSalesOrderLineItem[]): Promise<SalesOrder> {
    const result = await db.transaction(async (tx) => {
      // Generate order number if not provided
      let orderNumber = order.orderNumber;
      if (!orderNumber) {
        const lastOrder = await tx
          .select({ orderNumber: salesOrders.orderNumber })
          .from(salesOrders)
          .where(eq(salesOrders.tenantId, order.tenantId))
          .orderBy(desc(salesOrders.createdAt))
          .limit(1);
        
        const lastNumber = lastOrder[0]?.orderNumber;
        const nextNumber = lastNumber 
          ? parseInt(lastNumber.replace('SO-', '')) + 1 
          : 1;
        orderNumber = `SO-${nextNumber.toString().padStart(4, '0')}`;
      }

      // SECURITY: Calculate each line item's amount from quantity, price, discount
      // Don't trust client-provided amounts
      const lineItemsWithCalculatedAmounts = lineItems.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || "0");
        
        // Calculate amount: (quantity * unitPrice) - discount
        const calculatedAmount = (quantity * unitPrice) - discount;
        
        return {
          ...item,
          amount: calculatedAmount.toFixed(2), // Override client amount
        };
      });

      // Calculate subtotal from calculated amounts (not client amounts)
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax from calculated amounts
      const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
        if (!item.taxId) return 0;
        const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
        if (!tax) return 0;
        const amount = parseFloat(item.amount); // Use calculated amount
        const rate = parseFloat(tax.rate);
        return (amount * rate) / 100;
      }));
      const taxAmount = taxCalculations.reduce((sum, amt) => sum + amt, 0);

      const total = subtotal + taxAmount;

      // Override client-provided totals with server-calculated values
      const orderDataWithCalculatedTotals = {
        ...order,
        orderNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      };

      const [newOrder] = await tx
        .insert(salesOrders)
        .values(orderDataWithCalculatedTotals)
        .returning();

      // Insert line items with calculated amounts
      if (lineItemsWithCalculatedAmounts.length > 0) {
        const lineItemsWithOrderId = lineItemsWithCalculatedAmounts.map(item => ({
          ...item,
          salesOrderId: newOrder.id,
        }));
        await tx.insert(salesOrderLineItems).values(lineItemsWithOrderId);
      }

      return newOrder;
    });

    return result;
  }

  async updateSalesOrder(
    id: string, 
    tenantId: string, 
    order: Partial<InsertSalesOrder>, 
    lineItems?: InsertSalesOrderLineItem[]
  ): Promise<SalesOrder> {
    const result = await db.transaction(async (tx) => {
      // Always determine line items with recalculated amounts
      let lineItemsWithCalculatedAmounts: Array<InsertSalesOrderLineItem & { amount: string }>;
      
      if (lineItems !== undefined) {
        // New line items provided - calculate their amounts
        if (lineItems.length === 0) {
          throw new Error('At least one line item is required');
        }
        
        lineItemsWithCalculatedAmounts = lineItems.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            ...item,
            amount: calculatedAmount.toFixed(2),
          };
        });
      } else {
        // Fetch existing - recalculate their amounts
        const existing = await tx
          .select()
          .from(salesOrderLineItems)
          .where(and(
            eq(salesOrderLineItems.salesOrderId, id),
            eq(salesOrderLineItems.tenantId, tenantId)
          ));
        
        lineItemsWithCalculatedAmounts = existing.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            tenantId: item.tenantId,
            itemId: item.itemId || undefined,
            description: item.description,
            quantity: item.quantity,
            quantityFulfilled: item.quantityFulfilled || '0',
            unitPrice: item.unitPrice,
            discount: item.discount || "0",
            amount: calculatedAmount.toFixed(2),
            taxId: item.taxId || undefined,
          };
        });
      }

      // Calculate subtotal from calculated amounts
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax from calculated amounts
      const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
        if (!item.taxId) return 0;
        const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
        if (!tax) return 0;
        const amount = parseFloat(item.amount);
        const rate = parseFloat(tax.rate);
        return (amount * rate) / 100;
      }));
      const taxAmount = taxCalculations.reduce((sum, amt) => sum + amt, 0);

      const total = subtotal + taxAmount;

      // Override any client-provided totals with calculated values
      const orderDataWithCalculatedTotals = {
        ...order,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date(),
      };

      const [updatedOrder] = await tx
        .update(salesOrders)
        .set(orderDataWithCalculatedTotals)
        .where(and(
          eq(salesOrders.id, id),
          eq(salesOrders.tenantId, tenantId),
          isNull(salesOrders.deletedAt)
        ))
        .returning();

      if (!updatedOrder) {
        throw new Error('Sales order not found');
      }

      // ✅ ALWAYS persist recalculated line items
      await tx
        .delete(salesOrderLineItems)
        .where(and(
          eq(salesOrderLineItems.salesOrderId, id),
          eq(salesOrderLineItems.tenantId, tenantId)
        ));

      await tx.insert(salesOrderLineItems).values(
        lineItemsWithCalculatedAmounts.map(item => ({
          ...item,
          salesOrderId: id,
          tenantId,
        }))
      );

      return updatedOrder;
    });

    return result;
  }

  async deleteSalesOrder(id: string, tenantId: string): Promise<void> {
    await db
      .update(salesOrders)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(salesOrders.id, id),
        eq(salesOrders.tenantId, tenantId)
      ));
  }

  async getSalesOrderLineItems(salesOrderId: string, tenantId: string): Promise<SalesOrderLineItem[]> {
    return await db
      .select()
      .from(salesOrderLineItems)
      .where(and(
        eq(salesOrderLineItems.salesOrderId, salesOrderId),
        eq(salesOrderLineItems.tenantId, tenantId)
      ));
  }

  async convertSalesOrderToInvoice(salesOrderId: string, tenantId: string): Promise<Invoice> {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(salesOrders)
        .where(and(
          eq(salesOrders.id, salesOrderId),
          eq(salesOrders.tenantId, tenantId),
          isNull(salesOrders.deletedAt)
        ))
        .limit(1);

      if (!order) {
        throw new Error('Sales order not found');
      }

      if (order.convertedToInvoiceId) {
        throw new Error('Sales order has already been converted to an invoice');
      }

      const lineItems = await tx
        .select()
        .from(salesOrderLineItems)
        .where(and(
          eq(salesOrderLineItems.salesOrderId, salesOrderId),
          eq(salesOrderLineItems.tenantId, tenantId)
        ));

      const lastInvoice = await tx
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .orderBy(desc(invoices.invoiceDate))
        .limit(1);
      
      const lastNumber = lastInvoice[0]?.invoiceNumber;
      const nextNumber = lastNumber 
        ? parseInt(lastNumber.replace('INV-', '')) + 1 
        : 1;
      const invoiceNumber = `INV-${nextNumber.toString().padStart(4, '0')}`;

      const [newInvoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          customerId: order.customerId,
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          total: order.total,
          notes: order.notes || undefined,
        })
        .returning();

      if (lineItems.length > 0) {
        await tx.insert(invoiceLineItems).values(
          lineItems.map(item => ({
            tenantId,
            invoiceId: newInvoice.id,
            itemId: item.itemId || undefined,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || '0',
            amount: item.amount,
            taxId: item.taxId || undefined,
            accountId: undefined,
          }))
        );
      }

      await tx
        .update(salesOrders)
        .set({
          status: 'invoiced',
          convertedToInvoiceId: newInvoice.id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(salesOrders.id, salesOrderId));

      return newInvoice;
    });

    return result;
  }

  // Credit Note operations
  async getCreditNotes(tenantId: string): Promise<CreditNote[]> {
    return await db
      .select()
      .from(creditNotes)
      .where(and(
        eq(creditNotes.tenantId, tenantId),
        isNull(creditNotes.deletedAt)
      ))
      .orderBy(desc(creditNotes.createdAt));
  }

  async getCreditNoteById(id: string, tenantId: string): Promise<CreditNote | null> {
    const results = await db
      .select()
      .from(creditNotes)
      .where(and(
        eq(creditNotes.id, id),
        eq(creditNotes.tenantId, tenantId),
        isNull(creditNotes.deletedAt)
      ));
    return results[0] || null;
  }

  async createCreditNote(note: InsertCreditNote, lineItems: InsertCreditNoteLineItem[]): Promise<CreditNote> {
    const result = await db.transaction(async (tx) => {
      // Generate credit note number if not provided
      let creditNoteNumber = note.creditNoteNumber;
      if (!creditNoteNumber) {
        const lastNote = await tx
          .select({ creditNoteNumber: creditNotes.creditNoteNumber })
          .from(creditNotes)
          .where(eq(creditNotes.tenantId, note.tenantId))
          .orderBy(desc(creditNotes.createdAt))
          .limit(1);
        
        const lastNumber = lastNote[0]?.creditNoteNumber;
        const nextNumber = lastNumber 
          ? parseInt(lastNumber.replace('CN-', '')) + 1 
          : 1;
        creditNoteNumber = `CN-${nextNumber.toString().padStart(4, '0')}`;
      }

      // SECURITY: Calculate each line item's amount from quantity, price, discount
      const lineItemsWithCalculatedAmounts = lineItems.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || "0");
        
        // Calculate amount: (quantity * unitPrice) - discount
        const calculatedAmount = (quantity * unitPrice) - discount;
        
        return {
          ...item,
          amount: calculatedAmount.toFixed(2),
        };
      });

      // Calculate subtotal from calculated amounts
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax from calculated amounts
      const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
        if (!item.taxId) return 0;
        const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
        if (!tax) return 0;
        const taxRate = parseFloat(tax.rate);
        return parseFloat(item.amount) * (taxRate / 100);
      }));

      const taxAmount = taxCalculations.reduce((sum, tax) => sum + tax, 0);
      const total = subtotal + taxAmount;

      // Create credit note with server-calculated totals
      const [createdNote] = await tx
        .insert(creditNotes)
        .values({
          ...note,
          creditNoteNumber,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          balanceRemaining: total.toFixed(2), // Initially, full amount is available
        })
        .returning();

      // Insert line items with calculated amounts
      await tx.insert(creditNoteLineItems).values(
        lineItemsWithCalculatedAmounts.map(item => ({
          ...item,
          creditNoteId: createdNote.id,
          tenantId: note.tenantId,
        }))
      );

      return createdNote;
    });

    return result;
  }

  async updateCreditNote(id: string, tenantId: string, note: Partial<InsertCreditNote>, lineItems?: InsertCreditNoteLineItem[]): Promise<CreditNote> {
    const result = await db.transaction(async (tx) => {
      const [existingNote] = await tx
        .select()
        .from(creditNotes)
        .where(and(
          eq(creditNotes.id, id),
          eq(creditNotes.tenantId, tenantId),
          isNull(creditNotes.deletedAt)
        ))
        .limit(1);

      if (!existingNote) {
        throw new Error('Credit note not found');
      }

      let updatedNote: CreditNote;

      if (lineItems !== undefined) {
        // SECURITY: Recalculate amounts for all line items
        const lineItemsWithCalculatedAmounts = lineItems.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            ...item,
            amount: calculatedAmount.toFixed(2),
          };
        });

        // Recalculate totals
        const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
          return sum + parseFloat(item.amount);
        }, 0);

        const taxCalculations = await Promise.all(lineItemsWithCalculatedAmounts.map(async (item) => {
          if (!item.taxId) return 0;
          const [tax] = await tx.select().from(taxes).where(eq(taxes.id, item.taxId));
          if (!tax) return 0;
          const taxRate = parseFloat(tax.rate);
          return parseFloat(item.amount) * (taxRate / 100);
        }));

        const taxAmount = taxCalculations.reduce((sum, tax) => sum + tax, 0);
        const total = subtotal + taxAmount;

        // Calculate balance remaining (preserve the reduced amount from applications)
        const appliedAmount = parseFloat(existingNote.total) - parseFloat(existingNote.balanceRemaining);
        const newBalanceRemaining = total - appliedAmount;

        // Update credit note with recalculated totals
        [updatedNote] = await tx
          .update(creditNotes)
          .set({
            ...note,
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2),
            balanceRemaining: newBalanceRemaining.toFixed(2),
            updatedAt: new Date(),
          })
          .where(and(
            eq(creditNotes.id, id),
            eq(creditNotes.tenantId, tenantId)
          ))
          .returning();

        // Delete old line items
        await tx
          .delete(creditNoteLineItems)
          .where(and(
            eq(creditNoteLineItems.creditNoteId, id),
            eq(creditNoteLineItems.tenantId, tenantId)
          ));

        // Insert new line items
        await tx.insert(creditNoteLineItems).values(
          lineItemsWithCalculatedAmounts.map(item => ({
            ...item,
            creditNoteId: id,
            tenantId,
          }))
        );
      } else {
        // Update without changing line items
        [updatedNote] = await tx
          .update(creditNotes)
          .set({
            ...note,
            updatedAt: new Date(),
          })
          .where(and(
            eq(creditNotes.id, id),
            eq(creditNotes.tenantId, tenantId)
          ))
          .returning();
      }

      return updatedNote;
    });

    return result;
  }

  async deleteCreditNote(id: string, tenantId: string): Promise<void> {
    await db
      .update(creditNotes)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(creditNotes.id, id),
        eq(creditNotes.tenantId, tenantId)
      ));
  }

  async getCreditNoteLineItems(noteId: string, tenantId: string): Promise<CreditNoteLineItem[]> {
    return await db
      .select()
      .from(creditNoteLineItems)
      .where(and(
        eq(creditNoteLineItems.creditNoteId, noteId),
        eq(creditNoteLineItems.tenantId, tenantId)
      ));
  }

  async applyCreditNoteToInvoice(noteId: string, invoiceId: string, amount: string, tenantId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get credit note
      const [creditNote] = await tx
        .select()
        .from(creditNotes)
        .where(and(
          eq(creditNotes.id, noteId),
          eq(creditNotes.tenantId, tenantId),
          isNull(creditNotes.deletedAt)
        ))
        .limit(1);

      if (!creditNote) {
        throw new Error('Credit note not found');
      }

      const amountToApply = parseFloat(amount);
      const balanceRemaining = parseFloat(creditNote.balanceRemaining);

      if (amountToApply > balanceRemaining) {
        throw new Error('Amount exceeds credit note balance');
      }

      // Get invoice
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(
          eq(invoices.id, invoiceId),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        ))
        .limit(1);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Update credit note balance
      const newBalance = balanceRemaining - amountToApply;
      await tx
        .update(creditNotes)
        .set({
          balanceRemaining: newBalance.toFixed(2),
          status: newBalance === 0 ? 'applied' : creditNote.status,
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, noteId));

      // Update invoice (reduce the total owed)
      // This would typically create a payment record or adjust the invoice balance
      // For now, we'll just link the credit note to the invoice if not already linked
      if (!creditNote.invoiceId) {
        await tx
          .update(creditNotes)
          .set({
            invoiceId: invoiceId,
            updatedAt: new Date(),
          })
          .where(eq(creditNotes.id, noteId));
      }
    });
  }

  // Customer Payment operations
  async getCustomerPayments(tenantId: string): Promise<CustomerPayment[]> {
    return await db
      .select()
      .from(customerPayments)
      .where(and(
        eq(customerPayments.tenantId, tenantId),
        isNull(customerPayments.deletedAt)
      ))
      .orderBy(desc(customerPayments.paymentDate));
  }

  async getCustomerPaymentById(id: string, tenantId: string): Promise<CustomerPayment | null> {
    const [payment] = await db
      .select()
      .from(customerPayments)
      .where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.tenantId, tenantId),
        isNull(customerPayments.deletedAt)
      ))
      .limit(1);
    
    return payment || null;
  }

  async createCustomerPayment(paymentData: InsertCustomerPayment): Promise<CustomerPayment> {
    return await db.transaction(async (tx) => {
      const tenantId = paymentData.tenantId;
      const paymentNumber = await this.getNextCustomerPaymentNumber(tenantId);
      
      const [payment] = await tx
        .insert(customerPayments)
        .values({
          ...paymentData,
          paymentNumber,
        })
        .returning();

      // If payment is linked to an invoice, update invoice balance
      if (payment.invoiceId) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(and(
            eq(invoices.id, payment.invoiceId),
            eq(invoices.tenantId, tenantId),
            isNull(invoices.deletedAt)
          ))
          .limit(1);

        if (invoice) {
          const currentBalance = parseFloat(invoice.total);
          const paymentAmount = parseFloat(payment.amount);
          const newBalance = Math.max(0, currentBalance - paymentAmount);

          await tx
            .update(invoices)
            .set({
              status: newBalance === 0 ? 'paid' : invoice.status,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, payment.invoiceId));
        }
      }

      return payment;
    });
  }

  async updateCustomerPayment(id: string, tenantId: string, paymentData: Partial<InsertCustomerPayment>): Promise<CustomerPayment> {
    const [updated] = await db
      .update(customerPayments)
      .set({
        ...paymentData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.tenantId, tenantId),
        isNull(customerPayments.deletedAt)
      ))
      .returning();

    if (!updated) {
      throw new Error('Payment not found');
    }

    return updated;
  }

  async deleteCustomerPayment(id: string, tenantId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get the payment first to check if it's linked to an invoice
      const [payment] = await tx
        .select()
        .from(customerPayments)
        .where(and(
          eq(customerPayments.id, id),
          eq(customerPayments.tenantId, tenantId),
          isNull(customerPayments.deletedAt)
        ))
        .limit(1);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Soft delete the payment
      await tx
        .update(customerPayments)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customerPayments.id, id));

      // If payment was linked to an invoice, restore the balance
      if (payment.invoiceId) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(and(
            eq(invoices.id, payment.invoiceId),
            eq(invoices.tenantId, tenantId),
            isNull(invoices.deletedAt)
          ))
          .limit(1);

        if (invoice) {
          const currentTotal = parseFloat(invoice.total);
          const paymentAmount = parseFloat(payment.amount);
          const restoredBalance = currentTotal + paymentAmount;

          await tx
            .update(invoices)
            .set({
              status: restoredBalance > 0 ? 'sent' : invoice.status,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, payment.invoiceId));
        }
      }
    });
  }

  async getNextCustomerPaymentNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence
      let [sequence] = await tx
        .select()
        .from(customerPaymentSequences)
        .where(eq(customerPaymentSequences.tenantId, tenantId))
        .limit(1);
      
      if (!sequence) {
        // Create initial sequence
        [sequence] = await tx
          .insert(customerPaymentSequences)
          .values({
            tenantId,
            lastNumber: 1,
            prefix: "PAY-",
          })
          .returning();
        
        return `${sequence.prefix}${String(sequence.lastNumber).padStart(4, '0')}`;
      }
      
      // Increment sequence
      const nextNumber = sequence.lastNumber + 1;
      await tx
        .update(customerPaymentSequences)
        .set({ 
          lastNumber: nextNumber,
          updatedAt: new Date(),
        })
        .where(eq(customerPaymentSequences.tenantId, tenantId));
      
      return `${sequence.prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  // Recurring Invoice operations
  async getRecurringInvoices(tenantId: string): Promise<RecurringInvoice[]> {
    return await db
      .select()
      .from(recurringInvoices)
      .where(and(
        eq(recurringInvoices.tenantId, tenantId),
        isNull(recurringInvoices.deletedAt)
      ))
      .orderBy(desc(recurringInvoices.createdAt));
  }

  async getRecurringInvoiceById(id: string, tenantId: string): Promise<RecurringInvoice | null> {
    const results = await db
      .select()
      .from(recurringInvoices)
      .where(and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.tenantId, tenantId),
        isNull(recurringInvoices.deletedAt)
      ));
    return results[0] || null;
  }

  async createRecurringInvoice(data: InsertRecurringInvoice, lineItems: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice> {
    return await db.transaction(async (tx) => {
      // Generate recurring invoice number
      const lastRecurring = await tx
        .select({ recurringInvoiceNumber: recurringInvoices.recurringInvoiceNumber })
        .from(recurringInvoices)
        .where(eq(recurringInvoices.tenantId, data.tenantId))
        .orderBy(desc(recurringInvoices.createdAt))
        .limit(1);
      
      const lastNumber = lastRecurring[0]?.recurringInvoiceNumber;
      const nextNumber = lastNumber 
        ? parseInt(lastNumber.replace('REC-', '')) + 1 
        : 1;
      const recurringInvoiceNumber = `REC-${nextNumber.toString().padStart(4, '0')}`;

      // Calculate nextInvoiceDate from startDate and frequency
      const startDate = new Date(data.startDate);
      let nextInvoiceDate = new Date(startDate);
      
      switch (data.frequency) {
        case 'daily':
          nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 1);
          break;
        case 'weekly':
          nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 7);
          break;
        case 'monthly':
          nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 3);
          break;
        case 'yearly':
          nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1);
          break;
      }

      // Calculate line item amounts server-side
      const lineItemsWithCalculatedAmounts = lineItems.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || "0");
        const calculatedAmount = (quantity * unitPrice) - discount;
        
        return {
          ...item,
          amount: calculatedAmount.toFixed(2),
        };
      });

      // Calculate totals from line items
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax amount
      let taxAmount = 0;
      for (const item of lineItemsWithCalculatedAmounts) {
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const itemAmount = parseFloat(item.amount);
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (itemAmount * taxRate) / 100;
          }
        }
      }

      const total = subtotal + taxAmount;

      // Create recurring invoice
      const [createdRecurring] = await tx
        .insert(recurringInvoices)
        .values({
          ...data,
          recurringInvoiceNumber,
          nextInvoiceDate,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
        })
        .returning();

      // Insert line items
      if (lineItemsWithCalculatedAmounts.length > 0) {
        await tx.insert(recurringInvoiceLineItems).values(
          lineItemsWithCalculatedAmounts.map(item => ({
            ...item,
            tenantId: data.tenantId,
            recurringInvoiceId: createdRecurring.id,
          }))
        );
      }

      return createdRecurring;
    });
  }

  async updateRecurringInvoice(id: string, tenantId: string, data: Partial<InsertRecurringInvoice>, lineItems?: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice> {
    return await db.transaction(async (tx) => {
      // Verify ownership
      const existing = await this.getRecurringInvoiceById(id, tenantId);
      if (!existing) {
        throw new Error("Recurring invoice not found");
      }

      let updateData = { ...data };

      // If line items are provided, recalculate totals
      if (lineItems) {
        // Delete existing line items
        await tx
          .delete(recurringInvoiceLineItems)
          .where(eq(recurringInvoiceLineItems.recurringInvoiceId, id));

        // Calculate new line item amounts
        const lineItemsWithCalculatedAmounts = lineItems.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            ...item,
            amount: calculatedAmount.toFixed(2),
          };
        });

        // Calculate totals
        const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
          return sum + parseFloat(item.amount);
        }, 0);

        let taxAmount = 0;
        for (const item of lineItemsWithCalculatedAmounts) {
          if (item.taxId) {
            const [taxRecord] = await tx
              .select()
              .from(taxes)
              .where(eq(taxes.id, item.taxId))
              .limit(1);
            
            if (taxRecord) {
              const itemAmount = parseFloat(item.amount);
              const taxRate = parseFloat(taxRecord.rate);
              taxAmount += (itemAmount * taxRate) / 100;
            }
          }
        }

        const total = subtotal + taxAmount;

        updateData = {
          ...updateData,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
        };

        // Insert new line items
        if (lineItemsWithCalculatedAmounts.length > 0) {
          await tx.insert(recurringInvoiceLineItems).values(
            lineItemsWithCalculatedAmounts.map(item => ({
              ...item,
              tenantId,
              recurringInvoiceId: id,
            }))
          );
        }
      }

      // Update recurring invoice
      const [updated] = await tx
        .update(recurringInvoices)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(recurringInvoices.id, id),
          eq(recurringInvoices.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        throw new Error("Failed to update recurring invoice");
      }

      return updated;
    });
  }

  async deleteRecurringInvoice(id: string, tenantId: string): Promise<void> {
    await db
      .update(recurringInvoices)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.tenantId, tenantId)
      ));
  }

  async getRecurringInvoiceLineItems(recurringInvoiceId: string, tenantId: string): Promise<RecurringInvoiceLineItem[]> {
    return await db
      .select()
      .from(recurringInvoiceLineItems)
      .where(and(
        eq(recurringInvoiceLineItems.recurringInvoiceId, recurringInvoiceId),
        eq(recurringInvoiceLineItems.tenantId, tenantId)
      ));
  }

  async generateInvoiceFromRecurring(recurringId: string, tenantId: string): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      // Get recurring invoice
      const recurring = await this.getRecurringInvoiceById(recurringId, tenantId);
      if (!recurring) {
        throw new Error("Recurring invoice not found");
      }

      // Get line items
      const lineItems = await this.getRecurringInvoiceLineItems(recurringId, tenantId);

      // Generate new invoice number
      const invoiceNumber = await this.getNextInvoiceNumber(tenantId);

      // Create invoice
      const invoiceData: InsertInvoice = {
        tenantId,
        customerId: recurring.customerId,
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: "draft",
        subtotal: recurring.subtotal,
        taxAmount: recurring.taxAmount,
        total: recurring.total,
        invoiceSubject: recurring.invoiceSubject || undefined,
        notes: recurring.notes || undefined,
        issuerTaxId: recurring.issuerTaxId || undefined,
        customerTaxId: recurring.customerTaxId || undefined,
      };

      const [createdInvoice] = await tx
        .insert(invoices)
        .values(invoiceData)
        .returning();

      // Copy line items
      if (lineItems.length > 0) {
        await tx.insert(invoiceLineItems).values(
          lineItems.map(item => ({
            tenantId,
            invoiceId: createdInvoice.id,
            itemId: item.itemId || undefined,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || "0",
            amount: item.amount,
            taxId: item.taxId || undefined,
          }))
        );
      }

      // Update recurring invoice nextInvoiceDate
      const currentNext = new Date(recurring.nextInvoiceDate);
      let newNextDate = new Date(currentNext);
      
      switch (recurring.frequency) {
        case 'daily':
          newNextDate.setDate(newNextDate.getDate() + 1);
          break;
        case 'weekly':
          newNextDate.setDate(newNextDate.getDate() + 7);
          break;
        case 'monthly':
          newNextDate.setMonth(newNextDate.getMonth() + 1);
          break;
        case 'quarterly':
          newNextDate.setMonth(newNextDate.getMonth() + 3);
          break;
        case 'yearly':
          newNextDate.setFullYear(newNextDate.getFullYear() + 1);
          break;
      }

      // Check if we should mark as completed
      let newStatus = recurring.status;
      if (recurring.endDate && newNextDate > new Date(recurring.endDate)) {
        newStatus = 'completed';
      }

      await tx
        .update(recurringInvoices)
        .set({
          nextInvoiceDate: newNextDate,
          lastInvoiceId: createdInvoice.id,
          lastInvoiceDate: new Date(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(recurringInvoices.id, recurringId));

      return createdInvoice;
    });
  }

  async processRecurringInvoices(tenantId: string): Promise<Invoice[]> {
    const recurringList = await db
      .select()
      .from(recurringInvoices)
      .where(and(
        eq(recurringInvoices.tenantId, tenantId),
        eq(recurringInvoices.status, 'active'),
        isNull(recurringInvoices.deletedAt)
      ));

    const createdInvoices: Invoice[] = [];
    const now = new Date();

    for (const recurring of recurringList) {
      if (new Date(recurring.nextInvoiceDate) <= now) {
        try {
          const invoice = await this.generateInvoiceFromRecurring(recurring.id, tenantId);
          createdInvoices.push(invoice);
        } catch (error) {
          console.error(`Failed to generate invoice from recurring ${recurring.id}:`, error);
        }
      }
    }

    return createdInvoices;
  }

  // Retainer Invoice operations
  async getRetainerInvoices(tenantId: string): Promise<RetainerInvoice[]> {
    return await db
      .select()
      .from(retainerInvoices)
      .where(and(
        eq(retainerInvoices.tenantId, tenantId),
        isNull(retainerInvoices.deletedAt)
      ))
      .orderBy(desc(retainerInvoices.createdAt));
  }

  async getRetainerInvoiceById(id: string, tenantId: string): Promise<RetainerInvoice | null> {
    const results = await db
      .select()
      .from(retainerInvoices)
      .where(and(
        eq(retainerInvoices.id, id),
        eq(retainerInvoices.tenantId, tenantId),
        isNull(retainerInvoices.deletedAt)
      ));
    return results[0] || null;
  }

  async createRetainerInvoice(data: InsertRetainerInvoice, lineItems: InsertRetainerInvoiceLineItem[]): Promise<RetainerInvoice> {
    return await db.transaction(async (tx) => {
      // Generate retainer number (RET-0001)
      const lastRetainer = await tx
        .select({ retainerNumber: retainerInvoices.retainerNumber })
        .from(retainerInvoices)
        .where(eq(retainerInvoices.tenantId, data.tenantId))
        .orderBy(desc(retainerInvoices.createdAt))
        .limit(1);
      
      const lastNumber = lastRetainer[0]?.retainerNumber;
      const nextNumber = lastNumber 
        ? parseInt(lastNumber.replace('RET-', '')) + 1 
        : 1;
      const retainerNumber = `RET-${nextNumber.toString().padStart(4, '0')}`;

      // Calculate line item amounts server-side
      const lineItemsWithCalculatedAmounts = lineItems.map(item => {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || "0");
        const calculatedAmount = (quantity * unitPrice) - discount;
        
        return {
          ...item,
          amount: calculatedAmount.toFixed(2),
        };
      });

      // Calculate totals from line items
      const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
        return sum + parseFloat(item.amount);
      }, 0);

      // Calculate tax amount
      let taxAmount = 0;
      for (const item of lineItemsWithCalculatedAmounts) {
        if (item.taxId) {
          const [taxRecord] = await tx
            .select()
            .from(taxes)
            .where(eq(taxes.id, item.taxId))
            .limit(1);
          
          if (taxRecord) {
            const itemAmount = parseFloat(item.amount);
            const taxRate = parseFloat(taxRecord.rate);
            taxAmount += (itemAmount * taxRate) / 100;
          }
        }
      }

      const total = subtotal + taxAmount;

      // Initialize balances
      // remainingBalance = total when status = 'paid', otherwise 0
      const remainingBalance = data.status === 'paid' ? total : 0;

      // Create retainer invoice
      const [createdRetainer] = await tx
        .insert(retainerInvoices)
        .values({
          ...data,
          retainerNumber,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          amountUsed: "0",
          remainingBalance: remainingBalance.toFixed(2),
        })
        .returning();

      // Insert line items
      if (lineItemsWithCalculatedAmounts.length > 0) {
        await tx.insert(retainerInvoiceLineItems).values(
          lineItemsWithCalculatedAmounts.map(item => ({
            ...item,
            tenantId: data.tenantId,
            retainerInvoiceId: createdRetainer.id,
          }))
        );
      }

      return createdRetainer;
    });
  }

  async updateRetainerInvoice(id: string, tenantId: string, data: Partial<InsertRetainerInvoice>, lineItems?: InsertRetainerInvoiceLineItem[]): Promise<RetainerInvoice> {
    return await db.transaction(async (tx) => {
      // Verify ownership
      const existing = await this.getRetainerInvoiceById(id, tenantId);
      if (!existing) {
        throw new Error("Retainer invoice not found");
      }

      let updateData = { ...data };

      // If line items are provided, recalculate totals
      if (lineItems) {
        // Delete existing line items
        await tx
          .delete(retainerInvoiceLineItems)
          .where(eq(retainerInvoiceLineItems.retainerInvoiceId, id));

        // Calculate new line item amounts
        const lineItemsWithCalculatedAmounts = lineItems.map(item => {
          const quantity = parseFloat(item.quantity);
          const unitPrice = parseFloat(item.unitPrice);
          const discount = parseFloat(item.discount || "0");
          const calculatedAmount = (quantity * unitPrice) - discount;
          
          return {
            ...item,
            amount: calculatedAmount.toFixed(2),
          };
        });

        // Calculate totals
        const subtotal = lineItemsWithCalculatedAmounts.reduce((sum, item) => {
          return sum + parseFloat(item.amount);
        }, 0);

        let taxAmount = 0;
        for (const item of lineItemsWithCalculatedAmounts) {
          if (item.taxId) {
            const [taxRecord] = await tx
              .select()
              .from(taxes)
              .where(eq(taxes.id, item.taxId))
              .limit(1);
            
            if (taxRecord) {
              const itemAmount = parseFloat(item.amount);
              const taxRate = parseFloat(taxRecord.rate);
              taxAmount += (itemAmount * taxRate) / 100;
            }
          }
        }

        const total = subtotal + taxAmount;

        // Calculate new remaining balance
        const amountUsed = parseFloat(existing.amountUsed);
        const newRemainingBalance = Math.max(0, total - amountUsed);

        updateData = {
          ...updateData,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          remainingBalance: newRemainingBalance.toFixed(2),
        };

        // Insert new line items
        if (lineItemsWithCalculatedAmounts.length > 0) {
          await tx.insert(retainerInvoiceLineItems).values(
            lineItemsWithCalculatedAmounts.map(item => ({
              ...item,
              tenantId,
              retainerInvoiceId: id,
            }))
          );
        }
      }

      // If status changed to 'paid', initialize remaining balance
      if (updateData.status === 'paid' && existing.status !== 'paid') {
        const total = parseFloat(updateData.total || existing.total);
        const amountUsed = parseFloat(existing.amountUsed);
        updateData.remainingBalance = Math.max(0, total - amountUsed).toFixed(2);
      }

      // Update retainer invoice
      const [updated] = await tx
        .update(retainerInvoices)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(retainerInvoices.id, id),
          eq(retainerInvoices.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        throw new Error("Failed to update retainer invoice");
      }

      return updated;
    });
  }

  async deleteRetainerInvoice(id: string, tenantId: string): Promise<void> {
    await db
      .update(retainerInvoices)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(retainerInvoices.id, id),
        eq(retainerInvoices.tenantId, tenantId)
      ));
  }

  async getRetainerInvoiceLineItems(retainerInvoiceId: string, tenantId: string): Promise<RetainerInvoiceLineItem[]> {
    return await db
      .select()
      .from(retainerInvoiceLineItems)
      .where(and(
        eq(retainerInvoiceLineItems.retainerInvoiceId, retainerInvoiceId),
        eq(retainerInvoiceLineItems.tenantId, tenantId)
      ));
  }

  async getNextRetainerNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      const lastRetainer = await tx
        .select({ retainerNumber: retainerInvoices.retainerNumber })
        .from(retainerInvoices)
        .where(eq(retainerInvoices.tenantId, tenantId))
        .orderBy(desc(retainerInvoices.createdAt))
        .limit(1);
      
      const lastNumber = lastRetainer[0]?.retainerNumber;
      const nextNumber = lastNumber 
        ? parseInt(lastNumber.replace('RET-', '')) + 1 
        : 1;
      
      return `RET-${nextNumber.toString().padStart(4, '0')}`;
    });
  }

  // Journal Entry operations
  async getJournalEntries(tenantId: string): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.tenantId, tenantId))
      .orderBy(desc(journalEntries.entryDate));
  }

  async getJournalEntry(id: string): Promise<JournalEntry | undefined> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, id));
    return entry;
  }

  async getJournalEntryLegs(journalEntryId: string, tenantId: string): Promise<JournalEntryLeg[]> {
    return await db
      .select()
      .from(journalEntryLegs)
      .where(
        and(
          eq(journalEntryLegs.journalEntryId, journalEntryId),
          eq(journalEntryLegs.tenantId, tenantId)
        )
      );
  }

  async createJournalEntryWithLegs(payload: JournalEntryPayload): Promise<JournalEntry> {
    return await db.transaction(async (tx) => {
      const tenantId = payload.journalEntry.tenantId;
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      // SERVER-SIDE VALIDATION: Validate double-entry balance BEFORE inserting
      const debits = payload.legs
        .filter(leg => leg.type === 'Debit')
        .reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
      
      const credits = payload.legs
        .filter(leg => leg.type === 'Credit')
        .reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
      
      if (Math.abs(debits - credits) > 0.01) {
        throw new Error(`Journal entry is not balanced: Debits (${debits.toFixed(2)}) must equal Credits (${credits.toFixed(2)})`);
      }

      // ALWAYS generate journal entry number server-side
      const journalEntryNumber = await this.getNextJournalEntryNumber(tenantId);

      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safeEntryData } = payload.journalEntry;

      // Create journal entry with auto-generated number
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          ...safeEntryData,
          tenantId,
          journalEntryNumber,
        })
        .returning();

      // Insert legs with FORCE server tenantId
      if (payload.legs.length > 0) {
        const legsWithEntryId = payload.legs.map(leg => {
          // SECURITY: Strip any client-provided tenantId
          const { tenantId: _legTenantId, ...safeLegData } = leg as any;
          return {
            ...safeLegData,
            journalEntryId: entry.id,
            tenantId, // FORCE server tenantId
          };
        });
        await tx.insert(journalEntryLegs).values(legsWithEntryId);
      }

      return entry;
    });
  }

  async updateJournalEntryWithLegs(id: string, tenantId: string, payload: JournalEntryPayload): Promise<JournalEntry> {
    return await db.transaction(async (tx) => {
      // Fetch existing entry to verify ownership
      const [existingEntry] = await tx
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingEntry) {
        throw new Error("Journal entry not found");
      }

      // SERVER-SIDE VALIDATION: Validate double-entry balance BEFORE updating
      const debits = payload.legs
        .filter(leg => leg.type === 'Debit')
        .reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
      
      const credits = payload.legs
        .filter(leg => leg.type === 'Credit')
        .reduce((sum, leg) => sum + parseFloat(leg.amount.toString()), 0);
      
      if (Math.abs(debits - credits) > 0.01) {
        throw new Error(`Journal entry is not balanced: Debits (${debits.toFixed(2)}) must equal Credits (${credits.toFixed(2)})`);
      }

      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safeEntryData } = payload.journalEntry;

      // Update journal entry
      const [updatedEntry] = await tx
        .update(journalEntries)
        .set({
          ...safeEntryData,
          tenantId: existingEntry.tenantId, // FORCE existing tenantId
          updatedAt: new Date(),
        })
        .where(and(eq(journalEntries.id, id), eq(journalEntries.tenantId, tenantId)))
        .returning();

      if (!updatedEntry) {
        throw new Error("Failed to update journal entry");
      }

      // Delete existing legs
      await tx
        .delete(journalEntryLegs)
        .where(eq(journalEntryLegs.journalEntryId, id));

      // Insert new legs with FORCE server tenantId
      if (payload.legs.length > 0) {
        const legsWithEntryId = payload.legs.map(leg => {
          // SECURITY: Strip any client-provided tenantId
          const { tenantId: _legTenantId, ...safeLegData } = leg as any;
          return {
            ...safeLegData,
            journalEntryId: id,
            tenantId: existingEntry.tenantId, // FORCE server tenantId
          };
        });
        await tx.insert(journalEntryLegs).values(legsWithEntryId);
      }

      return updatedEntry;
    });
  }

  async deleteJournalEntry(id: string, tenantId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Verify ownership
      const [entry] = await tx
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!entry) {
        throw new Error("Journal entry not found");
      }

      // Delete legs first
      await tx
        .delete(journalEntryLegs)
        .where(eq(journalEntryLegs.journalEntryId, id));

      // Delete entry
      await tx
        .delete(journalEntries)
        .where(and(eq(journalEntries.id, id), eq(journalEntries.tenantId, tenantId)));
    });
  }

  async getNextJournalEntryNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence record (transaction provides basic isolation)
      let [sequence] = await tx
        .select()
        .from(journalEntrySequences)
        .where(eq(journalEntrySequences.tenantId, tenantId))
        .limit(1);

      if (!sequence) {
        // Create initial sequence
        [sequence] = await tx
          .insert(journalEntrySequences)
          .values({
            tenantId,
            lastNumber: 1,
            prefix: "JE-",
          })
          .returning();
        
        return `JE-${String(1).padStart(4, '0')}`;
      }

      // Increment and update
      const nextNumber = sequence.lastNumber + 1;
      await tx
        .update(journalEntrySequences)
        .set({
          lastNumber: nextNumber,
          updatedAt: new Date(),
        })
        .where(eq(journalEntrySequences.tenantId, tenantId));

      return `${sequence.prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  // Asset operations
  async getAssets(tenantId: string): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(eq(assets.tenantId, tenantId))
      .orderBy(desc(assets.createdAt));
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async getAssetDepreciationSchedules(assetId: string, tenantId: string): Promise<AssetDepreciationSchedule[]> {
    return await db
      .select()
      .from(assetDepreciationSchedules)
      .where(
        and(
          eq(assetDepreciationSchedules.assetId, assetId),
          eq(assetDepreciationSchedules.tenantId, tenantId)
        )
      )
      .orderBy(assetDepreciationSchedules.periodDate);
  }

  async createAsset(assetData: InsertAsset & { tenantId: string }): Promise<Asset> {
    return await db.transaction(async (tx) => {
      // Generate asset number using sequence
      const assetNumber = await this.getNextAssetNumber(assetData.tenantId);

      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safeAssetData } = assetData;

      // Create asset with auto-generated number
      const [asset] = await tx
        .insert(assets)
        .values({
          ...safeAssetData,
          tenantId: assetData.tenantId, // FORCE server tenantId
          assetNumber,
        })
        .returning();

      return asset;
    });
  }

  async updateAsset(id: string, tenantId: string, assetData: Partial<InsertAsset>): Promise<Asset> {
    const asset = await this.getAsset(id);
    if (!asset || asset.tenantId !== tenantId) {
      throw new Error("Asset not found");
    }

    // STRIP tenantId from payload - NEVER trust client
    const { tenantId: _, ...safeAssetData } = assetData as any;

    const [updatedAsset] = await db
      .update(assets)
      .set({
        ...safeAssetData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assets.id, id),
          eq(assets.tenantId, tenantId)
        )
      )
      .returning();

    if (!updatedAsset) {
      throw new Error("Asset not found");
    }

    return updatedAsset;
  }

  async deleteAsset(id: string, tenantId: string): Promise<void> {
    const asset = await this.getAsset(id);
    if (!asset || asset.tenantId !== tenantId) {
      throw new Error("Asset not found");
    }

    await db.transaction(async (tx) => {
      // Delete depreciation schedules first
      await tx
        .delete(assetDepreciationSchedules)
        .where(eq(assetDepreciationSchedules.assetId, id));

      // Delete asset
      await tx
        .delete(assets)
        .where(and(eq(assets.id, id), eq(assets.tenantId, tenantId)));
    });
  }

  async getNextAssetNumber(tenantId: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Get or create sequence record (transaction provides basic isolation)
      let [sequence] = await tx
        .select()
        .from(assetSequences)
        .where(eq(assetSequences.tenantId, tenantId))
        .limit(1);

      if (!sequence) {
        // Create initial sequence
        [sequence] = await tx
          .insert(assetSequences)
          .values({
            tenantId,
            lastNumber: 1,
            prefix: "ASSET-",
          })
          .returning();

        return `ASSET-${String(1).padStart(4, '0')}`;
      }

      // Increment and update
      const nextNumber = sequence.lastNumber + 1;
      await tx
        .update(assetSequences)
        .set({
          lastNumber: nextNumber,
          updatedAt: new Date(),
        })
        .where(eq(assetSequences.tenantId, tenantId));

      return `${sequence.prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  // Bank Reconciliation operations
  async getBankReconciliations(tenantId: string): Promise<BankReconciliation[]> {
    return await db
      .select()
      .from(bankReconciliations)
      .where(eq(bankReconciliations.tenantId, tenantId))
      .orderBy(desc(bankReconciliations.reconciliationDate));
  }

  async getBankReconciliation(id: string): Promise<BankReconciliation | undefined> {
    const [reconciliation] = await db
      .select()
      .from(bankReconciliations)
      .where(eq(bankReconciliations.id, id));
    return reconciliation;
  }

  async getBankReconciliationItems(reconciliationId: string, tenantId: string): Promise<BankReconciliationItem[]> {
    return await db
      .select()
      .from(bankReconciliationItems)
      .where(
        and(
          eq(bankReconciliationItems.reconciliationId, reconciliationId),
          eq(bankReconciliationItems.tenantId, tenantId)
        )
      );
  }

  async createBankReconciliationWithItems(payload: BankReconciliationPayload): Promise<BankReconciliation> {
    return await db.transaction(async (tx) => {
      // Validate tenantId exists
      const tenantId = payload.reconciliation.tenantId;
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      // Validate account belongs to tenant
      const [account] = await tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, payload.reconciliation.accountId),
            eq(accounts.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!account) {
        throw new Error("Account not found or doesn't belong to this tenant");
      }

      // SERVER-SIDE CALCULATION: difference = statementBalance - bookBalance
      const statementBalance = parseFloat(payload.reconciliation.statementBalance);
      const bookBalance = parseFloat(payload.reconciliation.bookBalance);
      const difference = (statementBalance - bookBalance).toFixed(2);

      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _, ...safeReconciliationData } = payload.reconciliation;

      // Create reconciliation with SERVER-CALCULATED difference
      const [reconciliation] = await tx
        .insert(bankReconciliations)
        .values({
          ...safeReconciliationData,
          tenantId, // FORCE server tenantId
          difference, // SERVER-CALCULATED
        })
        .returning();

      // Create reconciliation items
      if (payload.items.length > 0) {
        const itemsWithReconciliationId = payload.items.map(item => ({
          ...item,
          reconciliationId: reconciliation.id,
          tenantId, // CRITICAL: FORCE server tenantId on items
        }));
        await tx.insert(bankReconciliationItems).values(itemsWithReconciliationId);
      }

      return reconciliation;
    });
  }

  async updateBankReconciliationWithItems(id: string, tenantId: string, payload: BankReconciliationPayload): Promise<BankReconciliation> {
    return await db.transaction(async (tx) => {
      // Fetch existing reconciliation
      const [existingReconciliation] = await tx
        .select()
        .from(bankReconciliations)
        .where(
          and(
            eq(bankReconciliations.id, id),
            eq(bankReconciliations.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingReconciliation) {
        throw new Error("Bank reconciliation not found");
      }

      // Validate account belongs to tenant
      const [account] = await tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, payload.reconciliation.accountId),
            eq(accounts.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!account) {
        throw new Error("Account not found or doesn't belong to this tenant");
      }

      // SERVER-SIDE CALCULATION: difference = statementBalance - bookBalance
      const statementBalance = parseFloat(payload.reconciliation.statementBalance);
      const bookBalance = parseFloat(payload.reconciliation.bookBalance);
      const difference = (statementBalance - bookBalance).toFixed(2);

      // SECURITY: Strip tenantId from payload
      const { tenantId: _, ...safeReconciliationData } = payload.reconciliation;

      // Update reconciliation with SERVER-CALCULATED difference
      const [updatedReconciliation] = await tx
        .update(bankReconciliations)
        .set({
          ...safeReconciliationData,
          tenantId: existingReconciliation.tenantId, // FORCE server tenantId
          difference, // SERVER-CALCULATED
          updatedAt: new Date(),
        })
        .where(and(eq(bankReconciliations.id, id), eq(bankReconciliations.tenantId, tenantId)))
        .returning();

      if (!updatedReconciliation) {
        throw new Error("Bank reconciliation was deleted during update");
      }

      // Delete existing items
      await tx
        .delete(bankReconciliationItems)
        .where(eq(bankReconciliationItems.reconciliationId, id));

      // Create new items
      if (payload.items.length > 0) {
        const itemsWithReconciliationId = payload.items.map(item => ({
          ...item,
          reconciliationId: id,
          tenantId: existingReconciliation.tenantId, // CRITICAL: FORCE server tenantId on items
        }));
        await tx.insert(bankReconciliationItems).values(itemsWithReconciliationId);
      }

      return updatedReconciliation;
    });
  }

  async deleteBankReconciliation(id: string, tenantId: string): Promise<void> {
    const reconciliation = await this.getBankReconciliation(id);
    if (!reconciliation || reconciliation.tenantId !== tenantId) {
      throw new Error("Bank reconciliation not found");
    }

    await db.transaction(async (tx) => {
      // Delete items first
      await tx
        .delete(bankReconciliationItems)
        .where(eq(bankReconciliationItems.reconciliationId, id));

      // Delete reconciliation
      await tx
        .delete(bankReconciliations)
        .where(and(eq(bankReconciliations.id, id), eq(bankReconciliations.tenantId, tenantId)));
    });
  }

  async matchReconciliationItem(itemId: string, journalEntryId: string, tenantId: string): Promise<void> {
    // Validate item belongs to tenant
    const [item] = await db
      .select()
      .from(bankReconciliationItems)
      .where(
        and(
          eq(bankReconciliationItems.id, itemId),
          eq(bankReconciliationItems.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!item) {
      throw new Error("Reconciliation item not found");
    }

    // Validate journal entry belongs to tenant
    const [journalEntry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, journalEntryId),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!journalEntry) {
      throw new Error("Journal entry not found");
    }

    // Update item with journalEntryId and mark as matched
    await db
      .update(bankReconciliationItems)
      .set({
        journalEntryId,
        isMatched: true,
      })
      .where(eq(bankReconciliationItems.id, itemId));
  }

  // ====================================
  // FINANCIAL REPORTS (READ-ONLY)
  // ====================================

  async getProfitLossReport(tenantId: string, startDate: Date, endDate: Date): Promise<ProfitLossReport> {
    // Get all income accounts (revenue)
    const incomeAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'income'),
          eq(accounts.isActive, true)
        )
      );

    // Get all expense accounts
    const expenseAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'expense'),
          eq(accounts.isActive, true)
        )
      );

    // Calculate revenue from journal entries within date range
    const revenueAccountLines = await Promise.all(
      incomeAccounts.map(async (account) => {
        const result = await db
          .select({
            total: sum(sql`CASE WHEN ${journalEntryLegs.type} = 'Credit' THEN ${journalEntryLegs.amount} ELSE -${journalEntryLegs.amount} END`),
          })
          .from(journalEntryLegs)
          .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
          .where(
            and(
              eq(journalEntryLegs.tenantId, tenantId),
              eq(journalEntryLegs.accountId, account.id),
              gte(journalEntries.entryDate, startDate),
              lte(journalEntries.entryDate, endDate),
              eq(journalEntries.status, 'posted')
            )
          );

        const balance = result[0]?.total || '0';

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          balance: balance.toString(),
        };
      })
    );

    // Calculate expenses from journal entries within date range
    const expenseAccountLines = await Promise.all(
      expenseAccounts.map(async (account) => {
        const result = await db
          .select({
            total: sum(sql`CASE WHEN ${journalEntryLegs.type} = 'Debit' THEN ${journalEntryLegs.amount} ELSE -${journalEntryLegs.amount} END`),
          })
          .from(journalEntryLegs)
          .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
          .where(
            and(
              eq(journalEntryLegs.tenantId, tenantId),
              eq(journalEntryLegs.accountId, account.id),
              gte(journalEntries.entryDate, startDate),
              lte(journalEntries.entryDate, endDate),
              eq(journalEntries.status, 'posted')
            )
          );

        const balance = result[0]?.total || '0';

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          balance: balance.toString(),
        };
      })
    );

    // Calculate totals
    const totalRevenue = revenueAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
    const totalExpenses = expenseAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      tenantId,
      startDate,
      endDate,
      revenueAccounts: revenueAccountLines,
      totalRevenue: totalRevenue.toFixed(2),
      expenseAccounts: expenseAccountLines,
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  }

  async getBalanceSheetReport(tenantId: string, asOfDate: Date): Promise<BalanceSheetReport> {
    // Get all asset accounts
    const assetAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'asset'),
          eq(accounts.isActive, true)
        )
      );

    // Get all liability accounts
    const liabilityAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'liability'),
          eq(accounts.isActive, true)
        )
      );

    // Get all equity accounts
    const equityAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'equity'),
          eq(accounts.isActive, true)
        )
      );

    // Map asset accounts with current balance
    const assetAccountLines = assetAccounts.map((account) => ({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      balance: account.currentBalance,
    }));

    // Map liability accounts with current balance
    const liabilityAccountLines = liabilityAccounts.map((account) => ({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      balance: account.currentBalance,
    }));

    // Map equity accounts with current balance
    const equityAccountLines = equityAccounts.map((account) => ({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      balance: account.currentBalance,
    }));

    // Calculate totals
    const totalAssets = assetAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
    const totalLiabilities = liabilityAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
    const totalEquity = equityAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return {
      tenantId,
      asOfDate,
      assetAccounts: assetAccountLines,
      totalAssets: totalAssets.toFixed(2),
      liabilityAccounts: liabilityAccountLines,
      totalLiabilities: totalLiabilities.toFixed(2),
      equityAccounts: equityAccountLines,
      totalEquity: totalEquity.toFixed(2),
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
      isBalanced,
    };
  }

  async getTrialBalanceReport(tenantId: string, asOfDate: Date): Promise<TrialBalanceReport> {
    // Get all active accounts for tenant
    const allAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true)
        )
      );

    // Map accounts to trial balance format
    const accountLines = allAccounts.map((account) => {
      const balance = parseFloat(account.currentBalance);
      
      // Determine debit/credit based on account type and balance
      // Assets and Expenses have debit normal balance
      // Liabilities, Equity, and Income have credit normal balance
      let debit = '0.00';
      let credit = '0.00';

      if (account.type === 'asset' || account.type === 'expense') {
        if (balance >= 0) {
          debit = balance.toFixed(2);
        } else {
          credit = Math.abs(balance).toFixed(2);
        }
      } else {
        if (balance >= 0) {
          credit = balance.toFixed(2);
        } else {
          debit = Math.abs(balance).toFixed(2);
        }
      }

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit,
        credit,
      };
    });

    // Calculate totals
    const totalDebits = accountLines.reduce((sum, line) => sum + parseFloat(line.debit), 0);
    const totalCredits = accountLines.reduce((sum, line) => sum + parseFloat(line.credit), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return {
      tenantId,
      asOfDate,
      accounts: accountLines,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced,
    };
  }

  async getCashFlowReport(tenantId: string, startDate: Date, endDate: Date): Promise<CashFlowReport> {
    // Simplified Cash Flow Report
    // Operating activities: income and expense accounts
    const incomeAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'income'),
          eq(accounts.isActive, true)
        )
      );

    const expenseAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, 'expense'),
          eq(accounts.isActive, true)
        )
      );

    // Calculate operating activities
    const operatingAccountLines = await Promise.all(
      [...incomeAccounts, ...expenseAccounts].map(async (account) => {
        const result = await db
          .select({
            total: sum(sql`CASE 
              WHEN ${journalEntryLegs.type} = 'Debit' AND ${accounts.type} = 'expense' THEN ${journalEntryLegs.amount}
              WHEN ${journalEntryLegs.type} = 'Credit' AND ${accounts.type} = 'income' THEN ${journalEntryLegs.amount}
              ELSE -${journalEntryLegs.amount}
            END`),
          })
          .from(journalEntryLegs)
          .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
          .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
          .where(
            and(
              eq(journalEntryLegs.tenantId, tenantId),
              eq(journalEntryLegs.accountId, account.id),
              gte(journalEntries.entryDate, startDate),
              lte(journalEntries.entryDate, endDate),
              eq(journalEntries.status, 'posted')
            )
          );

        const balance = result[0]?.total || '0';

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          balance: balance.toString(),
        };
      })
    );

    const operatingTotal = operatingAccountLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);

    // Investing activities (simplified - asset purchases/sales)
    // For simplicity, we'll leave this empty for now
    const investingAccountLines: any[] = [];
    const investingTotal = 0;

    // Financing activities (simplified - equity and long-term liabilities)
    // For simplicity, we'll leave this empty for now
    const financingAccountLines: any[] = [];
    const financingTotal = 0;

    const netCashFlow = operatingTotal + investingTotal + financingTotal;

    return {
      tenantId,
      startDate,
      endDate,
      operatingActivities: {
        accounts: operatingAccountLines,
        total: operatingTotal.toFixed(2),
      },
      investingActivities: {
        accounts: investingAccountLines,
        total: investingTotal.toFixed(2),
      },
      financingActivities: {
        accounts: financingAccountLines,
        total: financingTotal.toFixed(2),
      },
      netCashFlow: netCashFlow.toFixed(2),
    };
  }
}

export class MemStorage implements IStorage {
  private users: User[] = [];
  private tenants: Tenant[] = [];
  private tenantCompanyProfiles: TenantCompanyProfile[] = [];
  private customers: Customer[] = [];
  private vendors: Vendor[] = [];
  private items: Item[] = [];
  private taxes: Tax[] = [];
  private invoices: Invoice[] = [];
  private invoiceLineItems: InvoiceLineItem[] = [];
  private bills: Bill[] = [];
  private billLineItems: BillLineItem[] = [];
  private expenses: Expense[] = [];
  private payments: Payment[] = [];
  private documents: Document[] = [];
  private invoiceSequenceCounters: Map<string, number> = new Map();
  private customerPayments: CustomerPayment[] = [];
  private customerPaymentSequenceCounters: Map<string, number> = new Map();

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const existingIndex = this.users.findIndex(u => u.id === user.id);
    const now = new Date();
    
    if (existingIndex >= 0) {
      const updated = { ...this.users[existingIndex], ...user, updatedAt: now };
      this.users[existingIndex] = updated;
      return updated;
    } else {
      const newUser: User = { ...user, createdAt: now, updatedAt: now } as User;
      this.users.push(newUser);
      return newUser;
    }
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenants.find(t => t.id === id);
  }

  async getTenantsByUserId(userId: string): Promise<Tenant[]> {
    return this.tenants.filter(t => t.ownerId === userId);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const now = new Date();
    const id = `tenant-${Date.now()}-${Math.random()}`;
    const newTenant: Tenant = { 
      ...tenant, 
      id, 
      createdAt: now, 
      updatedAt: now,
      stripeAccountId: tenant.stripeAccountId ?? null
    };
    this.tenants.push(newTenant);
    return newTenant;
  }

  async updateTenant(id: string, userId: string, tenant: Partial<InsertTenant>): Promise<Tenant> {
    const existing = this.tenants.find(t => t.id === id && t.ownerId === userId);
    if (!existing) throw new Error("Tenant not found");
    
    const updated = { ...existing, ...tenant, updatedAt: new Date() };
    const index = this.tenants.findIndex(t => t.id === id);
    this.tenants[index] = updated;
    return updated;
  }

  async isTenantMember(tenantId: string, userId: string): Promise<boolean> {
    const tenant = this.tenants.find(t => t.id === tenantId && t.ownerId === userId);
    return !!tenant;
  }

  // Company Profile operations
  async getCompanyProfile(tenantId: string): Promise<TenantCompanyProfile | null> {
    return this.tenantCompanyProfiles.find(p => p.tenantId === tenantId) || null;
  }

  async createCompanyProfile(profile: InsertTenantCompanyProfile): Promise<TenantCompanyProfile> {
    const now = new Date();
    const id = `profile-${Date.now()}-${Math.random()}`;
    const newProfile: TenantCompanyProfile = { 
      ...profile, 
      id, 
      createdAt: now, 
      updatedAt: now,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      website: profile.website ?? null,
      taxRegistrationNumber: profile.taxRegistrationNumber ?? null,
      address: profile.address ?? null
    };
    this.tenantCompanyProfiles.push(newProfile);
    return newProfile;
  }

  async updateCompanyProfile(tenantId: string, data: Partial<Omit<InsertTenantCompanyProfile, 'tenantId'>>): Promise<TenantCompanyProfile> {
    const existing = this.tenantCompanyProfiles.find(p => p.tenantId === tenantId);
    if (!existing) throw new Error("Company profile not found");
    
    const updated = { ...existing, ...data, updatedAt: new Date() };
    const index = this.tenantCompanyProfiles.findIndex(p => p.tenantId === tenantId);
    this.tenantCompanyProfiles[index] = updated;
    return updated;
  }

  // Customer operations
  async getCustomersByTenant(tenantId: string): Promise<Customer[]> {
    return this.customers.filter(c => c.tenantId === tenantId);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.find(c => c.id === id);
  }

  async getCustomerById(id: string, tenantId: string): Promise<Customer | null> {
    return this.customers.find(c => c.id === id && c.tenantId === tenantId) || null;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const now = new Date();
    const id = `customer-${Date.now()}-${Math.random()}`;
    const newCustomer: Customer = { 
      id,
      name: customer.name,
      tenantId: customer.tenantId,
      createdAt: now, 
      updatedAt: now,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      company: customer.company ?? null,
      displayName: customer.displayName ?? null,
      billingAddress: customer.billingAddress ?? null,
      shippingAddress: customer.shippingAddress ?? null,
      taxRegistrationNumber: customer.taxRegistrationNumber ?? null,
      paymentTerms: customer.paymentTerms ?? null,
      address: customer.address ?? null,
      notes: customer.notes ?? null
    };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: string, tenantId: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const existing = this.customers.find(c => c.id === id && c.tenantId === tenantId);
    if (!existing) throw new Error("Customer not found");
    
    const updated = { ...existing, ...customer, updatedAt: new Date() };
    const index = this.customers.findIndex(c => c.id === id);
    this.customers[index] = updated;
    return updated;
  }

  async deleteCustomer(id: string, tenantId: string): Promise<void> {
    const index = this.customers.findIndex(c => c.id === id && c.tenantId === tenantId);
    if (index === -1) throw new Error("Customer not found");
    this.customers.splice(index, 1);
  }

  // Vendor operations
  async getVendorsByTenant(tenantId: string): Promise<Vendor[]> {
    return this.vendors.filter(v => v.tenantId === tenantId);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    return this.vendors.find(v => v.id === id);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const now = new Date();
    const id = `vendor-${Date.now()}-${Math.random()}`;
    const newVendor: Vendor = { 
      id,
      name: vendor.name,
      tenantId: vendor.tenantId,
      createdAt: now, 
      updatedAt: now,
      email: vendor.email ?? null,
      stripeAccountId: vendor.stripeAccountId ?? null,
      phone: vendor.phone ?? null,
      company: vendor.company ?? null,
      displayName: vendor.displayName ?? null,
      billingAddress: vendor.billingAddress ?? null,
      shippingAddress: vendor.shippingAddress ?? null,
      taxRegistrationNumber: vendor.taxRegistrationNumber ?? null,
      paymentTerms: vendor.paymentTerms ?? null,
      address: vendor.address ?? null,
      bankAccountLast4: vendor.bankAccountLast4 ?? null,
      notes: vendor.notes ?? null
    };
    this.vendors.push(newVendor);
    return newVendor;
  }

  async updateVendor(id: string, tenantId: string, vendor: Partial<InsertVendor>): Promise<Vendor> {
    const existing = this.vendors.find(v => v.id === id && v.tenantId === tenantId);
    if (!existing) throw new Error("Vendor not found");
    
    const updated = { ...existing, ...vendor, updatedAt: new Date() };
    const index = this.vendors.findIndex(v => v.id === id);
    this.vendors[index] = updated;
    return updated;
  }

  async deleteVendor(id: string, tenantId: string): Promise<void> {
    const index = this.vendors.findIndex(v => v.id === id && v.tenantId === tenantId);
    if (index === -1) throw new Error("Vendor not found");
    this.vendors.splice(index, 1);
  }

  // Item operations
  async getItems(tenantId: string): Promise<Item[]> {
    return this.items.filter(i => i.tenantId === tenantId);
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.items.find(i => i.id === id);
  }

  async createItem(item: InsertItem & { tenantId: string }): Promise<Item> {
    const now = new Date();
    const id = `item-${Date.now()}-${Math.random()}`;
    const newItem: Item = { 
      ...item, 
      id, 
      createdAt: now, 
      updatedAt: now,
      description: item.description ?? null,
      sku: item.sku ?? null,
      unit: item.unit ?? null,
      isActive: item.isActive ?? null,
      accountId: item.accountId ?? null,
      taxId: item.taxId ?? null
    };
    this.items.push(newItem);
    return newItem;
  }

  async updateItem(id: string, tenantId: string, item: Partial<InsertItem>): Promise<Item> {
    const existing = this.items.find(i => i.id === id && i.tenantId === tenantId);
    if (!existing) throw new Error("Item not found");
    
    const updated = { ...existing, ...item, updatedAt: new Date() };
    const index = this.items.findIndex(i => i.id === id);
    this.items[index] = updated;
    return updated;
  }

  async deleteItem(id: string, tenantId: string): Promise<void> {
    const index = this.items.findIndex(i => i.id === id && i.tenantId === tenantId);
    if (index === -1) throw new Error("Item not found");
    this.items.splice(index, 1);
  }

  // Tax operations
  async getTaxes(tenantId: string): Promise<Tax[]> {
    return this.taxes.filter(t => t.tenantId === tenantId);
  }

  async getTax(id: string): Promise<Tax | undefined> {
    return this.taxes.find(t => t.id === id);
  }

  async createTax(tax: InsertTax & { tenantId: string }): Promise<Tax> {
    const now = new Date();
    const id = `tax-${Date.now()}-${Math.random()}`;
    const newTax: Tax = { 
      id,
      name: tax.name,
      tenantId: tax.tenantId,
      rate: tax.rate,
      isActive: tax.isActive ?? true,
      isDefault: tax.isDefault ?? false
    };
    this.taxes.push(newTax);
    return newTax;
  }

  async updateTax(id: string, tenantId: string, tax: Partial<InsertTax>): Promise<Tax> {
    const existing = this.taxes.find(t => t.id === id && t.tenantId === tenantId);
    if (!existing) throw new Error("Tax not found");
    
    const updated = { ...existing, ...tax, updatedAt: new Date() };
    const index = this.taxes.findIndex(t => t.id === id);
    this.taxes[index] = updated;
    return updated;
  }

  async deleteTax(id: string, tenantId: string): Promise<void> {
    const index = this.taxes.findIndex(t => t.id === id && t.tenantId === tenantId);
    if (index === -1) throw new Error("Tax not found");
    this.taxes.splice(index, 1);
  }

  // Invoice operations
  async getInvoicesByTenant(tenantId: string, includeDeleted: boolean = false): Promise<Invoice[]> {
    return this.invoices.filter(i => 
      i.tenantId === tenantId && (includeDeleted || !i.deletedAt)
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.find(i => i.id === id);
  }

  async getInvoiceById(id: string, tenantId: string): Promise<Invoice | null> {
    return this.invoices.find(i => i.id === id && i.tenantId === tenantId && !i.deletedAt) || null;
  }

  async getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]> {
    return this.invoiceLineItems.filter(
      item => item.invoiceId === invoiceId && item.tenantId === tenantId
    );
  }

  async getInvoiceLineItemsWithTax(invoiceId: string, tenantId: string): Promise<Array<{
    id: string;
    description: string;
    quantity: string;
    rate: string;
    amount: string;
    discount: string | null;
    taxName: string | null;
    taxRate: string | null;
  }>> {
    const items = this.invoiceLineItems.filter(
      item => item.invoiceId === invoiceId && item.tenantId === tenantId
    );
    
    return items.map(item => {
      const tax = item.taxId ? this.taxes.find(t => t.id === item.taxId) : null;
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.unitPrice,
        amount: item.amount,
        discount: item.discount,
        taxName: tax?.name || null,
        taxRate: tax?.rate || null,
      };
    });
  }

  async createInvoiceWithItems(payload: InvoicePayload): Promise<Invoice> {
    const now = new Date();
    const invoiceId = `invoice-${Date.now()}-${Math.random()}`;
    const invoiceNumber = await this.getNextInvoiceNumber(payload.invoice.tenantId);
    
    const newInvoice: Invoice = {
      id: invoiceId,
      tenantId: payload.invoice.tenantId,
      customerId: payload.invoice.customerId,
      invoiceNumber: invoiceNumber ?? null,
      invoiceDate: payload.invoice.invoiceDate,
      dueDate: payload.invoice.dueDate,
      status: payload.invoice.status,
      poReference: payload.invoice.poReference ?? null,
      invoiceSubject: payload.invoice.invoiceSubject ?? null,
      issuerTaxId: payload.invoice.issuerTaxId ?? null,
      customerTaxId: payload.invoice.customerTaxId ?? null,
      subtotal: payload.invoice.subtotal,
      taxAmount: payload.invoice.taxAmount,
      total: payload.invoice.total,
      notes: payload.invoice.notes ?? null,
      emailStatus: null,
      emailSentAt: null,
      emailError: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    
    this.invoices.push(newInvoice);
    
    for (const item of payload.lineItems) {
      const lineItemId = `lineitem-${Date.now()}-${Math.random()}`;
      const newLineItem: InvoiceLineItem = {
        id: lineItemId,
        tenantId: payload.invoice.tenantId,
        invoiceId,
        itemId: item.itemId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? null,
        taxId: item.taxId ?? null,
        amount: item.amount,
        accountId: item.accountId ?? null,
        createdAt: now,
      };
      this.invoiceLineItems.push(newLineItem);
    }
    
    return newInvoice;
  }

  async updateInvoice(id: string, tenantId: string, data: Partial<InsertInvoice>): Promise<Invoice> {
    const existing = this.invoices.find(i => i.id === id && i.tenantId === tenantId && !i.deletedAt);
    if (!existing) throw new Error("Invoice not found");
    
    const updated = { ...existing, ...data, updatedAt: new Date() };
    const index = this.invoices.findIndex(i => i.id === id);
    this.invoices[index] = updated;
    return updated;
  }

  async updateInvoiceWithItems(id: string, tenantId: string, payload: InvoicePayload): Promise<Invoice> {
    const existing = this.invoices.find(i => i.id === id && i.tenantId === tenantId && !i.deletedAt);
    if (!existing) throw new Error("Invoice not found");
    
    // Update invoice
    const updated = { ...existing, ...payload.invoice, updatedAt: new Date() };
    const invoiceIndex = this.invoices.findIndex(i => i.id === id);
    this.invoices[invoiceIndex] = updated;
    
    // Remove old line items
    this.invoiceLineItems = this.invoiceLineItems.filter(
      item => !(item.invoiceId === id && item.tenantId === tenantId)
    );
    
    // Add new line items
    const now = new Date();
    for (const item of payload.lineItems) {
      const lineItemId = `lineitem-${Date.now()}-${Math.random()}`;
      const newLineItem: InvoiceLineItem = {
        id: lineItemId,
        tenantId,
        invoiceId: id,
        itemId: item.itemId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? null,
        taxId: item.taxId ?? null,
        amount: item.amount,
        accountId: item.accountId ?? null,
        createdAt: now,
      };
      this.invoiceLineItems.push(newLineItem);
    }
    
    return updated;
  }

  async deleteInvoice(id: string, tenantId: string): Promise<boolean> {
    const existing = this.invoices.find(i => i.id === id && i.tenantId === tenantId);
    if (!existing) return false;
    
    const index = this.invoices.findIndex(i => i.id === id);
    this.invoices[index] = { ...existing, deletedAt: new Date() };
    return true;
  }

  async getNextInvoiceNumber(tenantId: string): Promise<string> {
    const current = this.invoiceSequenceCounters.get(tenantId) || 0;
    const next = current + 1;
    this.invoiceSequenceCounters.set(tenantId, next);
    return `INV-${String(next).padStart(4, '0')}`;
  }

  async logInvoiceAudit(log: InsertInvoiceAuditLog): Promise<void> {
    // No-op for in-memory storage
  }

  // Bill operations
  async getBillsByTenant(tenantId: string): Promise<Bill[]> {
    return this.bills.filter(b => b.tenantId === tenantId);
  }

  async getBill(id: string): Promise<Bill | undefined> {
    return this.bills.find(b => b.id === id);
  }

  async getBillById(id: string, tenantId: string): Promise<Bill | null> {
    const bill = this.bills.find(b => b.id === id && b.tenantId === tenantId);
    return bill || null;
  }

  async getBillLineItems(billId: string): Promise<BillLineItem[]> {
    return this.billLineItems.filter(item => item.billId === billId);
  }

  async createBillWithItems(payload: BillPayload, tenantId: string): Promise<Bill> {
    const now = new Date();
    const billId = `bill-${Date.now()}-${Math.random()}`;
    
    // SERVER-SIDE CALCULATIONS - NEVER trust client totals
    let subtotal = 0;
    let taxAmount = 0;
    
    // Calculate from line items
    for (const item of payload.lineItems) {
      const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      subtotal += lineAmount;
      
      // Fetch tax rate if taxId provided
      if (item.taxId) {
        const taxRecord = this.taxes.find(t => t.id === item.taxId);
        if (taxRecord) {
          const taxRate = parseFloat(taxRecord.rate);
          taxAmount += (lineAmount * taxRate / 100);
        }
      }
    }
    
    const total = subtotal + taxAmount;
    
    // SECURITY: Strip tenantId from payload, FORCE server tenantId
    const { tenantId: _, ...safeBillData } = payload.bill;
    
    const newBill: Bill = {
      ...safeBillData,
      id: billId,
      tenantId: tenantId, // FORCE server tenantId
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      createdAt: now,
      updatedAt: now,
    };
    
    this.bills.push(newBill);
    
    for (const item of payload.lineItems) {
      const lineItemId = `billitem-${Date.now()}-${Math.random()}`;
      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _itemTenantId, ...safeItemData } = item;
      const newLineItem: BillLineItem = {
        ...safeItemData,
        id: lineItemId,
        billId,
        tenantId: tenantId, // FORCE server tenantId
        amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
        itemId: item.itemId || null,
        taxId: item.taxId || null,
        accountId: item.accountId || null,
        createdAt: now,
        updatedAt: now,
      };
      this.billLineItems.push(newLineItem);
    }
    
    return newBill;
  }

  async updateBillWithItems(id: string, tenantId: string, payload: BillPayload): Promise<Bill> {
    const existing = this.bills.find(b => b.id === id && b.tenantId === tenantId);
    if (!existing) throw new Error("Bill not found");
    
    // SERVER-SIDE CALCULATIONS - NEVER trust client totals
    let subtotal = 0;
    let taxAmount = 0;
    
    // Calculate from line items
    for (const item of payload.lineItems) {
      const lineAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      subtotal += lineAmount;
      
      // Fetch tax rate if taxId provided
      if (item.taxId) {
        const taxRecord = this.taxes.find(t => t.id === item.taxId);
        if (taxRecord) {
          const taxRate = parseFloat(taxRecord.rate);
          taxAmount += (lineAmount * taxRate / 100);
        }
      }
    }
    
    const total = subtotal + taxAmount;
    
    // SECURITY: Strip tenantId from payload, FORCE server tenantId
    const { tenantId: _, ...safeBillData } = payload.bill;
    
    const updated = { 
      ...existing, 
      ...safeBillData, 
      tenantId: existing.tenantId, // FORCE server tenantId
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date() 
    };
    const index = this.bills.findIndex(b => b.id === id);
    this.bills[index] = updated;
    
    this.billLineItems = this.billLineItems.filter(item => item.billId !== id);
    
    const now = new Date();
    for (const item of payload.lineItems) {
      const lineItemId = `billitem-${Date.now()}-${Math.random()}`;
      // SECURITY: Strip tenantId from payload, FORCE server tenantId
      const { tenantId: _itemTenantId, ...safeItemData } = item;
      const newLineItem: BillLineItem = {
        ...safeItemData,
        id: lineItemId,
        billId: id,
        tenantId, // FORCE server tenantId
        amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
        itemId: item.itemId || null,
        taxId: item.taxId || null,
        accountId: item.accountId || null,
        createdAt: now,
        updatedAt: now,
      };
      this.billLineItems.push(newLineItem);
    }
    
    return updated;
  }

  async deleteBill(id: string, tenantId: string): Promise<void> {
    const index = this.bills.findIndex(b => b.id === id && b.tenantId === tenantId);
    if (index === -1) throw new Error("Bill not found");
    this.bills.splice(index, 1);
    this.billLineItems = this.billLineItems.filter(item => item.billId !== id);
  }

  // Expense operations
  async getExpensesByTenant(tenantId: string): Promise<Expense[]> {
    return this.expenses.filter(e => e.tenantId === tenantId);
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.find(e => e.id === id);
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const now = new Date();
    const id = `expense-${Date.now()}-${Math.random()}`;
    const newExpense: Expense = { ...expense, id, createdAt: now, updatedAt: now };
    this.expenses.push(newExpense);
    return newExpense;
  }

  async updateExpense(id: string, tenantId: string, expense: Partial<InsertExpense>): Promise<Expense> {
    const existing = this.expenses.find(e => e.id === id && e.tenantId === tenantId);
    if (!existing) throw new Error("Expense not found");
    
    const updated = { ...existing, ...expense, updatedAt: new Date() };
    const index = this.expenses.findIndex(e => e.id === id);
    this.expenses[index] = updated;
    return updated;
  }

  // Payment operations
  async getPaymentsByTenant(tenantId: string): Promise<Payment[]> {
    return this.payments.filter(p => p.tenantId === tenantId);
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const now = new Date();
    const id = `payment-${Date.now()}-${Math.random()}`;
    const newPayment: Payment = { ...payment, id, createdAt: now, updatedAt: now };
    this.payments.push(newPayment);
    return newPayment;
  }

  async updatePayment(id: string, tenantId: string, payment: Partial<InsertPayment>): Promise<Payment> {
    const existing = this.payments.find(p => p.id === id && p.tenantId === tenantId);
    if (!existing) throw new Error("Payment not found");
    
    const updated = { ...existing, ...payment, updatedAt: new Date() };
    const index = this.payments.findIndex(p => p.id === id);
    this.payments[index] = updated;
    return updated;
  }

  // Document operations
  async getDocumentsByTenant(tenantId: string): Promise<Document[]> {
    return this.documents.filter(d => d.tenantId === tenantId);
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const now = new Date();
    const id = `document-${Date.now()}-${Math.random()}`;
    const newDocument: Document = { ...document, id, createdAt: now, updatedAt: now };
    this.documents.push(newDocument);
    return newDocument;
  }

  async updateDocument(id: string, tenantId: string, document: Partial<InsertDocument>): Promise<Document> {
    const existing = this.documents.find(d => d.id === id && d.tenantId === tenantId);
    if (!existing) throw new Error("Document not found");
    
    const updated = { ...existing, ...document, updatedAt: new Date() };
    const index = this.documents.findIndex(d => d.id === id);
    this.documents[index] = updated;
    return updated;
  }

  // Quotes - stub implementation
  async getQuotes(tenantId: string): Promise<Quote[]> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async getQuoteById(id: string, tenantId: string): Promise<Quote | null> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async createQuote(quote: InsertQuote, lineItems: InsertQuoteLineItem[]): Promise<Quote> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async updateQuote(id: string, tenantId: string, quote: Partial<InsertQuote>, lineItems?: InsertQuoteLineItem[]): Promise<Quote> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async deleteQuote(id: string, tenantId: string): Promise<void> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async getQuoteLineItems(quoteId: string, tenantId: string): Promise<QuoteLineItem[]> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  async convertQuoteToInvoice(quoteId: string, tenantId: string): Promise<Invoice> {
    throw new Error('Quotes not implemented in MemStorage');
  }

  // Sales Order operations
  async getSalesOrders(tenantId: string): Promise<SalesOrder[]> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async getSalesOrderById(id: string, tenantId: string): Promise<SalesOrder | null> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async createSalesOrder(order: InsertSalesOrder, lineItems: InsertSalesOrderLineItem[]): Promise<SalesOrder> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async updateSalesOrder(id: string, tenantId: string, order: Partial<InsertSalesOrder>, lineItems?: InsertSalesOrderLineItem[]): Promise<SalesOrder> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async deleteSalesOrder(id: string, tenantId: string): Promise<void> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async getSalesOrderLineItems(salesOrderId: string, tenantId: string): Promise<SalesOrderLineItem[]> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  async convertSalesOrderToInvoice(salesOrderId: string, tenantId: string): Promise<Invoice> {
    throw new Error('Sales orders not implemented in MemStorage');
  }

  // Credit Note operations
  async getCreditNotes(tenantId: string): Promise<CreditNote[]> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async getCreditNoteById(id: string, tenantId: string): Promise<CreditNote | null> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async createCreditNote(note: InsertCreditNote, lineItems: InsertCreditNoteLineItem[]): Promise<CreditNote> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async updateCreditNote(id: string, tenantId: string, note: Partial<InsertCreditNote>, lineItems?: InsertCreditNoteLineItem[]): Promise<CreditNote> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async deleteCreditNote(id: string, tenantId: string): Promise<void> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async getCreditNoteLineItems(noteId: string, tenantId: string): Promise<CreditNoteLineItem[]> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  async applyCreditNoteToInvoice(noteId: string, invoiceId: string, amount: string, tenantId: string): Promise<void> {
    throw new Error('Credit notes not implemented in MemStorage');
  }

  // Customer Payment operations
  async getCustomerPayments(tenantId: string): Promise<CustomerPayment[]> {
    return this.customerPayments
      .filter(p => p.tenantId === tenantId && !p.deletedAt)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }

  async getCustomerPaymentById(id: string, tenantId: string): Promise<CustomerPayment | null> {
    const payment = this.customerPayments.find(p => p.id === id && p.tenantId === tenantId && !p.deletedAt);
    return payment || null;
  }

  async createCustomerPayment(paymentData: InsertCustomerPayment): Promise<CustomerPayment> {
    const now = new Date();
    const paymentId = `payment-${Date.now()}-${Math.random()}`;
    const paymentNumber = await this.getNextCustomerPaymentNumber(paymentData.tenantId);

    const newPayment: CustomerPayment = {
      id: paymentId,
      tenantId: paymentData.tenantId,
      customerId: paymentData.customerId,
      invoiceId: paymentData.invoiceId ?? null,
      paymentNumber,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      referenceNumber: paymentData.referenceNumber ?? null,
      amount: paymentData.amount,
      notes: paymentData.notes ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.customerPayments.push(newPayment);

    // Update invoice status if linked
    if (newPayment.invoiceId) {
      const invoice = this.invoices.find(i => i.id === newPayment.invoiceId && i.tenantId === paymentData.tenantId);
      if (invoice) {
        const currentBalance = parseFloat(invoice.total);
        const paymentAmount = parseFloat(newPayment.amount);
        const newBalance = Math.max(0, currentBalance - paymentAmount);
        
        invoice.status = newBalance === 0 ? 'paid' : invoice.status;
        invoice.updatedAt = now;
      }
    }

    return newPayment;
  }

  async updateCustomerPayment(id: string, tenantId: string, paymentData: Partial<InsertCustomerPayment>): Promise<CustomerPayment> {
    const paymentIndex = this.customerPayments.findIndex(p => p.id === id && p.tenantId === tenantId && !p.deletedAt);
    
    if (paymentIndex === -1) {
      throw new Error('Payment not found');
    }

    const updated = {
      ...this.customerPayments[paymentIndex],
      ...paymentData,
      updatedAt: new Date(),
    };

    this.customerPayments[paymentIndex] = updated;
    return updated;
  }

  async deleteCustomerPayment(id: string, tenantId: string): Promise<void> {
    const payment = this.customerPayments.find(p => p.id === id && p.tenantId === tenantId && !p.deletedAt);
    
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.deletedAt = new Date();
    payment.updatedAt = new Date();

    // Restore invoice status if linked
    if (payment.invoiceId) {
      const invoice = this.invoices.find(i => i.id === payment.invoiceId && i.tenantId === tenantId);
      if (invoice) {
        const currentTotal = parseFloat(invoice.total);
        const paymentAmount = parseFloat(payment.amount);
        const restoredBalance = currentTotal + paymentAmount;
        
        invoice.status = restoredBalance > 0 ? 'sent' : invoice.status;
        invoice.updatedAt = new Date();
      }
    }
  }

  async getNextCustomerPaymentNumber(tenantId: string): Promise<string> {
    const current = this.customerPaymentSequenceCounters.get(tenantId) || 0;
    const next = current + 1;
    this.customerPaymentSequenceCounters.set(tenantId, next);
    return `PAY-${String(next).padStart(4, '0')}`;
  }

  // Recurring Invoice operations
  async getRecurringInvoices(tenantId: string): Promise<RecurringInvoice[]> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async getRecurringInvoiceById(id: string, tenantId: string): Promise<RecurringInvoice | null> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async createRecurringInvoice(data: InsertRecurringInvoice, lineItems: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async updateRecurringInvoice(id: string, tenantId: string, data: Partial<InsertRecurringInvoice>, lineItems?: InsertRecurringInvoiceLineItem[]): Promise<RecurringInvoice> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async deleteRecurringInvoice(id: string, tenantId: string): Promise<void> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async getRecurringInvoiceLineItems(recurringInvoiceId: string, tenantId: string): Promise<RecurringInvoiceLineItem[]> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async generateInvoiceFromRecurring(recurringId: string, tenantId: string): Promise<Invoice> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }

  async processRecurringInvoices(tenantId: string): Promise<Invoice[]> {
    throw new Error('Recurring invoices not implemented in MemStorage');
  }
}

export const storage = new DatabaseStorage();
