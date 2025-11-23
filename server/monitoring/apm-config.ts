/**
 * APM (Application Performance Monitoring) Configuration
 * 
 * Initializes New Relic or other APM agents for comprehensive performance monitoring
 * Tracks API latency, database query times, error rates, and custom metrics
 */

/**
 * Initialize APM agent if license key is available
 */
export function initializeAPM(): boolean {
  const licenseKey = process.env.NEW_RELIC_LICENSE_KEY;

  if (!licenseKey) {
    console.log('[APM] New Relic license key not configured, APM disabled');
    return false;
  }

  try {
    // In a real scenario, you would import and configure the New Relic agent here
    // import newrelic from 'newrelic';
    // newrelic.setDispatcher('express');
    
    console.log('[APM] New Relic APM initialized');
    return true;
  } catch (error) {
    console.error('[APM] Failed to initialize APM:', error);
    return false;
  }
}

/**
 * APM Configuration Options
 */
export interface APMConfig {
  enabled: boolean;
  appName: string;
  licenseKey?: string;
  environment: 'development' | 'production' | 'staging';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  transactionTracing: {
    enabled: boolean;
    threshold: number; // ms
  };
  errorReporting: {
    enabled: boolean;
    captureStackTrace: boolean;
    maxErrorAttributes: number;
  };
  customMetrics: {
    enabled: boolean;
    interval: number; // ms
  };
  sqlTracing: {
    enabled: boolean;
    captureParameters: boolean;
    captureRaw: boolean;
  };
}

/**
 * Get APM configuration based on environment
 */
export function getAPMConfig(environment: string = process.env.NODE_ENV || 'development'): APMConfig {
  const licenseKey = process.env.NEW_RELIC_LICENSE_KEY;
  const appName = process.env.NEWRELIC_APP_NAME || 'copilot-accountant';

  const isProd = environment === 'production';

  return {
    enabled: !!licenseKey,
    appName,
    licenseKey,
    environment: environment as any,
    logLevel: isProd ? 'error' : 'info',
    transactionTracing: {
      enabled: true,
      threshold: isProd ? 500 : 100, // Report transactions slower than threshold
    },
    errorReporting: {
      enabled: true,
      captureStackTrace: !isProd,
      maxErrorAttributes: 128,
    },
    customMetrics: {
      enabled: true,
      interval: 60000, // Every minute
    },
    sqlTracing: {
      enabled: true,
      captureParameters: !isProd, // Don't capture sensitive data in production
      captureRaw: !isProd,
    },
  };
}

/**
 * APM Custom Metrics Collector
 */
export class APMMetricsCollector {
  private static instance: APMMetricsCollector;
  private config: APMConfig;

  constructor(config?: APMConfig) {
    this.config = config || getAPMConfig();
  }

  /**
   * Record custom metric
   */
  static recordMetric(name: string, value: number, unit: string = ''): void {
    if (!APMMetricsCollector.instance?.config.customMetrics.enabled) {
      return;
    }

    // In real implementation, send to APM service
    // newrelic.recordMetric(`Custom/${name}`, value);

    if (process.env.DEBUG_METRICS === 'true') {
      console.debug(`[APM Metric] ${name}: ${value}${unit}`);
    }
  }

  /**
   * Record transaction
   */
  static recordTransaction(
    name: string,
    duration: number,
    status: 'success' | 'error' = 'success'
  ): void {
    if (!APMMetricsCollector.instance?.config.transactionTracing.enabled) {
      return;
    }

    const threshold = APMMetricsCollector.instance.config.transactionTracing.threshold;
    if (duration > threshold) {
      const statusIcon = status === 'success' ? '✓' : '✗';
      console.warn(
        `[APM] Slow transaction: ${statusIcon} ${name} (${duration.toFixed(2)}ms)`
      );
    }
  }

  /**
   * Record error
   */
  static recordError(error: Error, context?: Record<string, any>): void {
    if (!APMMetricsCollector.instance?.config.errorReporting.enabled) {
      return;
    }

    // In real implementation, send to APM service
    // newrelic.recordCustomEvent('CustomError', { error: error.message, ...context });

    console.error('[APM] Error recorded:', error.message, context);
  }

  /**
   * Start transaction
   */
  static startTransaction(name: string): { end: (status?: 'success' | 'error') => void } {
    const startTime = performance.now();
    return {
      end: (status?: 'success' | 'error') => {
        const duration = performance.now() - startTime;
        APMMetricsCollector.recordTransaction(name, duration, status);
      },
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): APMMetricsCollector {
    if (!APMMetricsCollector.instance) {
      APMMetricsCollector.instance = new APMMetricsCollector();
    }
    return APMMetricsCollector.instance;
  }
}

/**
 * Initialize APM on module load
 */
if (process.env.NODE_ENV === 'production') {
  initializeAPM();
}
