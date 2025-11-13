import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_KEY_VERSION = 'v1';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

export class TokenEncryption {
  private currentKeyVersion: string = CURRENT_KEY_VERSION;
  private encryptionKeys: Map<string, Buffer> = new Map();

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    if (this.isProductionMode()) {
      console.log('[TokenEncryption] Running in PRODUCTION mode (KMS-based encryption)');
    } else {
      console.log('[TokenEncryption] Running in DEVELOPMENT mode (environment variable encryption)');
      this.loadDevKeys();
    }
  }

  private loadDevKeys(): void {
    const keyV1 = process.env.OPEN_BANKING_ENCRYPTION_KEY;
    
    if (!keyV1) {
      const generatedKey = this.generateEncryptionKey();
      console.warn(
        '\n⚠️  WARNING: OPEN_BANKING_ENCRYPTION_KEY not found in environment variables.\n' +
        '   A temporary key has been generated for this session.\n' +
        `   For production use, set: OPEN_BANKING_ENCRYPTION_KEY=${generatedKey}\n`
      );
      this.encryptionKeys.set('v1', Buffer.from(generatedKey, 'hex'));
    } else {
      try {
        const keyBuffer = Buffer.from(keyV1, 'hex');
        if (keyBuffer.length !== KEY_LENGTH) {
          throw new Error(
            `Invalid key length: expected ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), ` +
            `got ${keyBuffer.length} bytes`
          );
        }
        this.encryptionKeys.set('v1', keyBuffer);
      } catch (error) {
        throw new Error(
          `Failed to load OPEN_BANKING_ENCRYPTION_KEY: ${error instanceof Error ? error.message : 'Invalid format'}. ` +
          `Key must be a ${KEY_LENGTH * 2}-character hex string. Generate one with: openssl rand -hex 32`
        );
      }
    }

    const keyV2 = process.env.OPEN_BANKING_ENCRYPTION_KEY_V2;
    if (keyV2) {
      try {
        const keyBuffer = Buffer.from(keyV2, 'hex');
        if (keyBuffer.length !== KEY_LENGTH) {
          throw new Error(`Invalid v2 key length: expected ${KEY_LENGTH} bytes`);
        }
        this.encryptionKeys.set('v2', keyBuffer);
        console.log('[TokenEncryption] Loaded encryption key version: v2');
      } catch (error) {
        console.error('[TokenEncryption] Failed to load v2 key:', error);
      }
    }
  }

  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty plaintext');
    }

    const key = await this.getEncryptionKey(this.currentKeyVersion);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length} bytes`
      );
    }

    console.log(
      `[TokenEncryption] Encrypted token (version: ${this.currentKeyVersion}, ` +
      `plaintext length: ${plaintext.length} chars, ciphertext length: ${encrypted.length} bytes)`
    );

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.currentKeyVersion
    };
  }

  async decrypt(
    ciphertext: string,
    iv: string,
    authTag: string,
    keyVersion: string
  ): Promise<string> {
    if (!ciphertext || !iv || !authTag || !keyVersion) {
      throw new Error(
        'Missing required decryption parameters. ' +
        'All of ciphertext, iv, authTag, and keyVersion are required.'
      );
    }

    let ivBuffer: Buffer;
    let authTagBuffer: Buffer;
    let ciphertextBuffer: Buffer;

    try {
      ivBuffer = Buffer.from(iv, 'base64');
      authTagBuffer = Buffer.from(authTag, 'base64');
      ciphertextBuffer = Buffer.from(ciphertext, 'base64');
    } catch (error) {
      throw new Error(
        'Invalid Base64 encoding in encryption parameters. ' +
        'All parameters must be valid Base64 strings.'
      );
    }

    if (ivBuffer.length !== IV_LENGTH) {
      throw new Error(
        `Invalid IV length: expected ${IV_LENGTH} bytes, got ${ivBuffer.length} bytes. ` +
        'The IV may be corrupted or from a different encryption version.'
      );
    }

    if (authTagBuffer.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTagBuffer.length} bytes. ` +
        'The auth tag may be corrupted.'
      );
    }

    const key = await this.getEncryptionKey(keyVersion);
    
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      let decrypted = decipher.update(ciphertextBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const plaintext = decrypted.toString('utf8');

      console.log(
        `[TokenEncryption] Decrypted token (version: ${keyVersion}, ` +
        `ciphertext length: ${ciphertextBuffer.length} bytes, plaintext length: ${plaintext.length} chars)`
      );

      return plaintext;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error(
          'Decryption failed: Authentication tag verification failed. ' +
          'The data may have been tampered with or the wrong key/version was used.'
        );
      }
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'The ciphertext may be corrupted or encrypted with a different key.'
      );
    }
  }

  async rotateKey(): Promise<void> {
    console.log('[TokenEncryption] Starting key rotation process...');

    const oldVersion = this.currentKeyVersion;
    const newVersion = this.getNextKeyVersion(oldVersion);

    if (this.isProductionMode()) {
      console.log(
        `[TokenEncryption] Production mode: Key rotation requires KMS integration.\n` +
        `  Current version: ${oldVersion}\n` +
        `  Next version: ${newVersion}\n` +
        `  Please implement KMS key rotation in your production environment.`
      );
      throw new Error(
        'Key rotation in production mode requires KMS integration. ' +
        'This feature is not yet implemented. Please rotate keys through your KMS provider.'
      );
    }

    const newKeyEnvVar = `OPEN_BANKING_ENCRYPTION_KEY_${newVersion.toUpperCase()}`;
    const newKeyValue = process.env[newKeyEnvVar];

    if (!newKeyValue) {
      const generatedKey = this.generateEncryptionKey();
      console.log(
        `\n[TokenEncryption] Key rotation preparation:\n` +
        `  1. Set environment variable: ${newKeyEnvVar}=${generatedKey}\n` +
        `  2. Restart the application\n` +
        `  3. Run re-encryption script to migrate existing tokens to ${newVersion}\n` +
        `  4. Update CURRENT_KEY_VERSION to "${newVersion}" in code\n`
      );
      throw new Error(
        `Cannot rotate to version ${newVersion}: Environment variable ${newKeyEnvVar} not found. ` +
        'Please set the new key in environment variables first.'
      );
    }

    const newKeyBuffer = Buffer.from(newKeyValue, 'hex');
    if (newKeyBuffer.length !== KEY_LENGTH) {
      throw new Error(
        `Invalid ${newVersion} key length: expected ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`
      );
    }

    this.encryptionKeys.set(newVersion, newKeyBuffer);
    this.currentKeyVersion = newVersion;

    console.log(
      `[TokenEncryption] ✓ Key rotation successful\n` +
      `  Old version: ${oldVersion}\n` +
      `  New version: ${newVersion}\n` +
      `  Note: Existing encrypted data still uses ${oldVersion}. ` +
      `Run re-encryption script to migrate.`
    );
  }

  private async getEncryptionKey(version: string): Promise<Buffer> {
    if (this.isProductionMode()) {
      return await this.getKMSKey(version);
    } else {
      return this.getDevKey(version);
    }
  }

  private getDevKey(version: string): Buffer {
    const key = this.encryptionKeys.get(version);
    
    if (!key) {
      throw new Error(
        `Encryption key version "${version}" not found. ` +
        `Available versions: ${Array.from(this.encryptionKeys.keys()).join(', ')}. ` +
        `Set OPEN_BANKING_ENCRYPTION_KEY_${version.toUpperCase()} in environment variables.`
      );
    }
    
    return key;
  }

  private async getKMSKey(version: string): Promise<Buffer> {
    console.log(`[TokenEncryption] KMS integration not yet implemented for version ${version}`);
    
    throw new Error(
      'Production KMS integration not yet implemented. ' +
      'This is a placeholder for AWS KMS envelope encryption. ' +
      'In production, this method will:\n' +
      '  1. Retrieve the encrypted DEK (Data Encryption Key) from secure storage\n' +
      '  2. Decrypt the DEK using AWS KMS master key\n' +
      '  3. Return the decrypted DEK for AES-256-GCM operations\n' +
      'For now, use development mode with OPEN_BANKING_ENCRYPTION_KEY.'
    );
  }

  private getNextKeyVersion(currentVersion: string): string {
    const versionMatch = currentVersion.match(/^v(\d+)$/);
    
    if (!versionMatch) {
      throw new Error(
        `Invalid key version format: "${currentVersion}". ` +
        'Expected format: "v1", "v2", etc.'
      );
    }
    
    const currentNum = parseInt(versionMatch[1], 10);
    return `v${currentNum + 1}`;
  }

  isProductionMode(): boolean {
    return !!process.env.KMS_KEY_ID;
  }

  generateEncryptionKey(): string {
    const key = crypto.randomBytes(KEY_LENGTH);
    return key.toString('hex');
  }
}

export function generateEncryptionKey(): string {
  const encryption = new TokenEncryption();
  return encryption.generateEncryptionKey();
}

export function isProductionMode(): boolean {
  const encryption = new TokenEncryption();
  return encryption.isProductionMode();
}

export const tokenEncryption = new TokenEncryption();
