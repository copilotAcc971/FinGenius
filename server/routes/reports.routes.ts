/**
 * Financial Reports API Routes
 * All report endpoints with proper authentication and authorization
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { loadAuthContext, requirePermission } from '../middleware/rbac';
import { ProfitLossService } from '../services/reports/profit-loss.service';
import { BalanceSheetService } from '../services/reports/balance-sheet.service';
import { TrialBalanceService } from '../services/reports/trial-balance.service';
import { CashFlowService } from '../services/reports/cash-flow.service';
import { z } from 'zod';

const router = Router();

// Middleware to verify tenant access
const verifyTenantAccess = (req: any, res: any, next: any) => {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }
  req.tenantId = tenantId;
  next();
};

// Input validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  compareWith: z.enum(['year', 'quarter', 'month']).optional()
});

const asOfDateSchema = z.object({
  asOfDate: z.string().transform(val => new Date(val))
});

/**
 * GET /api/reports/profit-loss
 * Generate Profit & Loss Statement
 */
router.get('/profit-loss', 
  isAuthenticated, 
  verifyTenantAccess, 
  loadAuthContext, 
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = dateRangeSchema.parse(req.query);
      
      const report = await ProfitLossService.generateProfitLossStatement(
        tenantId,
        {
          startDate: params.startDate,
          endDate: params.endDate
        },
        params.compareWith
      );

      res.json(report);
    } catch (error: any) {
      console.error('Error generating P&L statement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to generate P&L statement' });
    }
  }
);

/**
 * GET /api/reports/profit-loss/export
 * Export Profit & Loss Statement
 */
router.get('/profit-loss/export',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = dateRangeSchema.parse(req.query);
      const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'xlsx';
      
      const report = await ProfitLossService.generateProfitLossStatement(
        tenantId,
        {
          startDate: params.startDate,
          endDate: params.endDate
        },
        params.compareWith
      );

      const exported = ProfitLossService.exportProfitLoss(report, format);

      if (format === 'json') {
        res.json(JSON.parse(exported as string));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=profit-loss.csv');
        res.send(exported);
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=profit-loss.xlsx');
        res.send(exported);
      }
    } catch (error: any) {
      console.error('Error exporting P&L statement:', error);
      res.status(500).json({ error: 'Failed to export P&L statement' });
    }
  }
);

/**
 * GET /api/reports/balance-sheet
 * Generate Balance Sheet
 */
router.get('/balance-sheet',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = asOfDateSchema.parse(req.query);
      
      const report = await BalanceSheetService.generateBalanceSheet(
        tenantId,
        params.asOfDate
      );

      res.json(report);
    } catch (error: any) {
      console.error('Error generating balance sheet:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to generate balance sheet' });
    }
  }
);

/**
 * GET /api/reports/balance-sheet/export
 * Export Balance Sheet
 */
router.get('/balance-sheet/export',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = asOfDateSchema.parse(req.query);
      const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'xlsx';
      
      const report = await BalanceSheetService.generateBalanceSheet(
        tenantId,
        params.asOfDate
      );

      const exported = BalanceSheetService.exportBalanceSheet(report, format);

      if (format === 'json') {
        res.json(JSON.parse(exported as string));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=balance-sheet.csv');
        res.send(exported);
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=balance-sheet.xlsx');
        res.send(exported);
      }
    } catch (error: any) {
      console.error('Error exporting balance sheet:', error);
      res.status(500).json({ error: 'Failed to export balance sheet' });
    }
  }
);

/**
 * GET /api/reports/trial-balance
 * Generate Trial Balance
 */
router.get('/trial-balance',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = asOfDateSchema.parse(req.query);
      const showZeroBalances = req.query.showZeroBalances === 'true';
      
      const report = await TrialBalanceService.generateTrialBalance(
        tenantId,
        params.asOfDate,
        showZeroBalances
      );

      res.json(report);
    } catch (error: any) {
      console.error('Error generating trial balance:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to generate trial balance' });
    }
  }
);

/**
 * GET /api/reports/trial-balance/export
 * Export Trial Balance
 */
router.get('/trial-balance/export',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = asOfDateSchema.parse(req.query);
      const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'xlsx';
      const showZeroBalances = req.query.showZeroBalances === 'true';
      
      const report = await TrialBalanceService.generateTrialBalance(
        tenantId,
        params.asOfDate,
        showZeroBalances
      );

      const exported = TrialBalanceService.exportTrialBalance(report, format);

      if (format === 'json') {
        res.json(JSON.parse(exported as string));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=trial-balance.csv');
        res.send(exported);
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=trial-balance.xlsx');
        res.send(exported);
      }
    } catch (error: any) {
      console.error('Error exporting trial balance:', error);
      res.status(500).json({ error: 'Failed to export trial balance' });
    }
  }
);

/**
 * GET /api/reports/trial-balance/account/:accountId
 * Get journal entries for a specific account (drill-down)
 */
router.get('/trial-balance/account/:accountId',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const { accountId } = req.params;
      const { startDate, endDate } = req.query;
      
      const entries = await TrialBalanceService.getAccountJournalEntries(
        tenantId,
        accountId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      res.json(entries);
    } catch (error: any) {
      console.error('Error fetching account journal entries:', error);
      res.status(500).json({ error: 'Failed to fetch journal entries' });
    }
  }
);

/**
 * GET /api/reports/cash-flow
 * Generate Cash Flow Statement
 */
router.get('/cash-flow',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = dateRangeSchema.parse(req.query);
      
      const report = await CashFlowService.generateCashFlowStatement(
        tenantId,
        {
          startDate: params.startDate,
          endDate: params.endDate
        }
      );

      res.json(report);
    } catch (error: any) {
      console.error('Error generating cash flow statement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to generate cash flow statement' });
    }
  }
);

/**
 * GET /api/reports/cash-flow/export
 * Export Cash Flow Statement
 */
router.get('/cash-flow/export',
  isAuthenticated,
  verifyTenantAccess,
  loadAuthContext,
  requirePermission('reports.read'),
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const params = dateRangeSchema.parse(req.query);
      const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'xlsx';
      
      const report = await CashFlowService.generateCashFlowStatement(
        tenantId,
        {
          startDate: params.startDate,
          endDate: params.endDate
        }
      );

      const exported = CashFlowService.exportCashFlow(report, format);

      if (format === 'json') {
        res.json(JSON.parse(exported as string));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=cash-flow.csv');
        res.send(exported);
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=cash-flow.xlsx');
        res.send(exported);
      }
    } catch (error: any) {
      console.error('Error exporting cash flow statement:', error);
      res.status(500).json({ error: 'Failed to export cash flow statement' });
    }
  }
);

export default router;