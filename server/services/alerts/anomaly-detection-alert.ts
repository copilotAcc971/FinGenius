import { db } from '../../db';
import { 
  invoices,
  bills,
  journalEntries,
  journalEntryLegs,
  payments,
  customers,
  vendors,
  anomalyDetection,
  alertInstances,
  type InsertAnomalyDetection,
  type InsertAlertInstance
} from '@shared/schema';
import { eq, and, gte, sql, desc, or } from 'drizzle-orm';

interface TransactionAnomaly {
  id: string;
  entityType: 'invoice' | 'bill' | 'payment' | 'journal_entry';
  entityId: string;
  anomalyType: 'unusual_amount' | 'duplicate_transaction' | 'payment_pattern' | 'vendor_fraud';
  anomalyScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  investigationNotes: string;
  supportingData: any;
  createdAt: Date;
}

interface AnomalyAnalysisResult {
  anomalies: TransactionAnomaly[];
  totalTransactionsAnalyzed: number;
  anomalyRate: number;
  highRiskCount: number;
}

export class AnomalyDetectionAlertService {
  /**
   * Analyze transactions for anomalies
   */
  async analyzeTransactions(
    tenantId: string,
    lookbackDays: number = 90
  ): Promise<AnomalyAnalysisResult> {

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    const anomalies: TransactionAnomaly[] = [];

    // 1. Analyze unusual amounts
    const unusualAmounts = await this.detectUnusualAmounts(tenantId, lookbackDate);
    anomalies.push(...unusualAmounts);

    // 2. Detect duplicate transactions
    const duplicates = await this.detectDuplicateTransactions(tenantId, lookbackDate);
    anomalies.push(...duplicates);

    // 3. Analyze payment pattern changes
    const patternChanges = await this.detectPaymentPatternChanges(tenantId, lookbackDate);
    anomalies.push(...patternChanges);

    // 4. Flag round number transactions
    const roundNumbers = await this.detectRoundNumberFlags(tenantId, lookbackDate);
    anomalies.push(...roundNumbers);

    // 5. Detect off-hours journal entries
    const offHours = await this.detectOffHoursEntries(tenantId, lookbackDate);
    anomalies.push(...offHours);

    // Store anomalies in database
    for (const anomaly of anomalies) {
      await this.storeAnomaly(tenantId, anomaly);
    }

    // Create alerts for high-risk anomalies
    const highRiskAnomalies = anomalies.filter(a => a.anomalyScore > 0.5);
    if (highRiskAnomalies.length > 0) {
      await this.createAnomalyAlert(tenantId, highRiskAnomalies);
    }

    const totalTransactions = await this.getTotalTransactionCount(tenantId, lookbackDate);

    return {
      anomalies,
      totalTransactionsAnalyzed: totalTransactions,
      anomalyRate: totalTransactions > 0 ? (anomalies.length / totalTransactions) * 100 : 0,
      highRiskCount: highRiskAnomalies.length
    };
  }

  /**
   * Detect unusual amounts (>3 standard deviations from average)
   */
  private async detectUnusualAmounts(
    tenantId: string,
    lookbackDate: Date
  ): Promise<TransactionAnomaly[]> {
    const anomalies: TransactionAnomaly[] = [];

    // Analyze bills by vendor
    const billsByVendor = await db
      .select({
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        bills: sql<any>`json_agg(json_build_object(
          'id', ${bills.id},
          'billNumber', ${bills.billNumber},
          'totalAmount', ${bills.totalAmount},
          'issueDate', ${bills.issueDate}
        ))`
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, lookbackDate.toISOString())
        )
      )
      .groupBy(bills.vendorId, vendors.name);

    for (const vendor of billsByVendor) {
      if (!vendor.vendorId) continue;
      
      const vendorBills = vendor.bills;
      if (vendorBills.length < 5) continue; // Need sufficient data

      const amounts = vendorBills.map((b: any) => parseFloat(b.totalAmount || '0'));
      const stats = this.calculateStatistics(amounts);

      // Check each bill for unusual amounts
      for (const bill of vendorBills) {
        const amount = parseFloat(bill.totalAmount || '0');
        const zScore = Math.abs((amount - stats.mean) / stats.stdDev);

        if (zScore > 3) {
          const anomalyScore = Math.min(1, zScore / 5); // Normalize to 0-1

          anomalies.push({
            id: `unusual_amount_bill_${bill.id}`,
            entityType: 'bill',
            entityId: bill.id,
            anomalyType: 'unusual_amount',
            anomalyScore,
            severity: this.calculateSeverity(anomalyScore),
            description: `Bill amount ($${amount.toLocaleString()}) is ${zScore.toFixed(1)} standard deviations from average for ${vendor.vendorName}`,
            investigationNotes: `Average: $${stats.mean.toLocaleString()}, Std Dev: $${stats.stdDev.toLocaleString()}, Z-Score: ${zScore.toFixed(2)}`,
            supportingData: {
              vendorId: vendor.vendorId,
              vendorName: vendor.vendorName,
              billNumber: bill.billNumber,
              amount,
              average: stats.mean,
              stdDev: stats.stdDev,
              zScore
            },
            createdAt: new Date()
          });
        }
      }
    }

