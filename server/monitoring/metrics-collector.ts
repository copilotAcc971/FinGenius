/**
 * Custom Metrics Collector
 * 
 * Collects and aggregates custom metrics for performance monitoring:
 * - Slow queries (>1000ms)
 * - N+1 query detection
 * - Cache statistics
 * - Database connection pool statistics
 */

import { queryOptimizer, type QueryMetrics } from '../utils/query-optimizer';
import { cacheManager } from '../cache/cache-manager';
import type { PoolStats } from '../db/pool-config';

export interface MetricsReport {
  timestamp: Date;
  slowQueries: { name: string; duration: number }[];
  n1QueryCandidates: { name: string; count: number; avgDuration: number }[];
  cacheStats: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  poolStats?: PoolStats;
  queryMetricsSummary: {
    totalQueries: number;
    totalTime: number;
    avgTime: number;
    slowestQueries: { name: string; avgTime: number; count: number }[];
  };
}

class MetricsCollector {
  private reports: MetricsReport[] = [];
  private maxReports: number = 100; // Keep last 100 reports

  /**
   * Collect slow queries above threshold
   */
  collectSlowQueries(threshold: number = 1000): { name: string; duration: number }[] {
    return queryOptimizer.getSlowQueries(threshold);
  }

  /**
   * Collect N+1 query patterns
   */
  collectN1Queries(): { name: string; count: number; avgDuration: number }[] {
    const metrics = queryOptimizer.getMetrics();
    const candidates: { name: string; count: number; avgDuration: number }[] = [];

    for (const [name, metric] of metrics.entries()) {
      // Heuristic: If the same query is executed many times (>10) with low avg time (<100ms),
      // it might be an N+1 pattern
      if (metric.count > 10 && metric.avgTime < 100 && metric.avgTime > 1) {
        candidates.push({
          name,
          count: metric.count,
          avgDuration: metric.avgTime,
        });
      }
    }

    return candidates.sort((a, b) => b.count - a.count);
  }

