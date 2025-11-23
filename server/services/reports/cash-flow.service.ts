/**
 * Cash Flow Statement Service
 * 
 * Implements indirect method cash flow calculation
 * Shows cash movements from operating, investing, and financing activities
 */

import Decimal from 'decimal.js';
import { BaseReportService, DateRange, AccountBalance } from './base-report.service';
import { db } from '../../db';
import { journalEntries, journalEntryLegs, accounts } from '@shared/schema';
import { eq, and, gte, lte, sql, or, like } from 'drizzle-orm';
import { queryOptimizer } from '../../utils/query-optimizer';

// Configure Decimal.js
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

export interface CashFlowSection {
  name: string;
  items: {
    description: string;
    amount: string;
    isAddition: boolean;
  }[];
  subtotal: string;
}

export interface CashFlowStatement {
  metadata: {
    reportName: string;
    companyName: string;
    dateRange: DateRange;
    currency: string;
    generatedAt: string;
  };
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netChangeInCash: string;
  cashBeginning: string;
  cashEnding: string;
  reconciliation?: {
    calculatedCashEnding: string;
    actualCashEnding: string;
    difference: string;
  };
}

export class CashFlowService extends BaseReportService {
  /**
   * Generate Cash Flow Statement using indirect method
   */
  static async generateCashFlowStatement(
    tenantId: string,
    dateRange: DateRange
  ): Promise<CashFlowStatement> {
    // Get metadata
    const metadata = await this.getReportMetadata(
      tenantId,
      'Cash Flow Statement',
      dateRange
    );

    // Get net income for the period
    const netIncome = await this.calculateNetIncome(tenantId, dateRange);

    // Get beginning and ending cash balances
    const cashBeginning = await this.getCashBalance(tenantId, dateRange.startDate);
    const cashEnding = await this.getCashBalance(tenantId, dateRange.endDate);

    // Calculate operating activities
    const operatingActivities = await this.calculateOperatingActivities(
      tenantId,
      dateRange,
      netIncome
    );

    // Calculate investing activities
    const investingActivities = await this.calculateInvestingActivities(
      tenantId,
      dateRange
    );

    // Calculate financing activities
    const financingActivities = await this.calculateFinancingActivities(
      tenantId,
      dateRange
    );

    // Calculate net change in cash
    const netChangeInCash = new Decimal(operatingActivities.subtotal)
      .add(new Decimal(investingActivities.subtotal))
      .add(new Decimal(financingActivities.subtotal));

    // Reconciliation check
    const calculatedCashEnding = cashBeginning.add(netChangeInCash);
    const difference = calculatedCashEnding.sub(cashEnding).abs();

    const statement: CashFlowStatement = {
      metadata: {
        reportName: metadata.reportName,
        companyName: metadata.companyName,
        dateRange,
        currency: metadata.currency,
        generatedAt: metadata.generatedAt
      },
      operatingActivities,
      investingActivities,
      financingActivities,
      netChangeInCash: netChangeInCash.toFixed(2),
      cashBeginning: cashBeginning.toFixed(2),
      cashEnding: cashEnding.toFixed(2)
    };

    // Add reconciliation if there's a difference
    if (difference.greaterThan(0.01)) {
      statement.reconciliation = {
        calculatedCashEnding: calculatedCashEnding.toFixed(2),
        actualCashEnding: cashEnding.toFixed(2),
        difference: difference.toFixed(2)
      };
    }

    return statement;
  }

  /**
   * Calculate net income for the period
   */
  private static async calculateNetIncome(
    tenantId: string,
    dateRange: DateRange
  ): Promise<Decimal> {
    // Get revenue and expense accounts
    const balances = await this.getAccountBalances(
      tenantId,
      dateRange,
      undefined,
      ['revenue', 'expense', 'other_income', 'other_expense']
    );

    let totalRevenue = new Decimal(0);
    let totalExpenses = new Decimal(0);

    balances.forEach(account => {
      const balance = new Decimal(account.netBalance);
      if (account.accountType === 'revenue' || account.accountType === 'other_income') {
        totalRevenue = totalRevenue.add(balance.abs());
      } else if (account.accountType === 'expense' || account.accountType === 'other_expense') {
        totalExpenses = totalExpenses.add(balance.abs());
      }
    });

    return totalRevenue.sub(totalExpenses);
  }

