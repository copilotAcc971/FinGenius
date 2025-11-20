import { db } from '../../db';
import OpenAI from 'openai';
import { 
  bills, 
  customerPayments,
  journalEntries,
  journalEntryLegs,
  vendors,
  customers,
  accounts,
  alertInstances,
  type InsertAlertInstance,
  type InsertJournalEntry,
  type InsertJournalEntryLeg
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RecurringExpense {
  vendorId: string;
  vendorName: string;
  description: string;
  averageAmount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  lastOccurrence: Date;
  expectedNextDate: Date;
  confidence: number;
  bills: any[];
}

interface RevenueRecognitionOpportunity {
  customerId: string;
  customerName: string;
  advancePaymentAmount: number;
  serviceDeliveryDate: Date;
  paymentDate: Date;
  rationale: string;
  confidence: number;
}

interface PrepaidExpense {
  vendorId: string;
  vendorName: string;
  totalPrepaidAmount: number;
  startDate: Date;
  endDate: Date;
  monthlyAmortization: number;
  remainingPeriods: number;
  rationale: string;
}

interface UnrecordedLiability {
  vendorId: string;
  vendorName: string;
  estimatedAmount: number;
  serviceCompletionDate: Date;
  rationale: string;
  confidence: number;
}

interface AccrualSuggestion {
  type: 'recurring_expense' | 'revenue_recognition' | 'prepaid_amortization' | 'unrecorded_liability';
  priority: 'critical' | 'high' | 'medium' | 'low';
  rationale: string;
  supportingData: any;
  draftJournalEntry: {
    description: string;
    entryDate: string;
    legs: Array<{
      accountName: string;
      accountCode: string;
      debitAmount: string;
      creditAmount: string;
      description: string;
    }>;
  };
  confidence: number;
}

export class AccrualsAlertService {
  /**
   * Detect accrual opportunities for a tenant at period end
   */
  async detectAccrualOpportunities(
    tenantId: string,
    periodEndDate: Date = new Date()
  ): Promise<void> {
    console.log(`[Accruals Alert] Analyzing accrual opportunities for tenant ${tenantId} at ${periodEndDate.toISOString()}`);

    const suggestions: AccrualSuggestion[] = [];

    // 1. Analyze recurring expenses
    const recurringExpenses = await this.analyzeRecurringExpenses(tenantId, periodEndDate);
    for (const expense of recurringExpenses) {
      if (expense.confidence > 0.7 && this.isAccrualNeeded(expense.expectedNextDate, periodEndDate)) {
        suggestions.push(await this.createRecurringExpenseAccrual(tenantId, expense, periodEndDate));
      }
    }

    // 2. Analyze revenue recognition opportunities
    const revenueOpportunities = await this.analyzeRevenueRecognition(tenantId, periodEndDate);
    for (const opportunity of revenueOpportunities) {
      if (opportunity.confidence > 0.7) {
        suggestions.push(await this.createRevenueRecognitionAccrual(tenantId, opportunity, periodEndDate));
      }
    }

    // 3. Analyze prepaid expenses
    const prepaidExpenses = await this.analyzePrepaidExpenses(tenantId, periodEndDate);
    for (const prepaid of prepaidExpenses) {
      suggestions.push(await this.createPrepaidAmortizationAccrual(tenantId, prepaid, periodEndDate));
    }

    // 4. Detect unrecorded liabilities
    const unrecordedLiabilities = await this.detectUnrecordedLiabilities(tenantId, periodEndDate);
    for (const liability of unrecordedLiabilities) {
      if (liability.confidence > 0.6) {
        suggestions.push(await this.createUnrecordedLiabilityAccrual(tenantId, liability, periodEndDate));
      }
    }

    // Create alert if we have suggestions
    if (suggestions.length > 0) {
      await this.createAccrualsAlert(tenantId, suggestions, periodEndDate);
    }

    console.log(`[Accruals Alert] Found ${suggestions.length} accrual suggestions`);
  }

  /**
   * Analyze recurring expenses using AI pattern matching
   */
  private async analyzeRecurringExpenses(
    tenantId: string,
    periodEndDate: Date
  ): Promise<RecurringExpense[]> {
    const lookbackMonths = 12;
    const startDate = new Date(periodEndDate);
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    // Get all bills in lookback period
    const historicalBills = await db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        issueDate: bills.issueDate,
        dueDate: bills.dueDate,
        totalAmount: bills.totalAmount,
        description: bills.description,
        status: bills.status
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, startDate.toISOString()),
          lte(bills.issueDate, periodEndDate.toISOString())
        )
      )
      .orderBy(desc(bills.issueDate));

    // Group by vendor
    const billsByVendor = new Map<string, any[]>();
    for (const bill of historicalBills) {
      if (!bill.vendorId) continue;
      if (!billsByVendor.has(bill.vendorId)) {
        billsByVendor.set(bill.vendorId, []);
      }
      billsByVendor.get(bill.vendorId)!.push(bill);
    }

    const recurringExpenses: RecurringExpense[] = [];

    // Analyze each vendor's billing pattern
    for (const [vendorId, vendorBills] of billsByVendor) {
      if (vendorBills.length < 3) continue; // Need at least 3 occurrences to establish pattern

      const pattern = this.detectRecurringPattern(vendorBills);
      
      if (pattern && pattern.confidence > 0.7) {
        recurringExpenses.push({
          vendorId,
          vendorName: vendorBills[0].vendorName,
          description: this.extractCommonDescription(vendorBills),
          averageAmount: pattern.averageAmount,
          frequency: pattern.frequency,
          lastOccurrence: new Date(pattern.lastOccurrence),
          expectedNextDate: pattern.expectedNextDate,
          confidence: pattern.confidence,
          bills: vendorBills
        });
      }
    }

    return recurringExpenses;
  }

  /**
   * Detect recurring pattern in bills using statistical analysis
   */
  private detectRecurringPattern(bills: any[]): {
    averageAmount: number;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    lastOccurrence: string;
    expectedNextDate: Date;
    confidence: number;
  } | null {
    if (bills.length < 3) return null;

    // Sort by date
    const sortedBills = bills.sort((a, b) => 
      new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
    );

    // Calculate intervals between bills (in days)
    const intervals: number[] = [];
    for (let i = 1; i < sortedBills.length; i++) {
      const days = Math.round(
        (new Date(sortedBills[i].issueDate).getTime() - new Date(sortedBills[i - 1].issueDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    // Calculate average interval and standard deviation
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    );

    // Determine frequency and confidence
    let frequency: 'monthly' | 'quarterly' | 'yearly';
    let confidence = 0;

    // Monthly: 28-32 days
    if (avgInterval >= 28 && avgInterval <= 32) {
      frequency = 'monthly';
      confidence = Math.max(0, 1 - (stdDev / avgInterval) * 2);
    }
    // Quarterly: 88-95 days
    else if (avgInterval >= 88 && avgInterval <= 95) {
      frequency = 'quarterly';
      confidence = Math.max(0, 1 - (stdDev / avgInterval) * 2);
    }
    // Yearly: 360-370 days
    else if (avgInterval >= 360 && avgInterval <= 370) {
      frequency = 'yearly';
      confidence = Math.max(0, 1 - (stdDev / avgInterval) * 2);
    }
    else {
      return null; // No clear pattern
    }

    // Calculate average amount
    const amounts = sortedBills.map(b => parseFloat(b.totalAmount || '0'));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const amountStdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
    );

    // Reduce confidence if amounts vary widely
    confidence *= Math.max(0, 1 - (amountStdDev / avgAmount));

    // Calculate expected next date
    const lastDate = new Date(sortedBills[sortedBills.length - 1].issueDate);
    const expectedNextDate = new Date(lastDate);
    expectedNextDate.setDate(expectedNextDate.getDate() + Math.round(avgInterval));

    return {
      averageAmount: avgAmount,
      frequency,
      lastOccurrence: sortedBills[sortedBills.length - 1].issueDate,
      expectedNextDate,
      confidence
    };
  }

  /**
   * Extract common description from bills
   */
  private extractCommonDescription(bills: any[]): string {
    const descriptions = bills
      .map(b => b.description || b.vendorName || 'Recurring Expense')
      .filter(d => d && d.trim().length > 0);
    
    if (descriptions.length === 0) return 'Recurring Expense';
    
    // Use the most common description or the first one
    const descriptionCounts = new Map<string, number>();
    for (const desc of descriptions) {
      descriptionCounts.set(desc, (descriptionCounts.get(desc) || 0) + 1);
    }
    
    let mostCommon = descriptions[0];
    let maxCount = 0;
    for (const [desc, count] of descriptionCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = desc;
      }
    }
    
    return mostCommon;
  }

  /**
   * Check if accrual is needed (expense expected but not yet recorded)
   */
  private isAccrualNeeded(expectedDate: Date, periodEndDate: Date): boolean {
    // If expected date is before or on period end date, accrual may be needed
    return expectedDate <= periodEndDate;
  }

  /**
   * Analyze revenue recognition opportunities
   */
  private async analyzeRevenueRecognition(
    tenantId: string,
    periodEndDate: Date
  ): Promise<RevenueRecognitionOpportunity[]> {
    const lookbackMonths = 6;
    const startDate = new Date(periodEndDate);
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    // Get advance payments (customer payments not yet fully recognized as revenue)
    const advancePayments = await db
      .select({
        id: customerPayments.id,
        customerId: customerPayments.customerId,
        customerName: customers.name,
        amount: customerPayments.amount,
        paymentDate: customerPayments.paymentDate,
        reference: customerPayments.reference,
        notes: customerPayments.notes
      })
      .from(customerPayments)
      .leftJoin(customers, eq(customerPayments.customerId, customers.id))
      .where(
        and(
          eq(customerPayments.tenantId, tenantId),
          gte(customerPayments.paymentDate, startDate.toISOString()),
          lte(customerPayments.paymentDate, periodEndDate.toISOString())
        )
      );

    const opportunities: RevenueRecognitionOpportunity[] = [];

    // Analyze each payment using AI for context
    for (const payment of advancePayments) {
      const notes = payment.notes || payment.reference || '';
      
      // Look for keywords suggesting advance payment
      const advanceKeywords = ['advance', 'prepayment', 'deposit', 'retainer', 'subscription'];
      const hasAdvanceIndicator = advanceKeywords.some(keyword => 
        notes.toLowerCase().includes(keyword)
      );

      if (hasAdvanceIndicator) {
        // Assume service delivery date is after payment date
        const serviceDeliveryDate = new Date(payment.paymentDate);
        serviceDeliveryDate.setDate(serviceDeliveryDate.getDate() + 30); // Default 30 days

        if (serviceDeliveryDate <= periodEndDate) {
          opportunities.push({
            customerId: payment.customerId,
            customerName: payment.customerName || 'Unknown Customer',
            advancePaymentAmount: parseFloat(payment.amount || '0'),
            serviceDeliveryDate,
            paymentDate: new Date(payment.paymentDate),
            rationale: `Advance payment detected: "${notes}". Service delivery expected by ${serviceDeliveryDate.toLocaleDateString()}.`,
            confidence: 0.75
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Analyze prepaid expenses
   */
  private async analyzePrepaidExpenses(
    tenantId: string,
    periodEndDate: Date
  ): Promise<PrepaidExpense[]> {
    const lookbackMonths = 12;
    const startDate = new Date(periodEndDate);
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    // Get bills with prepaid indicators
    const potentialPrepaids = await db
      .select({
        id: bills.id,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        totalAmount: bills.totalAmount,
        issueDate: bills.issueDate,
        description: bills.description
      })
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(
        and(
          eq(bills.tenantId, tenantId),
          gte(bills.issueDate, startDate.toISOString())
        )
      );

    const prepaidExpenses: PrepaidExpense[] = [];

    // Look for prepaid indicators in descriptions
    const prepaidKeywords = ['annual', 'yearly', 'prepaid', '12 month', 'subscription'];
    
    for (const bill of potentialPrepaids) {
      const description = bill.description || '';
      const hasKeyword = prepaidKeywords.some(keyword => 
        description.toLowerCase().includes(keyword)
      );

      if (hasKeyword) {
        const amount = parseFloat(bill.totalAmount || '0');
        const issueDate = new Date(bill.issueDate);
        
        // Assume 12-month prepayment
        const endDate = new Date(issueDate);
        endDate.setMonth(endDate.getMonth() + 12);
        
        const monthlyAmortization = amount / 12;
        const monthsElapsed = Math.min(
          12,
          Math.floor(
            (periodEndDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          )
        );
        const remainingPeriods = 12 - monthsElapsed;

        if (remainingPeriods > 0) {
          prepaidExpenses.push({
            vendorId: bill.vendorId!,
            vendorName: bill.vendorName || 'Unknown Vendor',
            totalPrepaidAmount: amount,
            startDate: issueDate,
            endDate,
            monthlyAmortization,
            remainingPeriods,
            rationale: `Prepaid expense identified: "${description}". Monthly amortization required.`
          });
        }
      }
    }

    return prepaidExpenses;
  }

  /**
   * Detect unrecorded liabilities
   */
  private async detectUnrecordedLiabilities(
    tenantId: string,
    periodEndDate: Date
  ): Promise<UnrecordedLiability[]> {
    // This is a simplified implementation
    // In production, you would analyze:
    // 1. Purchase orders without matching bills
    // 2. Service agreements with regular billing
    // 3. Historical vendor patterns

    const unrecordedLiabilities: UnrecordedLiability[] = [];

    // Get recurring vendors who haven't billed this month
    const recurringExpenses = await this.analyzeRecurringExpenses(tenantId, periodEndDate);
    
    for (const expense of recurringExpenses) {
      const lastBillDate = expense.lastOccurrence;
      const expectedBillDate = expense.expectedNextDate;

      // If we're past the expected bill date but no bill received
      if (expectedBillDate < periodEndDate) {
        const daysOverdue = Math.floor(
          (periodEndDate.getTime() - expectedBillDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysOverdue > 5) {
          unrecordedLiabilities.push({
            vendorId: expense.vendorId,
            vendorName: expense.vendorName,
            estimatedAmount: expense.averageAmount,
            serviceCompletionDate: expectedBillDate,
            rationale: `${expense.frequency} bill expected from ${expense.vendorName} on ${expectedBillDate.toLocaleDateString()} but not yet received. Based on historical pattern.`,
            confidence: expense.confidence * 0.8 // Slightly lower confidence
          });
        }
      }
    }

    return unrecordedLiabilities;
  }

  /**
   * Create accrual suggestion for recurring expense
   */
  private async createRecurringExpenseAccrual(
    tenantId: string,
    expense: RecurringExpense,
    periodEndDate: Date
  ): Promise<AccrualSuggestion> {
    const expenseAccount = await this.findOrSuggestAccount(tenantId, 'expense', expense.description);
    const accrualAccount = await this.findOrSuggestAccount(tenantId, 'liability', 'Accrued Expenses');

    return {
      type: 'recurring_expense',
      priority: 'high',
      rationale: `${expense.frequency} expense for ${expense.vendorName} is overdue. Last billed on ${expense.lastOccurrence.toLocaleDateString()}, expected on ${expense.expectedNextDate.toLocaleDateString()}. Average amount: $${expense.averageAmount.toLocaleString()}.`,
      supportingData: {
        vendorId: expense.vendorId,
        vendorName: expense.vendorName,
        frequency: expense.frequency,
        averageAmount: expense.averageAmount,
        lastOccurrence: expense.lastOccurrence,
        historicalBills: expense.bills.slice(0, 5).map(b => ({
          billNumber: b.billNumber,
          date: b.issueDate,
          amount: b.totalAmount
        }))
      },
      draftJournalEntry: {
        description: `Accrual for ${expense.frequency} expense - ${expense.vendorName} - ${expense.description}`,
        entryDate: periodEndDate.toISOString(),
        legs: [
          {
            accountName: expenseAccount.name,
            accountCode: expenseAccount.code,
            debitAmount: expense.averageAmount.toFixed(2),
            creditAmount: '0.00',
            description: `${expense.description} expense accrual`
          },
          {
            accountName: accrualAccount.name,
            accountCode: accrualAccount.code,
            debitAmount: '0.00',
            creditAmount: expense.averageAmount.toFixed(2),
            description: `Accrued liability - ${expense.vendorName}`
          }
        ]
      },
      confidence: expense.confidence
    };
  }

  /**
   * Create accrual suggestion for revenue recognition
   */
  private async createRevenueRecognitionAccrual(
    tenantId: string,
    opportunity: RevenueRecognitionOpportunity,
    periodEndDate: Date
  ): Promise<AccrualSuggestion> {
    const unearnedRevenueAccount = await this.findOrSuggestAccount(tenantId, 'liability', 'Unearned Revenue');
    const revenueAccount = await this.findOrSuggestAccount(tenantId, 'revenue', 'Service Revenue');

    return {
      type: 'revenue_recognition',
      priority: 'medium',
      rationale: opportunity.rationale,
      supportingData: {
        customerId: opportunity.customerId,
        customerName: opportunity.customerName,
        advancePaymentAmount: opportunity.advancePaymentAmount,
        paymentDate: opportunity.paymentDate,
        serviceDeliveryDate: opportunity.serviceDeliveryDate
      },
      draftJournalEntry: {
        description: `Revenue recognition - Service delivered to ${opportunity.customerName}`,
        entryDate: periodEndDate.toISOString(),
        legs: [
          {
            accountName: unearnedRevenueAccount.name,
            accountCode: unearnedRevenueAccount.code,
            debitAmount: opportunity.advancePaymentAmount.toFixed(2),
            creditAmount: '0.00',
            description: 'Recognize advance payment as earned revenue'
          },
          {
            accountName: revenueAccount.name,
            accountCode: revenueAccount.code,
            debitAmount: '0.00',
            creditAmount: opportunity.advancePaymentAmount.toFixed(2),
            description: `Service revenue - ${opportunity.customerName}`
          }
        ]
      },
      confidence: opportunity.confidence
    };
  }

  /**
   * Create accrual suggestion for prepaid amortization
   */
  private async createPrepaidAmortizationAccrual(
    tenantId: string,
    prepaid: PrepaidExpense,
    periodEndDate: Date
  ): Promise<AccrualSuggestion> {
    const prepaidAssetAccount = await this.findOrSuggestAccount(tenantId, 'asset', 'Prepaid Expenses');
    const expenseAccount = await this.findOrSuggestAccount(tenantId, 'expense', 'Operating Expenses');

    return {
      type: 'prepaid_amortization',
      priority: 'medium',
      rationale: prepaid.rationale,
      supportingData: {
        vendorId: prepaid.vendorId,
        vendorName: prepaid.vendorName,
        totalPrepaidAmount: prepaid.totalPrepaidAmount,
        startDate: prepaid.startDate,
        endDate: prepaid.endDate,
        monthlyAmortization: prepaid.monthlyAmortization,
        remainingPeriods: prepaid.remainingPeriods
      },
      draftJournalEntry: {
        description: `Monthly amortization of prepaid expense - ${prepaid.vendorName}`,
        entryDate: periodEndDate.toISOString(),
        legs: [
          {
            accountName: expenseAccount.name,
            accountCode: expenseAccount.code,
            debitAmount: prepaid.monthlyAmortization.toFixed(2),
            creditAmount: '0.00',
            description: 'Monthly expense recognition'
          },
          {
            accountName: prepaidAssetAccount.name,
            accountCode: prepaidAssetAccount.code,
            debitAmount: '0.00',
            creditAmount: prepaid.monthlyAmortization.toFixed(2),
            description: 'Reduce prepaid asset balance'
          }
        ]
      },
      confidence: 0.85
    };
  }

  /**
   * Create accrual suggestion for unrecorded liability
   */
  private async createUnrecordedLiabilityAccrual(
    tenantId: string,
    liability: UnrecordedLiability,
    periodEndDate: Date
  ): Promise<AccrualSuggestion> {
    const expenseAccount = await this.findOrSuggestAccount(tenantId, 'expense', 'Operating Expenses');
    const liabilityAccount = await this.findOrSuggestAccount(tenantId, 'liability', 'Accounts Payable');

    return {
      type: 'unrecorded_liability',
      priority: 'high',
      rationale: liability.rationale,
      supportingData: {
        vendorId: liability.vendorId,
        vendorName: liability.vendorName,
        estimatedAmount: liability.estimatedAmount,
        serviceCompletionDate: liability.serviceCompletionDate
      },
      draftJournalEntry: {
        description: `Accrual for unbilled services - ${liability.vendorName}`,
        entryDate: periodEndDate.toISOString(),
        legs: [
          {
            accountName: expenseAccount.name,
            accountCode: expenseAccount.code,
            debitAmount: liability.estimatedAmount.toFixed(2),
            creditAmount: '0.00',
            description: `Estimated expense - ${liability.vendorName}`
          },
          {
            accountName: liabilityAccount.name,
            accountCode: liabilityAccount.code,
            debitAmount: '0.00',
            creditAmount: liability.estimatedAmount.toFixed(2),
            description: 'Accrued liability for unbilled services'
          }
        ]
      },
      confidence: liability.confidence
    };
  }

  /**
   * Find or suggest appropriate account for accrual
   */
  private async findOrSuggestAccount(
    tenantId: string,
    accountType: 'asset' | 'liability' | 'expense' | 'revenue',
    keyword: string
  ): Promise<{ name: string; code: string }> {
    // Try to find existing account
    const accountTypeMap = {
      asset: 'asset',
      liability: 'liability',
      expense: 'expense',
      revenue: 'revenue'
    };

    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.type, accountTypeMap[accountType])
        )
      );

    // Look for account matching keyword
    const match = existingAccounts.find(a => 
      a.name.toLowerCase().includes(keyword.toLowerCase())
    );

    if (match) {
      return { name: match.name, code: match.code };
    }

    // Suggest new account
    const defaultCodes = {
      'Accrued Expenses': '2100',
      'Unearned Revenue': '2300',
      'Prepaid Expenses': '1400',
      'Service Revenue': '4000',
      'Operating Expenses': '6000',
      'Accounts Payable': '2000'
    };

    return {
      name: keyword,
      code: defaultCodes[keyword as keyof typeof defaultCodes] || '9999'
    };
  }

  /**
   * Create accruals alert
   */
  private async createAccrualsAlert(
    tenantId: string,
    suggestions: AccrualSuggestion[],
    periodEndDate: Date
  ): Promise<void> {
    const highPriority = suggestions.filter(s => s.priority === 'critical' || s.priority === 'high');
    const totalSuggestions = suggestions.length;

    const message = `${totalSuggestions} accrual suggestion(s) detected for period ending ${periodEndDate.toLocaleDateString()}.\n\n` +
      `Breakdown:\n` +
      `• Recurring Expenses: ${suggestions.filter(s => s.type === 'recurring_expense').length}\n` +
      `• Revenue Recognition: ${suggestions.filter(s => s.type === 'revenue_recognition').length}\n` +
      `• Prepaid Amortization: ${suggestions.filter(s => s.type === 'prepaid_amortization').length}\n` +
      `• Unrecorded Liabilities: ${suggestions.filter(s => s.type === 'unrecorded_liability').length}\n\n` +
      `Review and approve suggested journal entries to ensure accurate period-end financials.`;

    const alertData: InsertAlertInstance = {
      tenantId,
      alertType: 'accrual_suggestion',
      priority: highPriority.length > 0 ? 'high' : 'medium',
      title: '📝 Period-End Accruals Suggested',
      message,
      actionUrl: '/journal-entries',
      quickActions: [
        { label: 'Review Accruals', action: 'navigate', params: { url: '/journal-entries' } },
        { label: 'Create Journal Entries', action: 'bulk_action', params: { type: 'create_accruals', suggestions } }
      ],
      metadata: {
        periodEndDate: periodEndDate.toISOString(),
        totalSuggestions,
        suggestions: suggestions.map(s => ({
          type: s.type,
          priority: s.priority,
          rationale: s.rationale,
          confidence: s.confidence,
          draftJournalEntry: s.draftJournalEntry
        }))
      },
      status: 'new',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };

    await db.insert(alertInstances).values(alertData);
  }
}

export const accrualsAlertService = new AccrualsAlertService();
