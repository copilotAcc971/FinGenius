import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import OpenAI from "openai";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendInvoiceEmail } from "./email-service";
import { generateInvoicePDF } from "./pdf-service";
import googleDriveRoutes from "./google-drive-routes";
import {
  insertTenantSchema,
  insertTenantCompanyProfileSchema,
  updateTenantCompanyProfileSchema,
  insertCustomerSchema,
  updateCustomerSchema,
  insertVendorSchema,
  insertAccountSchema,
  insertItemSchema,
  insertTaxSchema,
  updateTaxSchema,
  insertInvoiceSchema,
  invoicePayloadSchema,
  insertBillSchema,
  billPayloadSchema,
  purchaseOrderPayloadSchema,
  insertExpenseSchema,
  insertPaymentSchema,
  insertDocumentSchema,
  insertQuoteSchema,
  insertQuoteLineItemSchema,
  insertSalesOrderSchema,
  insertSalesOrderLineItemSchema,
  insertCreditNoteSchema,
  insertCreditNoteLineItemSchema,
  insertCustomerPaymentSchema,
  insertRecurringInvoiceSchema,
  insertRecurringInvoiceLineItemSchema,
  insertRetainerInvoiceSchema,
  insertRetainerInvoiceLineItemSchema,
  insertJournalEntrySchema,
  journalEntryPayloadSchema,
  insertAssetSchema,
  insertBankReconciliationSchema,
  bankReconciliationPayloadSchema,
} from "@shared/schema";

// Initialize Stripe and OpenAI only if credentials are available
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-10-29.clover" })
  : null;

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Schema for send-email endpoint
const sendEmailSchema = z.object({
  message: z.string().optional()
});

