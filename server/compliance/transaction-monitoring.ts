import type { IStorage } from '../storage';
import type { InsertTransactionAlert } from '@shared/schema';

export interface Transaction {
  id: string;
  type: 'invoice' | 'payment' | 'bank_transaction';
  customerId: string;
  amount: number;
  currency: string;
  date: Date;
}

export class TransactionMonitoringService {
  constructor(private storage: IStorage) {}
  
  /**
   * Monitor transaction and generate alerts based on configured rules
   */
  async monitorTransaction(
    tenantId: string,
    transaction: Transaction
  ): Promise<void> {
    // CRITICAL: Store ALL transactions for historical analysis (not just alerts)
    // Create a "monitored" record first
    const monitoredRecord: InsertTransactionAlert = {
      tenantId,
      customerId: transaction.customerId,
      alertType: 'transaction_recorded',
      severity: 'low',
      alertDate: new Date(),
      transactionType: transaction.type,
      transactionId: transaction.id,
      transactionAmount: transaction.amount.toString(),
      transactionCurrency: transaction.currency,
      transactionDate: transaction.date,
      status: 'closed', // Not an actual alert, just a record
      resolution: 'monitored',
      riskScore: 0,
    };
    
    try {
      await this.storage.createTransactionAlert(monitoredRecord);
    } catch (error) {
      console.error('[TransactionMonitoring] Failed to record transaction:', error);
    }
    
    // Get active alert rules for tenant
    const rules = await this.storage.getAlertRules(tenantId);
    const activeRules = rules.filter(r => r.isActive);
    
    for (const rule of activeRules) {
      const shouldAlert = await this.evaluateRule(tenantId, transaction, rule);
      
      if (shouldAlert) {
        await this.createAlert(tenantId, transaction, rule);
      }
    }
  }
  
