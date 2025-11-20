/**
 * In-Memory DEK Cache with TTL
 * Caches decrypted Data Encryption Keys to reduce KMS overhead
 * 5-minute TTL balances performance vs. security exposure
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp (ms)
}

export class DEKCache {
  private cache: Map<string, CacheEntry<Buffer>>;
  private defaultTTL: number; // milliseconds
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(ttlMinutes: number = 5) {
    this.cache = new Map();
    this.defaultTTL = ttlMinutes * 60 * 1000; // Convert to milliseconds
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Generate cache key from tenant ID and purpose
   */
  private getCacheKey(tenantId: string, purpose: string, version?: number): string {
    return version !== undefined
      ? `${tenantId}:${purpose}:v${version}`
      : `${tenantId}:${purpose}`;
  }

  /**
   * Get decrypted DEK from cache
   * Returns null if not found or expired
   */
  get(tenantId: string, purpose: string, version?: number): Buffer | null {
    const key = this.getCacheKey(tenantId, purpose, version);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Store decrypted DEK in cache
   */
  set(
    tenantId: string,
    purpose: string,
    dek: Buffer,
    version?: number,
    ttl?: number
  ): void {
    const key = this.getCacheKey(tenantId, purpose, version);
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      value: dek,
      expiresAt
    });
  }

  /**
   * Remove specific DEK from cache
   */
  delete(tenantId: string, purpose: string, version?: number): void {
    const key = this.getCacheKey(tenantId, purpose, version);
    this.cache.delete(key);
  }

  /**
   * Clear all DEKs for a tenant (e.g., on key rotation)
   */
  clearTenant(tenantId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all DEKs for a specific purpose across all tenants
   */
  clearPurpose(purpose: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(`:${purpose}`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getStats(): {
    size: number;
    expired: number;
    active: number;
  } {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      size: this.cache.size,
      expired,
      active
    };
  }

  /**
   * Cleanup and stop interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance with 5-minute TTL
export const dekCache = new DEKCache(5);
