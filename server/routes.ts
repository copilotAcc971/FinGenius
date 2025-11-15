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
import { OpenBankingService, EncryptedPayloadValidationError, TokenRefreshError, nonceStore } from './open-banking';
import { openBankingProviderFactory } from './open-banking/providers';
import { db } from './db';
import { eq, and, desc, asc, sql, inArray, isNull, lt, gte, lte, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { RBACService, getAllPermissions } from './rbac/service';
import { loadAuthContext, requirePermission, requireAnyPermission, requireRole } from './middleware/rbac';
import { initializeRBAC, seedPermissions, seedRolesForTenant } from './scripts/seed-rbac';
import { 
  fetchExchangeRates, 
  createManualExchangeRate, 
  getLatestRate,
  updateExchangeRatesForTenant
} from './services/fx-rates';
import { triggerManualFXRatesUpdate } from './jobs/fx-rates-update';
import { getClosingRate, getAverageRate, getHistoricalRate, translateAmount } from './fx-translation';
import { assessRateVolatility } from './fx-volatility';
import { fetchInvoiceEntryData, createInvoiceJournalEntry, fetchBillEntryData, createBillJournalEntry, fetchCustomerPaymentEntryData, createCustomerPaymentJournalEntry, fetchVendorPaymentEntryData, createVendorPaymentJournalEntry } from './accounting/entry-creators';
import { ValidationError as AccountingValidationError, NotFoundError, AuthorizationError } from './accounting/errors';
import { withTransaction } from './accounting/service';
import { getAccountBalance, updateHistoricalBalances } from './accounting/historical-balance-service';
import { submitJournalEntryForApproval, approveJournalEntryStep, rejectJournalEntry, autoPostApprovedEntry } from './accounting/workflow-engine';
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
  insertCurrencySchema,
  insertExchangeRateSchema,
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
  openBankingConnections,
  bankAccounts,
  customers,
  vendors,
  currencies,
  bills,
  journalEntries,
  journalEntryLegs,
  accounts,
  accountTransactionHistory,
  users,
  approvalRequests,
  approvalHistory,
  approvalSteps,
  approvalWorkflows,
} from "@shared/schema";
import { insertFXConfigSchema } from "@shared/fx-types";

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

// Schema for journal entry approval workflow endpoints
const approveJournalEntrySchema = z.object({
  comments: z.string().optional()
});

const rejectJournalEntrySchema = z.object({
  rejectionReason: z.string().min(1, "Rejection reason is required")
});

