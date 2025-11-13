import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import OpenAI from "openai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertTenantSchema,
  insertCustomerSchema,
  insertVendorSchema,
  insertInvoiceSchema,
  insertBillSchema,
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
      const tenant = await storage.updateTenant(id, req.body);
      res.json(tenant);
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
      const customer = await storage.updateCustomer(id, req.body);
      res.json(customer);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      res.status(400).json({ message: error.message || "Failed to update customer" });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomer(id);
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
      const vendor = await storage.updateVendor(id, req.body);
      res.json(vendor);
    } catch (error: any) {
      console.error("Error updating vendor:", error);
      res.status(400).json({ message: error.message || "Failed to update vendor" });
    }
  });

  app.delete('/api/vendors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVendor(id);
      res.json({ message: "Vendor deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting vendor:", error);
      res.status(400).json({ message: error.message || "Failed to delete vendor" });
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
