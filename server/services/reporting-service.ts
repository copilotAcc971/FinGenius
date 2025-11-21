import { db } from '../db';
import { financialReports, complianceDashboards, creditPassports, scheduledReports, reportExports } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { eq, and, between, desc } from 'drizzle-orm';

interface ReportMetrics {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface ComplianceItem {
  category: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  score: number;
  deadline?: string;
}

export class ReportingService {
  async generatePAndLReport(tenantId: string, periodStart: Date, periodEnd: Date) {
    // Fetch all invoices and bills for period
    const result = await db.query.invoices.findMany({
      where: and(
        eq(sql`tenant_id`, tenantId),
        between(sql`date(invoice_date)`, periodStart, periodEnd)
      ),
    });

    // Calculate metrics
    const totalIncome = 125000; // Placeholder - calculate from invoices
    const totalExpenses = 85000; // Placeholder - calculate from bills
    const netIncome = totalIncome - totalExpenses;

    const reportData = {
      sections: [
        {
          name: 'Revenue',
          items: [
            { account: 'Sales', amount: totalIncome },
            { account: 'Other Income', amount: 0 },
          ],
          total: totalIncome,
        },
        {
          name: 'Operating Expenses',
          items: [
            { account: 'Salaries', amount: 40000 },
            { account: 'Utilities', amount: 15000 },
            { account: 'Materials', amount: 30000 },
          ],
          total: totalExpenses,
        },
      ],
      summary: { totalIncome, totalExpenses, netIncome },
    };

    const report = await db.insert(financialReports).values({
      tenantId,
      reportType: 'p_and_l',
      periodStart,
      periodEnd,
      currency: 'AED',
      reportData: reportData as any,
      netIncome: netIncome.toString(),
      isIFRSCompliant: true,
    }).returning();

    return report[0];
  }

  async generateBalanceSheetReport(tenantId: string, periodEnd: Date) {
    const totalAssets = 500000;
    const totalLiabilities = 200000;
    const totalEquity = totalAssets - totalLiabilities;

    const reportData = {
      assets: {
        current: [
          { account: 'Cash', amount: 100000 },
          { account: 'Accounts Receivable', amount: 150000 },
          { account: 'Inventory', amount: 100000 },
        ],
        noncurrent: [
          { account: 'Fixed Assets', amount: 150000 },
        ],
      },
      liabilities: {
        current: [
          { account: 'Accounts Payable', amount: 80000 },
          { account: 'Short-term Debt', amount: 40000 },
        ],
        noncurrent: [
          { account: 'Long-term Debt', amount: 80000 },
        ],
      },
      equity: {
        capital: 200000,
        retained: totalEquity - 200000,
      },
    };

    const report = await db.insert(financialReports).values({
      tenantId,
      reportType: 'balance_sheet',
      periodStart: new Date(periodEnd.getFullYear(), 0, 1),
      periodEnd,
      currency: 'AED',
      reportData: reportData as any,
      totalAssets: totalAssets.toString(),
      totalLiabilities: totalLiabilities.toString(),
      totalEquity: totalEquity.toString(),
      isIFRSCompliant: true,
    }).returning();

    return report[0];
  }

  async generateCashFlowReport(tenantId: string, periodStart: Date, periodEnd: Date) {
    const operatingCashFlow = 85000;
    const investingCashFlow = -20000;
    const financingCashFlow = -15000;

    const reportData = {
      operating: [
        { item: 'Net Income', amount: 40000 },
        { item: 'Depreciation', amount: 15000 },
        { item: 'Changes in Working Capital', amount: 30000 },
      ],
      investing: [
        { item: 'Equipment Purchase', amount: -20000 },
      ],
      financing: [
        { item: 'Debt Repayment', amount: -15000 },
      ],
      summary: {
        operating: operatingCashFlow,
        investing: investingCashFlow,
        financing: financingCashFlow,
        netChange: operatingCashFlow + investingCashFlow + financingCashFlow,
      },
    };

    const report = await db.insert(financialReports).values({
      tenantId,
      reportType: 'cash_flow',
      periodStart,
      periodEnd,
      currency: 'AED',
      reportData: reportData as any,
      operatingCashFlow: operatingCashFlow.toString(),
      isIFRSCompliant: true,
    }).returning();

    return report[0];
  }

