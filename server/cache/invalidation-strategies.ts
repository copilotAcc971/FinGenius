/**
 * Cache Invalidation Strategies
 * 
 * Implements event-based, time-based, and dependency-based cache invalidation
 * to ensure data consistency while maintaining performance benefits
 */

import {
  invalidateTenantCache,
  invalidateChartOfAccounts,
  invalidateTaxRules,
  invalidateFXRates,
  invalidateCustomerList,
  invalidateVendorList,
  invalidateFinancialReport,
  cacheManager,
} from './cache-manager';

/**
 * Event-based invalidation
 */
export const EventInvalidationStrategies = {
  /**
   * When a journal entry is posted, invalidate all financial reports
   */
  whenJournalEntryPosted(tenantId: string): void {
    // Invalidate all report caches for this tenant
    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    // Invalidate trial balance cache
    const trialBalancePattern = new RegExp(`.*trial.*balance.*:${tenantId}$`);
    cacheManager.deletePattern(trialBalancePattern);

    // Invalidate P&L cache
    const plPattern = new RegExp(`.*profit.*loss.*:${tenantId}$`);
    cacheManager.deletePattern(plPattern);

    // Invalidate balance sheet cache
    const bsPattern = new RegExp(`.*balance.*sheet.*:${tenantId}$`);
    cacheManager.deletePattern(bsPattern);

    // Invalidate cash flow cache
    const cfPattern = new RegExp(`.*cash.*flow.*:${tenantId}$`);
    cacheManager.deletePattern(cfPattern);

    console.log(`[Cache] Invalidated financial reports for tenant ${tenantId}`);
  },

  /**
   * When a customer is created/updated, invalidate customer list cache
   */
  whenCustomerUpdated(tenantId: string): void {
    invalidateCustomerList(tenantId);
    console.log(`[Cache] Invalidated customer list for tenant ${tenantId}`);
  },

  /**
   * When a vendor is created/updated, invalidate vendor list cache
   */
  whenVendorUpdated(tenantId: string): void {
    invalidateVendorList(tenantId);
    console.log(`[Cache] Invalidated vendor list for tenant ${tenantId}`);
  },

  /**
   * When an account is created/updated, invalidate chart of accounts
   */
  whenAccountUpdated(tenantId: string): void {
    invalidateChartOfAccounts(tenantId);

    // Also invalidate all financial reports that depend on COA
    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    console.log(`[Cache] Invalidated chart of accounts for tenant ${tenantId}`);
  },

  /**
   * When a tax rule is updated, invalidate tax rules cache
   */
  whenTaxRuleUpdated(tenantId: string): void {
    invalidateTaxRules(tenantId);

    // Also invalidate invoice/bill calculations that depend on tax rules
    const invoicePattern = new RegExp(`.*invoice.*:${tenantId}$`);
    cacheManager.deletePattern(invoicePattern);

    const billPattern = new RegExp(`.*bill.*:${tenantId}$`);
    cacheManager.deletePattern(billPattern);

    console.log(`[Cache] Invalidated tax rules for tenant ${tenantId}`);
  },

  /**
   * When FX rates are updated, invalidate FX rate cache
   */
  whenFXRatesUpdated(tenantId: string): void {
    invalidateFXRates(tenantId);

    // Also invalidate all reports that use FX conversion
    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    console.log(`[Cache] Invalidated FX rates for tenant ${tenantId}`);
  },

  /**
   * When an invoice is created/updated, invalidate related caches
   */
  whenInvoiceUpdated(tenantId: string, customerId?: string): void {
    // Invalidate AR aging reports
    const arPattern = new RegExp(`.*ar.*aging.*:${tenantId}$`);
    cacheManager.deletePattern(arPattern);

    // Invalidate customer list (summary stats may be affected)
    if (customerId) {
      const pattern = new RegExp(`.*customer.*${customerId}.*:${tenantId}$`);
      cacheManager.deletePattern(pattern);
    }

    console.log(`[Cache] Invalidated invoice-related caches for tenant ${tenantId}`);
  },

  /**
   * When a bill is created/updated, invalidate related caches
   */
  whenBillUpdated(tenantId: string, vendorId?: string): void {
    // Invalidate AP aging reports
    const apPattern = new RegExp(`.*ap.*aging.*:${tenantId}$`);
    cacheManager.deletePattern(apPattern);

    // Invalidate vendor list (summary stats may be affected)
    if (vendorId) {
      const pattern = new RegExp(`.*vendor.*${vendorId}.*:${tenantId}$`);
      cacheManager.deletePattern(pattern);
    }

    console.log(`[Cache] Invalidated bill-related caches for tenant ${tenantId}`);
  },

  /**
   * When a payment is recorded, invalidate related caches
   */
  whenPaymentRecorded(tenantId: string): void {
    // Invalidate AR/AP aging reports
    const agePattern = new RegExp(`.*aging.*:${tenantId}$`);
    cacheManager.deletePattern(agePattern);

    // Invalidate cash flow reports
    const cfPattern = new RegExp(`.*cash.*flow.*:${tenantId}$`);
    cacheManager.deletePattern(cfPattern);

    console.log(`[Cache] Invalidated payment-related caches for tenant ${tenantId}`);
  },
};

