/**
 * Key Manager - DEK Lifecycle Management
 * Handles creation, rotation, and retrieval of Data Encryption Keys
 * Implements caching for performance
 */

import { db } from '../db';
import { encryptionKeys, type EncryptionKey } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { kmsConfig } from './config';
import { dekCache } from './utils/cache';
import { generateKey, sha256, toBase64, fromBase64 } from './utils/crypto';

export class KeyManager {
  /**
   * Get active DEK for tenant + purpose
   * Creates new DEK if none exists
   * Caches decrypted DEK in memory (5min TTL)
   */
  async getActiveKey(tenantId: string, purpose: string): Promise<EncryptionKey> {
    // Try to find existing active key
    const activeKeys = await db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose),
          eq(encryptionKeys.status, 'active')
        )
      )
      .limit(1);

    if (activeKeys.length > 0) {
      return activeKeys[0];
    }

    // No active key exists, create one
    return this.createKey(tenantId, purpose);
  }

  /**
   * Find DEK by encrypted value (for decryption after rotation)
   * This allows us to decrypt data encrypted with old keys
   */
  async findDEKByEncryptedValue(
    encryptedDEK: string,
    tenantId: string,
    purpose: string
  ): Promise<EncryptionKey | null> {
    const keys = await db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose),
          eq(encryptionKeys.encryptedDEK, encryptedDEK)
        )
      )
      .limit(1);

    return keys.length > 0 ? keys[0] : null;
  }

  /**
   * Get decrypted DEK (with caching)
   * 
   * @param tenantId - Tenant ID for key isolation
   * @param purpose - Encryption purpose
   * @param version - Optional specific version to fetch
   * @param encryptedDEK - Optional encrypted DEK value to match (for finding exact key after rotation)
   */
  async getDecryptedDEK(
    tenantId: string,
    purpose: string,
    version?: number,
    encryptedDEK?: string
  ): Promise<Buffer> {
    // Get key metadata from database
    let keyRecord: EncryptionKey;
    
    if (encryptedDEK) {
      // Find key by encrypted DEK value (for decryption after rotation)
      const foundKey = await this.findDEKByEncryptedValue(encryptedDEK, tenantId, purpose);
      if (!foundKey) {
        throw new Error(`DEK not found: tenant=${tenantId}, purpose=${purpose}, encryptedDEK=${encryptedDEK.substring(0, 20)}...`);
      }
      keyRecord = foundKey;
      
      // Check cache with the found version
      const cached = dekCache.get(tenantId, purpose, keyRecord.version);
      if (cached) {
        return cached;
      }
    } else if (version !== undefined) {
      // Check cache first for specific version
      const cached = dekCache.get(tenantId, purpose, version);
      if (cached) {
        return cached;
      }
      
      // Get specific version
      const keys = await db
        .select()
        .from(encryptionKeys)
        .where(
          and(
            eq(encryptionKeys.tenantId, tenantId),
            eq(encryptionKeys.purpose, purpose),
            eq(encryptionKeys.version, version)
          )
        )
        .limit(1);
      
      if (keys.length === 0) {
        throw new Error(`DEK not found: tenant=${tenantId}, purpose=${purpose}, version=${version}`);
      }
      keyRecord = keys[0];
    } else {
      // Check cache for active key
      // Note: We can't reliably cache "active" without version since active key can change
      // Get active key
      keyRecord = await this.getActiveKey(tenantId, purpose);
      
      // Check cache with active key's version
      const cached = dekCache.get(tenantId, purpose, keyRecord.version);
      if (cached) {
        return cached;
      }
    }

    // Decrypt DEK using KMS adapter
    const adapter = await kmsConfig.getDefaultAdapter();
    const decryptedDEK = await adapter.unwrapKey(
      keyRecord.encryptedDEK,
      keyRecord.kmsKeyAlias
    );

    // Verify fingerprint
    const fingerprint = sha256(decryptedDEK);
    if (fingerprint !== keyRecord.dekFingerprint) {
      throw new Error('DEK fingerprint mismatch - possible tampering detected');
    }

    // Cache the decrypted DEK with version
    dekCache.set(tenantId, purpose, decryptedDEK, keyRecord.version);

    // Update usage tracking
    await db
      .update(encryptionKeys)
      .set({
        encryptionCount: sql`${encryptionKeys.encryptionCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(encryptionKeys.id, keyRecord.id));

    return decryptedDEK;
  }

  /**
   * Create new DEK for tenant + purpose
   * 1. Generate random 256-bit key
   * 2. Wrap with KMS adapter
   * 3. Compute fingerprint (SHA-256)
   * 4. Insert into encryption_keys table
   */
  async createKey(
    tenantId: string,
    purpose: string,
    expiresInDays: number = 90
  ): Promise<EncryptionKey> {
    // Generate new DEK
    const dek = generateKey();
    const fingerprint = sha256(dek);

    // Get KMS adapter
    const adapter = await kmsConfig.getDefaultAdapter();
    
    // Determine key alias
    const keyAlias = adapter.name === 'aws-kms' 
      ? process.env.AWS_KMS_KEY_ID || 'alias/default'
      : 'env:master';

    // Wrap DEK with master key
    const { encryptedKey, keyAlias: actualKeyAlias } = await adapter.wrapKey(dek, keyAlias);

    // Get next version number
    const existingKeys = await db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose)
        )
      )
      .orderBy(sql`${encryptionKeys.version} DESC`)
      .limit(1);

    const nextVersion = existingKeys.length > 0 
      ? (existingKeys[0].version || 0) + 1 
      : 1;

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Insert into database
    const newKey = await db
      .insert(encryptionKeys)
      .values({
        tenantId,
        purpose,
        version: nextVersion,
        kmsKeyAlias: actualKeyAlias,
        encryptedDEK: encryptedKey,
        dekAlgorithm: 'AES-256-GCM',
        dekFingerprint: fingerprint,
        status: 'active',
        activatedAt: new Date(),
        expiresAt,
        rotationReason: nextVersion === 1 ? 'initial' : undefined
      })
      .returning();

    // Cache the decrypted DEK
    dekCache.set(tenantId, purpose, dek, nextVersion);

    return newKey[0];
  }

  /**
   * Rotate key to new version
   * 1. Mark current key as 'rotating'
   * 2. Create new key (version + 1)
   * 3. Mark new key as 'active'
   * 4. Mark old key as 'deprecated'
   */
  async rotateKey(
    tenantId: string,
    purpose: string,
    reason: string = 'scheduled'
  ): Promise<EncryptionKey> {
    // Get current active key
    const currentKeys = await db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose),
          eq(encryptionKeys.status, 'active')
        )
      )
      .limit(1);

    if (currentKeys.length === 0) {
      // No active key exists, just create a new one
      return this.createKey(tenantId, purpose);
    }

    const currentKey = currentKeys[0];

    // Mark current key as rotating
    await db
      .update(encryptionKeys)
      .set({ status: 'rotating' })
      .where(eq(encryptionKeys.id, currentKey.id));

    try {
      // Create new key
      const newKey = await this.createKey(tenantId, purpose);

      // Update new key to reference previous key
      await db
        .update(encryptionKeys)
        .set({ previousKeyId: currentKey.id })
        .where(eq(encryptionKeys.id, newKey.id));

      // Mark old key as deprecated
      await db
        .update(encryptionKeys)
        .set({
          status: 'deprecated',
          rotatedAt: new Date(),
          rotationReason: reason
        })
        .where(eq(encryptionKeys.id, currentKey.id));

      // Clear cache for this tenant/purpose (force re-fetch)
      dekCache.delete(tenantId, purpose, currentKey.version);

      return newKey;
    } catch (error) {
      // Rollback: restore old key to active
      await db
        .update(encryptionKeys)
        .set({ status: 'active' })
        .where(eq(encryptionKeys.id, currentKey.id));
      
      throw error;
    }
  }

  /**
   * Revoke a key (for security incidents)
   */
  async revokeKey(
    tenantId: string,
    purpose: string,
    version: number,
    reason: string
  ): Promise<void> {
    await db
      .update(encryptionKeys)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        rotationReason: reason
      })
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose),
          eq(encryptionKeys.version, version)
        )
      );

    // Clear from cache
    dekCache.delete(tenantId, purpose, version);
  }

  /**
   * Get all keys for a tenant/purpose (for audit)
   */
  async getKeyHistory(
    tenantId: string,
    purpose: string
  ): Promise<EncryptionKey[]> {
    return db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.tenantId, tenantId),
          eq(encryptionKeys.purpose, purpose)
        )
      )
      .orderBy(sql`${encryptionKeys.version} DESC`);
  }
}

// Singleton instance
export const keyManager = new KeyManager();
