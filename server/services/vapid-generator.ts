import webpush from 'web-push';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { systemConfig } from '@shared/schema';

/**
 * Auto-generate VAPID keys on first startup
 * Stores keys in database for persistence across restarts
 * 
 * VAPID keys are public/private keypairs used for Web Push notifications.
 * They don't require encryption and are stored in the systemConfig table.
 */
export async function ensureVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
}> {
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@copilotaccountant.com';

  // Check if keys already exist in environment (user-provided override)
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject
    };
  }

  // Check if keys exist in database (stored for persistence)
  const existingConfig = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'vapid-keys'),
  });

  if (existingConfig?.value) {
    const keys = existingConfig.value as { publicKey: string; privateKey: string };
    
    // Set in environment for this session
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    
    return { ...keys, subject };
  }

  // Generate new keys
  const vapidKeys = webpush.generateVAPIDKeys();

  // Store in database for persistence
  await db.insert(systemConfig).values({
    key: 'vapid-keys',
    value: {
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      generatedAt: new Date().toISOString(),
    },
    description: 'VAPID keys for Web Push notifications (auto-generated)',
  });

  // Set in environment for this session
  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;


  return {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
    subject
  };
}
