/**
 * KMS Module - Main Export
 * Provides easy-to-use helper functions for envelope encryption
 * Handles AI logs, OAuth tokens, documents, etc.
 */

import { envelopeEncryption, type EncryptionMetadata, type EncryptionPurpose } from './envelope-encryption';
import { keyManager } from './key-manager';
import { kmsConfig } from './config';
import { dekCache } from './utils/cache';

// Re-export core services
export { envelopeEncryption, keyManager, kmsConfig, dekCache };
export type { EncryptionMetadata, EncryptionPurpose };

// Re-export types from adapters
export type { KMSAdapter } from './adapters/base';
export { EnvironmentKMSAdapter } from './adapters/environment';
export { AWSKMSAdapter } from './adapters/aws-kms';

// Re-export utilities
export * from './utils/crypto';

/**
 * AI Log Encryption Metadata
 * Matches database schema for ai_interaction_logs
 */
export interface AILogEncryptionMetadata {
  encryptedPayload: string;
  kmsKeyAlias: string;
  encryptedDataKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  payloadIntegrityHash: string;
}

/**
 * OAuth Token Encryption Metadata
 * Matches database schema for integration_connections
 */
export interface TokenEncryptionMetadata {
  encryptedToken: string;
  kmsKeyAlias: string;
  encryptedDek: string;
  iv: string;
  authTag: string;
  payloadIntegrityHash: string;
}

/**
 * Encrypt data for AI interaction logs
 * 
 * @param payload - The data to encrypt (will be JSON stringified)
 * @param tenantId - Tenant ID for key isolation
 * @returns Encryption metadata for database storage
 */
export async function encryptForAILogs(
  payload: object,
  tenantId: string
): Promise<AILogEncryptionMetadata> {
  const plaintextJson = JSON.stringify(payload);
  
  const metadata = await envelopeEncryption.encrypt(
    plaintextJson,
    tenantId,
    'ai_logs'
  );

  return {
    encryptedPayload: metadata.encryptedPayload,
    kmsKeyAlias: metadata.kmsKeyAlias,
    encryptedDataKey: metadata.encryptedDataKey,
    encryptionIv: metadata.encryptionIv,
    encryptionAuthTag: metadata.encryptionAuthTag,
    payloadIntegrityHash: metadata.payloadIntegrityHash
  };
}

/**
 * Decrypt AI log payload
 * 
 * @param encrypted - Encryption metadata from database
 * @param tenantId - Tenant ID for key isolation
 * @returns Decrypted payload (parsed as JSON object)
 */
export async function decryptAILogPayload(
  encrypted: AILogEncryptionMetadata,
  tenantId: string
): Promise<object> {
  const metadata: EncryptionMetadata = {
    encryptedPayload: encrypted.encryptedPayload,
    kmsKeyAlias: encrypted.kmsKeyAlias,
    encryptedDataKey: encrypted.encryptedDataKey,
    encryptionIv: encrypted.encryptionIv,
    encryptionAuthTag: encrypted.encryptionAuthTag,
    payloadIntegrityHash: encrypted.payloadIntegrityHash
  };

  const plaintext = await envelopeEncryption.decryptWithFallback(
    metadata,
    tenantId,
    'ai_logs'
  );

  return JSON.parse(plaintext.toString('utf8'));
}

/**
 * Encrypt OAuth access token
 * 
 * @param token - The access token to encrypt
 * @param tenantId - Tenant ID for key isolation
 * @param userId - User ID (for audit trail)
 * @returns Encryption metadata for database storage
 */
export async function encryptOAuthToken(
  token: string,
  tenantId: string,
  userId: string
): Promise<TokenEncryptionMetadata> {
  const metadata = await envelopeEncryption.encrypt(
    token,
    tenantId,
    'oauth_tokens'
  );

  return {
    encryptedToken: metadata.encryptedPayload,
    kmsKeyAlias: metadata.kmsKeyAlias,
    encryptedDek: metadata.encryptedDataKey,
    iv: metadata.encryptionIv,
    authTag: metadata.encryptionAuthTag,
    payloadIntegrityHash: metadata.payloadIntegrityHash
  };
}

/**
 * Decrypt OAuth token
 * 
 * @param encrypted - Encryption metadata from database
 * @param tenantId - Tenant ID for key isolation
 * @returns Decrypted token
 */
export async function decryptOAuthToken(
  encrypted: TokenEncryptionMetadata,
  tenantId: string
): Promise<string> {
  const metadata: EncryptionMetadata = {
    encryptedPayload: encrypted.encryptedToken,
    kmsKeyAlias: encrypted.kmsKeyAlias,
    encryptedDataKey: encrypted.encryptedDek,
    encryptionIv: encrypted.iv,
    encryptionAuthTag: encrypted.authTag,
    payloadIntegrityHash: encrypted.payloadIntegrityHash
  };

  const plaintext = await envelopeEncryption.decryptWithFallback(
    metadata,
    tenantId,
    'oauth_tokens'
  );

  return plaintext.toString('utf8');
}

/**
 * Encrypt document content
 * 
 * @param content - Document content (binary or text)
 * @param tenantId - Tenant ID for key isolation
 * @returns Encryption metadata
 */
export async function encryptDocument(
  content: Buffer | string,
  tenantId: string
): Promise<EncryptionMetadata> {
  return envelopeEncryption.encrypt(content, tenantId, 'documents');
}

/**
 * Decrypt document content
 * 
 * @param encrypted - Encryption metadata
 * @param tenantId - Tenant ID for key isolation
 * @returns Decrypted content
 */
export async function decryptDocument(
  encrypted: EncryptionMetadata,
  tenantId: string
): Promise<Buffer> {
  return envelopeEncryption.decryptWithFallback(encrypted, tenantId, 'documents');
}

/**
 * Rotate encryption key for a tenant/purpose
 * This will create a new key version and mark the old one as deprecated
 * Existing encrypted data can still be decrypted with old keys
 * 
 * @param tenantId - Tenant ID
 * @param purpose - Encryption purpose
 * @param reason - Reason for rotation
 */
export async function rotateEncryptionKey(
  tenantId: string,
  purpose: EncryptionPurpose,
  reason: string = 'scheduled'
): Promise<void> {
  await keyManager.rotateKey(tenantId, purpose, reason);
}

/**
 * Check if KMS is properly configured
 * Useful for health checks and startup validation
 */
export async function checkKMSHealth(): Promise<{
  configured: boolean;
  platform: string;
  adapter: string;
  masterKeySet: boolean;
  error?: string;
}> {
  try {
    const summary = await kmsConfig.getSummary();
    
    return {
      configured: true,
      platform: summary.platform,
      adapter: summary.defaultAdapter,
      masterKeySet: summary.masterKeySet
    };
  } catch (error) {
    return {
      configured: false,
      platform: 'unknown',
      adapter: 'none',
      masterKeySet: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Initialize KMS (call on server startup)
 * Validates configuration and logs summary
 */
export async function initializeKMS(): Promise<void> {
  const health = await checkKMSHealth();
  
  if (!health.configured) {
    console.error('❌ KMS NOT CONFIGURED:', health.error);
    console.error('   Please set MASTER_ENCRYPTION_KEY environment variable');
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    throw new Error('KMS not configured');
  }

  console.log('✅ KMS Initialized');
  console.log(`   Platform: ${health.platform}`);
  console.log(`   Adapter: ${health.adapter}`);
  console.log(`   Master Key: ${health.masterKeySet ? 'Set' : 'NOT SET'}`);
}
