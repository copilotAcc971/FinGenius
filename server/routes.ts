import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import OpenAI from "openai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertTenantSchema,
  insertCustomerSchema,
  updateCustomerSchema,
  insertVendorSchema,
  insertItemSchema,
  insertTaxSchema,
  updateTaxSchema,
  insertInvoiceSchema,
  invoicePayloadSchema,
  insertBillSchema,
  billPayloadSchema,
  insertExpenseSchema,
  insertPaymentSchema,
  insertDocumentSchema,
} from "@shared/schema";

// Initialize Stripe and OpenAI only if credentials are available
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

    // User must be the owner to access this tenant
    // In a production app, you'd check tenant_members table for membership
    if (tenant.ownerId !== userId) {
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
      
      const lineItems = await storage.getInvoiceLineItems(id);
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
      const userId = req.user.claims.sub;
      
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const tenant = await storage.getTenant(invoice.tenantId);
      if (!tenant || tenant.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const parsed = invoicePayloadSchema.parse({
        invoice: { ...req.body.invoice, tenantId: invoice.tenantId },
        lineItems: req.body.lineItems || [],
      });
      
      const updated = await storage.updateInvoiceWithItems(id, invoice.tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating invoice:", error);
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
      
      await storage.deleteInvoice(id, invoice.tenantId);
      res.json({ message: "Invoice deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      res.status(400).json({ message: error.message || "Failed to delete invoice" });
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

  const httpServer = createServer(app);
  return httpServer;
}