  private async evaluateRule(tenantId: string, transaction: Transaction, rule: any): Promise<boolean> {
    // Threshold-based rules
    if (rule.ruleType === 'threshold' && rule.thresholdAmount) {
      const threshold = parseFloat(rule.thresholdAmount);
      if (transaction.amount >= threshold) {
        return true;
      }
    }
    
    // Velocity rules (multiple transactions in short period)
    if (rule.ruleType === 'velocity') {
      const period = rule.thresholdPeriod || 'daily';
      const lookbackHours = period === 'daily' ? 24 : period === 'weekly' ? 168 : 720;
      const startDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
      
      // Count ALL monitored transactions (not just alerts) from this customer in period
      const allRecords = await this.storage.getTransactionAlerts(tenantId, {
        customerId: transaction.customerId,
        startDate,
      });
      
      // Filter to actual transactions (includes both monitored records and alerts)
      const transactionCount = allRecords.filter(record => 
        record.transactionId && record.transactionId !== 'unknown'
      ).length + 1; // +1 for current transaction
      
      // Velocity threshold: configurable via rule
      const velocityThreshold = parseInt(rule.thresholdAmount) || 5;
      
      if (transactionCount >= velocityThreshold) {
        console.log(`[TransactionMonitoring] Velocity alert: ${transactionCount} transactions in ${period} (threshold: ${velocityThreshold})`);
        return true;
      }
    }
    
    // Pattern rules (round amounts, structuring)
    if (rule.ruleType === 'pattern') {
      // Check for round amounts (possible structuring)
      if (this.isRoundAmount(transaction.amount)) {
        return true;
      }
      
      // Check for structuring (multiple transactions just below threshold)
      const structuringThreshold = 10000; // $10,000 reporting threshold
      if (transaction.amount >= structuringThreshold * 0.9 && transaction.amount < structuringThreshold) {
        // Count recent near-threshold transactions (all monitored records)
        const allRecords = await this.storage.getTransactionAlerts(tenantId, {
          customerId: transaction.customerId,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        });
        
        const nearThresholdTransactions = allRecords.filter(record => {
          if (!record.transactionAmount) return false;
          const amt = parseFloat(record.transactionAmount);
          return amt >= structuringThreshold * 0.9 && amt < structuringThreshold;
        });
        
        if (nearThresholdTransactions.length >= 2) {
          console.log(`[TransactionMonitoring] Structuring pattern detected: ${nearThresholdTransactions.length + 1} transactions near $10K threshold`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  private isRoundAmount(amount: number): boolean {
    // Check if amount is suspiciously round (e.g., exactly 10000, 50000)
    const roundThresholds = [1000, 5000, 10000, 25000, 50000, 100000];
    return roundThresholds.includes(amount);
  }
  
  private async createAlert(tenantId: string, transaction: Transaction, rule: any): Promise<void> {
    const alert: InsertTransactionAlert = {
      tenantId,
      customerId: transaction.customerId,
      alertType: rule.ruleName,
      severity: rule.severity,
      alertDate: new Date(),
      transactionType: transaction.type,
      transactionId: transaction.id,
      transactionAmount: transaction.amount.toString(),
      transactionCurrency: transaction.currency,
      transactionDate: transaction.date,
      ruleId: rule.id,
      ruleName: rule.ruleName,
      ruleThreshold: { threshold: rule.thresholdAmount, period: rule.thresholdPeriod },
      patternDescription: `Transaction matched rule: ${rule.ruleName}`,
      riskScore: this.calculateAlertRiskScore(transaction.amount, rule.severity),
      status: 'open',
    };
    
    await this.storage.createTransactionAlert(alert);
    
    console.log(`[TransactionMonitoring] Alert created: ${rule.ruleName} for transaction ${transaction.id}`);
  }
  
  private calculateAlertRiskScore(amount: number, severity: string): number {
    let baseScore = 0;
    
    // Severity contribution
    switch (severity) {
      case 'critical': baseScore = 80; break;
      case 'high': baseScore = 60; break;
      case 'medium': baseScore = 40; break;
      case 'low': baseScore = 20; break;
    }
    
    // Amount contribution (higher amounts = higher risk)
    const amountScore = Math.min(20, Math.floor(amount / 5000));
    
    return Math.min(100, baseScore + amountScore);
  }
  
  /**
   * Escalate transaction alert to SAR
   */
  async escalateToSAR(
    tenantId: string,
    alertId: string,
    userId: string,
    activityDescription: string
  ): Promise<any> {
    // Get the alert
    const alert = await this.storage.getTransactionAlertById(alertId, tenantId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    // Get customer info
    const customer = alert.customerId ? await this.storage.getCustomerById(alert.customerId, tenantId) : null;
    
    // Generate SAR number
    const sarNumber = `SAR-${tenantId.slice(0, 8)}-${Date.now()}`;
    
    // Create SAR
    const sar = await this.storage.createSuspiciousActivityReport({
      tenantId,
      sarNumber,
      status: 'draft',
      subjectType: 'customer',
      subjectId: alert.customerId || 'unknown',
      subjectName: customer?.name || 'Unknown',
      customerId: alert.customerId,
      activityType: this.mapAlertTypeToActivityType(alert.alertType),
      activityDescription,
      activityStartDate: alert.transactionDate?.toISOString().split('T')[0],
      activityEndDate: new Date().toISOString().split('T')[0],
      totalAmountInvolved: alert.transactionAmount,
      currencyCode: alert.transactionCurrency || 'USD',
      relatedAlertIds: [alertId],
      relatedTransactionIds: alert.transactionId ? [alert.transactionId] : [],
      investigatorId: userId,
      investigationStartDate: new Date(),
    });
    
    // Update alert to link to SAR
    await this.storage.updateTransactionAlert(alertId, tenantId, {
      status: 'escalated_to_sar',
      sarId: sar.id,
      resolution: 'suspicious',
      resolutionNotes: 'Escalated to SAR ' + sarNumber,
      reviewedBy: userId,
      reviewedAt: new Date(),
    });
    
    return sar;
  }
  
  private mapAlertTypeToActivityType(alertType: string): string {
    const mapping: Record<string, string> = {
      'threshold_exceeded': 'money_laundering',
      'structuring': 'structuring',
      'velocity': 'money_laundering',
      'round_amount': 'structuring',
      'geographic_anomaly': 'fraud',
    };
    
    return mapping[alertType] || 'money_laundering';
  }
}

/**
 * Initialize default alert rules for a new tenant
 */
export async function initializeDefaultAlertRules(storage: IStorage, tenantId: string): Promise<void> {
  const defaultRules = [
    {
      tenantId,
      ruleName: 'Large Transaction Threshold',
      ruleType: 'threshold',
      description: 'Alert when a single transaction exceeds $10,000',
      isActive: true,
      severity: 'high',
      thresholdAmount: '10000',
      thresholdCurrency: 'USD',
      thresholdPeriod: 'transaction',
    },
    {
      tenantId,
      ruleName: 'High Velocity - Daily',
      ruleType: 'velocity',
      description: 'Alert when customer has more than 5 transactions in 24 hours',
      isActive: true,
      severity: 'medium',
      thresholdAmount: '5', // Number of transactions
      thresholdPeriod: 'daily',
    },
    {
      tenantId,
      ruleName: 'Suspicious Patterns',
      ruleType: 'pattern',
      description: 'Alert on round amounts and potential structuring patterns',
      isActive: true,
      severity: 'high',
    },
  ];
  
  for (const rule of defaultRules) {
    try {
      await storage.createAlertRule(rule);
    } catch (error) {
      console.error('[TransactionMonitoring] Failed to create default rule:', error);
    }
  }
  
  console.log(`[TransactionMonitoring] Initialized ${defaultRules.length} default alert rules for tenant ${tenantId}`);
}