// Middleware to verify tenant membership
async function verifyTenantAccess(req: any, res: any, next: any) {
  try {
    const userId = req.user.claims.sub;
    const tenantId = req.query.tenantId || req.headers['x-tenant-id'] || req.body.tenantId;
    
    console.log('[verifyTenantAccess] Checking tenant access:', {
      userId,
      tenantId,
      fromQuery: !!req.query.tenantId,
      fromHeader: !!req.headers['x-tenant-id'],
      fromBody: !!req.body.tenantId,
      path: req.path
    });
    
    if (!tenantId) {
      console.error('[verifyTenantAccess] No tenant ID provided');
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // Check if user is a member or owner of this tenant
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      console.error('[verifyTenantAccess] Tenant not found:', { tenantId, userId });
      return res.status(404).json({ message: "Tenant not found" });
    }
    console.log('[verifyTenantAccess] Tenant found:', { tenantId, tenantName: tenant.name });

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
      console.log('[GET /api/company-profile] Fetching profile for tenant:', req.tenantId);
      const profile = await storage.getCompanyProfile(req.tenantId);
      console.log('[GET /api/company-profile] Profile found:', !!profile, profile ? `ID: ${profile.id}` : 'null');
      res.json(profile);
    } catch (error) {
      console.error("[GET /api/company-profile] Error fetching company profile:", error);
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  app.post('/api/company-profile', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      console.log('[POST /api/company-profile] Creating profile for tenant:', req.tenantId);
      const parsed = insertTenantCompanyProfileSchema.parse({ ...req.body, tenantId: req.tenantId });
      const profile = await storage.createCompanyProfile(parsed);
      console.log('[POST /api/company-profile] Profile created successfully:', profile.id);
      res.json(profile);
    } catch (error: any) {
      console.error("[POST /api/company-profile] Error creating company profile:", error);
      res.status(400).json({ message: error.message || "Failed to create company profile" });
    }
  });

  app.patch('/api/company-profile', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('company_profile.update'), async (req: any, res) => {
    try {
      console.log('[PATCH /api/company-profile] Updating profile for tenant:', req.tenantId);
      
      if (!req.tenantId) {
        console.error('[PATCH /api/company-profile] No tenant ID in request');
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // SECURITY: Use schema that excludes tenantId to prevent tampering
      const parsed = updateTenantCompanyProfileSchema.parse(req.body);
      
      const updated = await storage.updateCompanyProfile(req.tenantId, parsed);
      console.log('[PATCH /api/company-profile] Profile updated successfully:', updated.id);
      res.json(updated);
    } catch (error: any) {
      console.error("[PATCH /api/company-profile] Error updating company profile:", error);
      res.status(400).json({ message: error.message || "Failed to update company profile" });
    }
  });

  // ===== RBAC Routes =====

  // Get all permissions (catalog)
  app.get('/api/rbac/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const allPermissions = await getAllPermissions();
      res.json(allPermissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Get all roles for tenant
  app.get('/api/rbac/roles', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const rbacService = new RBACService(req.tenantId);
      const roles = await rbacService.getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Get role with permissions
  app.get('/api/rbac/roles/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const { id } = req.params;
      const rbacService = new RBACService(req.tenantId);
      const roleWithPerms = await rbacService.getRoleWithPermissions(id);
      
      if (!roleWithPerms) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      res.json(roleWithPerms);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  // Create custom role
  app.post('/api/rbac/roles', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('users.manage_roles'), async (req: any, res) => {
    try {
      const { name, description, permissionIds } = req.body;
      
      if (!name || !permissionIds || !Array.isArray(permissionIds)) {
        return res.status(400).json({ message: "Name and permissionIds array required" });
      }
      
      const rbacService = new RBACService(req.tenantId);
      const role = await rbacService.createCustomRole(name, description, permissionIds);
      res.json(role);
    } catch (error: any) {
      console.error("Error creating role:", error);
      res.status(400).json({ message: error.message || "Failed to create role" });
    }
  });

  // Update custom role
  app.patch('/api/rbac/roles/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('users.manage_roles'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissionIds } = req.body;
      
      const updates: any = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      
      const rbacService = new RBACService(req.tenantId);
      const role = await rbacService.updateRole(id, updates, permissionIds);
      res.json(role);
    } catch (error: any) {
      console.error("Error updating role:", error);
      res.status(400).json({ message: error.message || "Failed to update role" });
    }
  });

  // Delete custom role
  app.delete('/api/rbac/roles/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('users.manage_roles'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const rbacService = new RBACService(req.tenantId);
      await rbacService.deleteRole(id);
      res.json({ message: "Role deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting role:", error);
      res.status(400).json({ message: error.message || "Failed to delete role" });
    }
  });

  // Assign role to user
  app.post('/api/rbac/users/:userId/roles', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('users.manage_roles'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;
      
      if (!roleId) {
        return res.status(400).json({ message: "roleId required" });
      }
      
      const rbacService = new RBACService(req.tenantId);
      await rbacService.assignRoleToUser(userId, roleId);
      res.json({ message: "Role assigned successfully" });
    } catch (error: any) {
      console.error("Error assigning role:", error);
      res.status(400).json({ message: error.message || "Failed to assign role" });
    }
  });

  // Remove role from user
  app.delete('/api/rbac/users/:userId/roles/:roleId', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('users.manage_roles'), async (req: any, res) => {
    try {
      const { userId, roleId } = req.params;
      const rbacService = new RBACService(req.tenantId);
      await rbacService.removeRoleFromUser(userId, roleId);
      res.json({ message: "Role removed successfully" });
    } catch (error: any) {
      console.error("Error removing role:", error);
      res.status(400).json({ message: error.message || "Failed to remove role" });
    }
  });

  // Seed RBAC (initialize permissions and roles)
  app.post('/api/rbac/seed', isAuthenticated, async (req: any, res) => {
    try {
      // Only allow if user is an owner of at least one tenant
      const userId = req.user.claims.sub;
      const userTenants = await storage.getTenantsByUserId(userId);
      const isOwner = userTenants.some((t: any) => t.ownerId === userId);
      
      if (!isOwner) {
        return res.status(403).json({ message: "Only tenant owners can seed RBAC" });
      }
      
      await initializeRBAC();
      res.json({ message: "RBAC initialized successfully" });
    } catch (error: any) {
      console.error("Error seeding RBAC:", error);
      res.status(500).json({ message: error.message || "Failed to seed RBAC" });
    }
  });

  // Get current user's permissions
  app.get('/api/rbac/permissions/me', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      res.json({ permissions: req.permissions || [] });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Get current user's roles
  app.get('/api/rbac/roles/me', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      res.json({ roles: req.roles || [] });
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // Get all members for tenant with their roles
  app.get('/api/tenants/members', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const members = await storage.getTenantMembersWithRoles(req.tenantId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching tenant members:", error);
      res.status(500).json({ message: "Failed to fetch tenant members" });
    }
  });

  // Customer routes
  app.get('/api/customers', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('customers.read'), async (req: any, res) => {
    try {
      const customers = await storage.getCustomersByTenant(req.tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('customers.create'), async (req: any, res) => {
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

  app.patch('/api/customers/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('customers.update'), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Validate the update payload
      const parsed = updateCustomerSchema.parse(req.body);
      
      // Now perform the update (tenantId already verified by middleware)
      const updated = await storage.updateCustomer(id, req.tenantId, parsed);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      res.status(400).json({ message: error.message || "Failed to update customer" });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('customers.delete'), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Now perform the delete (tenantId already verified by middleware)
      await storage.deleteCustomer(id, req.tenantId);
      res.json({ message: "Customer deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      res.status(400).json({ message: error.message || "Failed to delete customer" });
    }
  });

  // Vendor routes
  app.get('/api/vendors', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('vendors.read'), async (req: any, res) => {
    try {
      const vendors = await storage.getVendorsByTenant(req.tenantId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post('/api/vendors', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('vendors.create'), async (req: any, res) => {
    try {
      const parsed = insertVendorSchema.parse({ ...req.body, tenantId: req.tenantId });
      const vendor = await storage.createVendor(parsed);
      res.json(vendor);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      res.status(400).json({ message: error.message || "Failed to create vendor" });
    }
  });

  app.patch('/api/vendors/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('vendors.update'), async (req: any, res) => {
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

  app.delete('/api/vendors/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('vendors.delete'), async (req: any, res) => {
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
  app.get('/api/accounts', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.read'), async (req: any, res) => {
    try {
      const accounts = await storage.getAccounts(req.tenantId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.post('/api/accounts', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.create'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Parse req.body - insertAccountSchema omits tenantId, code, and currentBalance
      const parsed = insertAccountSchema.parse(req.body);
      
      // createAccount will handle code generation and currentBalance default
      const account = await storage.createAccount({ ...parsed, tenantId });
      res.status(201).json(account);
    } catch (error: any) {
      console.error("Error creating account:", error);
      res.status(400).json({ message: error.message || "Failed to create account" });
    }
  });

  app.patch('/api/accounts/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.update'), async (req: any, res) => {
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

  app.delete('/api/accounts/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.delete'), async (req: any, res) => {
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

  /**
   * GET /api/accounts/:id/balance
   * Get current or historical balance for an account
   * 
   * @query asOfDate - Optional ISO date string for historical balance (e.g., "2024-11-15")
   * @returns Account balance with metadata
   * 
   * @example
   * GET /api/accounts/acc-123/balance?tenantId=tenant-456
   * GET /api/accounts/acc-123/balance?tenantId=tenant-456&asOfDate=2024-11-15
   * 
   * @testid API endpoint for account balance queries used in UI balance displays
   */
  app.get('/api/accounts/:id/balance', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { asOfDate } = req.query;

      // Fetch account to verify it exists and belongs to tenant
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(
          eq(accounts.id, id),
          eq(accounts.tenantId, tenantId)
        ))
        .limit(1);

      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Parse and validate asOfDate if provided
      let asOfDateParsed: Date | undefined;
      if (asOfDate) {
        try {
          asOfDateParsed = new Date(asOfDate as string);
          if (isNaN(asOfDateParsed.getTime())) {
            return res.status(400).json({ message: "Invalid asOfDate format. Use ISO date string (e.g., 2024-11-15)" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid asOfDate format. Use ISO date string (e.g., 2024-11-15)" });
        }
      }

      // Get balance using historical balance service
      const balance = await getAccountBalance(
        tenantId,
        id,
        asOfDateParsed
      );

      // Determine normal balance type based on account type
      const normalizedType = account.type.toLowerCase();
      let normalBalanceType: 'debit' | 'credit';
      
      if (normalizedType === 'asset' || normalizedType === 'expense') {
        normalBalanceType = 'debit';
      } else if (normalizedType === 'liability' || normalizedType === 'equity' || normalizedType === 'income') {
        normalBalanceType = 'credit';
      } else {
        normalBalanceType = 'debit'; // fallback
      }

      // Get tenant's base currency (FIX: was hardcoded to 'USD')
      const [baseCurrency] = await db
        .select({ code: currencies.code })
        .from(currencies)
        .where(and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isBaseCurrency, true)
        ))
        .limit(1);

      // Return structured response
      res.json({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        balance,
        asOfDate: asOfDateParsed ? asOfDateParsed.toISOString() : null,
        currency: baseCurrency?.code || 'USD', // Use base currency or fallback to USD
        normalBalanceType
      });
    } catch (error: any) {
      console.error("Error fetching account balance:", error);
      res.status(500).json({ message: error.message || "Failed to fetch account balance" });
    }
  });

  /**
   * GET /api/accounts/:id/transaction-history
   * Get detailed transaction history for an account with pagination
   * 
   * @query startDate - Optional ISO date string for date range start
   * @query endDate - Optional ISO date string for date range end
   * @query limit - Number of records to return (default: 100, max: 1000)
   * @query offset - Pagination offset (default: 0)
   * @returns Account transaction history with summary and pagination
   * 
   * @example
   * GET /api/accounts/acc-123/transaction-history?tenantId=tenant-456
   * GET /api/accounts/acc-123/transaction-history?tenantId=tenant-456&startDate=2024-01-01&endDate=2024-12-31&limit=50&offset=0
   * 
   * @testid API endpoint for account transaction history used in UI transaction tables
   */
  app.get('/api/accounts/:id/transaction-history', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.read'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { startDate, endDate, limit = '100', offset = '0' } = req.query;

      // Fetch account to verify it exists and belongs to tenant
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(
          eq(accounts.id, id),
          eq(accounts.tenantId, tenantId)
        ))
        .limit(1);

      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Parse and validate pagination parameters
      const limitNum = Math.min(parseInt(limit as string, 10) || 100, 1000);
      const offsetNum = parseInt(offset as string, 10) || 0;

      if (limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({ message: "Limit must be between 1 and 1000" });
      }

      if (offsetNum < 0) {
        return res.status(400).json({ message: "Offset must be >= 0" });
      }

      // Parse and validate date range if provided
      let startDateParsed: Date | undefined;
      let endDateParsed: Date | undefined;

      if (startDate) {
        try {
          startDateParsed = new Date(startDate as string);
          if (isNaN(startDateParsed.getTime())) {
            return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (e.g., 2024-01-01)" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (e.g., 2024-01-01)" });
        }
      }

      if (endDate) {
        try {
          endDateParsed = new Date(endDate as string);
          if (isNaN(endDateParsed.getTime())) {
            return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (e.g., 2024-12-31)" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (e.g., 2024-12-31)" });
        }
      }

      // Build query filters
      const filters: any[] = [
        eq(accountTransactionHistory.tenantId, tenantId),
        eq(accountTransactionHistory.accountId, id)
      ];

      if (startDateParsed) {
        filters.push(sql`${accountTransactionHistory.transactionDate} >= ${startDateParsed}`);
      }

      if (endDateParsed) {
        filters.push(sql`${accountTransactionHistory.transactionDate} <= ${endDateParsed}`);
      }

      // Query transactions with joins to get journal entry details
      const transactions = await db
        .select({
          id: accountTransactionHistory.id,
          transactionDate: accountTransactionHistory.transactionDate,
          journalEntryId: accountTransactionHistory.journalEntryId,
          journalEntryNumber: journalEntries.journalEntryNumber,
          journalEntryLegId: accountTransactionHistory.journalEntryLegId,
          description: accountTransactionHistory.description,
          debitAmount: accountTransactionHistory.debitAmount,
          creditAmount: accountTransactionHistory.creditAmount,
          runningBalance: accountTransactionHistory.runningBalance,
          sourceDocumentType: accountTransactionHistory.sourceDocumentType,
          sourceDocumentId: accountTransactionHistory.sourceDocumentId,
        })
        .from(accountTransactionHistory)
        .leftJoin(journalEntries, eq(accountTransactionHistory.journalEntryId, journalEntries.id))
        .where(and(...filters))
        .orderBy(asc(accountTransactionHistory.transactionDate))
        .limit(limitNum + 1) // Fetch one extra to check if there are more
        .offset(offsetNum);

      // Check if there are more results
      const hasMore = transactions.length > limitNum;
      const displayTransactions = hasMore ? transactions.slice(0, limitNum) : transactions;

      // Calculate summary statistics for the filtered range
      const [summaryResult] = await db
        .select({
          totalDebits: sql<string>`COALESCE(SUM(${accountTransactionHistory.debitAmount}), 0)`,
          totalCredits: sql<string>`COALESCE(SUM(${accountTransactionHistory.creditAmount}), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
        })
        .from(accountTransactionHistory)
        .where(and(...filters));

      // Get opening balance (balance before startDate or at account inception)
      // FIX: Use day BEFORE startDate to exclude same-day transactions from opening balance
      let openingBalance = '0.00';
      if (startDateParsed) {
        const dayBeforeStart = new Date(startDateParsed);
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
        openingBalance = await getAccountBalance(tenantId, id, dayBeforeStart);
      }

      // Calculate closing balance (last transaction's running balance or current balance)
      let closingBalance = '0.00';
      if (displayTransactions.length > 0) {
        closingBalance = displayTransactions[displayTransactions.length - 1].runningBalance || '0.00';
      } else if (endDateParsed) {
        closingBalance = await getAccountBalance(tenantId, id, endDateParsed);
      } else {
        closingBalance = await getAccountBalance(tenantId, id);
      }

      // Return structured response
      res.json({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        transactions: displayTransactions.map(t => ({
          id: t.id,
          transactionDate: t.transactionDate,
          journalEntryId: t.journalEntryId,
          journalEntryNumber: t.journalEntryNumber,
          journalEntryLegId: t.journalEntryLegId,
          description: t.description,
          debitAmount: t.debitAmount,
          creditAmount: t.creditAmount,
          runningBalance: t.runningBalance,
          sourceDocumentType: t.sourceDocumentType,
          sourceDocumentId: t.sourceDocumentId,
        })),
        summary: {
          totalDebits: summaryResult?.totalDebits || '0.00',
          totalCredits: summaryResult?.totalCredits || '0.00',
          openingBalance,
          closingBalance,
          transactionCount: summaryResult?.transactionCount || 0,
        },
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          hasMore
        }
      });
    } catch (error: any) {
      console.error("Error fetching account transaction history:", error);
      res.status(500).json({ message: error.message || "Failed to fetch account transaction history" });
    }
  });

  /**
   * GET /api/accounts/:accountId/balances
   * Get account balance history with transaction details for a date range
   * 
   * @param accountId - Account ID to get balance history for
   * @query startDate - Start date for balance history (ISO date string)
   * @query endDate - Optional end date for balance history (ISO date string, defaults to now)
   * @returns Account info, opening/current balances, and transaction history
   * 
   * @example
   * GET /api/accounts/acc-123/balances?tenantId=tenant-456&startDate=2024-01-01&endDate=2024-01-31
   * 
   * @testid API endpoint for account balance history page
   */
  app.get('/api/accounts/:accountId/balances', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('accounts.read'), async (req: any, res) => {
    try {
      const { accountId } = req.params;
      const tenantId = req.tenantId!;
      const { startDate, endDate } = req.query;

      // Validate required startDate parameter
      if (!startDate) {
        return res.status(400).json({ message: "startDate query parameter is required" });
      }

      // Parse and validate startDate
      let startDateParsed: Date;
      try {
        startDateParsed = new Date(startDate as string);
        if (isNaN(startDateParsed.getTime())) {
          return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (e.g., 2024-01-01)" });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (e.g., 2024-01-01)" });
      }

      // Parse and validate endDate if provided
      let endDateParsed: Date | undefined;
      if (endDate) {
        try {
          endDateParsed = new Date(endDate as string);
          if (isNaN(endDateParsed.getTime())) {
            return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (e.g., 2024-12-31)" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (e.g., 2024-12-31)" });
        }
      }

      // Use the historicalBalanceService to get account balance history
      const { getAccountBalanceHistory } = await import('./accounting/historical-balance-service');
      
      const history = await getAccountBalanceHistory(
        tenantId,
        accountId,
        startDateParsed,
        endDateParsed
      );

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching account balance history:", error);
      
      if (error.name === 'NotFoundError') {
        return res.status(404).json({ message: error.message || "Account not found" });
      }
      
      res.status(500).json({ message: error.message || "Failed to fetch account balance history" });
    }
  });

  // Item routes
  app.get('/api/items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('items.read'), async (req: any, res) => {
    try {
      const items = await storage.getItems(req.tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post('/api/items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('items.create'), async (req: any, res) => {
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

  app.patch('/api/items/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('items.update'), async (req: any, res) => {
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

  app.delete('/api/items/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('items.delete'), async (req: any, res) => {
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
  app.get('/api/taxes', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('taxes.read'), async (req: any, res) => {
    try {
      const taxes = await storage.getTaxes(req.tenantId);
      res.json(taxes);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      res.status(500).json({ message: "Failed to fetch taxes" });
    }
  });

  app.post('/api/taxes', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('taxes.create'), async (req: any, res) => {
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

  app.patch('/api/taxes/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('taxes.update'), async (req: any, res) => {
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

  app.delete('/api/taxes/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('taxes.delete'), async (req: any, res) => {
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

  // Currency routes
  app.get('/api/currencies', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const currencies = await storage.getCurrencies(tenantId);
      res.json(currencies);
    } catch (error) {
      console.error('Error fetching currencies:', error);
      res.status(500).json({ error: 'Failed to fetch currencies' });
    }
  });

  app.post('/api/currencies', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('settings:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      // Don't require tenantId from client - use server-side verified tenantId
      const data = insertCurrencySchema.omit({ tenantId: true }).parse(req.body);
      const currency = await storage.createCurrency(tenantId, data);
      res.json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid currency data', details: error.errors });
      }
      console.error('Error creating currency:', error);
      res.status(500).json({ error: 'Failed to create currency' });
    }
  });

  app.patch('/api/currencies/:code', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('settings:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    const { code } = req.params;
    
    try {
      // Use partial schema without tenantId to prevent client from changing it
      const data = insertCurrencySchema.partial().omit({ tenantId: true }).parse(req.body);
      const currency = await storage.updateCurrency(tenantId, code, data);
      res.json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid currency data', details: error.errors });
      }
      console.error('Error updating currency:', error);
      res.status(500).json({ error: 'Failed to update currency' });
    }
  });

  app.delete('/api/currencies/:code', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('settings:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    const { code } = req.params;
    
    try {
      // Check if it's the base currency
      const currency = await storage.getCurrencyByCode(tenantId, code);
      if (!currency) {
        return res.status(404).json({ error: 'Currency not found' });
      }
      
      if (currency.isBaseCurrency) {
        return res.status(400).json({ error: 'Cannot delete base currency' });
      }
      
      // Check if currency is used in any financial transactions
      const isUsed = await storage.checkCurrencyUsageAny(tenantId, code);
      
      if (isUsed) {
        return res.status(400).json({ 
          error: 'Cannot delete currency that is used in transactions',
          details: 'This currency is referenced by existing financial records. You can deactivate it instead.'
        });
      }
      
      await storage.deleteCurrency(tenantId, code);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting currency:', error);
      res.status(500).json({ error: 'Failed to delete currency' });
    }
  });

  app.post('/api/currencies/:code/set-base', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('settings:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    const { code } = req.params;
    
    try {
      await storage.setBaseCurrency(tenantId, code);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting base currency:', error);
      res.status(500).json({ error: 'Failed to set base currency' });
    }
  });

  // Exchange Rate routes
  app.get('/api/exchange-rates', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const filters = {
        fromCurrency: req.query.fromCurrency as string | undefined,
        toCurrency: req.query.toCurrency as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        source: req.query.source as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      };
      
      const rates = await storage.getExchangeRates(tenantId, filters);
      res.json(rates);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
  });

  app.get('/api/exchange-rates/latest', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const rates = await storage.getLatestExchangeRates(tenantId);
      res.json(rates);
    } catch (error) {
      console.error('Error fetching latest exchange rates:', error);
      res.status(500).json({ error: 'Failed to fetch latest exchange rates' });
    }
  });

  app.post('/api/exchange-rates', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('settings:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const { applyReciprocal, ...rateData } = req.body;
      const data = insertExchangeRateSchema.parse(rateData);
      
      const rates = await storage.createExchangeRate(tenantId, {
        ...data,
        applyReciprocal: applyReciprocal === true,
      });
      
      res.json(rates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid exchange rate data', details: error.errors });
      }
      console.error('Error creating exchange rate:', error);
      res.status(500).json({ error: 'Failed to create exchange rate' });
    }
  });

  app.post('/api/exchange-rates/refresh', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('billing:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      await updateExchangeRatesForTenant(tenantId);
      
      res.json({ success: true, message: 'Exchange rates refreshed successfully' });
    } catch (error) {
      console.error('Error refreshing exchange rates:', error);
      res.status(500).json({ error: 'Failed to refresh exchange rates' });
    }
  });

  // FX Configuration routes
  app.get('/api/settings/fx-config', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const config = await storage.getFXConfig(tenantId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching FX config:', error);
      res.status(500).json({ error: 'Failed to fetch FX configuration' });
    }
  });

  app.patch('/api/settings/fx-config', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('billing:update'), async (req: any, res) => {
    const tenantId = req.tenantId;
    
    try {
      const data = insertFXConfigSchema.partial().parse(req.body);
      const config = await storage.updateFXConfig(tenantId, data);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid FX config data', details: error.errors });
      }
      console.error('Error updating FX config:', error);
      res.status(500).json({ error: 'Failed to update FX configuration' });
    }
  });

  // Invoice routes
  app.get('/api/invoices', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.read'), async (req: any, res) => {
    try {
      const { limit, sortBy = 'createdAt', sortOrder = 'desc', status } = req.query;
      
      const conditions = [
        eq(invoices.tenantId, req.tenantId),
        isNull(invoices.deletedAt)
      ];
      
      // Handle status filter for overdue invoices
      if (status === 'overdue') {
        conditions.push(
          and(
            lt(invoices.dueDate, new Date()),
            or(
              eq(invoices.status, 'sent'),
              eq(invoices.status, 'overdue')
            )
          )
        );
      }
      
      let query = db
        .select()
        .from(invoices)
        .where(and(...conditions));
      
      // For overdue invoices, sort by dueDate ascending (most overdue first)
      // For regular queries, use the requested sort
      if (status === 'overdue') {
        query = query.orderBy(asc(invoices.dueDate));
      } else {
        const orderColumn = sortBy === 'invoiceDate' ? invoices.invoiceDate : invoices.createdAt;
        query = sortOrder === 'asc' 
          ? query.orderBy(asc(orderColumn))
          : query.orderBy(desc(orderColumn));
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get('/api/invoices/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.read'), async (req: any, res) => {
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

  app.get('/api/invoices/:id/line-items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.read'), async (req: any, res) => {
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

  app.post('/api/invoices', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.create'), async (req: any, res) => {
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

  app.patch('/api/invoices/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.update'), async (req: any, res) => {
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

  app.delete('/api/invoices/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.delete'), async (req: any, res) => {
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

  app.post("/api/invoices/:id/send-email", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.send'), async (req: any, res) => {
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

  app.post("/api/invoices/:id/post", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('invoices.update'), async (req: any, res) => {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.claims.sub;

    try {
      // 1. Validate invoice exists and belongs to tenant
      const invoice = await storage.getInvoiceById(id, tenantId);
      if (!invoice) {
        return res.status(404).json({ 
          message: "Invoice not found" 
        });
      }

      // 2. Check invoice status - can only post draft or approved invoices
      if (invoice.status !== 'draft' && invoice.status !== 'approved') {
        return res.status(400).json({ 
          message: `Cannot post invoice with status '${invoice.status}'. Only draft or approved invoices can be posted.` 
        });
      }

      // 3. Use database transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // 3a. Fetch invoice data with line items for journal entry creation
        const invoiceEntryData = await fetchInvoiceEntryData(id, tenantId, storage, tx);

        // 3b. Create journal entry structure
        const journalEntryInput = await createInvoiceJournalEntry(
          invoiceEntryData,
          tenantId,
          userId, // preparedBy
          storage,
          tx
        );

        // 3c. Get next journal entry number - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);

        // 3d. Persist journal entry header - CRITICAL: Pass tx for atomicity
        const journalEntry = await storage.createJournalEntry(
          tenantId,
          {
            entryDate: journalEntryInput.entryDate,
            entryNumber: journalEntryNumber,
            description: journalEntryInput.description,
            referenceNumber: journalEntryInput.referenceNumber,
            notes: journalEntryInput.notes,
            sourceDocumentType: journalEntryInput.sourceDocumentType,
            sourceDocumentId: journalEntryInput.sourceDocumentId,
            isAutoGenerated: journalEntryInput.isAutoGenerated,
            preparedBy: journalEntryInput.preparedBy,
            preparedAt: journalEntryInput.preparedAt,
            status: 'posted', // Auto-generated entries are posted immediately
          },
          tx
        );

        // 3e. Persist journal entry lines (legs) - CRITICAL: Pass tx for atomicity
        const journalEntryLegs = await storage.createJournalEntryLegs(
          tenantId,
          journalEntryInput.lines.map(line => ({
            journalEntryId: journalEntry.id,
            accountId: line.accountId!,
            type: line.debitAmount ? 'Debit' as const : 'Credit' as const,
            amount: line.debitAmount || line.creditAmount!,
            description: line.description,
          })),
          tx
        );

        // 3f. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);

        // 3g. Update invoice status to 'posted'
        const updatedInvoice = await storage.updateInvoice(id, tenantId, {
          status: 'posted',
        }, tx);

        return {
          invoice: updatedInvoice,
          journalEntry: {
            ...journalEntry,
            legs: journalEntryLegs,
          },
        };
      });

      // 4. Return success response with both invoice and journal entry
      res.json({
        success: true,
        message: `Invoice ${invoice.invoiceNumber} posted successfully`,
        invoice: result.invoice,
        journalEntry: result.journalEntry,
      });

    } catch (error: any) {
      console.error("Error posting invoice:", error);

      // Handle accounting validation errors with specific messages
      if (error instanceof AccountingValidationError) {
        return res.status(400).json({ 
          message: `Validation error: ${error.message}` 
        });
      }

      // Handle generic errors
      return res.status(500).json({ 
        message: error.message || "Failed to post invoice" 
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

  // Post credit note to ledger (create journal entry)
  app.post("/api/credit-notes/:id/post", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('credit_notes.approve'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Use atomic transaction to ensure credit note and journal entry are created together
      const result = await withTransaction(async (tx) => {
        // 1. Get credit note and validate status
        const existingCreditNote = await tx
          .select()
          .from(creditNotes)
          .where(and(eq(creditNotes.id, id), eq(creditNotes.tenantId, tenantId)))
          .limit(1);

        if (!existingCreditNote[0]) {
          throw new ValidationError('Credit note not found');
        }

        if (existingCreditNote[0].status === 'posted') {
          throw new ValidationError('Credit note has already been posted');
        }

        // 2. Fetch credit note data and create journal entry
        const creditNoteEntryData = await fetchCreditNoteEntryData(id, tenantId, storage, tx);
        const journalEntryData = await createCreditNoteJournalEntry(
          creditNoteEntryData,
          tenantId,
          userId,
          storage,
          tx
        );

        // 3. Persist journal entry to database - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);
        const journalEntry = await storage.createJournalEntry(tenantId, {
          journalEntryNumber,
          entryDate: journalEntryData.entryDate,
          description: journalEntryData.description,
          referenceNumber: journalEntryData.referenceNumber || null,
          notes: journalEntryData.notes || null,
          sourceDocumentType: journalEntryData.sourceDocumentType,
          sourceDocumentId: journalEntryData.sourceDocumentId,
          status: 'posted',
          isAutoGenerated: journalEntryData.isAutoGenerated || true,
          preparedBy: journalEntryData.preparedBy,
          preparedAt: journalEntryData.preparedAt || new Date(),
        }, tx);

        // 4. Create journal entry legs - CRITICAL: Pass tx for atomicity
        const legs = journalEntryData.lines.map(line => ({
          journalEntryId: journalEntry.id,
          accountId: line.accountId!,
          debitAmount: line.debitAmount || null,
          creditAmount: line.creditAmount || null,
          description: line.description,
        }));

        await storage.createJournalEntryLegs(tenantId, legs, tx);

        // 5. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);

        // 6. Update credit note status to 'posted'
        const updatedCreditNote = await tx
          .update(creditNotes)
          .set({ status: 'posted', updatedAt: new Date() })
          .where(and(eq(creditNotes.id, id), eq(creditNotes.tenantId, tenantId)))
          .returning();

        return { creditNote: updatedCreditNote[0], journalEntry };
      });

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof AccountingValidationError || error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error posting credit note:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== DEBIT NOTES =====

  // Post debit note to ledger (create journal entry)
  app.post("/api/debit-notes/:id/post", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('debit_notes.approve'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Use atomic transaction to ensure debit note and journal entry are created together
      const result = await withTransaction(async (tx) => {
        // 1. Get debit note and validate status
        const existingDebitNote = await tx
          .select()
          .from(debitNotes)
          .where(and(eq(debitNotes.id, id), eq(debitNotes.tenantId, tenantId)))
          .limit(1);

        if (!existingDebitNote[0]) {
          throw new ValidationError('Debit note not found');
        }

        if (existingDebitNote[0].status === 'posted') {
          throw new ValidationError('Debit note has already been posted');
        }

        // 2. Fetch debit note data and create journal entry
        const debitNoteEntryData = await fetchDebitNoteEntryData(id, tenantId, storage, tx);
        const journalEntryData = await createDebitNoteJournalEntry(
          debitNoteEntryData,
          tenantId,
          userId,
          storage,
          tx
        );

        // 3. Persist journal entry to database - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);
        const journalEntry = await storage.createJournalEntry(tenantId, {
          journalEntryNumber,
          entryDate: journalEntryData.entryDate,
          description: journalEntryData.description,
          referenceNumber: journalEntryData.referenceNumber || null,
          notes: journalEntryData.notes || null,
          sourceDocumentType: journalEntryData.sourceDocumentType,
          sourceDocumentId: journalEntryData.sourceDocumentId,
          status: 'posted',
          isAutoGenerated: journalEntryData.isAutoGenerated || true,
          preparedBy: journalEntryData.preparedBy,
          preparedAt: journalEntryData.preparedAt || new Date(),
        }, tx);

        // 4. Create journal entry legs - CRITICAL: Pass tx for atomicity
        const legs = journalEntryData.lines.map(line => ({
          journalEntryId: journalEntry.id,
          accountId: line.accountId!,
          debitAmount: line.debitAmount || null,
          creditAmount: line.creditAmount || null,
          description: line.description,
        }));

        await storage.createJournalEntryLegs(tenantId, legs, tx);

        // 5. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);

        // 6. Update debit note status to 'posted'
        const updatedDebitNote = await tx
          .update(debitNotes)
          .set({ status: 'posted', updatedAt: new Date() })
          .where(and(eq(debitNotes.id, id), eq(debitNotes.tenantId, tenantId)))
          .returning();

        return { debitNote: updatedDebitNote[0], journalEntry };
      });

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof AccountingValidationError || error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error posting debit note:', error);
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

  app.post("/api/customer-payments", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('customer_payments.create'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;
      const validated = insertCustomerPaymentSchema.parse({ ...req.body, tenantId });
      
      // Use atomic transaction to ensure payment and journal entry are created together
      const result = await withTransaction(async (tx) => {
        // 1. Create customer payment record
        const payment = await storage.createCustomerPayment(validated, tx);
        
        // 2. Fetch payment data and create journal entry
        const paymentEntryData = await fetchCustomerPaymentEntryData(payment.id, tenantId, storage, tx);
        const journalEntryData = await createCustomerPaymentJournalEntry(
          paymentEntryData,
          userId,
          tenantId,
          storage,
          tx
        );
        
        // 3. Persist journal entry to database - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);
        const journalEntry = await storage.createJournalEntry(tenantId, {
          journalEntryNumber,
          entryDate: journalEntryData.entryDate,
          description: journalEntryData.description,
          referenceNumber: journalEntryData.referenceNumber || null,
          notes: journalEntryData.notes || null,
          sourceDocumentType: journalEntryData.sourceDocumentType,
          sourceDocumentId: journalEntryData.sourceDocumentId,
          status: 'posted', // Auto-post journal entries for payments
          isAutoGenerated: journalEntryData.isAutoGenerated || true,
          preparedBy: journalEntryData.preparedBy,
          preparedAt: journalEntryData.preparedAt || new Date(),
        }, tx);
        
        // 4. Create journal entry legs - CRITICAL: Pass tx for atomicity
        const legs = journalEntryData.lines.map(line => ({
          journalEntryId: journalEntry.id,
          accountId: line.accountId!,
          debitAmount: line.debitAmount || null,
          creditAmount: line.creditAmount || null,
          description: line.description,
        }));
        
        await storage.createJournalEntryLegs(tenantId, legs, tx);

        // 5. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);
        
        return { payment, journalEntry };
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if (error instanceof AccountingValidationError) {
        return res.status(400).json({ message: error.message });
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

  // ===== APPROVAL ROUTES =====
  
  /**
   * Get pending approvals for current user
   * 
   * @route GET /api/approvals/pending
   * @testid pending-approvals-list
   */
  app.get("/api/approvals/pending", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Get user's roles for role-based approval matching
      const rbacService = new RBACService(tenantId);
      const userRoles = await rbacService.getUserRoles(userId);
      const userRoleNames = userRoles.map(r => r.name);

      // Build role condition - only add IN clause if user has roles
      const roleCondition = userRoleNames.length > 0 
        ? inArray(approvalSteps.approverRole, userRoleNames)
        : sql`FALSE`;

      // Alias for requestedBy user
      const requesterUser = alias(users, 'requester_user');

      // Build pending approvals query with all necessary joins
      const pendingApprovals = await db
        .select({
          // Approval request details
          approvalRequestId: approvalRequests.id,
          entityType: approvalRequests.entityType,
          entityId: approvalRequests.entityId,
          currentStep: approvalRequests.currentStep,
          requestedBy: approvalRequests.requestedBy,
          approvalRequestCreatedAt: approvalRequests.createdAt,
          approvalDeadline: approvalRequests.approvalDeadline,
          approvalStatus: approvalRequests.status,
          workflowId: approvalRequests.workflowId,
          
          // Workflow details
          workflowName: approvalWorkflows.name,
          
          // Approval step details
          stepOrder: approvalSteps.stepOrder,
          approverRole: approvalSteps.approverRole,
          approverUserId: approvalSteps.approverUserId,
          
          // Journal entry details (for journal_entry entity type)
          journalEntryNumber: journalEntries.journalEntryNumber,
          entryDate: journalEntries.entryDate,
          description: journalEntries.description,
          currencyCode: journalEntries.currencyCode,
          
          // Requester user details
          requesterFirstName: requesterUser.firstName,
          requesterLastName: requesterUser.lastName,
          requesterEmail: requesterUser.email,
        })
        .from(approvalRequests)
        .innerJoin(
          approvalSteps,
          and(
            eq(approvalSteps.workflowId, approvalRequests.workflowId),
            eq(approvalSteps.stepOrder, approvalRequests.currentStep)
          )
        )
        .innerJoin(approvalWorkflows, eq(approvalWorkflows.id, approvalRequests.workflowId))
        .leftJoin(
          journalEntries,
          and(
            eq(approvalRequests.entityType, 'journal_entry'),
            eq(journalEntries.id, approvalRequests.entityId)
          )
        )
        .innerJoin(requesterUser, eq(requesterUser.id, approvalRequests.requestedBy))
        .where(
          and(
            eq(approvalRequests.tenantId, tenantId),
            eq(approvalRequests.status, 'pending'),
            // User is assigned approver: either by userId OR by role
            sql`(
              ${approvalSteps.approverUserId} = ${userId}
              OR ${roleCondition}
            )`
          )
        )
        .orderBy(desc(approvalRequests.createdAt));

      // Calculate total amount for each journal entry
      const pendingApprovalsWithAmounts = await Promise.all(
        pendingApprovals.map(async (approval) => {
          let totalAmount = '0';
          
          if (approval.entityType === 'journal_entry' && approval.entityId) {
            // Get all legs for this journal entry to calculate total
            const legs = await db
              .select({ amount: journalEntryLegs.amount })
              .from(journalEntryLegs)
              .where(
                and(
                  eq(journalEntryLegs.journalEntryId, approval.entityId),
                  eq(journalEntryLegs.tenantId, tenantId),
                  eq(journalEntryLegs.type, 'Debit')
                )
              );
            
            totalAmount = legs.reduce((sum, leg) => {
              const amount = parseFloat(leg.amount || '0');
              return (parseFloat(sum) + amount).toFixed(2);
            }, '0');
          }
          
          return {
            ...approval,
            totalAmount,
          };
        })
      );

      // Get unique workflowIds from pending approvals (filter out null values)
      const allWorkflowIds = pendingApprovalsWithAmounts.map(a => a.workflowId);
      const uniqueWorkflowIds = [...new Set(allWorkflowIds.filter(id => id !== null))] as string[];

      // Build map with proper null handling
      const workflowStepMap = new Map<string | null, number>();

      // Get total steps for each workflow (only if we have non-null workflowIds)
      if (uniqueWorkflowIds.length > 0) {
        const workflowStepCounts = await db
          .select({
            workflowId: approvalSteps.workflowId,
            totalSteps: sql<number>`count(distinct ${approvalSteps.stepOrder})`.as('total_steps'),
          })
          .from(approvalSteps)
          .where(
            and(
              eq(approvalSteps.tenantId, tenantId),
              inArray(approvalSteps.workflowId, uniqueWorkflowIds)
            )
          )
          .groupBy(approvalSteps.workflowId);

        // Populate map with workflow step counts
        for (const step of workflowStepCounts) {
          workflowStepMap.set(step.workflowId, step.totalSteps);
        }
      }

      // For null workflowIds (ad-hoc approvals), count steps separately
      if (allWorkflowIds.includes(null)) {
        const nullWorkflowSteps = await db
          .select({
            totalSteps: sql<number>`count(distinct ${approvalSteps.stepOrder})`.as('total_steps'),
          })
          .from(approvalSteps)
          .where(
            and(
              eq(approvalSteps.tenantId, tenantId),
              sql`${approvalSteps.workflowId} IS NULL`
            )
          );
        
        if (nullWorkflowSteps.length > 0 && nullWorkflowSteps[0].totalSteps > 0) {
          workflowStepMap.set(null, nullWorkflowSteps[0].totalSteps);
        }
      }

      // Format response
      const formattedApprovals = pendingApprovalsWithAmounts.map(approval => ({
        id: approval.approvalRequestId,
        entityType: approval.entityType,
        entityId: approval.entityId,
        currentStep: approval.currentStep || 1,
        stepOrder: approval.stepOrder,
        requestedBy: approval.requestedBy,
        createdAt: approval.approvalRequestCreatedAt,
        approvalDeadline: approval.approvalDeadline,
        
        // Entity details
        entity: {
          journalEntryNumber: approval.journalEntryNumber,
          entryDate: approval.entryDate,
          description: approval.description,
          totalAmount: approval.totalAmount,
          currencyCode: approval.currencyCode,
        },
        
        // Workflow details
        workflow: {
          id: approval.workflowId,
          name: approval.workflowName,
          totalSteps: workflowStepMap.get(approval.workflowId) || 1,
          currentStepName: approval.approverRole || `Step ${approval.stepOrder || approval.currentStep}`,
        },
        
        // Requester details
        requester: {
          id: approval.requestedBy,
          firstName: approval.requesterFirstName,
          lastName: approval.requesterLastName,
          email: approval.requesterEmail,
        },
      }));

      res.json(formattedApprovals);
    } catch (error: any) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch pending approvals' });
    }
  });

  /**
   * Get all approval workflows for current tenant
   * 
   * @route GET /api/workflows
   * @testid workflows-list
   */
  app.get("/api/workflows", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;

      // Fetch workflows with creator info
      const workflows = await db
        .select({
          id: approvalWorkflows.id,
          tenantId: approvalWorkflows.tenantId,
          name: approvalWorkflows.name,
          entityType: approvalWorkflows.entityType,
          conditions: approvalWorkflows.conditions,
          isActive: approvalWorkflows.isActive,
          createdBy: approvalWorkflows.createdBy,
          createdAt: approvalWorkflows.createdAt,
          updatedAt: approvalWorkflows.updatedAt,
          creatorFirstName: users.firstName,
          creatorLastName: users.lastName,
          creatorEmail: users.email,
        })
        .from(approvalWorkflows)
        .leftJoin(users, eq(users.id, approvalWorkflows.createdBy))
        .where(eq(approvalWorkflows.tenantId, tenantId))
        .orderBy(desc(approvalWorkflows.createdAt));

      // Get step counts for each workflow
      const workflowIds = workflows.map(w => w.id);
      const stepCounts = workflowIds.length > 0
        ? await db
            .select({
              workflowId: approvalSteps.workflowId,
              totalSteps: sql<number>`count(*)`.as('total_steps'),
            })
            .from(approvalSteps)
            .where(
              and(
                eq(approvalSteps.tenantId, tenantId),
                inArray(approvalSteps.workflowId, workflowIds)
              )
            )
            .groupBy(approvalSteps.workflowId)
        : [];

      // Create map of workflow ID to step count
      const stepCountMap = new Map(
        stepCounts.map(s => [s.workflowId, s.totalSteps])
      );

      // Format response
      const formattedWorkflows = workflows.map(workflow => ({
        id: workflow.id,
        tenantId: workflow.tenantId,
        name: workflow.name,
        entityType: workflow.entityType,
        conditions: workflow.conditions,
        isActive: workflow.isActive,
        totalSteps: stepCountMap.get(workflow.id) || 0,
        createdBy: workflow.createdBy,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        creator: workflow.createdBy ? {
          id: workflow.createdBy,
          firstName: workflow.creatorFirstName,
          lastName: workflow.creatorLastName,
          email: workflow.creatorEmail,
        } : null,
      }));

      res.json(formattedWorkflows);
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch workflows' });
    }
  });

  /**
   * Get single workflow by ID with steps
   * 
   * @route GET /api/workflows/:id
   * @testid get-workflow
   */
  app.get("/api/workflows/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const workflowId = req.params.id;

      // Fetch workflow
      const [workflow] = await db
        .select()
        .from(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Fetch steps for this workflow
      const steps = await db
        .select()
        .from(approvalSteps)
        .where(
          and(
            eq(approvalSteps.workflowId, workflowId),
            eq(approvalSteps.tenantId, tenantId)
          )
        )
        .orderBy(asc(approvalSteps.stepOrder));

      res.json({ ...workflow, steps });
    } catch (error: any) {
      console.error('Error fetching workflow:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch workflow' });
    }
  });

  /**
   * Create new approval workflow
   * 
   * @route POST /api/workflows
   * @testid create-workflow
   */
  app.post("/api/workflows", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;
      const { name, entityType, conditions, isActive, steps } = req.body;

      // Validate required fields
      if (!name || !entityType) {
        return res.status(400).json({ message: "Name and entity type are required" });
      }

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ message: "At least one approval step is required" });
      }

      // Validate steps
      for (const step of steps) {
        if (!step.approverRole && !step.approverUserId) {
          return res.status(400).json({ 
            message: `Step ${step.stepOrder}: Either approver role or user must be specified` 
          });
        }
      }

      // Create workflow
      const [newWorkflow] = await db
        .insert(approvalWorkflows)
        .values({
          tenantId,
          name,
          entityType,
          conditions: conditions || {},
          isActive: isActive !== undefined ? isActive : true,
          createdBy: userId,
        })
        .returning();

      // Create approval steps
      const stepValues = steps.map((step: any) => ({
        tenantId,
        workflowId: newWorkflow.id,
        stepOrder: step.stepOrder,
        approverRole: step.approverRole || null,
        approverUserId: step.approverUserId || null,
        requiresAll: step.requiresAll || false,
      }));

      await db.insert(approvalSteps).values(stepValues);

      res.status(201).json({ ...newWorkflow, steps: stepValues });
    } catch (error: any) {
      console.error('Error creating workflow:', error);
      res.status(500).json({ message: error.message || 'Failed to create workflow' });
    }
  });

  /**
   * Update approval workflow
   * 
   * @route PUT /api/workflows/:id
   * @testid update-full-workflow
   */
  app.put("/api/workflows/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const workflowId = req.params.id;
      const { name, entityType, conditions, isActive, steps } = req.body;

      // Verify workflow exists
      const [existingWorkflow] = await db
        .select()
        .from(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingWorkflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Validate required fields
      if (!name || !entityType) {
        return res.status(400).json({ message: "Name and entity type are required" });
      }

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ message: "At least one approval step is required" });
      }

      // Validate steps
      for (const step of steps) {
        if (!step.approverRole && !step.approverUserId) {
          return res.status(400).json({ 
            message: `Step ${step.stepOrder}: Either approver role or user must be specified` 
          });
        }
      }

      // Update workflow
      const [updatedWorkflow] = await db
        .update(approvalWorkflows)
        .set({
          name,
          entityType,
          conditions: conditions || {},
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        )
        .returning();

      // Delete existing steps
      await db
        .delete(approvalSteps)
        .where(
          and(
            eq(approvalSteps.workflowId, workflowId),
            eq(approvalSteps.tenantId, tenantId)
          )
        );

      // Create new steps
      const stepValues = steps.map((step: any) => ({
        tenantId,
        workflowId: updatedWorkflow.id,
        stepOrder: step.stepOrder,
        approverRole: step.approverRole || null,
        approverUserId: step.approverUserId || null,
        requiresAll: step.requiresAll || false,
      }));

      await db.insert(approvalSteps).values(stepValues);

      res.json({ ...updatedWorkflow, steps: stepValues });
    } catch (error: any) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ message: error.message || 'Failed to update workflow' });
    }
  });

  /**
   * Update approval workflow (toggle active/inactive)
   * 
   * @route PATCH /api/workflows/:id
   * @testid update-workflow
   */
  app.patch("/api/workflows/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const workflowId = req.params.id;
      const { isActive } = req.body;

      // Verify workflow exists and belongs to tenant
      const workflow = await db
        .select()
        .from(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!workflow || workflow.length === 0) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Update workflow
      await db
        .update(approvalWorkflows)
        .set({
          isActive: isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        );

      res.json({ message: "Workflow updated successfully" });
    } catch (error: any) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ message: error.message || 'Failed to update workflow' });
    }
  });

  /**
   * Delete approval workflow
   * 
   * @route DELETE /api/workflows/:id
   * @testid delete-workflow
   */
  app.delete("/api/workflows/:id", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const workflowId = req.params.id;

      // Verify workflow exists and belongs to tenant
      const workflow = await db
        .select()
        .from(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!workflow || workflow.length === 0) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Delete workflow (cascade will delete approval steps)
      await db
        .delete(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.id, workflowId),
            eq(approvalWorkflows.tenantId, tenantId)
          )
        );

      res.json({ message: "Workflow deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ message: error.message || 'Failed to delete workflow' });
    }
  });

  // Journal Entry routes
  app.get("/api/journal-entries", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // Create alias for second users table join (for postedBy)
      const postedByUser = alias(users, 'posted_by_user');
      
      // Fetch journal entries with preparer, poster, and approval request info using joins
      const entries = await db
        .select({
          // Journal entry fields
          id: journalEntries.id,
          tenantId: journalEntries.tenantId,
          journalEntryNumber: journalEntries.journalEntryNumber,
          entryDate: journalEntries.entryDate,
          referenceNumber: journalEntries.referenceNumber,
          description: journalEntries.description,
          notes: journalEntries.notes,
          status: journalEntries.status,
          currencyCode: journalEntries.currencyCode,
          exchangeRate: journalEntries.exchangeRate,
          baseCurrencyAmount: journalEntries.baseCurrencyAmount,
          transactionCurrencyCode: journalEntries.transactionCurrencyCode,
          sourceDocumentType: journalEntries.sourceDocumentType,
          sourceDocumentId: journalEntries.sourceDocumentId,
          isAutoGenerated: journalEntries.isAutoGenerated,
          modificationLocked: journalEntries.modificationLocked,
          reversedEntryId: journalEntries.reversedEntryId,
          reversalReason: journalEntries.reversalReason,
          workflowRequestId: journalEntries.workflowRequestId,
          preparedBy: journalEntries.preparedBy,
          preparedAt: journalEntries.preparedAt,
          postedBy: journalEntries.postedBy,
          postedAt: journalEntries.postedAt,
          createdBy: journalEntries.createdBy,
          lastModifiedBy: journalEntries.lastModifiedBy,
          createdAt: journalEntries.createdAt,
          updatedAt: journalEntries.updatedAt,
          
          // Preparer user info
          preparedByUser: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          
          // Poster user info (from second join using alias)
          postedByUser: {
            id: postedByUser.id,
            firstName: postedByUser.firstName,
            lastName: postedByUser.lastName,
            email: postedByUser.email,
          },
          
          // Approval request info
          approvalRequestStatus: approvalRequests.status,
          approvalRequestCurrentStep: approvalRequests.currentStep,
        })
        .from(journalEntries)
        .leftJoin(users, eq(journalEntries.preparedBy, users.id))
        .leftJoin(postedByUser, eq(journalEntries.postedBy, postedByUser.id))
        .leftJoin(approvalRequests, eq(journalEntries.workflowRequestId, approvalRequests.id))
        .where(eq(journalEntries.tenantId, tenantId))
        .orderBy(desc(journalEntries.entryDate));
      
      // Get all workflowRequestIds to fetch approval history
      const workflowRequestIds = entries
        .map(e => e.workflowRequestId)
        .filter((id): id is string => id !== null);
      
      // Fetch approval history for all workflow requests in one query
      let approvalHistoryData: any[] = [];
      if (workflowRequestIds.length > 0) {
        approvalHistoryData = await db
          .select({
            approvalRequestId: approvalHistory.approvalRequestId,
            stepOrder: approvalHistory.stepOrder,
            approverUserId: approvalHistory.approverUserId,
            decision: approvalHistory.decision,
            comments: approvalHistory.comments,
            timestamp: approvalHistory.timestamp,
            approverFirstName: users.firstName,
            approverLastName: users.lastName,
            approverEmail: users.email,
          })
          .from(approvalHistory)
          .leftJoin(users, eq(approvalHistory.approverUserId, users.id))
          .where(inArray(approvalHistory.approvalRequestId, workflowRequestIds))
          .orderBy(asc(approvalHistory.stepOrder));
      }
      
      // Group approval history by approvalRequestId
      const historyByRequestId = new Map<string, any[]>();
      for (const historyItem of approvalHistoryData) {
        const requestId = historyItem.approvalRequestId;
        if (!historyByRequestId.has(requestId)) {
          historyByRequestId.set(requestId, []);
        }
        historyByRequestId.get(requestId)!.push({
          stepOrder: historyItem.stepOrder,
          approverUserId: historyItem.approverUserId,
          approverUser: {
            firstName: historyItem.approverFirstName,
            lastName: historyItem.approverLastName,
            email: historyItem.approverEmail,
          },
          action: historyItem.decision,
          comments: historyItem.comments,
          timestamp: historyItem.timestamp,
        });
      }
      
      // Transform to match expected response format
      const enrichedEntries = entries.map(entry => ({
        id: entry.id,
        journalEntryNumber: entry.journalEntryNumber,
        entryDate: entry.entryDate,
        referenceNumber: entry.referenceNumber,
        description: entry.description,
        notes: entry.notes,
        status: entry.status,
        currencyCode: entry.currencyCode,
        exchangeRate: entry.exchangeRate,
        baseCurrencyAmount: entry.baseCurrencyAmount,
        transactionCurrencyCode: entry.transactionCurrencyCode,
        
        // Preparer info
        preparedBy: entry.preparedBy,
        preparedByUser: entry.preparedBy && entry.preparedByUser.id ? {
          id: entry.preparedByUser.id,
          firstName: entry.preparedByUser.firstName!,
          lastName: entry.preparedByUser.lastName!,
          email: entry.preparedByUser.email!,
        } : null,
        preparedAt: entry.preparedAt,
        
        // Poster info
        postedBy: entry.postedBy,
        postedByUser: entry.postedBy && entry.postedByUser.id ? {
          id: entry.postedByUser.id,
          firstName: entry.postedByUser.firstName!,
          lastName: entry.postedByUser.lastName!,
          email: entry.postedByUser.email!,
        } : null,
        postedAt: entry.postedAt,
        
        // Source document
        sourceDocumentType: entry.sourceDocumentType,
        sourceDocumentId: entry.sourceDocumentId,
        isAutoGenerated: entry.isAutoGenerated,
        modificationLocked: entry.modificationLocked,
        reversedEntryId: entry.reversedEntryId,
        reversalReason: entry.reversalReason,
        
        // Workflow info
        workflowRequestId: entry.workflowRequestId,
        approvalWorkflow: entry.workflowRequestId ? {
          requestId: entry.workflowRequestId,
          status: entry.approvalRequestStatus!,
          currentStepOrder: entry.approvalRequestCurrentStep!,
          history: historyByRequestId.get(entry.workflowRequestId) || [],
        } : null,
        
        // Standard fields
        tenantId: entry.tenantId,
        createdBy: entry.createdBy,
        lastModifiedBy: entry.lastModifiedBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));
      
      res.json(enrichedEntries);
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

  // Get audit trail for a journal entry (complete lifecycle timeline)
  app.get("/api/journal-entries/:id/audit-trail", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // Fetch the journal entry with tenant filtering
      const [journalEntry] = await db
        .select()
        .from(journalEntries)
        .where(and(
          eq(journalEntries.id, id),
          eq(journalEntries.tenantId, tenantId)
        ));

      if (!journalEntry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      // Collect all user IDs we need to fetch
      const userIds = new Set<string>();
      if (journalEntry.createdBy) userIds.add(journalEntry.createdBy);
      if (journalEntry.preparedBy) userIds.add(journalEntry.preparedBy);
      if (journalEntry.postedBy) userIds.add(journalEntry.postedBy);
      if (journalEntry.lastModifiedBy) userIds.add(journalEntry.lastModifiedBy);

      // Fetch approval request and history if workflow exists
      let approvalRequest = null;
      let approvalHistoryRecords: any[] = [];
      let workflowSteps: any[] = [];

      if (journalEntry.workflowRequestId) {
        // Fetch approval request
        [approvalRequest] = await db
          .select()
          .from(approvalRequests)
          .where(and(
            eq(approvalRequests.id, journalEntry.workflowRequestId),
            eq(approvalRequests.tenantId, tenantId)
          ));

        if (approvalRequest) {
          // Add requestedBy to user IDs
          if (approvalRequest.requestedBy) userIds.add(approvalRequest.requestedBy);

          // Fetch approval history
          approvalHistoryRecords = await db
            .select()
            .from(approvalHistory)
            .where(eq(approvalHistory.approvalRequestId, journalEntry.workflowRequestId))
            .orderBy(asc(approvalHistory.timestamp));

          // Collect approver user IDs
          for (const record of approvalHistoryRecords) {
            if (record.approverUserId) userIds.add(record.approverUserId);
          }

          // Fetch workflow steps for step names (if workflow exists)
          if (approvalRequest.workflowId) {
            workflowSteps = await db
              .select()
              .from(approvalSteps)
              .where(eq(approvalSteps.workflowId, approvalRequest.workflowId))
              .orderBy(asc(approvalSteps.stepOrder));
          }
        }
      }

      // Collect user IDs from workflow steps for assigned approvers
      for (const step of workflowSteps) {
        if (step.approverUserId) userIds.add(step.approverUserId);
      }

      // Fetch all users in one query (only if we have user IDs)
      const usersData = userIds.size > 0 
        ? await db
            .select()
            .from(users)
            .where(inArray(users.id, Array.from(userIds)))
        : [];

      // Create a map for quick user lookup
      const userMap = new Map(usersData.map(u => [u.id, u]));

      // Helper function to get user details (MUST include id field)
      const getUserDetails = (userId: string | null) => {
        if (!userId) return null;
        const user = userMap.get(userId);
        if (!user) return null;
        return {
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
        };
      };

      // Helper function to get step name
      const getStepName = (stepOrder: number) => {
        const step = workflowSteps.find(s => s.stepOrder === stepOrder);
        return step ? `Step ${stepOrder}` : `Step ${stepOrder}`;
      };

      // Build timeline events
      const timeline: any[] = [];

      // 1. Created event
      if (journalEntry.createdAt && journalEntry.createdBy) {
        const user = getUserDetails(journalEntry.createdBy);
        timeline.push({
          eventType: 'created',
          timestamp: journalEntry.createdAt,
          userId: journalEntry.createdBy,
          user,
          action: `Created journal entry ${journalEntry.journalEntryNumber || 'draft'}`,
          comments: null,
          metadata: null,
        });
      }

      // 2. Prepared event (if different from created)
      if (journalEntry.preparedAt && journalEntry.preparedBy) {
        const user = getUserDetails(journalEntry.preparedBy);
        const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';
        timeline.push({
          eventType: 'prepared',
          timestamp: journalEntry.preparedAt,
          userId: journalEntry.preparedBy,
          user,
          action: `Prepared for posting by ${userName}`,
          comments: null,
          metadata: null,
        });
      }

      // 3. Submitted for approval event
      if (approvalRequest && approvalRequest.createdAt) {
        const user = getUserDetails(approvalRequest.requestedBy);
        timeline.push({
          eventType: 'submitted',
          timestamp: approvalRequest.createdAt,
          userId: approvalRequest.requestedBy,
          user,
          action: 'Submitted for approval workflow',
          comments: null,
          metadata: {
            workflowId: approvalRequest.workflowId,
            approvalRequestId: approvalRequest.id,
          },
        });
      }

      // 4. Approval/Rejection events
      for (const record of approvalHistoryRecords) {
        const user = getUserDetails(record.approverUserId);
        const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';
        const stepName = getStepName(record.stepOrder);
        const isApproved = record.decision === 'approved';
        
        let actionDescription = isApproved
          ? `Approved by ${userName} at approval ${stepName}`
          : `Rejected by ${userName} at approval ${stepName}`;

        if (record.comments) {
          actionDescription += ` - ${record.comments}`;
        }

        timeline.push({
          eventType: isApproved ? 'approved' : 'rejected',
          timestamp: record.timestamp,
          userId: record.approverUserId,
          user,
          action: actionDescription,
          comments: record.comments,
          metadata: {
            stepOrder: record.stepOrder,
            stepName,
            decision: record.decision,
            approvalHistoryId: record.id,
          },
        });
      }

      // 5. Posted event
      if (journalEntry.postedAt && journalEntry.postedBy) {
        const user = getUserDetails(journalEntry.postedBy);
        const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'System';
        timeline.push({
          eventType: 'posted',
          timestamp: journalEntry.postedAt,
          userId: journalEntry.postedBy,
          user,
          action: `Posted to ledger by ${userName}`,
          comments: null,
          metadata: null,
        });
      }

      // 6. Modified event (if updatedAt is different from createdAt)
      if (journalEntry.updatedAt && journalEntry.createdAt) {
        const updatedTime = new Date(journalEntry.updatedAt).getTime();
        const createdTime = new Date(journalEntry.createdAt).getTime();
        
        // If updated more than 1 second after creation, it was modified
        if (updatedTime - createdTime > 1000 && journalEntry.lastModifiedBy) {
          const user = getUserDetails(journalEntry.lastModifiedBy);
          timeline.push({
            eventType: 'modified',
            timestamp: journalEntry.updatedAt,
            userId: journalEntry.lastModifiedBy,
            user,
            action: 'Modified journal entry',
            comments: null,
            metadata: null,
          });
        }
      }

      // Sort timeline chronologically (ascending)
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Build summary
      const summary = {
        createdAt: journalEntry.createdAt,
        createdBy: journalEntry.createdBy,
        preparedAt: journalEntry.preparedAt,
        preparedBy: journalEntry.preparedBy,
        postedAt: journalEntry.postedAt,
        postedBy: journalEntry.postedBy,
        totalApprovalSteps: approvalHistoryRecords.length,
        currentStatus: journalEntry.status,
      };

      // Build assignedApprovers array for current step
      const currentStepApprovers = approvalRequest
        ? workflowSteps
            .filter(step => step.stepOrder === approvalRequest.currentStep)
            .map(step => step.approverUserId)
            .filter((id): id is string => id !== null)
        : [];

      // Build response
      const response = {
        journalEntry: {
          id: journalEntry.id,
          journalEntryNumber: journalEntry.journalEntryNumber,
          status: journalEntry.status,
          description: journalEntry.description,
          isAutoGenerated: journalEntry.isAutoGenerated,
          modificationLocked: journalEntry.modificationLocked,
        },
        timeline,
        summary,
        approvalRequest: approvalRequest ? {
          id: approvalRequest.id,
          status: approvalRequest.status,
          currentStep: approvalRequest.currentStep || 1,
          workflowId: approvalRequest.workflowId,
          requestedBy: approvalRequest.requestedBy,
          createdAt: approvalRequest.createdAt,
          assignedApprovers: currentStepApprovers,
        } : null,
        approvalHistoryRecords: approvalHistoryRecords.map(record => ({
          id: record.id,
          approvalRequestId: record.approvalRequestId,
          stepOrder: record.stepOrder,
          approverUserId: record.approverUserId,
          decision: record.decision,
          comments: record.comments,
          timestamp: record.timestamp,
          createdAt: record.createdAt,
          approver: getUserDetails(record.approverUserId),
        })),
        workflowSteps: workflowSteps.map(step => ({
          id: step.id,
          workflowId: step.workflowId,
          stepOrder: step.stepOrder,
          stepName: step.stepName || `Step ${step.stepOrder}`,
          assignedApprovers: step.approverUserId ? [step.approverUserId] : [],
          isParallel: step.isParallel,
        })),
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching journal entry audit trail:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch audit trail' });
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

  /**
   * Submit a journal entry for approval workflow
   * 
   * @testid button-submit-for-approval
   * @route POST /api/journal-entries/:id/submit-for-approval
   */
  app.post("/api/journal-entries/:id/submit-for-approval", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Use transaction for atomicity
      const result = await withTransaction(async (tx) => {
        // Submit journal entry for approval
        const approvalRequest = await submitJournalEntryForApproval(
          tenantId,
          id,
          userId,
          tx
        );

        // Fetch updated journal entry
        const [journalEntry] = await tx
          .select()
          .from(journalEntries)
          .where(and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          ))
          .limit(1);

        if (!journalEntry) {
          throw new NotFoundError('Journal entry not found', { journalEntryId: id });
        }

        return {
          journalEntry: {
            id: journalEntry.id,
            status: journalEntry.status,
            workflowRequestId: journalEntry.workflowRequestId,
          },
          approvalRequest: {
            id: approvalRequest.id,
            workflowId: approvalRequest.workflowId,
            status: approvalRequest.status,
            currentStepOrder: approvalRequest.currentStep || 1,
            assignedApprovers: approvalRequest.assignedApprovers,
          },
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error submitting journal entry for approval:', error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      if (error instanceof AccountingValidationError) {
        // Check if it's a "no workflow configured" error
        if (error.message.includes('No active approval workflows') || 
            error.message.includes('No matching workflow')) {
          return res.status(400).json({ message: 'No approval workflow configured' });
        }
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: error.message || 'Failed to submit journal entry for approval' });
    }
  });

  /**
   * Approve a journal entry at current workflow step
   * 
   * @testid button-approve-journal-entry
   * @route POST /api/journal-entries/:id/approve
   */
  app.post("/api/journal-entries/:id/approve", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Validate request body
      const { comments } = approveJournalEntrySchema.parse(req.body);

      // Use transaction for atomicity
      const result = await withTransaction(async (tx) => {
        // Approve journal entry at current step
        const approvalRequest = await approveJournalEntryStep(
          tenantId,
          id,
          userId,
          comments,
          tx
        );

        // Fetch updated journal entry
        const [journalEntry] = await tx
          .select()
          .from(journalEntries)
          .where(and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          ))
          .limit(1);

        if (!journalEntry) {
          throw new NotFoundError('Journal entry not found', { journalEntryId: id });
        }

        // If approval request is now fully approved, check for auto-posting
        if (approvalRequest.status === 'approved') {
          try {
            await autoPostApprovedEntry(tenantId, id, tx);
            // Re-fetch journal entry after auto-posting
            const [postedEntry] = await tx
              .select()
              .from(journalEntries)
              .where(and(
                eq(journalEntries.id, id),
                eq(journalEntries.tenantId, tenantId)
              ))
              .limit(1);
            
            if (postedEntry) {
              // Update historical balances if entry was posted
              if (postedEntry.status === 'posted') {
                await updateHistoricalBalances(tenantId, id, tx);
              }
            }
          } catch (autoPostError: any) {
            // Auto-posting not enabled or failed - this is acceptable
            // Entry remains in 'approved' status
            console.log('Auto-posting not enabled or failed:', autoPostError.message);
          }
        }

        // Re-fetch journal entry to get final status
        const [finalJournalEntry] = await tx
          .select()
          .from(journalEntries)
          .where(and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          ))
          .limit(1);

        // Fetch the most recent approval history entry
        const [latestApprovalHistory] = await tx
          .select()
          .from(approvalHistory)
          .where(and(
            eq(approvalHistory.approvalRequestId, approvalRequest.id),
            eq(approvalHistory.approverUserId, userId)
          ))
          .orderBy(desc(approvalHistory.createdAt))
          .limit(1);

        return {
          journalEntry: {
            id: finalJournalEntry!.id,
            status: finalJournalEntry!.status,
            workflowRequestId: finalJournalEntry!.workflowRequestId,
          },
          approvalRequest: {
            id: approvalRequest.id,
            status: approvalRequest.status,
            currentStepOrder: approvalRequest.currentStep || 1,
            isComplete: approvalRequest.status === 'approved',
            nextApprovers: approvalRequest.assignedApprovers,
          },
          approvalHistory: latestApprovalHistory ? {
            id: latestApprovalHistory.id,
            approverUserId: latestApprovalHistory.approverUserId,
            action: latestApprovalHistory.decision,
            comments: latestApprovalHistory.comments,
            timestamp: latestApprovalHistory.createdAt,
          } : undefined,
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error approving journal entry:', error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      
      if (error instanceof AccountingValidationError) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: error.message || 'Failed to approve journal entry' });
    }
  });

  /**
   * Reject a journal entry in workflow
   * 
   * @testid button-reject-journal-entry
   * @route POST /api/journal-entries/:id/reject
   */
  app.post("/api/journal-entries/:id/reject", isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;

      // Validate request body - rejectionReason is REQUIRED
      const { rejectionReason } = rejectJournalEntrySchema.parse(req.body);

      // Use transaction for atomicity
      const result = await withTransaction(async (tx) => {
        // Reject journal entry
        const approvalRequest = await rejectJournalEntry(
          tenantId,
          id,
          userId,
          rejectionReason,
          tx
        );

        // Fetch updated journal entry
        const [journalEntry] = await tx
          .select()
          .from(journalEntries)
          .where(and(
            eq(journalEntries.id, id),
            eq(journalEntries.tenantId, tenantId)
          ))
          .limit(1);

        if (!journalEntry) {
          throw new NotFoundError('Journal entry not found', { journalEntryId: id });
        }

        // Fetch the rejection history entry
        const [latestApprovalHistory] = await tx
          .select()
          .from(approvalHistory)
          .where(and(
            eq(approvalHistory.approvalRequestId, approvalRequest.id),
            eq(approvalHistory.approverUserId, userId),
            eq(approvalHistory.decision, 'rejected')
          ))
          .orderBy(desc(approvalHistory.createdAt))
          .limit(1);

        return {
          journalEntry: {
            id: journalEntry.id,
            status: journalEntry.status,
            workflowRequestId: journalEntry.workflowRequestId,
          },
          approvalRequest: {
            id: approvalRequest.id,
            status: approvalRequest.status,
          },
          approvalHistory: latestApprovalHistory ? {
            id: latestApprovalHistory.id,
            approverUserId: latestApprovalHistory.approverUserId,
            action: latestApprovalHistory.decision,
            comments: latestApprovalHistory.comments,
            timestamp: latestApprovalHistory.createdAt,
          } : undefined,
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error rejecting journal entry:', error);
      
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      
      if (error instanceof AccountingValidationError) {
        return res.status(400).json({ message: error.message });
      }
      
      // Handle Zod validation errors (e.g., missing rejectionReason)
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Rejection reason is required', errors: error.errors });
      }
      
      res.status(500).json({ message: error.message || 'Failed to reject journal entry' });
    }
  });

  // Bill routes
  app.get('/api/bills', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.read'), async (req: any, res) => {
    try {
      const { limit, sortBy = 'createdAt', sortOrder = 'desc', dueSoon } = req.query;
      
      const conditions = [eq(bills.tenantId, req.tenantId)];
      
      // Handle dueSoon filter for upcoming payments
      if (dueSoon === 'true') {
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);
        
        conditions.push(
          and(
            gte(bills.dueDate, now),
            lte(bills.dueDate, sevenDaysFromNow),
            sql`${bills.status} != 'paid'`
          )
        );
      }
      
      let query = db
        .select()
        .from(bills)
        .where(and(...conditions));
      
      // For upcoming bills, sort by dueDate ascending (soonest first)
      // For regular queries, use the requested sort
      if (dueSoon === 'true') {
        query = query.orderBy(asc(bills.dueDate));
      } else {
        const orderColumn = sortBy === 'billDate' ? bills.billDate : bills.createdAt;
        query = sortOrder === 'asc' 
          ? query.orderBy(asc(orderColumn))
          : query.orderBy(desc(orderColumn));
      }
      
      if (limit) {
        query = query.limit(parseInt(limit as string));
      }
      
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  app.get('/api/bills/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.read'), async (req: any, res) => {
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

  app.post('/api/bills', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.create'), async (req: any, res) => {
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

  app.patch('/api/bills/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.update'), async (req: any, res) => {
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

  app.delete('/api/bills/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.delete'), async (req: any, res) => {
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

  app.post("/api/bills/:id/post", isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.approve_posting'), async (req: any, res) => {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.claims.sub;

    try {
      // 1. Validate bill exists and belongs to tenant
      const bill = await storage.getBillById(id, tenantId);
      if (!bill) {
        return res.status(404).json({ 
          message: "Bill not found" 
        });
      }

      // 2. Check bill status - can only post unpaid bills
      if (bill.status !== 'unpaid') {
        return res.status(400).json({ 
          message: `Cannot post bill with status '${bill.status}'. Only unpaid bills can be posted.` 
        });
      }

      // 3. Use database transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // 3a. Fetch bill data with line items for journal entry creation
        const billEntryData = await fetchBillEntryData(id, tenantId, storage, tx);

        // 3b. Create journal entry structure
        const journalEntryInput = await createBillJournalEntry(
          billEntryData,
          tenantId,
          userId, // preparedBy
          storage,
          tx
        );

        // 3c. Get next journal entry number - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);

        // 3d. Persist journal entry header - CRITICAL: Pass tx for atomicity
        const journalEntry = await storage.createJournalEntry(
          tenantId,
          {
            entryDate: journalEntryInput.entryDate,
            entryNumber: journalEntryNumber,
            description: journalEntryInput.description,
            referenceNumber: journalEntryInput.referenceNumber,
            notes: journalEntryInput.notes,
            sourceDocumentType: journalEntryInput.sourceDocumentType,
            sourceDocumentId: journalEntryInput.sourceDocumentId,
            isAutoGenerated: journalEntryInput.isAutoGenerated,
            preparedBy: journalEntryInput.preparedBy,
            preparedAt: journalEntryInput.preparedAt,
            status: 'posted', // Auto-generated entries are posted immediately
          },
          tx
        );

        // 3e. Persist journal entry lines (legs) - CRITICAL: Pass tx for atomicity
        const journalEntryLegs = await storage.createJournalEntryLegs(
          tenantId,
          journalEntryInput.lines.map(line => ({
            journalEntryId: journalEntry.id,
            accountId: line.accountId!,
            type: line.debitAmount ? 'Debit' as const : 'Credit' as const,
            amount: line.debitAmount || line.creditAmount!,
            description: line.description,
          })),
          tx
        );

        // 3f. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);

        // 3g. Update bill status to 'paid' within transaction
        const [updatedBill] = await tx
          .update(bills)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(and(eq(bills.id, id), eq(bills.tenantId, tenantId)))
          .returning();

        if (!updatedBill) {
          throw new Error("Failed to update bill status");
        }

        return {
          bill: updatedBill,
          journalEntry: {
            ...journalEntry,
            legs: journalEntryLegs,
          },
        };
      });

      // 4. Return success response with both bill and journal entry
      res.json({
        success: true,
        message: `Bill ${bill.billNumber} posted successfully`,
        bill: result.bill,
        journalEntry: result.journalEntry,
      });

    } catch (error: any) {
      console.error("Error posting bill:", error);

      // Handle accounting validation errors with specific messages
      if (error instanceof AccountingValidationError) {
        return res.status(400).json({ 
          message: `Validation error: ${error.message}` 
        });
      }

      // Handle generic errors
      return res.status(500).json({ 
        message: error.message || "Failed to post bill" 
      });
    }
  });

  app.get('/api/bills/:id/line-items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.read'), async (req: any, res) => {
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

  app.post('/api/bills/extract', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.create'), async (req: any, res) => {
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

  app.post('/api/bills/extract-bulk', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bills.create'), async (req: any, res) => {
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
  app.get('/api/purchase-orders', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.read'), async (req: any, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrders(req.tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.get('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.read'), async (req: any, res) => {
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

  app.get('/api/purchase-orders/:id/line-items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.read'), async (req: any, res) => {
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

  app.post('/api/purchase-orders', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.create'), async (req: any, res) => {
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

  app.patch('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.update'), async (req: any, res) => {
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

  app.delete('/api/purchase-orders/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('purchase_orders.delete'), async (req: any, res) => {
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
  app.get('/api/expenses', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('expenses.read'), async (req: any, res) => {
    try {
      const expenses = await storage.getExpensesByTenant(req.tenantId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Payment routes
  app.get('/api/payments', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('payments.read'), async (req: any, res) => {
    try {
      const payments = await storage.getPaymentsByTenant(req.tenantId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post('/api/payments', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('payments.create'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;
      const validated = insertPaymentSchema.parse({ ...req.body, tenantId });

      // Use atomic transaction to ensure payment and journal entry are created together
      const result = await withTransaction(async (tx) => {
        // 1. Create vendor payment record
        const payment = await storage.createPayment(validated, tx);

        // 2. Fetch payment data and create journal entry
        const paymentEntryData = await fetchVendorPaymentEntryData(payment.id, tenantId, storage, tx);
        const journalEntryData = await createVendorPaymentJournalEntry(
          paymentEntryData,
          tenantId,
          userId,
          storage,
          tx
        );

        // 3. Persist journal entry to database - CRITICAL: Pass tx for atomicity
        const journalEntryNumber = await storage.getNextJournalEntryNumber(tenantId, tx);
        const journalEntry = await storage.createJournalEntry(tenantId, {
          journalEntryNumber,
          entryDate: journalEntryData.entryDate,
          description: journalEntryData.description,
          referenceNumber: journalEntryData.referenceNumber || null,
          notes: journalEntryData.notes || null,
          sourceDocumentType: journalEntryData.sourceDocumentType,
          sourceDocumentId: journalEntryData.sourceDocumentId,
          status: 'posted',
          isAutoGenerated: journalEntryData.isAutoGenerated || true,
          preparedBy: journalEntryData.preparedBy,
          preparedAt: journalEntryData.preparedAt || new Date(),
        }, tx);

        // 4. Create journal entry legs - CRITICAL: Pass tx for atomicity
        const legs = journalEntryData.lines.map(line => ({
          journalEntryId: journalEntry.id,
          accountId: line.accountId!,
          debitAmount: line.debitAmount || null,
          creditAmount: line.creditAmount || null,
          description: line.description,
        }));

        await storage.createJournalEntryLegs(tenantId, legs, tx);

        // 5. Update historical balances for all affected accounts
        await updateHistoricalBalances(tenantId, journalEntry.id, tx);

        return { payment, journalEntry };
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error creating vendor payment:', error);
      if (error instanceof AccountingValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || 'Failed to create vendor payment' });
      }
    }
  });

  // Document routes
  app.get('/api/documents', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('documents.read'), async (req: any, res) => {
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
  app.get('/api/assets', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.read'), async (req: any, res) => {
    try {
      const assets = await storage.getAssets(req.tenantId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get('/api/assets/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.read'), async (req: any, res) => {
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

  app.get('/api/assets/:id/depreciation-schedules', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.read'), async (req: any, res) => {
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

  app.post('/api/assets', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.create'), async (req: any, res) => {
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

  app.patch('/api/assets/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.update'), async (req: any, res) => {
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

  app.delete('/api/assets/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('assets.delete'), async (req: any, res) => {
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
  app.get('/api/bank-reconciliations', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.read'), async (req: any, res) => {
    try {
      const reconciliations = await storage.getBankReconciliations(req.tenantId);
      res.json(reconciliations);
    } catch (error) {
      console.error("Error fetching bank reconciliations:", error);
      res.status(500).json({ message: "Failed to fetch bank reconciliations" });
    }
  });

  app.get('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.read'), async (req: any, res) => {
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

  app.get('/api/bank-reconciliations/:id/items', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.read'), async (req: any, res) => {
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

  app.post('/api/bank-reconciliations', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.create'), async (req: any, res) => {
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

  app.patch('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.reconcile'), async (req: any, res) => {
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

  app.delete('/api/bank-reconciliations/:id', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.reconcile'), async (req: any, res) => {
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

  app.patch('/api/bank-reconciliations/items/:itemId/match', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('bank_reconciliations.reconcile'), async (req: any, res) => {
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

  app.get('/api/reports/profit-loss', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
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

      // Get base report data
      const report = await storage.getProfitLossReport(tenantId, start, end);
      
      // Fetch company profile for IFRS FX config
      const profile = await storage.getCompanyProfile(tenantId);
      
      // Get base currency from currencies table
      const baseCurrencyRecord = await db.query.currencies.findFirst({
        where: and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isBaseCurrency, true)
        )
      });
      
      const baseCurrency = baseCurrencyRecord?.code || "USD";
      const ifrsCompliant = profile?.ifrsComplianceEnabled || false;
      
      // CRITICAL: Branch based on IFRS compliance
      if (!ifrsCompliant) {
        // NON-IFRS MODE: Simple base currency report
        return res.json({
          ...report,
          baseCurrency,
          ifrsComplianceEnabled: false,
          fxTranslationApplied: false,
          // NO FX-related fields at all
        });
      }
      
      // IFRS MODE: Full IAS 21 compliance with FX metadata
      return res.json({
        ...report,
        baseCurrency,
        ifrsComplianceEnabled: true,
        fxTranslationStandard: profile?.fxTranslationStandard || "ifrs-sme",
        incomeExpenseMethod: profile?.fxIncomeExpenseMethod || "transaction-date",
        fxTranslationApplied: false, // Will be true when multi-currency transactions are active
      });
    } catch (error: any) {
      console.error("Error generating profit & loss report:", error);
      res.status(500).json({ message: "Failed to generate profit & loss report" });
    }
  });

  app.get('/api/reports/profit-loss-comparison', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { startDate, endDate, prevStartDate, prevEndDate } = req.query;

      if (!startDate || !endDate || !prevStartDate || !prevEndDate) {
        return res.status(400).json({ message: "startDate, endDate, prevStartDate, and prevEndDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const prevStart = new Date(prevStartDate as string);
      const prevEnd = new Date(prevEndDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(prevStart.getTime()) || isNaN(prevEnd.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // Get reports for both periods
      const currentReport = await storage.getProfitLossReport(tenantId, start, end);
      const previousReport = await storage.getProfitLossReport(tenantId, prevStart, prevEnd);
      
      // Fetch company profile for IFRS FX config
      const profile = await storage.getCompanyProfile(tenantId);
      
      // Get base currency
      const baseCurrencyRecord = await db.query.currencies.findFirst({
        where: and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isBaseCurrency, true)
        )
      });
      
      const baseCurrency = baseCurrencyRecord?.code || "USD";
      const ifrsCompliant = profile?.ifrsComplianceEnabled || false;

      // Helper function to parse balance string to number
      const parseBalance = (balance: string): number => parseFloat(balance) || 0;

      // CRITICAL FIX: Include accounts from BOTH periods for complete coverage
      // Build a map of all unique revenue account IDs from both periods
      const allRevenueAccountIds = new Set<string>();
      currentReport.revenueAccounts.forEach(acc => allRevenueAccountIds.add(acc.accountId));
      previousReport.revenueAccounts.forEach(acc => allRevenueAccountIds.add(acc.accountId));

      // Calculate variances for revenue - iterate over ALL accounts from both periods
      const revenueComparison = Array.from(allRevenueAccountIds).map((accountId) => {
        const currentAcc = currentReport.revenueAccounts.find(a => a.accountId === accountId);
        const prevAcc = previousReport.revenueAccounts.find(a => a.accountId === accountId);
        
        // If account doesn't exist in current period, use 0 for current amount
        const currentAmount = currentAcc ? parseBalance(currentAcc.balance) : 0;
        const previousAmount = prevAcc ? parseBalance(prevAcc.balance) : 0;
        const variance = currentAmount - previousAmount;
        
        let percentageChange: number | "Infinity" | "-Infinity";
        if (previousAmount === 0) {
          if (currentAmount === 0) {
            percentageChange = 0;
          } else if (currentAmount > 0) {
            percentageChange = "Infinity";
          } else {
            percentageChange = "-Infinity";
          }
        } else if (currentAmount === 0) {
          percentageChange = -100;
        } else {
          percentageChange = (variance / previousAmount) * 100;
        }

        // Get account details from whichever period has the account
        const accountInfo = currentAcc || prevAcc!;

        return {
          accountId: accountInfo.accountId,
          accountCode: accountInfo.accountCode,
          accountName: accountInfo.accountName,
          currentAmount,
          previousAmount,
          variance,
          percentageChange,
          isFavorable: variance > 0
        };
      });

      // Build a map of all unique expense account IDs from both periods
      const allExpenseAccountIds = new Set<string>();
      currentReport.expenseAccounts.forEach(acc => allExpenseAccountIds.add(acc.accountId));
      previousReport.expenseAccounts.forEach(acc => allExpenseAccountIds.add(acc.accountId));

      // Calculate variances for expenses - iterate over ALL accounts from both periods
      const expenseComparison = Array.from(allExpenseAccountIds).map((accountId) => {
        const currentAcc = currentReport.expenseAccounts.find(a => a.accountId === accountId);
        const prevAcc = previousReport.expenseAccounts.find(a => a.accountId === accountId);
        
        // If account doesn't exist in current period, use 0 for current amount
        const currentAmount = currentAcc ? parseBalance(currentAcc.balance) : 0;
        const previousAmount = prevAcc ? parseBalance(prevAcc.balance) : 0;
        const variance = currentAmount - previousAmount;
        
        let percentageChange: number | "Infinity" | "-Infinity";
        if (previousAmount === 0) {
          if (currentAmount === 0) {
            percentageChange = 0;
          } else if (currentAmount > 0) {
            percentageChange = "Infinity";
          } else {
            percentageChange = "-Infinity";
          }
        } else if (currentAmount === 0) {
          percentageChange = -100;
        } else {
          percentageChange = (variance / previousAmount) * 100;
        }

        // Get account details from whichever period has the account
        const accountInfo = currentAcc || prevAcc!;

        return {
          accountId: accountInfo.accountId,
          accountCode: accountInfo.accountCode,
          accountName: accountInfo.accountName,
          currentAmount,
          previousAmount,
          variance,
          percentageChange,
          isFavorable: variance < 0 // For expenses, negative variance is favorable
        };
      });

      const currentRevenue = parseBalance(currentReport.totalRevenue);
      const previousRevenue = parseBalance(previousReport.totalRevenue);
      const revenueVariance = currentRevenue - previousRevenue;
      
      let revenuePercentageChange: number | "Infinity" | "-Infinity";
      if (previousRevenue === 0) {
        if (currentRevenue === 0) {
          revenuePercentageChange = 0;
        } else if (currentRevenue > 0) {
          revenuePercentageChange = "Infinity";
        } else {
          revenuePercentageChange = "-Infinity";
        }
      } else if (currentRevenue === 0) {
        revenuePercentageChange = -100;
      } else {
        revenuePercentageChange = (revenueVariance / previousRevenue) * 100;
      }

      const currentExpenses = parseBalance(currentReport.totalExpenses);
      const previousExpenses = parseBalance(previousReport.totalExpenses);
      const expensesVariance = currentExpenses - previousExpenses;
      
      let expensesPercentageChange: number | "Infinity" | "-Infinity";
      if (previousExpenses === 0) {
        if (currentExpenses === 0) {
          expensesPercentageChange = 0;
        } else if (currentExpenses > 0) {
          expensesPercentageChange = "Infinity";
        } else {
          expensesPercentageChange = "-Infinity";
        }
      } else if (currentExpenses === 0) {
        expensesPercentageChange = -100;
      } else {
        expensesPercentageChange = (expensesVariance / previousExpenses) * 100;
      }

      const currentNetProfit = parseBalance(currentReport.netProfit);
      const previousNetProfit = parseBalance(previousReport.netProfit);
      const netProfitVariance = currentNetProfit - previousNetProfit;
      
      let netProfitPercentageChange: number | "Infinity" | "-Infinity";
      if (previousNetProfit === 0) {
        if (currentNetProfit === 0) {
          netProfitPercentageChange = 0;
        } else if (currentNetProfit > 0) {
          netProfitPercentageChange = "Infinity";
        } else {
          netProfitPercentageChange = "-Infinity";
        }
      } else if (currentNetProfit === 0) {
        netProfitPercentageChange = -100;
      } else {
        netProfitPercentageChange = (netProfitVariance / previousNetProfit) * 100;
      }

      // Calculate margin percentages
      const currentGrossProfitMargin = currentRevenue !== 0 ? (currentRevenue / currentRevenue) * 100 : 0;
      const previousGrossProfitMargin = previousRevenue !== 0 ? (previousRevenue / previousRevenue) * 100 : 0;
      const currentNetProfitMargin = currentRevenue !== 0 ? (currentNetProfit / currentRevenue) * 100 : 0;
      const previousNetProfitMargin = previousRevenue !== 0 ? (previousNetProfit / previousRevenue) * 100 : 0;

      const response = {
        current: {
          startDate: start,
          endDate: end,
          revenue: revenueComparison,
          expenses: expenseComparison,
          totalRevenue: currentRevenue,
          totalExpenses: currentExpenses,
          netProfit: currentNetProfit,
          grossProfitMargin: currentGrossProfitMargin,
          netProfitMargin: currentNetProfitMargin
        },
        previous: {
          startDate: prevStart,
          endDate: prevEnd,
          totalRevenue: previousRevenue,
          totalExpenses: previousExpenses,
          netProfit: previousNetProfit,
          grossProfitMargin: previousGrossProfitMargin,
          netProfitMargin: previousNetProfitMargin
        },
        variances: {
          revenue: {
            amount: revenueVariance,
            percentage: revenuePercentageChange,
            isFavorable: revenueVariance > 0
          },
          expenses: {
            amount: expensesVariance,
            percentage: expensesPercentageChange,
            isFavorable: expensesVariance < 0
          },
          netProfit: {
            amount: netProfitVariance,
            percentage: netProfitPercentageChange,
            isFavorable: netProfitVariance > 0
          },
          grossProfitMargin: currentGrossProfitMargin - previousGrossProfitMargin,
          netProfitMargin: currentNetProfitMargin - previousNetProfitMargin
        },
        baseCurrency,
        ifrsComplianceEnabled: ifrsCompliant,
        fxTranslationStandard: ifrsCompliant ? (profile?.fxTranslationStandard || "ifrs-sme") : null,
        incomeExpenseMethod: ifrsCompliant ? (profile?.fxIncomeExpenseMethod || "transaction-date") : null,
        fxTranslationApplied: false
      };

      res.json(response);
    } catch (error: any) {
      console.error("Error generating profit & loss comparison report:", error);
      res.status(500).json({ message: "Failed to generate profit & loss comparison report" });
    }
  });

  app.get('/api/reports/balance-sheet', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
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

      // Get base report data
      const report = await storage.getBalanceSheetReport(tenantId, asOf);
      
      // Fetch company profile for IFRS FX config
      const profile = await storage.getCompanyProfile(tenantId);
      
      // Get base currency from currencies table
      const baseCurrencyRecord = await db.query.currencies.findFirst({
        where: and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isBaseCurrency, true)
        )
      });
      
      const baseCurrency = baseCurrencyRecord?.code || "USD";
      const ifrsCompliant = profile?.ifrsComplianceEnabled || false;
      
      // CRITICAL: Branch based on IFRS compliance
      if (!ifrsCompliant) {
        // NON-IFRS MODE: Simple base currency report
        return res.json({
          ...report,
          baseCurrency,
          ifrsComplianceEnabled: false,
          fxTranslationApplied: false,
        });
      }
      
      // IFRS MODE: Full compliance
      return res.json({
        ...report,
        baseCurrency,
        ifrsComplianceEnabled: true,
        fxTranslationStandard: profile?.fxTranslationStandard || "ifrs-sme",
        translationMethod: "closing-rate",
        fxTranslationApplied: false, // Will be true when multi-currency transactions are active
      });
    } catch (error: any) {
      console.error("Error generating balance sheet report:", error);
      res.status(500).json({ message: "Failed to generate balance sheet report" });
    }
  });

  app.get('/api/reports/trial-balance', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
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

      // Get base report data
      const report = await storage.getTrialBalanceReport(tenantId, asOf);
      
      // Fetch company profile for IFRS FX config
      const profile = await storage.getCompanyProfile(tenantId);
      
      // Get base currency from currencies table
      const baseCurrencyRecord = await db.query.currencies.findFirst({
        where: and(
          eq(currencies.tenantId, tenantId),
          eq(currencies.isBaseCurrency, true)
        )
      });
      
      const baseCurrency = baseCurrencyRecord?.code || "USD";
      const fxTranslationStandard = profile?.fxTranslationStandard || "ifrs-sme";
      
      // For trial balance, we would show both original currency and translated amounts
      // For now, all amounts are assumed to be in base currency
      // Future enhancement: Add currency column and show multi-currency details
      
      // Add FX metadata to response
      const enrichedReport = {
        ...report,
        baseCurrency,
        fxTranslationStandard,
        showMultiCurrency: false, // Will be true when we track currencies at transaction level
        fxTranslationApplied: false,
      };
      
      res.json(enrichedReport);
    } catch (error: any) {
      console.error("Error generating trial balance report:", error);
      res.status(500).json({ message: "Failed to generate trial balance report" });
    }
  });

  app.get('/api/reports/cash-flow', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
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

  app.get('/api/reports/ar-aging', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const groupBy = (req.query.groupBy as 'customer' | 'invoice' | 'project') || 'customer';

      // Validate groupBy parameter
      if (!['customer', 'invoice', 'project'].includes(groupBy)) {
        return res.status(400).json({ message: "Invalid groupBy parameter. Must be 'customer', 'invoice', or 'project'" });
      }

      const report = await storage.getARAgingReport(tenantId, groupBy);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating AR aging report:", error);
      res.status(500).json({ message: "Failed to generate AR aging report" });
    }
  });

  app.get('/api/reports/ap-aging', isAuthenticated, verifyTenantAccess, loadAuthContext, requirePermission('reports.read'), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const groupBy = (req.query.groupBy as 'vendor' | 'invoice' | 'project') || 'vendor';

      // Validate groupBy parameter
      if (!['vendor', 'invoice', 'project'].includes(groupBy)) {
        return res.status(400).json({ message: "Invalid groupBy parameter. Must be 'vendor', 'invoice', or 'project'" });
      }

      const report = await storage.getAPAgingReport(tenantId, groupBy);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating AP aging report:", error);
      res.status(500).json({ message: "Failed to generate AP aging report" });
    }
  });

  // ============================================================================
  // OPEN BANKING ROUTES
  // ============================================================================

  // GET /api/open-banking/connections
  // List all Open Banking connections for tenant
  app.get('/api/open-banking/connections', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const connections = await db.select()
        .from(openBankingConnections)
        .where(eq(openBankingConnections.tenantId, tenantId));
      
      res.json(connections);
    } catch (error: any) {
      console.error('[Open Banking] Error fetching connections:', error);
      res.status(500).json({ message: 'Failed to fetch connections' });
    }
  });

  // GET /api/open-banking/lean/authorize
  // Generate authorization URL for bank connection
  app.get('/api/open-banking/lean/authorize', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.query;
      const tenantId = req.tenantId!;
      const userId = req.user.claims.sub;
      const clientIp = req.ip || req.connection.remoteAddress;

      // Validate required parameters
      if (!entityType || !entityId) {
        console.log('[Open Banking] Authorization attempt failed: Missing parameters', {
          tenantId,
          userId,
          clientIp,
        });
        return res.status(400).json({ 
          message: "Missing required parameters: entityType and entityId" 
        });
      }

      // Validate entityType
      if (!['customer', 'vendor'].includes(entityType as string)) {
        console.log('[Open Banking] Authorization attempt failed: Invalid entityType', {
          tenantId,
          userId,
          entityType,
          clientIp,
        });
        return res.status(400).json({ 
          message: "Invalid entityType. Must be 'customer' or 'vendor'" 
        });
      }

      // SECURITY: Verify entity ownership before generating auth URL
      if (entityType === 'customer') {
        const customer = await db.select().from(customers)
          .where(and(eq(customers.id, entityId as string), eq(customers.tenantId, tenantId)))
          .limit(1);
        if (!customer[0]) {
          console.log('[Open Banking] Authorization attempt failed: Customer not found or access denied', {
            tenantId,
            userId,
            entityType,
            entityId,
            clientIp,
          });
          return res.status(403).json({ message: 'Entity not found or access denied' });
        }
      } else if (entityType === 'vendor') {
        const vendor = await db.select().from(vendors)
          .where(and(eq(vendors.id, entityId as string), eq(vendors.tenantId, tenantId)))
          .limit(1);
        if (!vendor[0]) {
          console.log('[Open Banking] Authorization attempt failed: Vendor not found or access denied', {
            tenantId,
            userId,
            entityType,
            entityId,
            clientIp,
          });
          return res.status(403).json({ message: 'Entity not found or access denied' });
        }
      }

      // SECURITY: Generate cryptographically secure state using JWT
      const nonce = randomBytes(32).toString('hex');
      const statePayload = {
        nonce,
        tenantId,
        entityType,
        entityId,
        exp: Math.floor(Date.now() / 1000) + 600 // 10 minute expiry
      };
      const state = jwt.sign(statePayload, process.env.SESSION_SECRET!);

      // Construct redirect URI using environment-aware URL
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      const redirectUri = `${baseUrl}/api/open-banking/lean/callback`;

      // Create Lean provider and get authorization URL
      const provider = openBankingProviderFactory.createProvider('lean');
      const authorizationUrl = provider.getAuthorizationUrl(redirectUri, state);

      console.log('[Open Banking] Authorization URL generated successfully', {
        tenantId,
        userId,
        entityType,
        entityId,
        provider: 'lean',
        clientIp,
      });

      res.json({ authorizationUrl });
    } catch (error: any) {
      console.error('[Open Banking] Error generating authorization URL:', error);
      res.status(500).json({ 
        message: "Failed to generate authorization URL",
      });
    }
  });

  // GET /api/open-banking/lean/callback
  // Handle OAuth callback and create bank connection
  // NOTE: This route is intentionally UNAUTHENTICATED as it receives callbacks from external OAuth providers
  app.get('/api/open-banking/lean/callback', async (req: any, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    try {
      const { code, state } = req.query;

      // Validate required parameters
      if (!code || !state) {
        console.log('[Open Banking] Callback failed: Missing parameters', {
          clientIp,
        });
        return res.status(400).json({ 
          message: "Invalid request" 
        });
      }

      // SECURITY: Verify and decode JWT state parameter
      let statePayload: {
        nonce: string;
        tenantId: string;
        entityType: string;
        entityId: string;
        exp: number;
      };

      try {
        statePayload = jwt.verify(state as string, process.env.SESSION_SECRET!) as {
          nonce: string;
          tenantId: string;
          entityType: string;
          entityId: string;
          exp: number;
        };
      } catch (error) {
        console.log('[Open Banking] Callback failed: Invalid or expired state token', {
          clientIp,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return res.status(400).json({ message: 'Invalid or expired state parameter' });
      }

      // SECURITY: Check for nonce replay attack
      if (nonceStore.isNonceUsed(statePayload.nonce)) {
        console.log('[Open Banking] Callback failed: Nonce replay detected', {
          nonce: statePayload.nonce,
          clientIp,
        });
        return res.status(400).json({ message: 'Invalid or reused authorization state' });
      }

      // SECURITY: Extract verified tenantId from JWT (NEVER trust query params)
      const { tenantId, entityType, entityId } = statePayload;

      // Validate tenantId exists in database
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        console.log('[Open Banking] Callback failed: Tenant not found', {
          tenantId,
          clientIp,
        });
        return res.status(400).json({ 
          message: "Invalid request" 
        });
      }

      // SECURITY: Re-verify entity ownership (defense in depth)
      if (entityType === 'customer') {
        const customer = await db.select().from(customers)
          .where(and(eq(customers.id, entityId), eq(customers.tenantId, tenantId)))
          .limit(1);
        if (!customer[0]) {
          console.log('[Open Banking] Callback failed: Customer validation failed', {
            tenantId,
            entityType,
            entityId,
            clientIp,
          });
          return res.status(403).json({ message: 'Entity validation failed' });
        }
      } else if (entityType === 'vendor') {
        const vendor = await db.select().from(vendors)
          .where(and(eq(vendors.id, entityId), eq(vendors.tenantId, tenantId)))
          .limit(1);
        if (!vendor[0]) {
          console.log('[Open Banking] Callback failed: Vendor validation failed', {
            tenantId,
            entityType,
            entityId,
            clientIp,
          });
          return res.status(403).json({ message: 'Entity validation failed' });
        }
      }

      // SECURITY: Mark nonce as used IMMEDIATELY to prevent replay attacks
      // This happens BEFORE any side effects (token exchange, connection creation)
      // so that even if those operations fail, the nonce cannot be replayed
      nonceStore.markNonceAsUsed(statePayload.nonce);

      // Construct redirect URI
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      const redirectUri = `${baseUrl}/api/open-banking/lean/callback`;

      // Exchange authorization code for tokens
      const provider = openBankingProviderFactory.createProvider('lean');
      const tokens = await provider.exchangeCodeForTokens(code as string, redirectUri);

      console.log('[Open Banking] Token exchange successful', {
        tenantId,
        entityType,
        entityId,
        provider: 'lean',
        clientIp,
      });

      // Create OpenBankingService instance for this tenant
      const openBankingService = new OpenBankingService(tenantId);

      // Initiate connection in database
      const connection = await openBankingService.initiateConnection(
        'lean',
        entityId,
        entityId, // Use entityId as customerId for now
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn,
        undefined, // bankIdentifier - will be set when fetching accounts
        undefined, // bankName
        undefined, // accountType
        undefined, // accountMask
        ['accounts', 'transactions', 'payments', 'identity'] // Default permissions
      );

      console.log('[Open Banking] Connection created successfully', {
        connectionId: connection.id,
        tenantId,
        provider: 'lean',
        clientIp,
      });

      // Fetch bank accounts from provider
      const accounts = await openBankingService.getAccounts(connection.id);

      console.log('[Open Banking] Accounts fetched successfully', {
        connectionId: connection.id,
        accountCount: accounts.length,
        tenantId,
        clientIp,
      });

      // Store bank accounts in database
      for (const account of accounts) {
        await db.insert(bankAccounts).values({
          tenantId,
          connectionId: connection.id,
          accountId: account.accountId,
          accountName: account.accountName,
          accountType: account.accountType,
          currency: account.currency,
          balance: account.balance?.toString(),
          availableBalance: account.availableBalance?.toString(),
          status: 'active',
        });
      }

      console.log('[Open Banking] Bank accounts stored successfully', {
        connectionId: connection.id,
        accountCount: accounts.length,
        tenantId,
        clientIp,
      });

      res.json({ 
        success: true, 
        connectionId: connection.id,
        accountCount: accounts.length 
      });
    } catch (error: any) {
      console.error('[Open Banking] Callback error:', error, {
        clientIp,
      });
      res.status(500).json({ 
        message: "Failed to process OAuth callback",
      });
    }
  });

  // POST /api/open-banking/connections/:id/refresh
  // Refresh connection tokens
  app.post('/api/open-banking/connections/:id/refresh', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Fetch connection to get tenantId
      const [connection] = await db
        .select()
        .from(openBankingConnections)
        .where(eq(openBankingConnections.id, id))
        .limit(1);

      if (!connection) {
        return res.status(404).json({ 
          message: "Connection not found" 
        });
      }

      // Verify user has access to this tenant
      const tenant = await storage.getTenant(connection.tenantId);
      if (!tenant) {
        return res.status(404).json({ 
          message: "Tenant not found" 
        });
      }

      // Check if user is owner or member
      if (tenant.ownerId !== userId) {
        const isMember = await storage.isTenantMember(connection.tenantId, userId);
        if (!isMember) {
          return res.status(403).json({ 
            message: "Access denied to this connection" 
          });
        }
      }

      // Create service and refresh connection
      const openBankingService = new OpenBankingService(connection.tenantId);
      await openBankingService.refreshConnection(id);

      console.log('[Open Banking] Refreshed connection', {
        connectionId: id,
        tenantId: connection.tenantId,
        provider: connection.provider,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Open Banking] Refresh error:', error);
      
      // Handle typed errors with appropriate status codes
      if (error instanceof EncryptedPayloadValidationError) {
        return res.status(400).json({ 
          message: 'Invalid encrypted token data',
          error: error.message 
        });
      }
      
      if (error instanceof TokenRefreshError) {
        return res.status(400).json({ 
          message: 'Token refresh failed',
          error: error.message 
        });
      }
      
      // Generic error fallback
      return res.status(500).json({ 
        message: "Failed to refresh connection",
        error: error.message 
      });
    }
  });

  // DELETE /api/open-banking/connections/:id
  // Disconnect bank connection
  app.delete('/api/open-banking/connections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Fetch connection to get tenantId
      const [connection] = await db
        .select()
        .from(openBankingConnections)
        .where(eq(openBankingConnections.id, id))
        .limit(1);

      if (!connection) {
        return res.status(404).json({ 
          message: "Connection not found" 
        });
      }

      // Verify user has access to this tenant
      const tenant = await storage.getTenant(connection.tenantId);
      if (!tenant) {
        return res.status(404).json({ 
          message: "Tenant not found" 
        });
      }

      // Check if user is owner or member
      if (tenant.ownerId !== userId) {
        const isMember = await storage.isTenantMember(connection.tenantId, userId);
        if (!isMember) {
          return res.status(403).json({ 
            message: "Access denied to this connection" 
          });
        }
      }

      // Create service and disconnect connection
      const openBankingService = new OpenBankingService(connection.tenantId);
      await openBankingService.disconnectConnection(id);

      console.log('[Open Banking] Disconnected connection', {
        connectionId: id,
        tenantId: connection.tenantId,
        provider: connection.provider,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Open Banking] Disconnect error:', error);
      res.status(500).json({ 
        message: "Failed to disconnect connection",
        error: error.message 
      });
    }
  });

  // GET /api/open-banking/connections/:id/capabilities
  // Get provider capabilities for a connection
  app.get('/api/open-banking/connections/:id/capabilities', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Fetch connection to get tenantId and provider
      const [connection] = await db
        .select()
        .from(openBankingConnections)
        .where(eq(openBankingConnections.id, id))
        .limit(1);

      if (!connection) {
        return res.status(404).json({ 
          message: "Connection not found" 
        });
      }

      // Verify user has access to this tenant
      const tenant = await storage.getTenant(connection.tenantId);
      if (!tenant) {
        return res.status(404).json({ 
          message: "Tenant not found" 
        });
      }

      // Check if user is owner or member
      if (tenant.ownerId !== userId) {
        const isMember = await storage.isTenantMember(connection.tenantId, userId);
        if (!isMember) {
          return res.status(403).json({ 
            message: "Access denied to this connection" 
          });
        }
      }

      // Get provider capabilities
      const provider = openBankingProviderFactory.createProvider(connection.provider as any);
      const capabilities = openBankingProviderFactory.getProviderCapabilities(provider);

      console.log('[Open Banking] Retrieved capabilities', {
        connectionId: id,
        tenantId: connection.tenantId,
        provider: connection.provider,
        capabilities,
      });

      res.json({ capabilities });
    } catch (error: any) {
      console.error('[Open Banking] Get capabilities error:', error);
      res.status(500).json({ 
        message: "Failed to get provider capabilities",
        error: error.message 
      });
    }
  });

  // ===== EXCHANGE RATE ROUTES =====

  // GET /api/exchange-rates - List all exchange rates for tenant
  app.get('/api/exchange-rates', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const rates = await storage.getExchangeRates(req.tenantId);
      res.json(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });

  // GET /api/exchange-rates/latest/:from/:to - Get latest exchange rate
  app.get('/api/exchange-rates/latest/:from/:to', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const { from, to } = req.params;
      const rate = await getLatestRate(req.tenantId, from, to);
      
      if (rate === null) {
        return res.status(404).json({ 
          message: `No exchange rate found for ${from} to ${to}` 
        });
      }
      
      res.json({ 
        fromCurrency: from, 
        toCurrency: to, 
        rate: rate.toString() 
      });
    } catch (error) {
      console.error("Error fetching latest exchange rate:", error);
      res.status(500).json({ message: "Failed to fetch exchange rate" });
    }
  });

  // POST /api/exchange-rates/fetch - Manually trigger rate fetch for tenant
  app.post('/api/exchange-rates/fetch', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const { source } = req.body;
      const validSources = ['uae_central_bank', 'ecb', 'fed', 'boe', 'all'];
      const selectedSource = source && validSources.includes(source) ? source : 'all';
      
      console.log(`Manually fetching exchange rates for tenant ${req.tenantId} from ${selectedSource}...`);
      
      // Fetch from specific source or all sources using official APIs
      const results = await fetchExchangeRates(req.tenantId, selectedSource as any);
      
      // Check results
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      res.json({ 
        success: successful.length > 0, 
        message: `Exchange rates updated: ${successful.length} source(s) successful, ${failed.length} failed`,
        results: results.map(r => ({
          source: r.source,
          success: r.success,
          rateCount: r.rates.length,
          error: r.error
        }))
      });
    } catch (error: any) {
      console.error("Error fetching exchange rates:", error);
      res.status(500).json({ 
        message: "Failed to fetch exchange rates",
        error: error.message 
      });
    }
  });

  // POST /api/exchange-rates/manual - Manually add/update an exchange rate
  app.post('/api/exchange-rates/manual', isAuthenticated, verifyTenantAccess, loadAuthContext, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fromCurrency, toCurrency, rate, effectiveDate } = req.body;
      
      if (!fromCurrency || !toCurrency || !rate) {
        return res.status(400).json({ 
          message: "fromCurrency, toCurrency, and rate are required" 
        });
      }

      const effectiveDateParsed = effectiveDate ? new Date(effectiveDate) : new Date();
      
      await createManualExchangeRate(
        req.tenantId,
        fromCurrency,
        toCurrency,
        rate.toString(),
        effectiveDateParsed,
        userId
      );
      
      res.json({ 
        success: true, 
        message: `Manual exchange rate created: ${fromCurrency} to ${toCurrency}` 
      });
    } catch (error: any) {
      console.error("Error creating manual exchange rate:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create manual exchange rate" 
      });
    }
  });

  // GET /api/fx/volatility - Assess exchange rate volatility for a period
  app.get('/api/fx/volatility', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
    try {
      const { fromCurrency, toCurrency, startDate, endDate } = req.query;
      
      if (!fromCurrency || !toCurrency || !startDate || !endDate) {
        return res.status(400).json({ 
          message: "Missing required parameters: fromCurrency, toCurrency, startDate, endDate" 
        });
      }
      
      const periodStart = new Date(startDate as string);
      const periodEnd = new Date(endDate as string);
      
      const volatility = await assessRateVolatility(
        req.tenantId,
        fromCurrency as string,
        toCurrency as string,
        periodStart,
        periodEnd
      );
      
      res.json(volatility);
    } catch (error: any) {
      console.error("Error assessing exchange rate volatility:", error);
      res.status(500).json({ 
        message: "Failed to assess volatility",
        error: error.message 
      });
    }
  });

  // POST /api/exchange-rates/fetch-all - Trigger manual fetch for all tenants (admin only)
  app.post('/api/exchange-rates/fetch-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Only allow if user is an owner of at least one tenant
      const userTenants = await storage.getTenantsByUserId(userId);
      const isOwner = userTenants.some((t: any) => t.ownerId === userId);
      
      if (!isOwner) {
        return res.status(403).json({ 
          message: "Only tenant owners can trigger global exchange rate fetch" 
        });
      }
      
      console.log('Manually triggering global FX rates update for all tenants...');
      
      const result = await triggerManualFXRatesUpdate();
      
      res.json({
        success: result.success,
        tenantsUpdated: result.tenantsUpdated,
        errors: result.errors,
        message: `Updated exchange rates for ${result.tenantsUpdated} tenants`
      });
    } catch (error: any) {
      console.error("Error triggering global exchange rate fetch:", error);
      res.status(500).json({ 
        message: "Failed to trigger global exchange rate fetch",
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
