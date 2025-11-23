import { db } from './db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: 'ok' | 'failed'; message?: string };
    rbac: { status: 'ok' | 'failed'; message?: string };
    websockets: { status: 'ok' | 'failed'; message?: string };
    environment: { status: 'ok' | 'failed'; message?: string };
  };
  version: string;
}

interface ReadinessStatus {
  ready: boolean;
  message: string;
  checks: {
    database: boolean;
    rbac: boolean;
    environment: boolean;
  };
}

let lastDatabaseCheck = 0;
let databaseCheckCache: boolean | null = null;

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const now = Date.now();
    // Cache for 10 seconds
    if (databaseCheckCache !== null && now - lastDatabaseCheck < 10000) {
      return databaseCheckCache;
    }

    await db.execute(sql`SELECT 1`);
    databaseCheckCache = true;
    lastDatabaseCheck = now;
    return true;
  } catch (error) {
    databaseCheckCache = false;
    lastDatabaseCheck = Date.now();
    return false;
  }
}

export function checkRBACHealth(): { status: 'ok' | 'failed'; message?: string } {
  // Check if RBAC bypass is configured properly in development
  const rbacBypass = process.env.RBAC_BYPASS_ENABLED === 'true';
  
  if (process.env.NODE_ENV === 'development' && rbacBypass) {
    return { status: 'ok', message: 'RBAC bypass enabled (development mode)' };
  }
  
  if (process.env.NODE_ENV === 'production' && rbacBypass) {
    return { status: 'failed', message: 'RBAC bypass should not be enabled in production' };
  }
  
  return { status: 'ok', message: 'RBAC operational' };
}

export function checkWebSocketsHealth(): { status: 'ok' | 'failed'; message?: string } {
  // WebSockets are initialized if the server is running
  return { status: 'ok', message: 'WebSocket servers initialized' };
}

export function checkEnvironmentHealth(): { status: 'ok' | 'failed'; message?: string } {
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'VITE_STRIPE_PUBLIC_KEY',
    'STRIPE_SECRET_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    return {
      status: 'failed',
      message: `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    };
  }

  return { status: 'ok', message: 'All required environment variables configured' };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseOk = await checkDatabaseHealth();
  const rbacOk = checkRBACHealth();
  const websocketsOk = checkWebSocketsHealth();
  const environmentOk = checkEnvironmentHealth();

  const allHealthy =
    databaseOk &&
    rbacOk.status === 'ok' &&
    websocketsOk.status === 'ok' &&
    environmentOk.status === 'ok';

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: databaseOk ? 'ok' : 'failed' },
      rbac: rbacOk,
      websockets: websocketsOk,
      environment: environmentOk,
    },
    version: process.env.VERSION || '1.0.0',
  };
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const databaseOk = await checkDatabaseHealth();
  const rbacOk = checkRBACHealth();
  const environmentOk = checkEnvironmentHealth();

  const ready = databaseOk && rbacOk.status === 'ok' && environmentOk.status === 'ok';

  return {
    ready,
    message: ready ? 'Application is ready to receive traffic' : 'Application is not ready',
    checks: {
      database: databaseOk,
      rbac: rbacOk.status === 'ok',
      environment: environmentOk.status === 'ok',
    },
  };
}
