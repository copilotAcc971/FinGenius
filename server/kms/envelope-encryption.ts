/**
 * Envelope Encryption Service
 * Implements envelope encryption pattern:
 * 1. Encrypt data with DEK (Data Encryption Key)
 * 2. DEK is encrypted with master key (stored in encryption_keys table)
 * 
 * This provides:
 * - Key rotation without re-encrypting all data
 * - Separation of key management from data encryption
 * - Better performance (DEKs are cached)
 */

import { keyManager } from './key-manager';
import {
  encryptAES256GCM,
  decryptAES256GCM,
  generateIV,
  sha256,
  toBase64,
  fromBase64,
  toHex,
  fromHex
} from './utils/crypto';

export interface EncryptionMetadata {
  encryptedPayload: string; // base64
  kmsKeyAlias: string;
  encryptedDataKey: string; // base64 (from encryption_keys table)
  encryptionIv: string; // hex
  encryptionAuthTag: string; // hex
  payloadIntegrityHash: string; // hex (SHA-256 of plaintext)
}

export type EncryptionPurpose = 'ai_logs' | 'oauth_tokens' | 'documents' | 'webhook_signatures';

export class EnvelopeEncryptionService {
  /**
   * Encrypt plaintext using envelope encryption
   * 1. Get active DEK for tenant + purpose
   * 2. Generate random IV
   * 3. Encrypt with AES-256-GCM
   * 4. Compute SHA-256 integrity hash
   */
  async encrypt(
    plaintext: Buffer | string,
    tenantId: string,
    purpose: EncryptionPurpose
  ): Promise<EncryptionMetadata> {
    // Convert string to Buffer if needed
    const plaintextBuffer = Buffer.isBuffer(plaintext)
      ? plaintext
      : Buffer.from(plaintext, 'utf8');

    // Get active DEK
    const keyRecord = await keyManager.getActiveKey(tenantId, purpose);
    const dek = await keyManager.getDecryptedDEK(tenantId, purpose);

    // Generate random IV
    const iv = generateIV();

    // Encrypt with AES-256-GCM
    const { ciphertext, authTag } = encryptAES256GCM(plaintextBuffer, dek, iv);

    // Compute integrity hash (SHA-256 of plaintext)
    const integrityHash = sha256(plaintextBuffer);

    return {
      encryptedPayload: toBase64(ciphertext),
      kmsKeyAlias: keyRecord.kmsKeyAlias,
      encryptedDataKey: keyRecord.encryptedDEK, // Reference to encryption_keys table
      encryptionIv: toHex(iv),
      encryptionAuthTag: toHex(authTag),
      payloadIntegrityHash: integrityHash
    };
  }

  /**
   * Decrypt ciphertext using envelope encryption
   * 1. Lookup DEK by encryptedDataKey reference (finds exact key version used for encryption)
   * 2. Decrypt DEK if not cached
   * 3. Verify integrity hash
   * 4. Decrypt with AES-256-GCM + verify auth tag
   * 
   * CRITICAL FIX: Uses encrypted.encryptedDataKey to find the EXACT DEK that was used to encrypt,
   * not the current active key. This ensures decryption works after key rotation.
   */
  async decrypt(
    encrypted: EncryptionMetadata,
    tenantId: string,
    purpose: EncryptionPurpose
  ): Promise<Buffer> {
    // CRITICAL: Use the encryptedDataKey to find the exact DEK that encrypted this data
    // This ensures we can decrypt data encrypted with old keys after rotation
    const dek = await keyManager.getDecryptedDEK(
      tenantId,
      purpose,
      undefined, // version (not needed when we have encryptedDataKey)
      encrypted.encryptedDataKey // Match by encrypted DEK value
    );

    // Decode encrypted data
    const ciphertext = fromBase64(encrypted.encryptedPayload);
    const iv = fromHex(encrypted.encryptionIv);
    const authTag = fromHex(encrypted.encryptionAuthTag);

    // Decrypt with AES-256-GCM
    const plaintext = decryptAES256GCM(ciphertext, dek, iv, authTag);

    // Verify integrity hash (if provided)
    if (encrypted.payloadIntegrityHash && encrypted.payloadIntegrityHash.length > 0) {
      const actualHash = sha256(plaintext);
      if (actualHash !== encrypted.payloadIntegrityHash) {
        throw new Error('Integrity verification failed - payload may have been tampered with');
      }
    }

    return plaintext;
  }

  /**
   * Decrypt with fallback to previous key versions
   * Useful during key rotation window
   */
  async decryptWithFallback(
    encrypted: EncryptionMetadata,
    tenantId: string,
    purpose: EncryptionPurpose
  ): Promise<Buffer> {
    try {
      // Try with active key first
      return await this.decrypt(encrypted, tenantId, purpose);
    } catch (error) {
      // If decryption fails, try previous versions
      const keyHistory = await keyManager.getKeyHistory(tenantId, purpose);
      
      for (const keyRecord of keyHistory) {
        if (keyRecord.status === 'deprecated' || keyRecord.status === 'rotating') {
          try {
            const dek = await keyManager.getDecryptedDEK(
              tenantId,
              purpose,
              keyRecord.version
            );

            const ciphertext = fromBase64(encrypted.encryptedPayload);
            const iv = fromHex(encrypted.encryptionIv);
            const authTag = fromHex(encrypted.encryptionAuthTag);

            const plaintext = decryptAES256GCM(ciphertext, dek, iv, authTag);

            // Verify integrity (if provided)
            if (encrypted.payloadIntegrityHash && encrypted.payloadIntegrityHash.length > 0) {
              const actualHash = sha256(plaintext);
              if (actualHash === encrypted.payloadIntegrityHash) {
                return plaintext;
              }
            } else {
              // No integrity hash provided, just return plaintext after successful AES-GCM decryption
              return plaintext;
            }
          } catch {
            // Continue to next version
            continue;
          }
        }
      }

      // All versions failed
      throw new Error(
        `Failed to decrypt with all available key versions. Original error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Re-encrypt data with new key (for key rotation)
   */
  async reEncrypt(
    encrypted: EncryptionMetadata,
    tenantId: string,
    purpose: EncryptionPurpose
  ): Promise<EncryptionMetadata> {
    // Decrypt with old key (may use fallback)
    const plaintext = await this.decryptWithFallback(encrypted, tenantId, purpose);

    // Encrypt with new active key
    return this.encrypt(plaintext, tenantId, purpose);
  }
}

// Singleton instance
export const envelopeEncryption = new EnvelopeEncryptionService();
