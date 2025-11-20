/**
 * Environment Variable KMS Adapter
 * Uses MASTER_ENCRYPTION_KEY from environment variable
 * This is the DEFAULT adapter (always available)
 * 
 * Security: Master key is stored in environment variable, not in database
 * Wraps DEKs using AES-256-GCM with the master key
 */

import {
  KMSAdapter,
  KMSAdapterError,
  KMSAdapterNotAvailableError,
  KMSAdapterConfigError
} from './base';
import {
  encryptAES256GCM,
  decryptAES256GCM,
  generateIV,
  toBase64,
  fromBase64,
  toHex,
  fromHex,
  validateMasterKey
} from '../utils/crypto';

export class EnvironmentKMSAdapter implements KMSAdapter {
  name = 'environment';
  private masterKey: Buffer | null = null;

  /**
   * Get master encryption key from environment
   */
  private getMasterKey(): Buffer {
    if (this.masterKey) {
      return this.masterKey;
    }

    const keyHex = process.env.MASTER_ENCRYPTION_KEY;
    
    if (!keyHex) {
      throw new KMSAdapterNotAvailableError(
        this.name,
        'MASTER_ENCRYPTION_KEY environment variable not set'
      );
    }

    if (!validateMasterKey(keyHex)) {
      throw new KMSAdapterConfigError(
        this.name,
        'MASTER_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
      );
    }

    this.masterKey = fromHex(keyHex);
    return this.masterKey;
  }

  /**
   * Wrap (encrypt) a DEK with the master key
   */
  async wrapKey(plaintext: Buffer, keyAlias: string): Promise<{
    encryptedKey: string;
    keyAlias: string;
  }> {
    try {
      const masterKey = this.getMasterKey();
      const iv = generateIV();
      
      const { ciphertext, authTag } = encryptAES256GCM(plaintext, masterKey, iv);
      
      // Package: IV + AuthTag + Ciphertext (all base64)
      const wrapped = JSON.stringify({
        iv: toHex(iv),
        authTag: toHex(authTag),
        ciphertext: toBase64(ciphertext),
        version: 1 // For future algorithm changes
      });
      
      return {
        encryptedKey: toBase64(Buffer.from(wrapped, 'utf8')),
        keyAlias: keyAlias || 'env:master'
      };
    } catch (error) {
      if (error instanceof KMSAdapterError) {
        throw error;
      }
      throw new KMSAdapterError(
        `Failed to wrap key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Unwrap (decrypt) a DEK with the master key
   */
  async unwrapKey(encryptedKey: string, keyAlias: string): Promise<Buffer> {
    try {
      const masterKey = this.getMasterKey();
      
      // Decode the package
      const packageJson = Buffer.from(encryptedKey, 'base64').toString('utf8');
      const pkg = JSON.parse(packageJson);
      
      if (pkg.version !== 1) {
        throw new Error(`Unsupported key version: ${pkg.version}`);
      }
      
      const iv = fromHex(pkg.iv);
      const authTag = fromHex(pkg.authTag);
      const ciphertext = fromBase64(pkg.ciphertext);
      
      const plaintext = decryptAES256GCM(ciphertext, masterKey, iv, authTag);
      
      return plaintext;
    } catch (error) {
      if (error instanceof KMSAdapterError) {
        throw error;
      }
      throw new KMSAdapterError(
        `Failed to unwrap key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if adapter is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      this.getMasterKey();
      return true;
    } catch {
      return false;
    }
  }
}
