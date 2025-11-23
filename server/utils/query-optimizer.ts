/**
 * Query Optimizer - Performance Monitoring
 * 
 * Tracks query execution times and identifies N+1 queries and slow queries
 * Provides metrics for performance analysis and optimization
 */

export interface QueryMetrics {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
}

interface SlowQuery {
  name: string;
  duration: number;
  timestamp: Date;
  stack?: string;
}

class QueryOptimizer {
  private metrics: Map<string, QueryMetrics> = new Map();
  private slowQueries: SlowQuery[] = [];
  private threshold: number = 1000; // 1 second default

  /**
   * Measure query execution time
   */
  async measureQuery<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration);
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      throw error;
    }
  }

  /**
   * Record query metrics
   */
  private recordMetric(name: string, duration: number): void {
    const existing = this.metrics.get(name) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.minTime = Math.min(existing.minTime, duration);

    this.metrics.set(name, existing);

    // Track slow queries
    if (duration > this.threshold) {
      this.slowQueries.push({
        name,
        duration,
        timestamp: new Date(),
        stack: new Error().stack,
      });

      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): Map<string, QueryMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics for specific query
   */
  getMetricFor(name: string): QueryMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get slow queries above threshold
   */
  getSlowQueries(threshold?: number): SlowQuery[] {
    const t = threshold ?? this.threshold;
    return this.slowQueries.filter(q => q.duration > t);
  }

  /**
   * Get N+1 query candidates
   * Identifies patterns like multiple separate queries that could be batched
   */
  detectN1Queries(): { name: string; count: number; avgDuration: number }[] {
    const candidates: { name: string; count: number; avgDuration: number }[] = [];

    for (const [name, metrics] of this.metrics.entries()) {
      // If we see the same query executed many times (e.g., >10) in sequence,
      // it might be an N+1 pattern
      if (metrics.count > 10 && metrics.avgTime < 100) {
        candidates.push({
          name,
          count: metrics.count,
          avgDuration: metrics.avgTime,
        });
      }
    }

    return candidates.sort((a, b) => b.count - a.count);
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.slowQueries = [];
  }

  /**
   * Set slow query threshold in milliseconds
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /**
   * Log metrics summary
   */
  logSummary(): void {
    console.log('\n=== Query Performance Summary ===');
    console.log(`Total unique queries: ${this.metrics.size}`);
    console.log(`Slow queries (>${this.threshold}ms): ${this.slowQueries.length}\n`);

    // Sort by average time
    const sorted = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10);

    console.log('Top 10 Slowest Queries:');
    console.log('Name | Count | Avg Time | Max Time | Total Time');
    console.log('--- | --- | --- | --- | ---');

    for (const [name, metrics] of sorted) {
      console.log(
        `${name} | ${metrics.count} | ${metrics.avgTime.toFixed(2)}ms | ${metrics.maxTime.toFixed(2)}ms | ${metrics.totalTime.toFixed(2)}ms`
      );
    }

    // Check for N+1 patterns
    const n1Candidates = this.detectN1Queries();
    if (n1Candidates.length > 0) {
      console.log('\n⚠️  Potential N+1 Query Patterns Detected:');
      for (const candidate of n1Candidates) {
        console.log(
          `${candidate.name}: executed ${candidate.count} times (avg ${candidate.avgDuration.toFixed(2)}ms)`
        );
      }
    }
  }

  /**
   * Export metrics as JSON
   */
  export(): {
    metrics: { [key: string]: QueryMetrics };
    slowQueries: SlowQuery[];
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      slowQueries: this.slowQueries,
    };
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer();

// Convenience function for middleware integration
export function instrumentQuery(name: string) {
  return async (fn: () => Promise<any>) => {
    const { result, duration } = await queryOptimizer.measureQuery(name, fn);
    
    if (process.env.DEBUG_QUERIES === 'true') {
      console.debug(`[${name}] ${duration.toFixed(2)}ms`);
    }

    return result;
  };
}
