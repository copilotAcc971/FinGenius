/**
 * Low-Level Cryptographic Utilities
 * Uses Node.js built-in crypto module (no external dependencies)
 * Implements AES-256-GCM for encryption and SHA-256 for hashing
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM (recommended)
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Generate a random encryption key (256-bit)
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a random initialization vector (96-bit for GCM)
 */
export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Compute SHA-256 hash of data
 * Used for key fingerprints and integrity verification
 */
export function sha256(data: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: { ciphertext, iv, authTag }
 */
export function encryptAES256GCM(
  plaintext: Buffer | string,
  key: Buffer,
  iv: Buffer
): {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const plaintextBuffer = Buffer.isBuffer(plaintext) 
    ? plaintext 
    : Buffer.from(plaintext, 'utf8');
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return { ciphertext, iv, authTag };
}

/**
 * Decrypt data using AES-256-GCM
 * Verifies authentication tag to ensure data integrity
 */
export function decryptAES256GCM(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return plaintext;
}

/**
 * Encode Buffer to base64 string (for database storage)
 */
export function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Decode base64 string to Buffer
 */
export function fromBase64(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Encode Buffer to hex string (for IVs and auth tags)
 */
export function toHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

/**
 * Decode hex string to Buffer
 */
export function fromHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Constant-time buffer comparison to prevent timing attacks
 */
export function constantTimeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validate master encryption key format
 * Should be 32-byte hex string (64 hex characters)
 */
export function validateMasterKey(key: string): boolean {
  // Must be 64 hex characters (32 bytes)
  return /^[0-9a-f]{64}$/i.test(key);
}

/**
 * Generate a master encryption key (for initial setup)
 * Returns 32-byte hex string
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