  /**
   * Collect cache statistics
   */
  collectCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    return cacheManager.getStats();
  }

  /**
   * Collect connection pool statistics
   */
  collectConnectionPoolStats(pool?: any): PoolStats | undefined {
    if (!pool) return undefined;

    return {
      totalConnections: pool._all?.length ?? 0,
      idleConnections: pool._available?.length ?? 0,
      busyConnections: (pool._all?.length ?? 0) - (pool._available?.length ?? 0),
      waitingRequests: pool._queue?.length ?? 0,
      avgConnectionLifetime: 0,
    };
  }

  /**
   * Generate comprehensive metrics report
   */
  generateReport(pool?: any): MetricsReport {
    const metrics = queryOptimizer.getMetrics();
    const queryMetricsSummary = this.summarizeQueryMetrics(metrics);

    const report: MetricsReport = {
      timestamp: new Date(),
      slowQueries: this.collectSlowQueries(),
      n1QueryCandidates: this.collectN1Queries(),
      cacheStats: this.collectCacheStats(),
      poolStats: pool ? this.collectConnectionPoolStats(pool) : undefined,
      queryMetricsSummary,
    };

    // Store report
    this.reports.push(report);
    if (this.reports.length > this.maxReports) {
      this.reports.shift();
    }

    return report;
  }

  /**
   * Summarize query metrics
   */
  private summarizeQueryMetrics(
    metrics: Map<string, QueryMetrics>
  ): {
    totalQueries: number;
    totalTime: number;
    avgTime: number;
    slowestQueries: { name: string; avgTime: number; count: number }[];
  } {
    let totalQueries = 0;
    let totalTime = 0;

    for (const [_, metric] of metrics.entries()) {
      totalQueries += metric.count;
      totalTime += metric.totalTime;
    }

    const avgTime = totalQueries > 0 ? totalTime / totalQueries : 0;

    // Get top 10 slowest queries
    const slowestQueries = Array.from(metrics.entries())
      .map(([name, metric]) => ({
        name,
        avgTime: metric.avgTime,
        count: metric.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return {
      totalQueries,
      totalTime,
      avgTime,
      slowestQueries,
    };
  }

  /**
   * Get report history
   */
  getReportHistory(limit: number = 10): MetricsReport[] {
    return this.reports.slice(-limit);
  }

  /**
   * Get latest report
   */
  getLatestReport(): MetricsReport | undefined {
    return this.reports[this.reports.length - 1];
  }

  /**
   * Log metrics report
   */
  logReport(report: MetricsReport): void {
    console.log('\n=== Metrics Report ===');
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);

    // Query metrics
    console.log('\n--- Query Metrics ---');
    console.log(`Total Queries: ${report.queryMetricsSummary.totalQueries}`);
    console.log(`Total Time: ${report.queryMetricsSummary.totalTime.toFixed(2)}ms`);
    console.log(`Average Time: ${report.queryMetricsSummary.avgTime.toFixed(2)}ms`);

    if (report.queryMetricsSummary.slowestQueries.length > 0) {
      console.log('\nTop 10 Slowest Queries:');
      for (const q of report.queryMetricsSummary.slowestQueries) {
        console.log(
          `  ${q.name}: ${q.avgTime.toFixed(2)}ms (${q.count} executions)`
        );
      }
    }

    // Slow queries
    if (report.slowQueries.length > 0) {
      console.log(`\n⚠️  Slow Queries (>${1000}ms): ${report.slowQueries.length}`);
      for (const q of report.slowQueries.slice(0, 5)) {
        console.log(`  ${q.name}: ${q.duration.toFixed(2)}ms`);
      }
    }

    // N+1 queries
    if (report.n1QueryCandidates.length > 0) {
      console.log(`\n⚠️  N+1 Query Patterns: ${report.n1QueryCandidates.length}`);
      for (const q of report.n1QueryCandidates.slice(0, 5)) {
        console.log(
          `  ${q.name}: executed ${q.count} times (avg ${q.avgDuration.toFixed(2)}ms)`
        );
      }
    }

    // Cache stats
    console.log('\n--- Cache Statistics ---');
    console.log(`Size: ${report.cacheStats.size} entries`);
    console.log(`Hits: ${report.cacheStats.hits}`);
    console.log(`Misses: ${report.cacheStats.misses}`);
    console.log(`Hit Rate: ${(report.cacheStats.hitRate * 100).toFixed(2)}%`);

    // Pool stats
    if (report.poolStats) {
      console.log('\n--- Connection Pool ---');
      console.log(`Total: ${report.poolStats.totalConnections}`);
      console.log(`Idle: ${report.poolStats.idleConnections}`);
      console.log(`Busy: ${report.poolStats.busyConnections}`);
      console.log(`Waiting: ${report.poolStats.waitingRequests}`);
    }
  }

  /**
   * Export metrics data
   */
  export(): {
    reports: MetricsReport[];
  } {
    return {
      reports: this.reports,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    queryOptimizer.reset();
    cacheManager.clear();
    this.reports = [];
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Start automatic metrics collection
 */
export function startMetricsCollection(intervalMs: number = 300000): () => void {
  // Collect metrics every 5 minutes by default
  const interval = setInterval(() => {
    const report = metricsCollector.generateReport();
    
    // Log if there are issues
    if (report.slowQueries.length > 0 || report.n1QueryCandidates.length > 0) {
      console.warn('[Metrics] Performance issues detected');
      metricsCollector.logReport(report);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Health check function for monitoring endpoints
 */
export function getMetricsHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  issues: string[];
} {
  const report = metricsCollector.getLatestReport();
  if (!report) {
    return {
      status: 'healthy',
      message: 'No metrics collected yet',
      issues: [],
    };
  }

  const issues: string[] = [];

  // Check for slow queries
  if (report.slowQueries.length > 5) {
    issues.push(`${report.slowQueries.length} slow queries detected`);
  }

  // Check for N+1 patterns
  if (report.n1QueryCandidates.length > 2) {
    issues.push(`${report.n1QueryCandidates.length} N+1 query patterns detected`);
  }

  // Check cache hit rate
  if (report.cacheStats.hitRate < 0.5 && report.cacheStats.misses > 100) {
    issues.push(`Low cache hit rate: ${(report.cacheStats.hitRate * 100).toFixed(2)}%`);
  }

  // Check pool utilization
  if (report.poolStats) {
    const utilization = report.poolStats.busyConnections / report.poolStats.totalConnections;
    if (utilization > 0.9) {
      issues.push(`High database pool utilization: ${(utilization * 100).toFixed(2)}%`);
    }
  }

  if (issues.length === 0) {
    return {
      status: 'healthy',
      message: 'All metrics within normal range',
      issues: [],
    };
  }

  if (issues.length > 3) {
    return {
      status: 'unhealthy',
      message: 'Multiple critical performance issues detected',
      issues,
    };
  }

  return {
    status: 'degraded',
    message: 'Some performance issues detected',
    issues,
  };
}
