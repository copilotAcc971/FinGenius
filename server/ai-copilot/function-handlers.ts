import { storage } from '../storage';
import type { AccountingFunctionHandler } from './functions';

interface FunctionContext {
  tenantId: string;
  userId: string;
}

export const functionHandlers: Record<string, AccountingFunctionHandler> = {
  async show_outstanding_invoices(args: any, context: FunctionContext) {
    const { customerId, limit = 10 } = args;
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    
    let filtered = invoices.filter(inv => 
      inv.status === 'sent' || inv.status === 'partial'
    );
    
    if (customerId) {
      filtered = filtered.filter(inv => inv.customerId === customerId);
    }
    
    const limited = filtered.slice(0, limit);
    
    return {
      count: filtered.length,
      total: filtered.reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0),
      invoices: limited.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        amount: inv.total,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        status: inv.status
      }))
    };
  },

  async show_overdue_invoices(args: any, context: FunctionContext) {
    const { customerId } = args;
    const today = new Date();
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    
    let filtered = invoices.filter(inv => {
      if (inv.status !== 'sent' && inv.status !== 'partial') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < today;
    });
    
    if (customerId) {
      filtered = filtered.filter(inv => inv.customerId === customerId);
    }
    
    return {
      count: filtered.length,
      total: filtered.reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0),
      invoices: filtered.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        amount: inv.total,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        daysOverdue: Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
      }))
    };
  },

  async get_customer_balance(args: any, context: FunctionContext) {
    const { customerId } = args;
    
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    
    const customer = await storage.getCustomer(customerId);
    
    if (!customer || customer.tenantId !== context.tenantId) {
      throw new Error('Customer not found');
    }
    
    const invoices = await storage.getInvoicesByTenant(context.tenantId, false);
    const customerInvoices = invoices.filter(inv => inv.customerId === customerId);
    
    const outstanding = customerInvoices
      .filter(inv => inv.status === 'sent' || inv.status === 'partial')
      .reduce((sum, inv) => sum + parseFloat(inv.balanceDue || '0'), 0);
    
    return {
      customerId,
      customerName: customer.companyName || customer.contactName,
      outstandingBalance: outstanding,
      invoiceCount: customerInvoices.length
    };
  },

  async list_customers(args: any, context: FunctionContext) {
    const { search, limit = 20 } = args;
    
    let customers = await storage.getCustomersByTenant(context.tenantId);
    
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(c => 
        c.companyName?.toLowerCase().includes(searchLower) ||
        c.contactName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
      );
    }
    
    return {
      count: customers.length,
      customers: customers.slice(0, limit).map(c => ({
        id: c.id,
        name: c.companyName || c.contactName,
        email: c.email,
        phone: c.phone
      }))
    };
  },

  async generate_profit_loss_report(args: any, context: FunctionContext) {
    const { startDate, endDate } = args;
    
    const report = await storage.getProfitLossReport(
      context.tenantId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return {
      period: { startDate, endDate },
      revenue: report.revenue,
      expenses: report.expenses,
      netIncome: report.netIncome,
      summary: `Net ${report.netIncome >= 0 ? 'profit' : 'loss'} of ${Math.abs(report.netIncome).toFixed(2)} for the period`
    };
  },

  async generate_balance_sheet(args: any, context: FunctionContext) {
    const asOfDate = args.asOfDate || new Date().toISOString().split('T')[0];
    
    const report = await storage.getBalanceSheet(
      context.tenantId,
      new Date(asOfDate)
    );
    
    return {
      asOfDate,
      assets: report.totalAssets,
      liabilities: report.totalLiabilities,
      equity: report.totalEquity,
      summary: `Total assets: ${report.totalAssets.toFixed(2)}, Liabilities: ${report.totalLiabilities.toFixed(2)}, Equity: ${report.totalEquity.toFixed(2)}`
    };
  },

  async show_recent_transactions(args: any, context: FunctionContext) {
    const { limit = 10, accountId } = args;
    
    const entries = await storage.getJournalEntries(context.tenantId);
    
    let filtered = entries
      .filter(e => e.status === 'posted')
      .sort((a, b) => new Date(b.entryDate!).getTime() - new Date(a.entryDate!).getTime());
    
    if (accountId) {
      const withLegs = await Promise.all(
        filtered.map(async (entry) => ({
          entry,
          legs: await storage.getJournalEntryLegs(entry.id!)
        }))
      );
      
      filtered = withLegs
        .filter(({ legs }) => legs.some(leg => leg.accountId === accountId))
        .map(({ entry }) => entry);
    }
    
    return {
      count: filtered.length,
      transactions: filtered.slice(0, limit).map(e => ({
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.entryDate,
        description: e.description,
        amount: e.totalDebit || e.totalCredit
      }))
    };
  },

  async get_cash_flow_summary(args: any, context: FunctionContext) {
    const { startDate, endDate } = args;
    
    const report = await storage.getCashFlowReport(
      context.tenantId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return {
      period: { startDate, endDate },
      operatingActivities: report.operatingActivities,
      investingActivities: report.investingActivities,
      financingActivities: report.financingActivities,
      netCashFlow: report.netCashFlow,
      summary: `Net cash flow: ${report.netCashFlow.toFixed(2)} for the period`
    };
  },

  async list_bills(args: any, context: FunctionContext) {
    const { status = 'all', vendorId, limit = 10 } = args;
    
    let bills = await storage.getBillsByTenant(context.tenantId);
    
    if (status !== 'all') {
      bills = bills.filter(b => b.status === status);
    }
    
    if (vendorId) {
      bills = bills.filter(b => b.vendorId === vendorId);
    }
    
    return {
      count: bills.length,
      total: bills.reduce((sum, b) => sum + parseFloat(b.total || '0'), 0),
      bills: bills.slice(0, limit).map(b => ({
        id: b.id,
        billNumber: b.billNumber,
        vendorName: b.vendorName,
        amount: b.total,
        dueDate: b.dueDate,
        status: b.status
      }))
    };
  },

  async create_invoice(args: any, context: FunctionContext) {
    throw new Error('create_invoice requires user confirmation. This function should be handled specially in the WebSocket server.');
  },

  async record_payment(args: any, context: FunctionContext) {
    throw new Error('record_payment requires user confirmation. This function should be handled specially in the WebSocket server.');
  }
};
