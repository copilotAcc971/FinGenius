import cron from 'node-cron';
import { storage } from './storage';
import { sendReportEmail } from './email-service';
import * as XLSX from 'xlsx';
import { db } from './db';
import { tenants } from '@shared/schema';
import { initializeTransactionSync } from './jobs/transaction-sync';

const cronJobs = new Map<string, cron.ScheduledTask>();

export async function initializeScheduledReports() {
  try {
    console.log('Initializing scheduled reports...');
    
    // Get all tenants
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    
    let totalJobsRegistered = 0;
    
    // For each tenant, get their active scheduled reports
    for (const tenant of allTenants) {
      const reports = await storage.getScheduledReports(tenant.id);
      const activeReports = reports.filter(r => r.isActive);
      
      // Register cron job for each active report
      for (const report of activeReports) {
        try {
          registerCronJob(report.id, tenant.id, report.schedule);
          totalJobsRegistered++;
        } catch (error) {
          console.error(`Failed to register cron job for report ${report.id}:`, error);
        }
      }
    }
    
    console.log(`Scheduled reports initialization complete: ${totalJobsRegistered} jobs registered`);
  } catch (error) {
    console.error('Error initializing scheduled reports:', error);
  }
}

export function registerCronJob(reportId: string, tenantId: string, schedule: string) {
  try {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    // Stop existing job if exists
    if (cronJobs.has(reportId)) {
      cronJobs.get(reportId)?.stop();
    }

    // Create new job
    const task = cron.schedule(schedule, async () => {
      await executeScheduledReport(tenantId, reportId);
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    cronJobs.set(reportId, task);
    console.log(`Registered cron job for report ${reportId} with schedule: ${schedule}`);
  } catch (error) {
    console.error(`Error registering cron job for report ${reportId}:`, error);
    throw error;
  }
}

export function unregisterCronJob(reportId: string) {
  const job = cronJobs.get(reportId);
  if (job) {
    job.stop();
    cronJobs.delete(reportId);
    console.log(`Unregistered cron job for report ${reportId}`);
  }
}

async function executeScheduledReport(tenantId: string, reportId: string) {
  const runAt = new Date();
  let status: 'success' | 'failed' = 'success';
  let errorMessage: string | null = null;
  let emailSent = false;
  let recipientCount = 0;
  let reportData: any = null;

  try {
    console.log(`Executing scheduled report ${reportId} for tenant ${tenantId}`);

    // Get scheduled report config
    const report = await storage.getScheduledReport(tenantId, reportId);
    if (!report) {
      throw new Error('Scheduled report not found');
    }

    if (!report.isActive) {
      console.log(`Report ${reportId} is not active, skipping execution`);
      return;
    }

    // Generate report data based on reportType
    reportData = await generateReportData(tenantId, report);

    // Generate Excel attachment
    const attachments = [];
    const excelBuffer = generateExcelAttachment(reportData, report.reportType);
    attachments.push({
      filename: `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
      content: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Send email via Outlook Graph API
    const emailBody = report.emailBody || `
      <html>
        <body>
          <h2>${report.name}</h2>
          <p>Please find attached the ${report.reportType.replace(/_/g, ' ')} report.</p>
          <p>This is an automated report generated on ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC.</p>
        </body>
      </html>
    `;

    const emailSuccess = await sendReportEmail({
      recipients: report.recipients,
      subject: report.emailSubject,
      body: emailBody,
      attachments
    });

    emailSent = emailSuccess;
    recipientCount = report.recipients.length;

    if (!emailSuccess) {
      status = 'failed';
      errorMessage = 'Failed to send email';
    }

    // Update last run time
    await storage.updateScheduledReport(tenantId, reportId, {
      lastRunAt: runAt
    });

  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error executing scheduled report ${reportId}:`, error);
  } finally {
    // Log execution in scheduledReportRuns
    await storage.createScheduledReportRun({
      tenantId,
      scheduledReportId: reportId,
      runAt,
      status,
      errorMessage,
      reportData,
      emailSent,
      recipientCount
    });
  }
}

async function generateReportData(tenantId: string, report: any): Promise<any> {
  // Generate report data based on reportType
  // For now, return a simple structure
  // In production, this would call the appropriate report generation functions

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1); // Default to last month

  switch (report.reportType) {
    case 'profit_loss':
      // Use existing P&L report generation logic
      return {
        reportType: 'profit_loss',
        title: 'Profit & Loss Statement',
        period: { startDate, endDate },
        data: {
          revenue: [],
          expenses: [],
          netIncome: 0
        }
      };

    case 'balance_sheet':
      return {
        reportType: 'balance_sheet',
        title: 'Balance Sheet',
        asOf: endDate,
        data: {
          assets: [],
          liabilities: [],
          equity: []
        }
      };

    case 'cash_flow':
      return {
        reportType: 'cash_flow',
        title: 'Cash Flow Statement',
        period: { startDate, endDate },
        data: {
          operating: [],
          investing: [],
          financing: []
        }
      };

    case 'trial_balance':
      return {
        reportType: 'trial_balance',
        title: 'Trial Balance',
        asOf: endDate,
        data: {
          accounts: []
        }
      };

    case 'custom':
      if (report.customReportId) {
        const customReport = await storage.getCustomReport(tenantId, report.customReportId);
        if (customReport) {
          return await storage.generateCustomReport(tenantId, {
            reportType: customReport.reportType,
            selectedColumns: customReport.selectedColumns,
            filters: customReport.filters
          });
        }
      }
      throw new Error('Custom report not found');

    default:
      throw new Error(`Unsupported report type: ${report.reportType}`);
  }
}

function generateExcelAttachment(reportData: any, reportType: string): Buffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Generate worksheet based on report type
  let worksheet: XLSX.WorkSheet;

  if (reportType === 'custom' && reportData.rows) {
    // For custom reports, use the rows data
    worksheet = XLSX.utils.json_to_sheet(reportData.rows);
  } else {
    // For standard reports, create a simple structure
    const data = [
      ['Report Type', reportData.reportType || reportType],
      ['Generated At', new Date().toISOString()],
      [],
      ['Note', 'Full report data generation will be implemented in production']
    ];
    worksheet = XLSX.utils.aoa_to_sheet(data);
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}

export function validateCronExpression(expression: string): boolean {
  return cron.validate(expression);
}
