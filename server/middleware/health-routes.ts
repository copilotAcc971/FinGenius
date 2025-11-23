import { type Request, type Response } from 'express';
import { getHealthStatus, getReadinessStatus } from '../health-checks';

/**
 * GET /health - Comprehensive health check endpoint
 * Used for monitoring and diagnostics
 * 
 * Returns:
 * - 200: Application is healthy
 * - 503: Application is degraded or unhealthy
 */
export async function handleHealthCheck(req: Request, res: Response) {
  try {
    const health = await getHealthStatus();
    
    if (health.status === 'healthy') {
      return res.status(200).json(health);
    } else if (health.status === 'degraded') {
      return res.status(503).json(health);
    } else {
      return res.status(503).json(health);
    }
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Failed to perform health check',
    });
  }
}

/**
 * GET /ready - Readiness check endpoint
 * Used by load balancers and orchestrators to route traffic
 * 
 * Returns:
 * - 200: Application is ready to receive traffic
 * - 503: Application is not ready
 */
export async function handleReadinessCheck(req: Request, res: Response) {
  try {
    const readiness = await getReadinessStatus();
    
    if (readiness.ready) {
      return res.status(200).json(readiness);
    } else {
      return res.status(503).json(readiness);
    }
  } catch (error) {
    return res.status(503).json({
      ready: false,
      message: 'Failed to perform readiness check',
      checks: {
        database: false,
        rbac: false,
        environment: false,
      },
    });
  }
}

/**
 * GET /live - Liveness check endpoint
 * Simple endpoint to verify the application is running
 * 
 * Returns:
 * - 200: Application is alive
 */
export function handleLivenessCheck(req: Request, res: Response) {
  return res.status(200).json({ alive: true });
}
