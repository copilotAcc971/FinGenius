/**
 * Cache Manager - Multi-level caching system
 * 
 * Provides in-memory caching for frequently accessed data:
 * - Chart of Accounts (1-hour TTL)
 * - Tax Rules & Rates (24-hour TTL)
 * - Currency Pairs & FX Rates (1-day TTL)
 * - Customer/Vendor Lists (4-hour TTL)
 * - Financial Report Cache (1-hour TTL)
 * - Calculation Results (30-min TTL)
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Default TTL values in milliseconds
 */
export const DEFAULT_TTLS = {
  CHART_OF_ACCOUNTS: 60 * 60 * 1000,        // 1 hour
  TAX_RULES: 24 * 60 * 60 * 1000,           // 24 hours
  FX_RATES: 24 * 60 * 60 * 1000,            // 1 day
  CURRENCY_PAIRS: 24 * 60 * 60 * 1000,      // 1 day
  CUSTOMER_LIST: 4 * 60 * 60 * 1000,        // 4 hours
  VENDOR_LIST: 4 * 60 * 60 * 1000,          // 4 hours
  FINANCIAL_REPORT: 60 * 60 * 1000,         // 1 hour
  CALCULATION_RESULT: 30 * 60 * 1000,       // 30 minutes
  DEFAULT: 5 * 60 * 1000,                   // 5 minutes
};

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Record hit
    entry.hits++;
    this.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, value: T, ttl: number = DEFAULT_TTLS.DEFAULT): void {
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      createdAt: now,
      hits: 0,
    });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete multiple keys by pattern
   */
  deletePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Log cache statistics
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('=== Cache Statistics ===');
    console.log(`Size: ${stats.size} entries`);
    console.log(`Hits: ${stats.hits}`);
    console.log(`Misses: ${stats.misses}`);
    console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
  }

  /**
   * Get cache entry details (for debugging)
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    return this.cache.get(key) ?? null;
  }

  /**
   * Warm up cache (pre-load frequently used data)
   * This should be called during server startup
   */
  async warmUp(loader: () => Promise<{ [key: string]: any }>): Promise<void> {
    const data = await loader();
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Higher-level cache functions for specific data types
 */

/**
 * Cache Chart of Accounts
 */
export function cacheChartOfAccounts(tenantId: string, accounts: any): void {
  const key = `coa:${tenantId}`;
  cacheManager.set(key, accounts, DEFAULT_TTLS.CHART_OF_ACCOUNTS);
}

export function getChartOfAccounts(tenantId: string): any | null {
  const key = `coa:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateChartOfAccounts(tenantId: string): void {
  const key = `coa:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache Tax Rules
 */
export function cacheTaxRules(tenantId: string, taxes: any): void {
  const key = `taxes:${tenantId}`;
  cacheManager.set(key, taxes, DEFAULT_TTLS.TAX_RULES);
}

export function getTaxRules(tenantId: string): any | null {
  const key = `taxes:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateTaxRules(tenantId: string): void {
  const key = `taxes:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache FX Rates
 */
export function cacheFXRates(tenantId: string, rates: any): void {
  const key = `fxrates:${tenantId}`;
  cacheManager.set(key, rates, DEFAULT_TTLS.FX_RATES);
}

export function getFXRates(tenantId: string): any | null {
  const key = `fxrates:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateFXRates(tenantId: string): void {
  const key = `fxrates:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache Currency Pairs
 */
export function cacheCurrencyPairs(tenantId: string, pairs: any): void {
  const key = `currencies:${tenantId}`;
  cacheManager.set(key, pairs, DEFAULT_TTLS.CURRENCY_PAIRS);
}

export function getCurrencyPairs(tenantId: string): any | null {
  const key = `currencies:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateCurrencyPairs(tenantId: string): void {
  const key = `currencies:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache Customer List
 */
export function cacheCustomerList(tenantId: string, customers: any): void {
  const key = `customers:${tenantId}`;
  cacheManager.set(key, customers, DEFAULT_TTLS.CUSTOMER_LIST);
}

export function getCustomerList(tenantId: string): any | null {
  const key = `customers:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateCustomerList(tenantId: string): void {
  const key = `customers:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache Vendor List
 */
export function cacheVendorList(tenantId: string, vendors: any): void {
  const key = `vendors:${tenantId}`;
  cacheManager.set(key, vendors, DEFAULT_TTLS.VENDOR_LIST);
}

export function getVendorList(tenantId: string): any | null {
  const key = `vendors:${tenantId}`;
  return cacheManager.get(key);
}

export function invalidateVendorList(tenantId: string): void {
  const key = `vendors:${tenantId}`;
  cacheManager.delete(key);
}

/**
 * Cache Financial Report
 */
export function cacheFinancialReport(reportKey: string, report: any): void {
  cacheManager.set(reportKey, report, DEFAULT_TTLS.FINANCIAL_REPORT);
}

export function getFinancialReport(reportKey: string): any | null {
  return cacheManager.get(reportKey);
}

export function invalidateFinancialReport(reportKey: string): void {
  cacheManager.delete(reportKey);
}

/**
 * Cache Calculation Result
 */
export function cacheCalculationResult(key: string, result: any): void {
  cacheManager.set(key, result, DEFAULT_TTLS.CALCULATION_RESULT);
}

export function getCalculationResult(key: string): any | null {
  return cacheManager.get(key);
}

export function invalidateCalculationResult(key: string): void {
  cacheManager.delete(key);
}

/**
 * Invalidate all cache for a tenant
 */
export function invalidateTenantCache(tenantId: string): void {
  const pattern = new RegExp(`.*:${tenantId}$`);
  cacheManager.deletePattern(pattern);
}

/**
 * Invalidate all cache
 */
export function invalidateAllCache(): void {
  cacheManager.clear();
}