/**
 * Time-based invalidation
 */
export class TimeBasedInvalidation {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Schedule daily FX rate cache refresh at midnight UTC
   */
  scheduleDailyFXRefresh(tenantId: string): void {
    const key = `fx-refresh-${tenantId}`;

    // Clear any existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    // Calculate time until next midnight UTC
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Schedule timer
    const timer = setTimeout(() => {
      invalidateFXRates(tenantId);
      console.log(`[Cache] Daily FX rate refresh for tenant ${tenantId}`);

      // Reschedule for next day
      this.scheduleDailyFXRefresh(tenantId);
    }, msUntilMidnight);

    this.timers.set(key, timer);
  }

  /**
   * Schedule hourly cache refresh for specific key pattern
   */
  scheduleHourlyRefresh(pattern: RegExp, tenantId: string): void {
    const key = `hourly-refresh-${tenantId}`;

    // Clear any existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    // Schedule hourly refresh
    const timer = setInterval(() => {
      cacheManager.deletePattern(pattern);
      console.log(`[Cache] Hourly refresh for ${tenantId}`);
    }, 60 * 60 * 1000); // 1 hour

    this.timers.set(key, timer as any);
  }

  /**
   * Cancel scheduled refresh
   */
  cancelRefresh(tenantId: string): void {
    const fxKey = `fx-refresh-${tenantId}`;
    const hourlyKey = `hourly-refresh-${tenantId}`;

    if (this.timers.has(fxKey)) {
      clearTimeout(this.timers.get(fxKey)!);
      this.timers.delete(fxKey);
    }

    if (this.timers.has(hourlyKey)) {
      clearInterval(this.timers.get(hourlyKey)! as any);
      this.timers.delete(hourlyKey);
    }
  }
}

// Singleton instance
export const timeBasedInvalidation = new TimeBasedInvalidation();

/**
 * Dependency-based invalidation
 */
export const DependencyInvalidationStrategies = {
  /**
   * Invalidate all dependents when chart of accounts changes
   */
  whenCoAChanges(tenantId: string): void {
    // COA affects:
    // - All financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow)
    // - Account lists
    // - GL reports
    
    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    invalidateChartOfAccounts(tenantId);
    console.log(`[Cache] Invalidated CoA dependents for tenant ${tenantId}`);
  },

  /**
   * Invalidate all dependents when tax rates change
   */
  whenTaxRatesChange(tenantId: string): void {
    // Tax rates affect:
    // - Invoice calculations
    // - Bill calculations
    // - Tax reports
    // - Financial reports (if tax is expense)

    invalidateTaxRules(tenantId);

    const invoicePattern = new RegExp(`.*invoice.*:${tenantId}$`);
    cacheManager.deletePattern(invoicePattern);

    const billPattern = new RegExp(`.*bill.*:${tenantId}$`);
    cacheManager.deletePattern(billPattern);

    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    console.log(`[Cache] Invalidated tax rate dependents for tenant ${tenantId}`);
  },

  /**
   * Invalidate all dependents when currency rates change
   */
  whenCurrencyRatesChange(tenantId: string): void {
    // Currency rates affect:
    // - FX translations (IAS 21)
    // - Multi-currency reports
    // - Consolidated statements

    invalidateFXRates(tenantId);

    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    const fxPattern = new RegExp(`.*fx.*:${tenantId}$`);
    cacheManager.deletePattern(fxPattern);

    console.log(`[Cache] Invalidated currency rate dependents for tenant ${tenantId}`);
  },

  /**
   * Invalidate all dependents when calculation rules change
   */
  whenCalculationRulesChange(tenantId: string): void {
    // Calculation rules affect:
    // - All financial calculations
    // - Depreciation schedules
    // - Impairment tests
    // - All reports

    const reportPattern = new RegExp(`.*report.*:${tenantId}$`);
    cacheManager.deletePattern(reportPattern);

    const calcPattern = new RegExp(`.*calc.*:${tenantId}$`);
    cacheManager.deletePattern(calcPattern);

    console.log(`[Cache] Invalidated calculation rule dependents for tenant ${tenantId}`);
  },
};

/**
 * Bulk invalidation operations
 */
export function invalidateAllForTenant(tenantId: string): void {
  invalidateTenantCache(tenantId);
  timeBasedInvalidation.cancelRefresh(tenantId);
  console.log(`[Cache] Fully invalidated all caches for tenant ${tenantId}`);
}

export function invalidateAllGlobally(): void {
  cacheManager.clear();
  console.log(`[Cache] Globally invalidated all caches`);
}
