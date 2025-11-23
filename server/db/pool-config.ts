/**
 * Database Connection Pool Configuration
 * 
 * Optimizes database connection pooling for better resource utilization
 * and improved query execution performance
 */

export interface PoolConfig {
  min: number;           // Minimum connections to maintain
  max: number;           // Maximum connections allowed
  idleTimeoutMillis: number;  // Idle connection timeout
  connectionTimeoutMillis: number;  // Connection acquisition timeout
  statementTimeout: number;  // Query execution timeout
  preparedStatements: boolean;  // Use prepared statements
  applicationName: string;  // Identify connection source in logs
}

/**
 * Get pool configuration based on environment
 */
export function getPoolConfig(environment: 'development' | 'production' = 'development'): PoolConfig {
  if (environment === 'production') {
    return {
      min: 10,             // Keep 10 warm connections
      max: 50,             // Allow up to 50 concurrent connections
      idleTimeoutMillis: 300000,  // 5 minutes idle timeout
      connectionTimeoutMillis: 30000,  // 30 seconds to acquire connection
      statementTimeout: 60000,  // 60 seconds per statement
      preparedStatements: true,
      applicationName: 'copilot-accountant-prod',
    };
  }

  // Development configuration
  return {
    min: 2,              // Keep 2 warm connections
    max: 20,             // Allow up to 20 concurrent connections
    idleTimeoutMillis: 300000,  // 5 minutes idle timeout
    connectionTimeoutMillis: 30000,  // 30 seconds to acquire connection
    statementTimeout: 30000,  // 30 seconds per statement
    preparedStatements: true,
    applicationName: 'copilot-accountant-dev',
  };
}

/**
 * Pool monitoring and health check
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  busyConnections: number;
  waitingRequests: number;
  avgConnectionLifetime: number;
}

export class PoolMonitor {
  /**
   * Get current pool statistics
   */
  static getStats(pool: any): PoolStats {
    // Implementation depends on the actual database driver
    // This is a template for monitoring
    return {
      totalConnections: pool._all?.length ?? 0,
      idleConnections: pool._available?.length ?? 0,
      busyConnections: (pool._all?.length ?? 0) - (pool._available?.length ?? 0),
      waitingRequests: pool._queue?.length ?? 0,
      avgConnectionLifetime: 0,
    };
  }

  /**
   * Check pool health
   */
  static isHealthy(stats: PoolStats, threshold = 0.8): boolean {
    if (stats.totalConnections === 0) return false;
    const utilization = stats.busyConnections / stats.totalConnections;
    return utilization < threshold && stats.waitingRequests === 0;
  }

  /**
   * Log pool statistics
   */
  static logStats(stats: PoolStats): void {
    console.log('=== Database Pool Statistics ===');
    console.log(`Total Connections: ${stats.totalConnections}`);
    console.log(`Idle Connections: ${stats.idleConnections}`);
    console.log(`Busy Connections: ${stats.busyConnections}`);
    console.log(`Waiting Requests: ${stats.waitingRequests}`);
    console.log(`Utilization: ${((stats.busyConnections / stats.totalConnections) * 100).toFixed(2)}%`);
  }
}

/**
 * Connection pool initialization
 */
export function initializePool() {
  const environment = (process.env.NODE_ENV as 'development' | 'production') || 'development';
  const config = getPoolConfig(environment);

  return {
    min: config.min,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    application_name: config.applicationName,
    statement_timeout: config.statementTimeout,
  };
}

/**
 * Recommended pool settings for different scenarios
 */
export const PoolPresets = {
  /**
   * Development: Small footprint, good for testing
   */
  development: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 300000,
  },

  /**
   * Standard: Balanced for typical SaaS
   */
  standard: {
    min: 5,
    max: 30,
    idleTimeoutMillis: 300000,
  },

  /**
   * HighConcurrency: For high-traffic scenarios
   */
  highConcurrency: {
    min: 10,
    max: 50,
    idleTimeoutMillis: 300000,
  },

  /**
   * HighThroughput: For batch/reporting operations
   */
  highThroughput: {
    min: 15,
    max: 100,
    idleTimeoutMillis: 600000,
  },
};

/**
 * Recommended timeout settings
 */
export const TimeoutPresets = {
  /**
   * Fast: For quick queries (< 1 second)
   */
  fast: {
    connectionTimeoutMillis: 15000,
    statementTimeout: 5000,
  },

  /**
   * Standard: For normal queries (< 30 seconds)
   */
  standard: {
    connectionTimeoutMillis: 30000,
    statementTimeout: 30000,
  },

  /**
   * Long: For reports and batch operations (< 5 minutes)
   */
  long: {
    connectionTimeoutMillis: 60000,
    statementTimeout: 300000,
  },
};