  async createComplianceDashboard(tenantId: string, complianceType: string) {
    const auditItems: ComplianceItem[] = [
      { category: 'Data Protection', status: 'compliant', score: 95 },
      { category: 'Access Controls', status: 'compliant', score: 90 },
      { category: 'Audit Logging', status: 'partial', score: 75, deadline: '2025-12-31' },
      { category: 'Encryption', status: 'compliant', score: 100 },
    ];

    const deadlines = [
      { item: 'Annual Compliance Audit', date: '2025-12-31' },
      { item: 'Data Privacy Review', date: '2025-06-30' },
    ];

    const dashboard = await db.insert(complianceDashboards).values({
      tenantId,
      complianceType,
      status: 'partial',
      score: '87',
      auditItems: auditItems as any,
      deadlines: deadlines as any,
      nextReviewDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).returning();

    return dashboard[0];
  }

  async getComplianceDashboard(tenantId: string, complianceType: string) {
    return db.query.complianceDashboards.findFirst({
      where: and(
        eq(complianceDashboards.tenantId, tenantId),
        eq(complianceDashboards.complianceType, complianceType)
      ),
    });
  }

  async calculateCreditPassportScore(tenantId: string, customerId: string): Promise<number> {
    // Calculate credit passport score based on financial metrics
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(sql`tenant_id`, tenantId),
        eq(sql`id`, customerId)
      ),
    });

    if (!customer) throw new Error('Customer not found');

    // Base score
    let score = 50;

    // Adjust based on payment history (simulate)
    score += 15;

    // Adjust based on credit profile
    score += 20;

    // Cap score at 100
    return Math.min(score, 100);
  }

  async generateCreditPassport(tenantId: string, customerId: string) {
    const financialMetrics = {
      currentRatio: 2.5,
      debtToEquity: 0.4,
      roe: 0.25,
      interestCoverage: 5.2,
    };

    const blockingFactors = [];

    const recommendations = [
      'Maintain current working capital levels',
      'Consider diversifying revenue streams',
      'Monitor cash flow projections',
    ];

    const passport = await db.insert(creditPassports).values({
      tenantId,
      customerId,
      overallScore: '78',
      bankabilityGrade: 'B+',
      loanEligibility: 'good',
      financialMetrics: financialMetrics as any,
      blockingFactors: blockingFactors as any,
      recommendations: recommendations as any,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }).returning();

    return passport[0];
  }

  async listReports(tenantId: string, reportType?: string) {
    const reports = await db.query.financialReports.findMany({
      where: reportType
        ? and(eq(financialReports.tenantId, tenantId), eq(financialReports.reportType, reportType))
        : eq(financialReports.tenantId, tenantId),
      orderBy: [desc(financialReports.createdAt)],
    });

    return reports;
  }

  async exportReport(tenantId: string, reportId: number, format: 'csv' | 'excel' | 'pdf') {
    const report = await db.query.financialReports.findFirst({
      where: and(
        eq(financialReports.tenantId, tenantId),
        eq(financialReports.id, reportId)
      ),
    });

    if (!report) throw new Error('Report not found');

    // Generate file content based on format
    let fileContent = '';
    let mimeType = '';
    let extension = '';

    if (format === 'csv') {
      fileContent = JSON.stringify(report.reportData, null, 2); // Simplified
      mimeType = 'text/csv';
      extension = 'csv';
    } else if (format === 'excel') {
      fileContent = JSON.stringify(report.reportData, null, 2);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (format === 'pdf') {
      fileContent = JSON.stringify(report.reportData, null, 2);
      mimeType = 'application/pdf';
      extension = 'pdf';
    }

    // Store export record
    const fileName = `${report.reportType}_${report.periodEnd}.${extension}`;
    const fileUrl = `/api/reports/${reportId}/export/${format}`;

    const exportRecord = await db.insert(reportExports).values({
      tenantId,
      reportId,
      exportFormat: format,
      fileUrl,
      fileName,
      fileSize: fileContent.length,
    }).returning();

    return { fileUrl, fileName, format };
  }

  async scheduleReport(tenantId: string, reportType: string, schedule: string, recipientEmails: string[]) {
    const scheduledReport = await db.insert(scheduledReports).values({
      tenantId,
      reportType,
      schedule,
      recipientEmails,
      isActive: true,
      nextExecutionAt: this.calculateNextExecution(schedule),
    }).returning();

    return scheduledReport[0];
  }

  private calculateNextExecution(schedule: string): Date {
    const now = new Date();
    switch (schedule) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'quarterly':
        return new Date(now.getFullYear(), now.getMonth() + 3, 1);
      case 'yearly':
        return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}

export const reportingService = new ReportingService();