    // Similarly analyze invoices by customer
    const invoicesByCustomer = await db
      .select({
        customerId: invoices.customerId,
        customerName: customers.name,
        invoices: sql<any>`json_agg(json_build_object(
          'id', ${invoices.id},
          'invoiceNumber', ${invoices.invoiceNumber},
          'totalAmount', ${invoices.totalAmount},
          'issueDate', ${invoices.issueDate}
        ))`
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.issueDate, lookbackDate.toISOString())
        )
      )
      .groupBy(invoices.customerId, customers.name);

    for (const customer of invoicesByCustomer) {
      if (!customer.customerId) continue;
      
      const customerInvoices = customer.invoices;
      if (customerInvoices.length < 5) continue;

      const amounts = customerInvoices.map((inv: any) => parseFloat(inv.totalAmount || '0'));
      const stats = this.calculateStatistics(amounts);

      for (const invoice of customerInvoices) {
        const amount = parseFloat(invoice.totalAmount || '0');
        const zScore = Math.abs((amount - stats.mean) / stats.stdDev);

        if (zScore > 3) {
          const anomalyScore = Math.min(1, zScore / 5);

          anomalies.push({
            id: `unusual_amount_invoice_${invoice.id}`,
            entityType: 'invoice',
            entityId: invoice.id,
            anomalyType: 'unusual_amount',
            anomalyScore,
            severity: this.calculateSeverity(anomalyScore),
            description: `Invoice amount ($${amount.toLocaleString()}) is ${zScore.toFixed(1)} standard deviations from average for ${customer.customerName}`,
            investigationNotes: `Average: $${stats.mean.toLocaleString()}, Std Dev: $${stats.stdDev.toLocaleString()}, Z-Score: ${zScore.toFixed(2)}`,
            supportingData: {
              customerId: customer.customerId,
              customerName: customer.customerName,
              invoiceNumber: invoice.invoiceNumber,
              amount,
              average: stats.mean,
              stdDev: stats.stdDev,
              zScore
            },
            createdAt: new Date()
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect duplicate transactions
   */
  private async detectDuplicateTransactions(
    tenantId: string,
    lookbackDate: Date
  ): Promise<TransactionAnomaly[]> {
    const anomalies: TransactionAnomaly[] = [];

    // Find duplicate bills (same vendor, amount, within 24 hours)
    const duplicateBills = await db.execute(sql`
      WITH bill_duplicates AS (
        SELECT 
          b1.id as id1,
          b1.bill_number as bill_number1,
          b2.id as id2,
          b2.bill_number as bill_number2,
          b1.vendor_id,
          v.name as vendor_name,
          b1.total_amount,
          b1.issue_date as date1,
          b2.issue_date as date2,
          EXTRACT(EPOCH FROM (b2.issue_date::timestamp - b1.issue_date::timestamp)) / 3600 as hours_apart
        FROM bills b1
        JOIN bills b2 ON b1.vendor_id = b2.vendor_id 
          AND b1.total_amount = b2.total_amount
          AND b1.id < b2.id
          AND ABS(EXTRACT(EPOCH FROM (b2.issue_date::timestamp - b1.issue_date::timestamp))) < 86400
        LEFT JOIN vendors v ON b1.vendor_id = v.id
        WHERE b1.tenant_id = ${tenantId}
          AND b1.issue_date >= ${lookbackDate.toISOString()}
      )
      SELECT * FROM bill_duplicates
      LIMIT 50
    `);

    for (const dup of duplicateBills.rows) {
      const hoursApart = parseFloat(dup.hours_apart as string);
      const anomalyScore = Math.max(0.6, 1 - (hoursApart / 24)); // Higher score for closer duplicates

      anomalies.push({
        id: `duplicate_bill_${dup.id1}_${dup.id2}`,
        entityType: 'bill',
        entityId: dup.id1 as string,
        anomalyType: 'duplicate_transaction',
        anomalyScore,
        severity: this.calculateSeverity(anomalyScore),
        description: `Potential duplicate bill detected: ${dup.bill_number1} and ${dup.bill_number2} for ${dup.vendor_name} with same amount ($${parseFloat(dup.total_amount as string).toLocaleString()})`,
        investigationNotes: `Transactions ${hoursApart.toFixed(1)} hours apart. Review to confirm if duplicate or legitimate separate transactions.`,
        supportingData: {
          bill1: { id: dup.id1, billNumber: dup.bill_number1, date: dup.date1 },
          bill2: { id: dup.id2, billNumber: dup.bill_number2, date: dup.date2 },
          vendorId: dup.vendor_id,
          vendorName: dup.vendor_name,
          amount: dup.total_amount,
          hoursApart
        },
        createdAt: new Date()
      });
    }

    // Find duplicate invoices
    const duplicateInvoices = await db.execute(sql`
      WITH invoice_duplicates AS (
        SELECT 
          i1.id as id1,
          i1.invoice_number as invoice_number1,
          i2.id as id2,
          i2.invoice_number as invoice_number2,
          i1.customer_id,
          c.name as customer_name,
          i1.total_amount,
          i1.issue_date as date1,
          i2.issue_date as date2,
          EXTRACT(EPOCH FROM (i2.issue_date::timestamp - i1.issue_date::timestamp)) / 3600 as hours_apart
        FROM invoices i1
        JOIN invoices i2 ON i1.customer_id = i2.customer_id 
          AND i1.total_amount = i2.total_amount
          AND i1.id < i2.id
          AND ABS(EXTRACT(EPOCH FROM (i2.issue_date::timestamp - i1.issue_date::timestamp))) < 86400
        LEFT JOIN customers c ON i1.customer_id = c.id
        WHERE i1.tenant_id = ${tenantId}
          AND i1.issue_date >= ${lookbackDate.toISOString()}
      )
      SELECT * FROM invoice_duplicates
      LIMIT 50
    `);

    for (const dup of duplicateInvoices.rows) {
      const hoursApart = parseFloat(dup.hours_apart as string);
      const anomalyScore = Math.max(0.6, 1 - (hoursApart / 24));

      anomalies.push({
        id: `duplicate_invoice_${dup.id1}_${dup.id2}`,
        entityType: 'invoice',
        entityId: dup.id1 as string,
        anomalyType: 'duplicate_transaction',
        anomalyScore,
        severity: this.calculateSeverity(anomalyScore),
        description: `Potential duplicate invoice detected: ${dup.invoice_number1} and ${dup.invoice_number2} for ${dup.customer_name} with same amount ($${parseFloat(dup.total_amount as string).toLocaleString()})`,
        investigationNotes: `Transactions ${hoursApart.toFixed(1)} hours apart. Review to confirm if duplicate or legitimate separate invoices.`,
        supportingData: {
          invoice1: { id: dup.id1, invoiceNumber: dup.invoice_number1, date: dup.date1 },
          invoice2: { id: dup.id2, invoiceNumber: dup.invoice_number2, date: dup.date2 },
          customerId: dup.customer_id,
          customerName: dup.customer_name,
          amount: dup.total_amount,
          hoursApart
        },
        createdAt: new Date()
      });
    }

    return anomalies;
  }

  /**
   * Detect payment pattern changes
   */
  private async detectPaymentPatternChanges(
    tenantId: string,
    lookbackDate: Date
  ): Promise<TransactionAnomaly[]> {
    const anomalies: TransactionAnomaly[] = [];

    // Get bills by vendor and analyze payment intervals
    const vendorBills = await db
      .select({
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        issueDate: bills.issueDate,
        totalAmount: bills.totalAmount,
        id: bills.id,
        billNumber: bills.billNumber
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, lookbackDate.toISOString())
        )
      )
      .orderBy(bills.vendorId, bills.issueDate);

    // Group by vendor
    const billsByVendor = new Map<string, any[]>();
    for (const bill of vendorBills) {
      if (!bill.vendorId) continue;
      if (!billsByVendor.has(bill.vendorId)) {
        billsByVendor.set(bill.vendorId, []);
      }
      billsByVendor.get(bill.vendorId)!.push(bill);
    }

    for (const [vendorId, bills] of billsByVendor) {
      if (bills.length < 4) continue; // Need at least 4 bills to detect pattern change

      // Calculate intervals between bills
      const intervals: number[] = [];
      for (let i = 1; i < bills.length; i++) {
        const days = Math.round(
          (new Date(bills[i].issueDate).getTime() - new Date(bills[i - 1].issueDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      // Calculate average and std dev of intervals
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      const stdDev = Math.sqrt(
        intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
      );

      // Check last interval for significant deviation
      const lastInterval = intervals[intervals.length - 1];
      const deviation = Math.abs(lastInterval - avgInterval);
      
      if (deviation > stdDev * 2) {
        const anomalyScore = Math.min(1, deviation / (avgInterval * 2));

        anomalies.push({
          id: `payment_pattern_${vendorId}_${bills[bills.length - 1].id}`,
          entityType: 'bill',
          entityId: bills[bills.length - 1].id,
          anomalyType: 'payment_pattern',
          anomalyScore,
          severity: this.calculateSeverity(anomalyScore),
          description: `Payment pattern change detected for ${bills[0].vendorName}. Latest interval (${lastInterval} days) differs significantly from average (${avgInterval.toFixed(0)} days)`,
          investigationNotes: `Historical average: ${avgInterval.toFixed(0)} days, Latest: ${lastInterval} days, Deviation: ${deviation.toFixed(0)} days`,
          supportingData: {
            vendorId,
            vendorName: bills[0].vendorName,
            avgInterval,
            lastInterval,
            deviation,
            recentBills: bills.slice(-3).map(b => ({
              id: b.id,
              billNumber: b.billNumber,
              issueDate: b.issueDate,
              amount: b.totalAmount
            }))
          },
          createdAt: new Date()
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect excessive round numbers (potential estimates)
   */
  private async detectRoundNumberFlags(
    tenantId: string,
    lookbackDate: Date
  ): Promise<TransactionAnomaly[]> {
    const anomalies: TransactionAnomaly[] = [];

    // Find bills with round amounts (multiples of 1000 or 5000)
    const roundBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        totalAmount: bills.totalAmount,
        issueDate: bills.issueDate
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, lookbackDate.toISOString())
        )
      );

    for (const bill of roundBills) {
      const amount = parseFloat(bill.totalAmount || '0');
      
      // Check if amount is round (multiple of 1000 or 5000)
      const isRound1000 = amount % 1000 === 0 && amount > 0;
      const isRound5000 = amount % 5000 === 0 && amount > 0;
      
      if (isRound5000 || (isRound1000 && amount >= 10000)) {
        const anomalyScore = isRound5000 ? 0.6 : 0.5;

        anomalies.push({
          id: `round_number_bill_${bill.id}`,
          entityType: 'bill',
          entityId: bill.id,
          anomalyType: 'vendor_fraud',
          anomalyScore,
          severity: this.calculateSeverity(anomalyScore),
          description: `Round number amount detected: $${amount.toLocaleString()} for ${bill.vendorName}. May indicate estimate rather than actual invoice.`,
          investigationNotes: `Round amounts may suggest estimates or potential fraud. Verify supporting documentation.`,
          supportingData: {
            vendorId: bill.vendorId,
            vendorName: bill.vendorName,
            billNumber: bill.billNumber,
            amount,
            isMultipleOf5000: isRound5000
          },
          createdAt: new Date()
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect off-hours journal entries (fraud indicator)
   */
  private async detectOffHoursEntries(
    tenantId: string,
    lookbackDate: Date
  ): Promise<TransactionAnomaly[]> {
    const anomalies: TransactionAnomaly[] = [];

    // Get journal entries with creation timestamps
    const entries = await db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        entryDate: journalEntries.entryDate,
        createdAt: journalEntries.createdAt,
        createdBy: journalEntries.createdBy
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          gte(journalEntries.createdAt, lookbackDate.toISOString())
        )
      );

    for (const entry of entries) {
      const createdAt = new Date(entry.createdAt);
      const hour = createdAt.getUTCHours();
      const dayOfWeek = createdAt.getUTCDay();

      // Off-hours: Before 7 AM or after 10 PM, or weekends
      const isOffHours = hour < 7 || hour >= 22;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isOffHours || isWeekend) {
        const anomalyScore = isOffHours ? 0.7 : 0.6;

        anomalies.push({
          id: `off_hours_entry_${entry.id}`,
          entityType: 'journal_entry',
          entityId: entry.id,
          anomalyType: 'vendor_fraud',
          anomalyScore,
          severity: this.calculateSeverity(anomalyScore),
          description: `Journal entry created during ${isWeekend ? 'weekend' : 'off-hours'} (${createdAt.toLocaleString()})`,
          investigationNotes: `Entry created at ${createdAt.toLocaleTimeString()} on ${createdAt.toLocaleDateString()}. Review for authorization and legitimacy.`,
          supportingData: {
            entryId: entry.id,
            entryNumber: entry.entryNumber,
            description: entry.description,
            createdAt: entry.createdAt,
            createdBy: entry.createdBy,
            hour,
            dayOfWeek,
            isOffHours,
            isWeekend
          },
          createdAt: new Date()
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate statistics for an array of numbers
   */
  private calculateStatistics(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  /**
   * Calculate severity based on anomaly score
   */
  private calculateSeverity(anomalyScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (anomalyScore >= 0.9) return 'critical';
    if (anomalyScore >= 0.7) return 'high';
    if (anomalyScore >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Store anomaly in database
   */
  private async storeAnomaly(
    tenantId: string,
    anomaly: TransactionAnomaly
  ): Promise<void> {
    const anomalyData: InsertAnomalyDetection = {
      tenantId,
      entityType: anomaly.entityType,
      entityId: anomaly.entityId,
      anomalyType: anomaly.anomalyType,
      score: anomaly.anomalyScore,
      description: anomaly.description,
      investigationNotes: anomaly.investigationNotes,
      metadata: anomaly.supportingData,
      status: 'new'
    };

    await db.insert(anomalyDetection).values(anomalyData);
  }

  /**
   * Create alert for anomalies
   */
  private async createAnomalyAlert(
    tenantId: string,
    anomalies: TransactionAnomaly[]
  ): Promise<void> {
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    const totalCount = anomalies.length;

    const topAnomalies = anomalies
      .sort((a, b) => b.anomalyScore - a.anomalyScore)
      .slice(0, 5);

    const anomalyList = topAnomalies
      .map(a => `• ${a.description} (Risk: ${(a.anomalyScore * 100).toFixed(0)}%)`)
      .join('\n');

    const message = `${totalCount} suspicious transaction(s) detected requiring investigation.\n\n` +
      `Risk Breakdown:\n` +
      `• Critical Risk: ${criticalCount}\n` +
      `• High Risk: ${highCount}\n` +
      `• Medium Risk: ${totalCount - criticalCount - highCount}\n\n` +
      `Top Anomalies:\n${anomalyList}${totalCount > 5 ? `\n\n+${totalCount - 5} more anomalies` : ''}`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'anomaly',
      priority: criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium',
      title: '🔍 Transaction Anomalies Detected - Investigation Required',
      message,
      actionUrl: '/compliance/anomalies',
      quickActions: [
        { label: 'Review Anomalies', action: 'navigate', params: { url: '/compliance/anomalies' } },
        { label: 'Investigate High Risk', action: 'filter', params: { severity: 'high' } },
        { label: 'Mark False Positives', action: 'bulk_action', params: { type: 'mark_false_positive' } }
      ],
      metadata: {
        totalCount,
        criticalCount,
        highCount,
        anomalies: topAnomalies.map(a => ({
          id: a.id,
          entityType: a.entityType,
          entityId: a.entityId,
          anomalyType: a.anomalyType,
          score: a.anomalyScore,
          severity: a.severity,
          description: a.description
        }))
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }

  /**
   * Get total transaction count for anomaly rate calculation
   */
  private async getTotalTransactionCount(
    tenantId: string,
    lookbackDate: Date
  ): Promise<number> {
    const [invoiceCount, billCount, entryCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            gte(invoices.issueDate, lookbackDate.toISOString())
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(bills)
        .where(
          and(
            eq(bills.tenantId, tenantId),
            gte(bills.issueDate, lookbackDate.toISOString())
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.tenantId, tenantId),
            gte(journalEntries.createdAt, lookbackDate.toISOString())
          )
        )
    ]);

    return Number(invoiceCount[0]?.count || 0) + 
           Number(billCount[0]?.count || 0) + 
           Number(entryCount[0]?.count || 0);
  }

  /**
   * Mark anomaly as false positive
   */
  async markAsFalsePositive(
    tenantId: string,
    anomalyId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    await db
      .update(anomalyDetection)
      .set({
        status: 'false_positive',
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(anomalyDetection.id, anomalyId),
          eq(anomalyDetection.tenantId, tenantId)
        )
      );
  }

  /**
   * Escalate anomaly for investigation
   */
  async escalateAnomaly(
    tenantId: string,
    anomalyId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    await db
      .update(anomalyDetection)
      .set({
        status: 'investigating',
        investigatedBy: userId,
        investigationNotes: notes,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(anomalyDetection.id, anomalyId),
          eq(anomalyDetection.tenantId, tenantId)
        )
      );
  }
}

export const anomalyDetectionAlertService = new AnomalyDetectionAlertService();
