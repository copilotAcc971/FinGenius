import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../db';
import { webhookLogs } from '@shared/schema';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Rate limiting store (in-memory, can be replaced with Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Rate limiting middleware for webhook endpoints
 * Limits requests per source IP + endpoint combination
 */
export function rateLimitWebhook(source: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const key = `${source}:${clientIp}`;
    const now = Date.now();

    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      };
      rateLimitStore.set(key, entry);
    }

    // Check rate limit
    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`[Webhook] Rate limit exceeded for ${source} from ${clientIp}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    // Increment counter
    entry.count++;

    next();
  };
}

/**
 * Verify HMAC signature for webhook requests
 * Supports multiple signature header formats
 */
export function verifyHMAC(options: {
  secret: string;
  signatureHeader: string;
  algorithm?: string;
  encoding?: 'hex' | 'base64';
}) {
  const {
    secret,
    signatureHeader,
    algorithm = 'sha256',
    encoding = 'hex',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers[signatureHeader.toLowerCase()] as string;

      if (!signature) {
        console.error(`[Webhook HMAC] Missing signature header: ${signatureHeader}`);
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      // Get raw body (must be buffer)
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error('[Webhook HMAC] Raw body not available');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      // Compute expected signature
      const hmac = createHmac(algorithm, secret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest(encoding);

      // Extract actual signature (handle various formats)
      let actualSignature = signature;
      
      // Handle GitHub-style signatures (sha256=...)
      if (signature.includes('=')) {
        const parts = signature.split('=');
        actualSignature = parts[1];
      }

      // Convert to buffers for timing-safe comparison
      const signatureBuffer = Buffer.from(actualSignature, encoding);
      const expectedBuffer = Buffer.from(expectedSignature, encoding);

      // Check lengths match before comparison (prevent timing attacks)
      if (signatureBuffer.length !== expectedBuffer.length) {
        console.error('[Webhook HMAC] Invalid signature length');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Timing-safe comparison
      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        console.error('[Webhook HMAC] Signature verification failed');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      next();
    } catch (error) {
      console.error('[Webhook HMAC] Verification error:', error);
      return res.status(500).json({ error: 'Webhook verification failed' });
    }
  };
}

/**
 * Verify Twilio webhook signature
 * Uses Twilio's specific signature validation algorithm
 */
export function verifyTwilioSignature(authToken: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const twilioSignature = req.headers['x-twilio-signature'] as string;

      if (!twilioSignature) {
        console.error('[Twilio Webhook] Missing X-Twilio-Signature header');
        return res.status(401).json({ error: 'Missing Twilio signature' });
      }

      // Get the full URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;

      // Concatenate URL with sorted POST parameters
      let data = url;
      const params = req.body;
      
      // Sort keys and append to data string
      Object.keys(params).sort().forEach(key => {
        data += key + params[key];
      });

      // Compute HMAC-SHA1
      const hmac = createHmac('sha1', authToken);
      hmac.update(Buffer.from(data, 'utf-8'));
      const expectedSignature = hmac.digest('base64');

      // Compare signatures
      if (twilioSignature !== expectedSignature) {
        console.error('[Twilio Webhook] Signature verification failed');
        return res.status(401).json({ error: 'Invalid Twilio signature' });
      }

      next();
    } catch (error) {
      console.error('[Twilio Webhook] Verification error:', error);
      return res.status(500).json({ error: 'Twilio webhook verification failed' });
    }
  };
}

/**
 * Resolve tenant from API key or email domain
 * For tenant-aware webhook routing
 */
export async function resolveTenantFromWebhook(
  apiKey?: string,
  emailDomain?: string
): Promise<string | null> {
  // TODO: Implement API key lookup
  // For now, this is a placeholder
  
  if (apiKey) {
    // Look up tenant by API key
    // const tenant = await db.query.apiKeys.findFirst({
    //   where: eq(apiKeys.key, apiKey),
    //   with: { tenant: true }
    // });
    // return tenant?.tenantId || null;
  }

  if (emailDomain) {
    // Look up tenant by email domain
    // const tenant = await db.query.tenants.findFirst({
    //   where: eq(tenants.emailDomain, emailDomain)
    // });
    // return tenant?.id || null;
  }

  return null;
}

/**
 * Log webhook attempt to database
 */
export async function logWebhookAttempt(data: {
  tenantId?: string;
  source: string;
  endpoint: string;
  method: string;
  headers: Record<string, any>;
  body: any;
  hmacValid: boolean;
  processed: boolean;
  inboundDocumentId?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(webhookLogs).values({
      tenantId: data.tenantId || null,
      source: data.source,
      endpoint: data.endpoint,
      method: data.method,
      headers: data.headers,
      body: data.body,
      hmacValid: data.hmacValid,
      processed: data.processed,
      inboundDocumentId: data.inboundDocumentId || null,
      errorMessage: data.errorMessage || null,
    });

  } catch (error) {
    console.error('[Webhook Log] Failed to log webhook attempt:', error);
    // Don't throw - logging failure shouldn't break the webhook
  }
}

/**
 * Middleware to capture raw body for HMAC verification
 * Must be applied BEFORE express.json() middleware
 */
export function captureRawBody(req: Request, res: Response, next: NextFunction) {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });
}

/**
 * API Key authentication middleware for webhook endpoints
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // TODO: Implement API key validation
  // For now, just check if it exists
  if (apiKey.length < 20) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Attach API key to request for later use
  (req as any).webhookApiKey = apiKey;

  next();
}