  /**
   * Get cash balance as of a specific date
   */
  private static async getCashBalance(
    tenantId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    // Cash accounts typically start with 10 (1000-1099)
    const cashAccounts = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(
            CASE 
              WHEN ${accounts.normalBalance} = 'debit' 
              THEN ${journalEntryLegs.debit} - ${journalEntryLegs.credit}
              ELSE ${journalEntryLegs.credit} - ${journalEntryLegs.debit}
            END
          ), 0)
        `
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, asOfDate),
          like(accounts.code, '10%'), // Cash accounts
          eq(accounts.accountType, 'asset')
        )
      );

    return new Decimal(cashAccounts[0]?.balance || 0);
  }

  /**
   * Calculate operating activities section
   */
  private static async calculateOperatingActivities(
    tenantId: string,
    dateRange: DateRange,
    netIncome: Decimal
  ): Promise<CashFlowSection> {
    const items: any[] = [];
    let cashFromOperations = netIncome;

    // Start with net income
    items.push({
      description: 'Net Income',
      amount: netIncome.toFixed(2),
      isAddition: true
    });

    // Add back depreciation and amortization (non-cash expenses)
    const depreciation = await this.getAccountMovement(
      tenantId,
      dateRange,
      ['5800', '5810'], // Typical depreciation account codes
      'expense'
    );
    
    if (!depreciation.isZero()) {
      items.push({
        description: 'Depreciation and Amortization',
        amount: depreciation.abs().toFixed(2),
        isAddition: true
      });
      cashFromOperations = cashFromOperations.add(depreciation.abs());
    }

    // Changes in working capital
    
    // Accounts Receivable (increase is negative, decrease is positive)
    const arChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '11%', // AR accounts
      'asset'
    );
    
    if (!arChange.isZero()) {
      items.push({
        description: '(Increase)/Decrease in Accounts Receivable',
        amount: arChange.neg().toFixed(2),
        isAddition: arChange.isNegative()
      });
      cashFromOperations = cashFromOperations.sub(arChange);
    }

    // Inventory (increase is negative, decrease is positive)
    const inventoryChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '12%', // Inventory accounts
      'asset'
    );
    
    if (!inventoryChange.isZero()) {
      items.push({
        description: '(Increase)/Decrease in Inventory',
        amount: inventoryChange.neg().toFixed(2),
        isAddition: inventoryChange.isNegative()
      });
      cashFromOperations = cashFromOperations.sub(inventoryChange);
    }

    // Accounts Payable (increase is positive, decrease is negative)
    const apChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '20%', // AP accounts
      'liability'
    );
    
    if (!apChange.isZero()) {
      items.push({
        description: 'Increase/(Decrease) in Accounts Payable',
        amount: apChange.toFixed(2),
        isAddition: apChange.isPositive()
      });
      cashFromOperations = cashFromOperations.add(apChange);
    }

    // Accrued Liabilities
    const accruedChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '21%', // Accrued liability accounts
      'liability'
    );
    
    if (!accruedChange.isZero()) {
      items.push({
        description: 'Increase/(Decrease) in Accrued Liabilities',
        amount: accruedChange.toFixed(2),
        isAddition: accruedChange.isPositive()
      });
      cashFromOperations = cashFromOperations.add(accruedChange);
    }

    return {
      name: 'Cash Flows from Operating Activities',
      items,
      subtotal: cashFromOperations.toFixed(2)
    };
  }

  /**
   * Calculate investing activities section
   */
  private static async calculateInvestingActivities(
    tenantId: string,
    dateRange: DateRange
  ): Promise<CashFlowSection> {
    const items: any[] = [];
    let cashFromInvesting = new Decimal(0);

    // Purchase of property, plant, and equipment
    const ppe = await this.getAccountMovement(
      tenantId,
      dateRange,
      ['15%', '16%'], // Fixed asset accounts
      'asset'
    );
    
    if (!ppe.isZero()) {
      items.push({
        description: 'Purchase of Property, Plant and Equipment',
        amount: ppe.neg().toFixed(2),
        isAddition: false
      });
      cashFromInvesting = cashFromInvesting.sub(ppe);
    }

    // Sale of assets
    const assetSales = await this.getAccountMovement(
      tenantId,
      dateRange,
      ['4800'], // Gain on sale of assets
      'revenue'
    );
    
    if (!assetSales.isZero()) {
      items.push({
        description: 'Proceeds from Sale of Assets',
        amount: assetSales.abs().toFixed(2),
        isAddition: true
      });
      cashFromInvesting = cashFromInvesting.add(assetSales.abs());
    }

    // Investments
    const investments = await this.getAccountMovement(
      tenantId,
      dateRange,
      ['17%'], // Investment accounts
      'asset'
    );
    
    if (!investments.isZero()) {
      items.push({
        description: 'Purchase of Investments',
        amount: investments.neg().toFixed(2),
        isAddition: false
      });
      cashFromInvesting = cashFromInvesting.sub(investments);
    }

    // If no investing activities, add placeholder
    if (items.length === 0) {
      items.push({
        description: 'No investing activities',
        amount: '0.00',
        isAddition: true
      });
    }

    return {
      name: 'Cash Flows from Investing Activities',
      items,
      subtotal: cashFromInvesting.toFixed(2)
    };
  }

  /**
   * Calculate financing activities section
   */
  private static async calculateFinancingActivities(
    tenantId: string,
    dateRange: DateRange
  ): Promise<CashFlowSection> {
    const items: any[] = [];
    let cashFromFinancing = new Decimal(0);

    // Long-term debt proceeds/payments
    const debtChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '25%', // Long-term debt accounts
      'liability'
    );
    
    if (!debtChange.isZero()) {
      if (debtChange.isPositive()) {
        items.push({
          description: 'Proceeds from Long-term Debt',
          amount: debtChange.toFixed(2),
          isAddition: true
        });
      } else {
        items.push({
          description: 'Repayment of Long-term Debt',
          amount: debtChange.abs().toFixed(2),
          isAddition: false
        });
      }
      cashFromFinancing = cashFromFinancing.add(debtChange);
    }

    // Equity transactions
    const equityChange = await this.getAccountChange(
      tenantId,
      dateRange,
      '30%', // Share capital accounts
      'equity'
    );
    
    if (!equityChange.isZero()) {
      if (equityChange.isPositive()) {
        items.push({
          description: 'Proceeds from Issuance of Shares',
          amount: equityChange.toFixed(2),
          isAddition: true
        });
      } else {
        items.push({
          description: 'Repurchase of Shares',
          amount: equityChange.abs().toFixed(2),
          isAddition: false
        });
      }
      cashFromFinancing = cashFromFinancing.add(equityChange);
    }

    // Dividends paid
    const dividends = await this.getAccountMovement(
      tenantId,
      dateRange,
      ['3950'], // Dividends account
      'equity'
    );
    
    if (!dividends.isZero()) {
      items.push({
        description: 'Dividends Paid',
        amount: dividends.abs().toFixed(2),
        isAddition: false
      });
      cashFromFinancing = cashFromFinancing.sub(dividends.abs());
    }

    // If no financing activities, add placeholder
    if (items.length === 0) {
      items.push({
        description: 'No financing activities',
        amount: '0.00',
        isAddition: true
      });
    }

    return {
      name: 'Cash Flows from Financing Activities',
      items,
      subtotal: cashFromFinancing.toFixed(2)
    };
  }

  /**
   * Get account movement (debits - credits) for a period
   */
  private static async getAccountMovement(
    tenantId: string,
    dateRange: DateRange,
    accountCodes: string[],
    accountType: string
  ): Promise<Decimal> {
    const conditions: any[] = [
      eq(journalEntries.tenantId, tenantId),
      eq(journalEntries.status, 'posted'),
      gte(journalEntries.entryDate, dateRange.startDate),
      lte(journalEntries.entryDate, dateRange.endDate),
      eq(accounts.accountType, accountType)
    ];

    // Add account code conditions
    if (accountCodes.length === 1 && accountCodes[0].includes('%')) {
      conditions.push(like(accounts.code, accountCodes[0]));
    } else if (accountCodes.length > 0) {
      const codeConditions = accountCodes.map(code => 
        code.includes('%') ? like(accounts.code, code) : eq(accounts.code, code)
      );
      conditions.push(or(...codeConditions));
    }

    const result = await db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${journalEntryLegs.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${journalEntryLegs.credit}), 0)`
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(and(...conditions));