// Middleware to verify tenant membership
async function verifyTenantAccess(req: any, res: any, next: any) {
  try {
    const userId = req.user.claims.sub;
    const tenantId = req.query.tenantId || req.headers['x-tenant-id'] || req.body.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // Check if user is a member or owner of this tenant
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Check if user is owner
    if (tenant.ownerId === userId) {
      req.tenantId = tenantId;
      return next();
    }

    // Check if user is a member
    const isMember = await storage.isTenantMember(tenantId, userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied to this workspace" });
    }

    // Attach verified tenantId to request
    req.tenantId = tenantId;
    next();
  } catch (error) {
    console.error("Error verifying tenant access:", error);
    res.status(500).json({ message: "Failed to verify tenant access" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Google Drive routes (no auth required for now)
  app.use(googleDriveRoutes);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Tenant routes
  app.get('/api/tenants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenants = await storage.getTenantsByUserId(userId);
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post('/api/tenants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertTenantSchema.parse({ ...req.body, ownerId: userId });
      const tenant = await storage.createTenant(parsed);
      res.json(tenant);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      res.status(400).json({ message: error.message || "Failed to create tenant" });
    }
  });

  app.patch('/api/tenants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Storage layer will verify ownership
      const updated = await storage.updateTenant(id, userId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      res.status(400).json({ message: error.message || "Failed to update tenant" });
    }
  });

  // Company Profile routes
  app.get('/api/company-profile', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const profile = await storage.getCompanyProfile(req.tenantId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  app.post('/api/company-profile', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const parsed = insertTenantCompanyProfileSchema.parse({ ...req.body, tenantId: req.tenantId });
      const profile = await storage.createCompanyProfile(parsed);
      res.json(profile);
    } catch (error: any) {
      console.error("Error creating company profile:", error);
      res.status(400).json({ message: error.message || "Failed to create company profile" });
    }
  });

  app.patch('/api/company-profile', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      if (!req.tenantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // SECURITY: Use schema that excludes tenantId to prevent tampering
      const parsed = updateTenantCompanyProfileSchema.parse(req.body);
      
      const updated = await storage.updateCompanyProfile(req.tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating company profile:", error);
      res.status(400).json({ message: error.message || "Failed to update company profile" });
    }
  });

  // Customer routes
  app.get('/api/customers', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const customers = await storage.getCustomersByTenant(req.tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      // Use verified tenantId from middleware
      const parsed = insertCustomerSchema.parse({ ...req.body, tenantId: req.tenantId });
      const customer = await storage.createCustomer(parsed);
      res.json(customer);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      res.status(400).json({ message: error.message || "Failed to create customer" });
    }
  });

  app.patch('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Fetch the customer to get its tenantId
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Verify user owns the tenant this customer belongs to
      const tenant = await storage.getTenant(customer.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate the update payload
      const parsed = updateCustomerSchema.parse(req.body);
      
      // Now perform the update
      const updated = await storage.updateCustomer(id, customer.tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      res.status(400).json({ message: error.message || "Failed to update customer" });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Fetch the customer to get its tenantId
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Verify user owns the tenant this customer belongs to
      const tenant = await storage.getTenant(customer.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Now perform the delete
      await storage.deleteCustomer(id, customer.tenantId);
      res.json({ message: "Customer deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      res.status(400).json({ message: error.message || "Failed to delete customer" });
    }
  });

  // Vendor routes
  app.get('/api/vendors', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const vendors = await storage.getVendorsByTenant(req.tenantId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post('/api/vendors', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const parsed = insertVendorSchema.parse({ ...req.body, tenantId: req.tenantId });
      const vendor = await storage.createVendor(parsed);
      res.json(vendor);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      res.status(400).json({ message: error.message || "Failed to create vendor" });
    }
  });

  app.patch('/api/vendors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Fetch the vendor to get its tenantId
      const vendor = await storage.getVendor(id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Verify user owns the tenant this vendor belongs to
      const tenant = await storage.getTenant(vendor.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Now perform the update
      const updated = await storage.updateVendor(id, vendor.tenantId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating vendor:", error);
      res.status(400).json({ message: error.message || "Failed to update vendor" });
    }
  });

  app.delete('/api/vendors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Fetch the vendor to get its tenantId
      const vendor = await storage.getVendor(id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Verify user owns the tenant this vendor belongs to
      const tenant = await storage.getTenant(vendor.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Now perform the delete
      await storage.deleteVendor(id, vendor.tenantId);
      res.json({ message: "Vendor deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting vendor:", error);
      res.status(400).json({ message: error.message || "Failed to delete vendor" });
    }
  });

  // Account routes
  app.get('/api/accounts', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const accounts = await storage.getAccounts(req.tenantId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.post('/api/accounts', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse req.body - insertAccountSchema omits tenantId
      const parsed = insertAccountSchema.parse(req.body);
      
      // Auto-generate account code if not provided
      const code = parsed.code || await storage.getNextAccountNumber(tenantId);
      
      // Add verified tenantId and code back AFTER parsing
      const account = await storage.createAccount({ ...parsed, code, tenantId });
      res.status(201).json(account);
    } catch (error: any) {
      console.error("Error creating account:", error);
      res.status(400).json({ message: error.message || "Failed to create account" });
    }
  });

  app.patch('/api/accounts/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify account exists and belongs to this tenant
      const existingAccount = await storage.getAccount(id);
      if (!existingAccount) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      // Verify the account belongs to the tenant the user has access to
      if (existingAccount.tenantId !== tenantId) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      // STRIP tenantId from payload - NEVER trust client
      const { tenantId: _, ...sanitizedPayload } = req.body;
      
      // Validate sanitized payload
      const parsed = insertAccountSchema.partial().parse(sanitizedPayload);
      
      // Update with VERIFIED tenantId
      const updated = await storage.updateAccount(id, tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating account:", error);
      res.status(400).json({ message: error.message || "Failed to update account" });
    }
  });

  app.delete('/api/accounts/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify account exists and belongs to this tenant
      const existingAccount = await storage.getAccount(id);
      if (!existingAccount) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      // Verify the account belongs to the tenant the user has access to
      if (existingAccount.tenantId !== tenantId) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      // Delete using VERIFIED tenantId from middleware
      await storage.deleteAccount(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(400).json({ message: error.message || "Failed to delete account" });
    }
  });

  // Item routes
  app.get('/api/items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const items = await storage.getItems(req.tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post('/api/items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse req.body - insertItemSchema.omit strips tenantId
      const parsed = insertItemSchema.parse(req.body);
      
      // Add verified tenantId back AFTER parsing
      const item = await storage.createItem({ ...parsed, tenantId });
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating item:", error);
      res.status(400).json({ message: error.message || "Failed to create item" });
    }
  });

  app.patch('/api/items/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify item exists and belongs to this tenant
      const existingItem = await storage.getItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Verify the item belongs to the tenant the user has access to
      if (existingItem.tenantId !== tenantId) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // STRIP tenantId from payload - NEVER trust client
      const { tenantId: _, ...sanitizedPayload } = req.body;
      
      // Validate sanitized payload
      const parsed = insertItemSchema.partial().parse(sanitizedPayload);
      
      // Update with VERIFIED tenantId
      const updated = await storage.updateItem(id, tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating item:", error);
      res.status(400).json({ message: error.message || "Failed to update item" });
    }
  });

  app.delete('/api/items/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify item exists and belongs to this tenant
      const existingItem = await storage.getItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Verify the item belongs to the tenant the user has access to
      if (existingItem.tenantId !== tenantId) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Delete using VERIFIED tenantId from middleware
      await storage.deleteItem(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      res.status(400).json({ message: error.message || "Failed to delete item" });
    }
  });

  // Tax routes
  app.get('/api/taxes', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const taxes = await storage.getTaxes(req.tenantId);
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      res.status(500).json({ message: "Failed to fetch taxes" });
    }
  });

  app.post('/api/taxes', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse req.body - insertTaxSchema.omit strips tenantId
      const parsed = insertTaxSchema.parse(req.body);
      
      // Add verified tenantId back AFTER parsing
      const tax = await storage.createTax({ ...parsed, tenantId });
      res.status(201).json(tax);
    } catch (error: any) {
      console.error("Error creating tax:", error);
      res.status(400).json({ message: error.message || "Failed to create tax" });
    }
  });

  app.patch('/api/taxes/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify tax exists and belongs to this tenant
      const existingTax = await storage.getTax(id);
      if (!existingTax) {
        return res.status(404).json({ message: "Tax not found" });
      }
      
      // Verify the tax belongs to the tenant the user has access to
      if (existingTax.tenantId !== tenantId) {
        return res.status(404).json({ message: "Tax not found" });
      }
      
      // STRIP tenantId from payload - NEVER trust client
      const { tenantId: _, ...sanitizedPayload } = req.body;
      
      // Validate sanitized payload with custom update schema
      const parsed = updateTaxSchema.parse(sanitizedPayload);
      
      // Update with VERIFIED tenantId
      const updated = await storage.updateTax(id, tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating tax:", error);
      res.status(400).json({ message: error.message || "Failed to update tax" });
    }
  });

  app.delete('/api/taxes/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify tax exists and belongs to this tenant
      const existingTax = await storage.getTax(id);
      if (!existingTax) {
        return res.status(404).json({ message: "Tax not found" });
      }
      
      // Verify the tax belongs to the tenant the user has access to
      if (existingTax.tenantId !== tenantId) {
        return res.status(404).json({ message: "Tax not found" });
      }
      
      // Delete using VERIFIED tenantId from middleware
      await storage.deleteTax(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting tax:", error);
      res.status(400).json({ message: error.message || "Failed to delete tax" });
    }
  });

  // Invoice routes
  app.get('/api/invoices', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const invoices = await storage.getInvoicesByTenant(req.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get('/api/invoices/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoiceById(id, req.tenantId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found or has been deleted" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get('/api/invoices/:id/line-items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const tenant = await storage.getTenant(invoice.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const lineItems = await storage.getInvoiceLineItems(id, req.tenantId);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching invoice line items:", error);
      res.status(500).json({ message: "Failed to fetch invoice line items" });
    }
  });

  app.post('/api/invoices', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const parsed = invoicePayloadSchema.parse({
        invoice: { ...req.body.invoice, tenantId: req.tenantId },
        lineItems: req.body.lineItems || [],
      });
      
      // Validate issuerTaxId is present for tax compliance
      if (!parsed.invoice.issuerTaxId || parsed.invoice.issuerTaxId.trim() === '') {
        return res.status(400).json({ 
          message: "Issuer tax registration number is required for invoices" 
        });
      }
      
      const invoice = await storage.createInvoiceWithItems(parsed);
      res.json(invoice);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      res.status(400).json({ message: error.message || "Failed to create invoice" });
    }
  });

  app.patch('/api/invoices/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // SECURITY: Verify invoice exists and belongs to tenant before update
      const existing = await storage.getInvoiceById(id, req.tenantId);
      if (!existing) {
        return res.status(404).json({ message: "Invoice not found or has been deleted" });
      }
      
      const parsed = invoicePayloadSchema.parse({
        invoice: { ...req.body.invoice, tenantId: req.tenantId },
        lineItems: req.body.lineItems || [],
      });
      
      // Validate issuerTaxId is present for tax compliance
      if (!parsed.invoice.issuerTaxId || parsed.invoice.issuerTaxId.trim() === '') {
        return res.status(400).json({ 
          message: "Issuer tax registration number is required for invoices" 
        });
      }
      
      const updated = await storage.updateInvoiceWithItems(id, req.tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating invoice:", error);
      if (error.message === "Invoice not found or has been deleted") {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: error.message || "Failed to update invoice" });
    }
  });

  app.delete('/api/invoices/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const tenant = await storage.getTenant(invoice.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteInvoice(id, invoice.tenantId);
      if (success) {
        res.json({ message: "Invoice deleted successfully" });
      } else {
        res.status(404).json({ message: "Invoice not found or already deleted" });
      }
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      res.status(400).json({ message: error.message || "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices/:id/send-email", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    const { id } = req.params;
    const tenantId = req.tenantId;
    
    try {
      // Validate with default empty string for message
      const validatedBody = sendEmailSchema.parse(req.body);
      const customMessage = validatedBody.message || ''; // Default to empty string
      
      // Get invoice with customer details
      const invoice = await storage.getInvoiceById(id, tenantId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const customer = await storage.getCustomerById(invoice.customerId, tenantId);
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "Customer email not found" });
      }
      
      const companyProfile = await storage.getCompanyProfile(tenantId);
      
      // Gracefully handle missing company profile
      const companyName = companyProfile?.legalName || 'Company';
      
      // STEP 1: Validate invoice data BEFORE attempting email send
      // This prevents misleading success responses when data is fundamentally invalid
      
      // Validate dates
      if (!invoice.invoiceDate || !invoice.dueDate) {
        return res.status(400).json({ 
          error: "Cannot send invoice - missing invoice or due date" 
        });
      }

      const invoiceDate = new Date(invoice.invoiceDate);
      const dueDate = new Date(invoice.dueDate);

      if (isNaN(invoiceDate.getTime()) || isNaN(dueDate.getTime())) {
        return res.status(400).json({ 
          error: "Cannot send invoice - invalid invoice or due date" 
        });
      }

      // Validate totals
      if (invoice.subtotal == null || invoice.subtotal === '' ||
          invoice.taxAmount == null || invoice.taxAmount === '' ||
          invoice.total == null || invoice.total === '') {
        return res.status(400).json({ 
          error: "Cannot send invoice - missing invoice totals" 
        });
      }

      const subtotal = parseFloat(invoice.subtotal.toString());
      const taxAmount = parseFloat(invoice.taxAmount.toString());
      const total = parseFloat(invoice.total.toString());

      if (isNaN(subtotal) || isNaN(taxAmount) || isNaN(total)) {
        return res.status(400).json({ 
          error: "Cannot send invoice - invalid invoice totals" 
        });
      }
      
      // Generate PDF attachment
      let pdfBuffer: Buffer | null = null;
      let pdfAttached = false;
      let pdfError: string | null = null;
      
      try {
        // Get line items with tax details
        const lineItems = await storage.getInvoiceLineItemsWithTax(id, tenantId);
        
        // STEP 2: Removed line items check - attempt PDF generation even with zero items
        // This makes email endpoint consistent with download endpoint behavior
        
        // Use fallback values for missing company profile data
        const companyLegalName = companyProfile?.legalName || 'Company Name Not Set';
        const companyTaxId = companyProfile?.taxRegistrationNumber || 'Tax ID Not Set';
        
        // Format company address
        let companyAddress: string | undefined;
        if (companyProfile?.address) {
          try {
            const addr = typeof companyProfile.address === 'string' 
              ? JSON.parse(companyProfile.address) 
              : companyProfile.address;
            companyAddress = [addr.street, addr.city, addr.state, addr.zip, addr.country]
              .filter(Boolean)
              .join(', ');
          } catch {
            companyAddress = companyProfile.address as string;
          }
        }

        // Format customer address
        let customerAddress: string | undefined;
        if (customer.address) {
          try {
            const addr = typeof customer.address === 'string' 
              ? JSON.parse(customer.address) 
              : customer.address;
            customerAddress = [addr.street, addr.city, addr.state, addr.zip, addr.country]
              .filter(Boolean)
              .join(', ');
          } catch {
            customerAddress = customer.address as string;
          }
        }
        
        // Build PDF data
        const pdfData = {
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: invoiceDate,
            dueDate: dueDate,
            invoiceSubject: invoice.invoiceSubject || undefined,
            status: invoice.status,
            subtotal: subtotal,
            totalTax: taxAmount,
            total: total,
            issuerTaxId: invoice.issuerTaxId || '',
            customerTaxId: invoice.customerTaxId || undefined,
          },
          customer: {
            name: customer.name,
            email: customer.email || '',
            address: customerAddress,
            taxRegistrationNumber: customer.taxRegistrationNumber || undefined,
          },
          companyProfile: {
            legalName: companyLegalName,
            taxRegistrationNumber: companyTaxId,
            address: companyAddress,
          },
          lineItems: (lineItems || []).map(item => {
            const quantity = parseFloat(item.quantity?.toString() || '0');
            const rate = parseFloat(item.rate?.toString() || '0');
            const amount = parseFloat(item.amount?.toString() || '0');
            
            const discountValue = item.discount != null ? parseFloat(item.discount.toString()) : NaN;
            const discount = !isNaN(discountValue) ? discountValue : undefined;
            
            const taxRateValue = item.taxRate != null ? parseFloat(item.taxRate.toString()) : NaN;
            const taxRate = !isNaN(taxRateValue) ? taxRateValue : undefined;

            if (isNaN(quantity) || isNaN(rate) || isNaN(amount)) {
              throw new Error(`Invalid line item data for item: ${item.description}`);
            }

            return {
              description: item.description,
              quantity: quantity,
              rate: rate,
              amount: amount,
              discount: discount,
              taxName: item.taxName || undefined,
              taxRate: taxRate,
            };
          }),
        };

        // Generate PDF
        pdfBuffer = await generateInvoicePDF(pdfData);
        pdfAttached = true;
        console.log(`[Invoice ${invoice.invoiceNumber}] PDF generated successfully`, {
          tenantId,
          invoiceId: invoice.id,
          lineItemCount: lineItems?.length || 0
        });
      } catch (pdfGenerationError: any) {
        // STEP 4: Improved structured logging
        pdfError = pdfGenerationError.message || 'PDF generation failed';
        console.error(`[Invoice ${invoice.invoiceNumber}] PDF generation failed:`, {
          tenantId,
          invoiceId: invoice.id,
          error: pdfError,
          stack: pdfGenerationError.stack
        });
        // Continue without PDF attachment - email will still be sent
      }
      
      // Build email body with PDF status note
      const pdfNote = pdfAttached 
        ? '<p><em>A PDF copy of this invoice is attached to this email.</em></p>'
        : pdfError
        ? `<p><em>Note: PDF attachment could not be generated (${pdfError}). Please download the invoice from your account.</em></p>`
        : '<p><em>Note: Please download the invoice PDF from your account.</em></p>';
      
      const subject = `Invoice ${invoice.invoiceNumber} from ${companyName}`;
      let body = `
        <html>
          <body>
            <h2>Invoice ${invoice.invoiceNumber}</h2>
            <p>Dear ${customer.name},</p>
            ${customMessage ? `<p>${customMessage}</p>` : '<p>Please find your invoice details below.</p>'}
            ${pdfNote}
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> $${parseFloat(invoice.total).toFixed(2)}</p>
            ${invoice.invoiceSubject ? `<p><strong>Subject:</strong> ${invoice.invoiceSubject}</p>` : ''}
            <br/>
            <p>Thank you for your business!</p>
            <p>Best regards,<br/>${companyName}</p>
          </body>
        </html>
      `;
      
      // Send email
      let emailSent = false;
      try {
        await sendInvoiceEmail({
          to: customer.email,
          subject,
          body,
          invoiceNumber: invoice.invoiceNumber || '',
          pdfAttachment: pdfBuffer ? {
            filename: `invoice-${invoice.invoiceNumber || invoice.id}.pdf`,
            content: pdfBuffer
          } : undefined
        });
        emailSent = true; // Mark as sent
      } catch (emailError: any) {
        // Email send failed - update status and return error
        try {
          await storage.updateInvoice(id, tenantId, {
            emailStatus: 'failed',
            emailError: emailError.message || 'Failed to send email'
          });
        } catch (updateError) {
          console.error('Failed to update invoice email error status:', updateError);
        }
        
        // Handle Outlook connection errors gracefully
        if (emailError.message?.includes('Outlook not connected')) {
          return res.status(503).json({ 
            error: 'Email service not configured. Please set up Outlook integration.' 
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to send email: ' + emailError.message 
        });
      }
      
      // Email sent successfully - now update DB
      if (emailSent) {
        try {
          await storage.updateInvoice(id, tenantId, {
            emailSentAt: new Date(),
            emailSentTo: customer.email,
            emailStatus: 'sent'
          });
          
          const updatedInvoice = await storage.getInvoiceById(id, tenantId);
          // STEP 3: Always include pdfAttached and pdfError in response
          return res.json({ 
            success: true, 
            message: pdfAttached 
              ? 'Invoice sent successfully with PDF attachment'
              : 'Invoice sent successfully without PDF attachment',
            invoice: updatedInvoice,
            pdfAttached: pdfAttached,
            pdfError: pdfError || undefined
          });
        } catch (updateError: any) {
          // SPECIAL CASE: Email sent but DB update failed
          console.error('Failed to update invoice email status after successful send:', updateError);
          return res.status(500).json({ 
            error: 'Email sent successfully but failed to update invoice status. Please refresh to see latest data.',
            emailSent: true // Flag to indicate email was sent
          });
        }
      }
    } catch (error: any) {
      console.error('Error in send-email endpoint:', error);
      
      // Return JSON error for validation failures
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request: ' + error.errors.map(e => e.message).join(', ') 
        });
      }
      
      return res.status(500).json({ 
        error: error.message || 'Internal server error' 
      });
    }
  });

  app.get("/api/invoices/:id/pdf", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    const { id } = req.params;
    const tenantId = req.tenantId; // From verifyTenantAccess middleware

    try {
      // SECURITY: Three-layer defense in depth for tenant isolation
      // Layer 1: isAuthenticated + verifyTenantAccess middleware
      // Layer 2: storage.getInvoiceById filters by tenantId
      // Layer 3: Explicit ownership verification below

      // Get invoice with tenant filter
      const invoice = await storage.getInvoiceById(id, tenantId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Layer 3: Explicit tenant ownership verification
      if (invoice.tenantId !== tenantId) {
        console.error(`Security violation: User attempted to access invoice ${id} from different tenant`);
        return res.status(403).json({ error: "Access denied" });
      }

      // Get customer
      const customer = await storage.getCustomerById(invoice.customerId, tenantId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get company profile
      const companyProfile = await storage.getCompanyProfile(tenantId);
      if (!companyProfile) {
        return res.status(400).json({ error: "Company profile not configured" });
      }

      // Get line items with tax details using NEW method
      const lineItems = await storage.getInvoiceLineItemsWithTax(id, tenantId);
      
      // Validate invoice has line items
      if (!lineItems || lineItems.length === 0) {
        return res.status(400).json({ 
          error: "Cannot generate PDF for invoice without line items" 
        });
      }
      
      // Format company address
      let companyAddress: string | undefined;
      if (companyProfile.address) {
        try {
          const addr = typeof companyProfile.address === 'string' 
            ? JSON.parse(companyProfile.address) 
            : companyProfile.address;
          companyAddress = [addr.street, addr.city, addr.state, addr.zip, addr.country]
            .filter(Boolean)
            .join(', ');
        } catch {
          companyAddress = companyProfile.address as string;
        }
      }

      // Format customer address
      let customerAddress: string | undefined;
      if (customer.address) {
        try {
          const addr = typeof customer.address === 'string' 
            ? JSON.parse(customer.address) 
            : customer.address;
          customerAddress = [addr.street, addr.city, addr.state, addr.zip, addr.country]
            .filter(Boolean)
            .join(', ');
        } catch {
          customerAddress = customer.address as string;
        }
      }
      
      // Validate dates - reject null/empty values before conversion
      const invoiceDateValue = invoice.invoiceDate;
      const dueDateValue = invoice.dueDate;

      if (!invoiceDateValue || !dueDateValue) {
        return res.status(400).json({ 
          error: "Missing invoice or due date - unable to generate PDF" 
        });
      }

      const invoiceDate = new Date(invoiceDateValue);
      const dueDate = new Date(dueDateValue);
      
      if (isNaN(invoiceDate.getTime()) || isNaN(dueDate.getTime())) {
        return res.status(400).json({ 
          error: "Invalid invoice or due date - unable to generate PDF" 
        });
      }

      // Validate numeric fields - reject null/empty values
      if (invoice.subtotal == null || invoice.subtotal === '' ||
          invoice.taxAmount == null || invoice.taxAmount === '' ||
          invoice.total == null || invoice.total === '') {
        return res.status(400).json({ 
          error: "Missing invoice totals - unable to generate PDF" 
        });
      }

      // Convert all numeric fields from strings to numbers with validation
      const subtotal = parseFloat(invoice.subtotal.toString());
      const taxAmount = parseFloat(invoice.taxAmount.toString());
      const total = parseFloat(invoice.total.toString());

      // Validate numeric conversions
      if (isNaN(subtotal) || isNaN(taxAmount) || isNaN(total)) {
        return res.status(400).json({ 
          error: "Invalid invoice totals - unable to generate PDF" 
        });
      }

      // Build PDF data with proper type conversion
      const pdfData = {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber || '',
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          invoiceSubject: invoice.invoiceSubject || undefined,
          status: invoice.status,
          subtotal: subtotal,        // number
          totalTax: taxAmount,       // number
          total: total,              // number
          issuerTaxId: invoice.issuerTaxId || '',
          customerTaxId: invoice.customerTaxId || undefined,
        },
        customer: {
          name: customer.name,
          email: customer.email || '',
          address: customerAddress,
          taxRegistrationNumber: customer.taxRegistrationNumber || undefined,
        },
        companyProfile: {
          legalName: companyProfile.legalName,
          taxRegistrationNumber: companyProfile.taxRegistrationNumber || '',
          address: companyAddress,
        },
        lineItems: lineItems.map(item => {
          // Convert line item fields to numbers with validation
          const quantity = parseFloat(item.quantity?.toString() || '0');
          const rate = parseFloat(item.rate?.toString() || '0');
          const amount = parseFloat(item.amount?.toString() || '0');
          
          // Handle optional discount and taxRate (treat empty/null as undefined, not NaN)
          const discountValue = item.discount != null ? parseFloat(item.discount.toString()) : NaN;
          const discount = !isNaN(discountValue) ? discountValue : undefined;
          
          const taxRateValue = item.taxRate != null ? parseFloat(item.taxRate.toString()) : NaN;
          const taxRate = !isNaN(taxRateValue) ? taxRateValue : undefined;

          // Validate required conversions (quantity, rate, amount must be valid)
          if (isNaN(quantity) || isNaN(rate) || isNaN(amount)) {
            throw new Error(`Invalid line item data for item: ${item.description}`);
          }

          return {
            description: item.description,
            quantity: quantity,      // number
            rate: rate,              // number
            amount: amount,          // number
            discount: discount,      // number | undefined
            taxName: item.taxName || undefined,
            taxRate: taxRate,        // number | undefined
          };
        }),
      };

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(pdfData);

      // Generate filename with fallback
      const filename = invoice.invoiceNumber 
        ? `invoice-${invoice.invoiceNumber}.pdf`
        : `invoice-${invoice.id}.pdf`;

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: error.message || 'Failed to generate PDF' });
    }
  });

  // ===== QUOTES =====

  // Get all quotes for tenant
  app.get("/api/quotes", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const quotes = await storage.getQuotes(tenantId);
      res.json(quotes);
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote by ID
  app.get("/api/quotes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const quote = await storage.getQuoteById(id, tenantId);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      res.json(quote);
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote line items
  app.get("/api/quotes/:id/line-items", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const lineItems = await storage.getQuoteLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Error fetching quote line items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create quote
  app.post("/api/quotes", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!; // From middleware - trusted source
      const { lineItems, ...quoteData } = req.body;
      
      // SECURITY: IGNORE client-provided tenantId, use req.tenantId instead
      const validatedQuote = insertQuoteSchema.parse({ ...quoteData, tenantId });
      
      // Validate line items - also use req.tenantId
      const validatedLineItems = lineItems.map((item: any) =>
        insertQuoteLineItemSchema.parse({ ...item, tenantId })
      );
      
      const quote = await storage.createQuote(validatedQuote, validatedLineItems);
      res.status(201).json(quote);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating quote:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update quote
  app.patch("/api/quotes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!; // From middleware - trusted source
      const { lineItems, subtotal, taxAmount, total, ...quoteData } = req.body;
      
      // SECURITY: Strip out any client-provided totals (server will calculate)
      // Only allow non-financial fields to be updated
      
      const partialQuoteSchema = insertQuoteSchema.partial().omit({
        subtotal: true,
        taxAmount: true,
        total: true,
      });
      const validatedQuote = partialQuoteSchema.parse({ ...quoteData, tenantId });
      
      // Validate line items if provided
      let validatedLineItems;
      if (lineItems !== undefined) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          return res.status(422).json({ message: 'At least one line item is required' });
        }
        validatedLineItems = lineItems.map((item: any) =>
          insertQuoteLineItemSchema.parse({ ...item, tenantId })
        );
      }
      
      const quote = await storage.updateQuote(id, tenantId, validatedQuote, validatedLineItems);
      res.json(quote);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating quote:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete quote (soft delete)
  app.delete("/api/quotes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteQuote(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Convert quote to invoice
  app.post("/api/quotes/:id/convert-to-invoice", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const invoice = await storage.convertQuoteToInvoice(id, tenantId);
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Error converting quote to invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Sales Order routes
  // List sales orders
  app.get("/api/sales-orders", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const orders = await storage.getSalesOrders(tenantId);
      res.json(orders);
    } catch (error: any) {
      console.error('Error fetching sales orders:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get sales order by ID
  app.get("/api/sales-orders/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const order = await storage.getSalesOrderById(id, tenantId);
      
      if (!order) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      
      res.json(order);
    } catch (error: any) {
      console.error('Error fetching sales order:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get sales order line items
  app.get("/api/sales-orders/:id/line-items", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const lineItems = await storage.getSalesOrderLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Error fetching sales order line items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create sales order
  app.post("/api/sales-orders", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!; // From middleware - trusted source
      const { lineItems, ...orderData } = req.body;
      
      // SECURITY: IGNORE client-provided tenantId, use req.tenantId instead
      const validatedOrder = insertSalesOrderSchema.parse({ ...orderData, tenantId });
      
      // Validate line items - also use req.tenantId
      const validatedLineItems = lineItems.map((item: any) =>
        insertSalesOrderLineItemSchema.parse({ ...item, tenantId })
      );
      
      const order = await storage.createSalesOrder(validatedOrder, validatedLineItems);
      res.status(201).json(order);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating sales order:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update sales order
  app.patch("/api/sales-orders/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!; // From middleware - trusted source
      const { lineItems, subtotal, taxAmount, total, ...orderData } = req.body;
      
      // SECURITY: Strip out any client-provided totals (server will calculate)
      // Only allow non-financial fields to be updated
      
      const partialOrderSchema = insertSalesOrderSchema.partial().omit({
        subtotal: true,
        taxAmount: true,
        total: true,
      });
      const validatedOrder = partialOrderSchema.parse({ ...orderData, tenantId });
      
      // Validate line items if provided
      let validatedLineItems;
      if (lineItems !== undefined) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          return res.status(422).json({ message: 'At least one line item is required' });
        }
        validatedLineItems = lineItems.map((item: any) =>
          insertSalesOrderLineItemSchema.parse({ ...item, tenantId })
        );
      }
      
      const order = await storage.updateSalesOrder(id, tenantId, validatedOrder, validatedLineItems);
      res.json(order);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating sales order:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete sales order (soft delete)
  app.delete("/api/sales-orders/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteSalesOrder(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting sales order:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Convert sales order to invoice
  app.post("/api/sales-orders/:id/convert-to-invoice", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const invoice = await storage.convertSalesOrderToInvoice(id, tenantId);
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Error converting sales order to invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CREDIT NOTES =====

  // Get all credit notes for tenant
  app.get("/api/credit-notes", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const creditNotes = await storage.getCreditNotes(tenantId);
      res.json(creditNotes);
    } catch (error: any) {
      console.error('Error fetching credit notes:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get credit note by ID
  app.get("/api/credit-notes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const creditNote = await storage.getCreditNoteById(id, tenantId);
      
      if (!creditNote) {
        return res.status(404).json({ message: "Credit note not found" });
      }
      
      res.json(creditNote);
    } catch (error: any) {
      console.error('Error fetching credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get credit note line items
  app.get("/api/credit-notes/:id/line-items", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const lineItems = await storage.getCreditNoteLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Error fetching credit note line items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create credit note
  app.post("/api/credit-notes", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { lineItems, ...creditNoteData } = req.body;
      
      // SECURITY: Use req.tenantId from middleware
      const validatedCreditNote = insertCreditNoteSchema.parse({ ...creditNoteData, tenantId });
      
      // Validate line items
      const validatedLineItems = lineItems.map((item: any) =>
        insertCreditNoteLineItemSchema.parse({ ...item, tenantId })
      );
      
      const creditNote = await storage.createCreditNote(validatedCreditNote, validatedLineItems);
      res.status(201).json(creditNote);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update credit note
  app.patch("/api/credit-notes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { lineItems, subtotal, taxAmount, total, balanceRemaining, ...creditNoteData } = req.body;
      
      // SECURITY: Strip out client-provided totals (server will calculate)
      const partialCreditNoteSchema = insertCreditNoteSchema.partial().omit({
        subtotal: true,
        taxAmount: true,
        total: true,
        balanceRemaining: true,
      });
      const validatedCreditNote = partialCreditNoteSchema.parse({ ...creditNoteData, tenantId });
      
      // Validate line items if provided
      let validatedLineItems;
      if (lineItems !== undefined) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          return res.status(422).json({ message: 'At least one line item is required' });
        }
        validatedLineItems = lineItems.map((item: any) =>
          insertCreditNoteLineItemSchema.parse({ ...item, tenantId })
        );
      }
      
      const creditNote = await storage.updateCreditNote(id, tenantId, validatedCreditNote, validatedLineItems);
      res.json(creditNote);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete credit note (soft delete)
  app.delete("/api/credit-notes/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteCreditNote(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Apply credit note to invoice
  app.post("/api/credit-notes/:id/apply-to-invoice", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { invoiceId, amount } = req.body;
      
      if (!invoiceId || !amount) {
        return res.status(400).json({ message: 'Invoice ID and amount are required' });
      }
      
      await storage.applyCreditNoteToInvoice(id, invoiceId, amount, tenantId);
      res.status(200).json({ message: 'Credit note applied successfully' });
    } catch (error: any) {
      console.error('Error applying credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Customer Payment routes (Accounts Receivable)
  app.get("/api/customer-payments", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const payments = await storage.getCustomerPayments(tenantId);
      res.json(payments);
    } catch (error: any) {
      console.error('Error fetching customer payments:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customer-payments/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const payment = await storage.getCustomerPaymentById(id, tenantId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error: any) {
      console.error('Error fetching customer payment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customer-payments", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const validated = insertCustomerPaymentSchema.parse({ ...req.body, tenantId });
      const payment = await storage.createCustomerPayment(validated);
      res.status(201).json(payment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating customer payment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/customer-payments/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const partialSchema = insertCustomerPaymentSchema.partial();
      const validated = partialSchema.parse({ ...req.body, tenantId });
      const payment = await storage.updateCustomerPayment(id, tenantId, validated);
      res.json(payment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating customer payment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/customer-payments/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteCustomerPayment(id, tenantId);
      res.json({ message: "Payment deleted" });
    } catch (error: any) {
      console.error('Error deleting customer payment:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Recurring Invoice routes
  app.get("/api/recurring-invoices", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const recurringInvoices = await storage.getRecurringInvoices(tenantId);
      res.json(recurringInvoices);
    } catch (error: any) {
      console.error('Error fetching recurring invoices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recurring-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const recurringInvoice = await storage.getRecurringInvoiceById(id, tenantId);
      if (!recurringInvoice) {
        return res.status(404).json({ message: "Recurring invoice not found" });
      }
      res.json(recurringInvoice);
    } catch (error: any) {
      console.error('Error fetching recurring invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recurring-invoices/:id/line-items", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const lineItems = await storage.getRecurringInvoiceLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Error fetching recurring invoice line items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/recurring-invoices", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { lineItems, ...recurringData } = req.body;
      
      // Validate recurring invoice data
      const validatedData = insertRecurringInvoiceSchema.parse({ ...recurringData, tenantId });
      
      // Validate line items
      const validatedLineItems = lineItems.map((item: any) => 
        insertRecurringInvoiceLineItemSchema.parse(item)
      );
      
      const recurringInvoice = await storage.createRecurringInvoice(validatedData, validatedLineItems);
      res.status(201).json(recurringInvoice);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating recurring invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/recurring-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { lineItems, ...recurringData } = req.body;
      
      // Validate data
      const partialSchema = insertRecurringInvoiceSchema.partial();
      const validatedData = partialSchema.parse(recurringData);
      
      let validatedLineItems;
      if (lineItems) {
        validatedLineItems = lineItems.map((item: any) => 
          insertRecurringInvoiceLineItemSchema.parse(item)
        );
      }
      
      const updated = await storage.updateRecurringInvoice(id, tenantId, validatedData, validatedLineItems);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating recurring invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/recurring-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteRecurringInvoice(id, tenantId);
      res.json({ message: "Recurring invoice deleted" });
    } catch (error: any) {
      console.error('Error deleting recurring invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/recurring-invoices/:id/generate", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const invoice = await storage.generateInvoiceFromRecurring(id, tenantId);
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Error generating invoice from recurring:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/recurring-invoices/process", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const invoices = await storage.processRecurringInvoices(tenantId);
      res.json({ 
        message: `Generated ${invoices.length} invoice(s) from recurring templates`,
        invoices 
      });
    } catch (error: any) {
      console.error('Error processing recurring invoices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Retainer Invoice routes
  app.get("/api/retainer-invoices", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const retainerInvoices = await storage.getRetainerInvoices(tenantId);
      res.json(retainerInvoices);
    } catch (error: any) {
      console.error('Error fetching retainer invoices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/retainer-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const retainerInvoice = await storage.getRetainerInvoiceById(id, tenantId);
      if (!retainerInvoice) {
        return res.status(404).json({ message: "Retainer invoice not found" });
      }
      res.json(retainerInvoice);
    } catch (error: any) {
      console.error('Error fetching retainer invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/retainer-invoices/:id/line-items", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const lineItems = await storage.getRetainerInvoiceLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Error fetching retainer invoice line items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/retainer-invoices", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { lineItems, ...retainerData } = req.body;
      
      // Validate retainer invoice data
      const validatedData = insertRetainerInvoiceSchema.parse({ ...retainerData, tenantId });
      
      // Validate line items
      const validatedLineItems = lineItems.map((item: any) => 
        insertRetainerInvoiceLineItemSchema.parse(item)
      );
      
      const retainerInvoice = await storage.createRetainerInvoice(validatedData, validatedLineItems);
      res.status(201).json(retainerInvoice);
    } catch (error: any) {
      console.error('Error creating retainer invoice:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid retainer invoice data', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/retainer-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { lineItems, ...retainerData } = req.body;
      
      // Validate retainer invoice data
      const validatedData = insertRetainerInvoiceSchema.partial().parse(retainerData);
      
      // Validate line items if provided
      let validatedLineItems;
      if (lineItems) {
        validatedLineItems = lineItems.map((item: any) => 
          insertRetainerInvoiceLineItemSchema.parse(item)
        );
      }
      
      const retainerInvoice = await storage.updateRetainerInvoice(id, tenantId, validatedData, validatedLineItems);
      res.json(retainerInvoice);
    } catch (error: any) {
      console.error('Error updating retainer invoice:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid retainer invoice data', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/retainer-invoices/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteRetainerInvoice(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting retainer invoice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Journal Entry routes
  app.get("/api/journal-entries", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const journalEntries = await storage.getJournalEntries(tenantId);
      res.json(journalEntries);
    } catch (error: any) {
      console.error('Error fetching journal entries:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/journal-entries/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const journalEntry = await storage.getJournalEntry(id);
      if (!journalEntry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      res.json(journalEntry);
    } catch (error: any) {
      console.error('Error fetching journal entry:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/journal-entries/:id/legs", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const legs = await storage.getJournalEntryLegs(id, tenantId);
      res.json(legs);
    } catch (error: any) {
      console.error('Error fetching journal entry legs:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal-entries", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Validate payload structure
      const validated = journalEntryPayloadSchema.parse(req.body);
      
      // SECURITY: Inject server tenantId into journal entry data (NEVER trust client)
      const payloadWithTenant = {
        journalEntry: {
          ...validated.journalEntry,
          tenantId,
        },
        legs: validated.legs,
      };
      
      const journalEntry = await storage.createJournalEntryWithLegs(payloadWithTenant);
      res.status(201).json(journalEntry);
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid journal entry data', errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/journal-entries/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Validate payload structure
      const validated = journalEntryPayloadSchema.parse(req.body);
      
      // SECURITY: Inject server tenantId into journal entry data (NEVER trust client)
      const payloadWithTenant = {
        journalEntry: {
          ...validated.journalEntry,
          tenantId,
        },
        legs: validated.legs,
      };
      
      const journalEntry = await storage.updateJournalEntryWithLegs(id, tenantId, payloadWithTenant);
      res.json(journalEntry);
    } catch (error: any) {
      console.error('Error updating journal entry:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid journal entry data', errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/journal-entries/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteJournalEntry(id, tenantId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting journal entry:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bill routes
  app.get('/api/bills', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const bills = await storage.getBillsByTenant(req.tenantId);
      res.json(bills);
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  app.get('/api/bills/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const bill = await storage.getBillById(id, tenantId);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      console.error("Error fetching bill:", error);
      res.status(500).json({ message: "Failed to fetch bill" });
    }
  });

  app.post('/api/bills', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse body WITHOUT tenantId
      const validated = billPayloadSchema.parse(req.body);
      
      // Inject server tenantId into bill data (NEVER trust client)
      const billWithTenant = {
        ...validated,
        bill: {
          ...validated.bill,
          tenantId: tenantId,
        }
      };
      
      // Also inject tenantId into line items
      const lineItemsWithTenant = validated.lineItems.map(item => ({
        ...item,
        tenantId: tenantId,
      }));
      
      const payload = {
        bill: billWithTenant.bill,
        lineItems: lineItemsWithTenant,
      };
      
      const bill = await storage.createBillWithItems(payload, tenantId);
      res.status(201).json(bill);
    } catch (error: any) {
      console.error("Error creating bill:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid bill data', errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to create bill" });
    }
  });

  app.patch('/api/bills/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Parse body WITHOUT trusting tenantId
      const validated = billPayloadSchema.parse(req.body);
      
      // Force server tenantId (same pattern as POST)
      const billWithTenant = {
        ...validated,
        bill: {
          ...validated.bill,
          tenantId: tenantId,
        }
      };
      
      const lineItemsWithTenant = validated.lineItems.map(item => ({
        ...item,
        tenantId: tenantId,
      }));
      
      const payload = {
        bill: billWithTenant.bill,
        lineItems: lineItemsWithTenant,
      };
      
      const bill = await storage.updateBillWithItems(id, tenantId, payload);
      res.json(bill);
    } catch (error: any) {
      console.error("Error updating bill:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid bill data', errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to update bill" });
    }
  });

  app.delete('/api/bills/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deleteBill(id, tenantId);
      res.json({ message: "Bill deleted" });
    } catch (error: any) {
      console.error("Error deleting bill:", error);
      res.status(500).json({ message: error.message || "Failed to delete bill" });
    }
  });

  app.get('/api/bills/:id/line-items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // SECURITY: Verify bill belongs to this tenant before returning line items
      const bill = await storage.getBillById(id, tenantId);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }
      
      const lineItems = await storage.getBillLineItems(id);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching bill line items:", error);
      res.status(500).json({ message: "Failed to fetch bill line items" });
    }
  });

  app.post('/api/bills/extract', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ message: "No image provided" });
      }
      const { extractBillData } = await import('./ai-bill-extractor');
      const extractedData = await extractBillData(image);
      res.json(extractedData);
    } catch (error: any) {
      console.error("Error extracting bill data:", error);
      res.status(500).json({ message: error.message || "Failed to extract bill data" });
    }
  });

  app.post('/api/bills/extract-bulk', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: "No images provided. Please provide an array of base64 images." });
      }

      if (images.length > 20) {
        return res.status(400).json({ message: "Too many images. Maximum 20 documents per batch." });
      }

      const { extractBillData } = await import('./ai-bill-extractor');
      
      const results = await Promise.allSettled(
        images.map(async (image: string, index: number) => {
          try {
            const extractedData = await extractBillData(image);
            return {
              success: true,
              index,
              data: extractedData,
              fileName: `Document ${index + 1}`
            };
          } catch (error: any) {
            return {
              success: false,
              index,
              error: error.message || "Extraction failed",
              fileName: `Document ${index + 1}`
            };
          }
        })
      );

      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            index,
            error: result.reason?.message || "Extraction failed",
            fileName: `Document ${index + 1}`
          };
        }
      });

      const successCount = processedResults.filter(r => r.success).length;
      const failureCount = processedResults.filter(r => !r.success).length;

      res.json({
        results: processedResults,
        summary: {
          total: images.length,
          successful: successCount,
          failed: failureCount
        }
      });
    } catch (error: any) {
      console.error("Error in bulk extraction:", error);
      res.status(500).json({ message: error.message || "Failed to process bulk extraction" });
    }
  });

  // Purchase Order routes
  app.get('/api/purchase-orders', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrders(req.tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.get('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const po = await storage.getPurchaseOrder(id);
      if (!po) {
        return res.status(404).json({ message: "Purchase Order not found" });
      }
      // Verify tenant access
      if (po.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(po);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get('/api/purchase-orders/:id/line-items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // SECURITY: Verify PO belongs to this tenant before returning line items
      const po = await storage.getPurchaseOrder(id);
      if (!po) {
        return res.status(404).json({ message: "Purchase Order not found" });
      }
      if (po.tenantId !== tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const lineItems = await storage.getPurchaseOrderLineItems(id, tenantId);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching purchase order line items:", error);
      res.status(500).json({ message: "Failed to fetch purchase order line items" });
    }
  });

  app.post('/api/purchase-orders', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse body WITHOUT tenantId
      const validated = purchaseOrderPayloadSchema.parse(req.body);
      
      // Inject server tenantId into PO data (NEVER trust client)
      const poWithTenant = {
        ...validated,
        purchaseOrder: {
          ...validated.purchaseOrder,
          tenantId: tenantId,
        }
      };
      
      // Also inject tenantId into line items
      const lineItemsWithTenant = validated.lineItems.map(item => ({
        ...item,
        tenantId: tenantId,
      }));
      
      const payload = {
        purchaseOrder: poWithTenant.purchaseOrder,
        lineItems: lineItemsWithTenant,
      };
      
      const po = await storage.createPurchaseOrderWithItems(payload);
      res.status(201).json(po);
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid purchase order data', errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to create purchase order" });
    }
  });

  app.patch('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      // Parse body WITHOUT trusting tenantId
      const validated = purchaseOrderPayloadSchema.parse(req.body);
      
      // Force server tenantId (same pattern as POST)
      const poWithTenant = {
        ...validated,
        purchaseOrder: {
          ...validated.purchaseOrder,
          tenantId: tenantId,
        }
      };
      
      const lineItemsWithTenant = validated.lineItems.map(item => ({
        ...item,
        tenantId: tenantId,
      }));
      
      const payload = {
        purchaseOrder: poWithTenant.purchaseOrder,
        lineItems: lineItemsWithTenant,
      };
      
      const po = await storage.updatePurchaseOrderWithItems(id, tenantId, payload);
      res.json(po);
    } catch (error: any) {
      console.error("Error updating purchase order:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid purchase order data', errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to update purchase order" });
    }
  });

  app.delete('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      await storage.deletePurchaseOrder(id, tenantId);
      res.json({ message: "Purchase Order deleted" });
    } catch (error: any) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ message: error.message || "Failed to delete purchase order" });
    }
  });

  // Expense routes
  app.get('/api/expenses', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const expenses = await storage.getExpensesByTenant(req.tenantId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Payment routes
  app.get('/api/payments', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const payments = await storage.getPaymentsByTenant(req.tenantId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Document routes
  app.get('/api/documents', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const documents = await storage.getDocumentsByTenant(req.tenantId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Dashboard stats route
  app.get('/api/dashboard/stats', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const [invoices, bills, expenses, payments] = await Promise.all([
        storage.getInvoicesByTenant(req.tenantId),
        storage.getBillsByTenant(req.tenantId),
        storage.getExpensesByTenant(req.tenantId),
        storage.getPaymentsByTenant(req.tenantId),
      ]);

      const stats = {
        totalRevenue: invoices
          .filter(i => i.status === 'paid')
          .reduce((sum, i) => sum + parseFloat(i.total), 0),
        totalExpenses: expenses
          .filter(e => e.status === 'paid')
          .reduce((sum, e) => sum + parseFloat(e.amount), 0),
        outstandingInvoices: invoices
          .filter(i => i.status === 'sent' || i.status === 'overdue')
          .reduce((sum, i) => sum + parseFloat(i.total), 0),
        pendingPayments: payments
          .filter(p => p.status === 'pending' || p.status === 'scheduled')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0),
        recentInvoices: invoices.filter(i => {
          const date = new Date(i.createdAt!);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length,
        recentBills: bills.filter(b => {
          const date = new Date(b.createdAt!);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length,
        scheduledPayments: payments.filter(p => {
          if (!p.scheduledDate) return false;
          const scheduled = new Date(p.scheduledDate);
          const now = new Date();
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return scheduled >= now && scheduled <= weekFromNow;
        }).length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Asset Management routes
  app.get('/api/assets', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const assets = await storage.getAssets(req.tenantId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get('/api/assets/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const asset = await storage.getAsset(id);
      
      if (!asset || asset.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  app.get('/api/assets/:id/depreciation-schedules', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // SECURITY: Verify asset belongs to this tenant before returning schedules
      const asset = await storage.getAsset(id);
      if (!asset || asset.tenantId !== tenantId) {
        return res.status(404).json({ message: "Asset not found" });
      }

      const schedules = await storage.getAssetDepreciationSchedules(id, tenantId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching depreciation schedules:", error);
      res.status(500).json({ message: "Failed to fetch depreciation schedules" });
    }
  });

  app.post('/api/assets', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;

      // SECURITY: Strip client-provided tenantId, use verified tenantId from middleware
      const { tenantId: _, ...assetPayload } = req.body;
      
      // Parse and validate request body
      const parsed = insertAssetSchema.parse(assetPayload);

      // Create asset with FORCE server tenantId
      const asset = await storage.createAsset({ ...parsed, tenantId });
      res.status(201).json(asset);
    } catch (error: any) {
      console.error("Error creating asset:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid asset data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.patch('/api/assets/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // SECURITY: Strip client-provided tenantId
      const { tenantId: _, ...assetPayload } = req.body;

      // Parse and validate request body
      const parsed = insertAssetSchema.partial().parse(assetPayload);

      // Update asset (verifies tenant ownership inside)
      const asset = await storage.updateAsset(id, tenantId, parsed);
      res.json(asset);
    } catch (error: any) {
      console.error("Error updating asset:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid asset data", errors: error.errors });
      }
      if (error.message === "Asset not found") {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete('/api/assets/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // Delete asset (verifies tenant ownership inside)
      await storage.deleteAsset(id, tenantId);
      res.json({ message: "Asset deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting asset:", error);
      if (error.message === "Asset not found") {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Bank Reconciliation routes
  app.get('/api/bank-reconciliations', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const reconciliations = await storage.getBankReconciliations(req.tenantId);
      res.json(reconciliations);
    } catch (error) {
      console.error("Error fetching bank reconciliations:", error);
      res.status(500).json({ message: "Failed to fetch bank reconciliations" });
    }
  });

  app.get('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const reconciliation = await storage.getBankReconciliation(id);
      
      if (!reconciliation || reconciliation.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Bank reconciliation not found" });
      }
      
      res.json(reconciliation);
    } catch (error) {
      console.error("Error fetching bank reconciliation:", error);
      res.status(500).json({ message: "Failed to fetch bank reconciliation" });
    }
  });

  app.get('/api/bank-reconciliations/:id/items', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // SECURITY: Verify reconciliation belongs to this tenant before returning items
      const reconciliation = await storage.getBankReconciliation(id);
      if (!reconciliation || reconciliation.tenantId !== tenantId) {
        return res.status(404).json({ message: "Bank reconciliation not found" });
      }

      const items = await storage.getBankReconciliationItems(id, tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching reconciliation items:", error);
      res.status(500).json({ message: "Failed to fetch reconciliation items" });
    }
  });

  app.post('/api/bank-reconciliations', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;

      // SECURITY: Strip client-provided tenantId from both reconciliation and items
      const payload = req.body;
      
      // Parse and validate request body
      const parsed = bankReconciliationPayloadSchema.parse(payload);

      // CRITICAL: Inject server tenantId into reconciliation
      const payloadWithTenantId = {
        reconciliation: {
          ...parsed.reconciliation,
          tenantId, // FORCE server tenantId
        },
        items: parsed.items, // Items will get tenantId injected in storage layer
      };

      const reconciliation = await storage.createBankReconciliationWithItems(payloadWithTenantId);
      res.status(201).json(reconciliation);
    } catch (error: any) {
      console.error("Error creating bank reconciliation:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid reconciliation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bank reconciliation" });
    }
  });

  app.patch('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // Parse and validate request body
      const parsed = bankReconciliationPayloadSchema.parse(req.body);

      // CRITICAL: Inject server tenantId into reconciliation
      const payloadWithTenantId = {
        reconciliation: {
          ...parsed.reconciliation,
          tenantId, // FORCE server tenantId
        },
        items: parsed.items, // Items will get tenantId injected in storage layer
      };

      const reconciliation = await storage.updateBankReconciliationWithItems(id, tenantId, payloadWithTenantId);
      res.json(reconciliation);
    } catch (error: any) {
      console.error("Error updating bank reconciliation:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid reconciliation data", errors: error.errors });
      }
      if (error.message === "Bank reconciliation not found") {
        return res.status(404).json({ message: "Bank reconciliation not found" });
      }
      res.status(500).json({ message: "Failed to update bank reconciliation" });
    }
  });

  app.delete('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      await storage.deleteBankReconciliation(id, tenantId);
      res.json({ message: "Bank reconciliation deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting bank reconciliation:", error);
      if (error.message === "Bank reconciliation not found") {
        return res.status(404).json({ message: "Bank reconciliation not found" });
      }
      res.status(500).json({ message: "Failed to delete bank reconciliation" });
    }
  });

  app.patch('/api/bank-reconciliations/items/:itemId/match', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { itemId } = req.params;
      const { journalEntryId } = req.body;
      const tenantId = req.tenantId!;

      if (!journalEntryId) {
        return res.status(400).json({ message: "journalEntryId is required" });
      }

      await storage.matchReconciliationItem(itemId, journalEntryId, tenantId);
      res.json({ message: "Reconciliation item matched successfully" });
    } catch (error: any) {
      console.error("Error matching reconciliation item:", error);
      if (error.message === "Reconciliation item not found" || error.message === "Journal entry not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to match reconciliation item" });
    }
  });

  // ====================================
  // FINANCIAL REPORTS (READ-ONLY)
  // ====================================

  app.get('/api/reports/profit-loss', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const report = await storage.getProfitLossReport(tenantId, start, end);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating profit & loss report:", error);
      res.status(500).json({ message: "Failed to generate profit & loss report" });
    }
  });

  app.get('/api/reports/balance-sheet', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { asOfDate } = req.query;

      if (!asOfDate) {
        return res.status(400).json({ message: "asOfDate is required" });
      }

      const asOf = new Date(asOfDate as string);

      if (isNaN(asOf.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const report = await storage.getBalanceSheetReport(tenantId, asOf);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating balance sheet report:", error);
      res.status(500).json({ message: "Failed to generate balance sheet report" });
    }
  });

  app.get('/api/reports/trial-balance', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { asOfDate } = req.query;

      if (!asOfDate) {
        return res.status(400).json({ message: "asOfDate is required" });
      }

      const asOf = new Date(asOfDate as string);

      if (isNaN(asOf.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const report = await storage.getTrialBalanceReport(tenantId, asOf);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating trial balance report:", error);
      res.status(500).json({ message: "Failed to generate trial balance report" });
    }
  });

  app.get('/api/reports/cash-flow', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const report = await storage.getCashFlowReport(tenantId, start, end);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating cash flow report:", error);
      res.status(500).json({ message: "Failed to generate cash flow report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
