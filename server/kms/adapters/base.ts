/**
 * KMSAdapter Interface
 * Defines the contract for Key Management Service adapters
 * Supports multiple backends: environment variables, AWS KMS, etc.
 */

export interface KMSAdapter {
  /**
   * Adapter name (for logging and identification)
   */
  name: string;
  
  /**
   * Wrap (encrypt) a Data Encryption Key with the master key
   * 
   * @param plaintext - The plaintext DEK to wrap
   * @param keyAlias - Identifier for the master key
   * @returns Encrypted key (base64) and key alias
   */
  wrapKey(plaintext: Buffer, keyAlias: string): Promise<{
    encryptedKey: string; // base64
    keyAlias: string;
  }>;
  
  /**
   * Unwrap (decrypt) a Data Encryption Key using the master key
   * 
   * @param encryptedKey - The encrypted DEK (base64)
   * @param keyAlias - Identifier for the master key
   * @returns Decrypted DEK
   */
  unwrapKey(encryptedKey: string, keyAlias: string): Promise<Buffer>;
  
  /**
   * Check if this adapter is available and properly configured
   * 
   * @returns True if adapter can be used
   */
  isAvailable(): Promise<boolean>;
}

/**
 * KMS Adapter Error
 * Base error class for all KMS adapter errors
 */
export class KMSAdapterError extends Error {
  constructor(
    message: string,
    public adapterName: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'KMSAdapterError';
  }
}

/**
 * KMS Adapter Not Available Error
 * Thrown when an adapter cannot be used
 */
export class KMSAdapterNotAvailableError extends KMSAdapterError {
  constructor(adapterName: string, reason: string) {
    super(`KMS adapter '${adapterName}' is not available: ${reason}`, adapterName);
    this.name = 'KMSAdapterNotAvailableError';
  }
}

/**
 * KMS Adapter Configuration Error
 * Thrown when an adapter is misconfigured
 */
export class KMSAdapterConfigError extends KMSAdapterError {
  constructor(adapterName: string, message: string) {
    super(`KMS adapter '${adapterName}' configuration error: ${message}`, adapterName);
    this.name = 'KMSAdapterConfigError';
  }
}