    const debit = new Decimal(result[0]?.totalDebit || 0);
    const credit = new Decimal(result[0]?.totalCredit || 0);

    return debit.sub(credit);
  }

  /**
   * Get change in account balance between start and end of period
   */
  private static async getAccountChange(
    tenantId: string,
    dateRange: DateRange,
    accountCodePattern: string,
    accountType: string
  ): Promise<Decimal> {
    // Get balance at start
    const startBalance = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(
            CASE 
              WHEN ${accounts.normalBalance} = 'debit' 
              THEN ${journalEntryLegs.debit} - ${journalEntryLegs.credit}
              ELSE ${journalEntryLegs.credit} - ${journalEntryLegs.debit}
            END
          ), 0)
        `
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, dateRange.startDate),
          like(accounts.code, accountCodePattern),
          eq(accounts.accountType, accountType)
        )
      );

    // Get balance at end
    const endBalance = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(
            CASE 
              WHEN ${accounts.normalBalance} = 'debit' 
              THEN ${journalEntryLegs.debit} - ${journalEntryLegs.credit}
              ELSE ${journalEntryLegs.credit} - ${journalEntryLegs.debit}
            END
          ), 0)
        `
      })
      .from(journalEntryLegs)
      .innerJoin(journalEntries, eq(journalEntryLegs.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(journalEntryLegs.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, dateRange.endDate),
          like(accounts.code, accountCodePattern),
          eq(accounts.accountType, accountType)
        )
      );

    const start = new Decimal(startBalance[0]?.balance || 0);
    const end = new Decimal(endBalance[0]?.balance || 0);

    return end.sub(start);
  }

  /**
   * Export Cash Flow Statement to various formats
   */
  static exportCashFlow(
    statement: CashFlowStatement,
    format: 'csv' | 'xlsx' | 'json'
  ): string | Buffer {
    const exportData: any[] = [];

    // Header
    exportData.push({
      'Description': statement.metadata.companyName,
      'Amount': 'CASH FLOW STATEMENT'
    });

    exportData.push({
      'Description': `For the period ${statement.metadata.dateRange.startDate.toLocaleDateString()} to ${statement.metadata.dateRange.endDate.toLocaleDateString()}`,
      'Amount': ''
    });

    exportData.push({}); // Empty row

    // Operating Activities
    exportData.push({
      'Description': statement.operatingActivities.name,
      'Amount': ''
    });

    statement.operatingActivities.items.forEach(item => {
      exportData.push({
        'Description': `  ${item.description}`,
        'Amount': item.amount
      });
    });

    exportData.push({
      'Description': 'Net Cash from Operating Activities',
      'Amount': statement.operatingActivities.subtotal
    });

    exportData.push({}); // Empty row

    // Investing Activities
    exportData.push({
      'Description': statement.investingActivities.name,
      'Amount': ''
    });

    statement.investingActivities.items.forEach(item => {
      exportData.push({
        'Description': `  ${item.description}`,
        'Amount': item.amount
      });
    });

    exportData.push({
      'Description': 'Net Cash from Investing Activities',
      'Amount': statement.investingActivities.subtotal
    });

    exportData.push({}); // Empty row

    // Financing Activities
    exportData.push({
      'Description': statement.financingActivities.name,
      'Amount': ''
    });

    statement.financingActivities.items.forEach(item => {
      exportData.push({
        'Description': `  ${item.description}`,
        'Amount': item.amount
      });
    });

    exportData.push({
      'Description': 'Net Cash from Financing Activities',
      'Amount': statement.financingActivities.subtotal
    });

    exportData.push({}); // Empty row

    // Summary
    exportData.push({
      'Description': 'Net Change in Cash',
      'Amount': statement.netChangeInCash
    });

    exportData.push({
      'Description': 'Cash at Beginning of Period',
      'Amount': statement.cashBeginning
    });

    exportData.push({
      'Description': 'Cash at End of Period',
      'Amount': statement.cashEnding
    });

    // Reconciliation if needed
    if (statement.reconciliation) {
      exportData.push({}); // Empty row
      exportData.push({
        'Description': 'Reconciliation:',
        'Amount': ''
      });
      exportData.push({
        'Description': '  Calculated Cash Ending',
        'Amount': statement.reconciliation.calculatedCashEnding
      });
      exportData.push({
        'Description': '  Actual Cash Ending',
        'Amount': statement.reconciliation.actualCashEnding
      });
      exportData.push({
        'Description': '  Difference',
        'Amount': statement.reconciliation.difference
      });
    }

    // Export based on format
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.exportToCSV(exportData);
    } else {
      return this.exportToExcel(exportData, 'Cash Flow');
    }
  }
}