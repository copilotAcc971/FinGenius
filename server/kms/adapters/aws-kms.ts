/**
 * AWS KMS Adapter (OPTIONAL)
 * Uses AWS KMS for key wrapping if credentials are available
 * Falls back to environment adapter if AWS is not configured
 * 
 * Detects AWS environment: Replit, AWS Lambda, EC2, etc.
 * 
 * Note: Requires @aws-sdk/client-kms package
 * If not available, gracefully degrades to environment adapter
 */

import {
  KMSAdapter,
  KMSAdapterError,
  KMSAdapterNotAvailableError
} from './base';

// Optional AWS SDK import (graceful degradation)
let KMSClient: any;
let EncryptCommand: any;
let DecryptCommand: any;

try {
  const awsSdk = await import('@aws-sdk/client-kms');
  KMSClient = awsSdk.KMSClient;
  EncryptCommand = awsSdk.EncryptCommand;
  DecryptCommand = awsSdk.DecryptCommand;
} catch {
  // AWS SDK not available - adapter will report as unavailable
}

export class AWSKMSAdapter implements KMSAdapter {
  name = 'aws-kms';
  private client: any | null = null;
  private keyId: string | null = null;

  /**
   * Get AWS KMS client (lazy initialization)
   */
  private getClient(): any {
    if (this.client) {
      return this.client;
    }

    if (!KMSClient) {
      throw new KMSAdapterNotAvailableError(
        this.name,
        '@aws-sdk/client-kms package not installed'
      );
    }

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region) {
      throw new KMSAdapterNotAvailableError(
        this.name,
        'AWS_REGION environment variable not set'
      );
    }

    const config: any = { region };

    // Use explicit credentials if provided
    if (accessKeyId && secretAccessKey) {
      config.credentials = {
        accessKeyId,
        secretAccessKey
      };
    }
    // Otherwise, use default credential chain (IAM role, etc.)

    this.client = new KMSClient(config);
    return this.client;
  }

  /**
   * Get KMS key ID from environment
   */
  private getKeyId(keyAlias?: string): string {
    if (keyAlias && keyAlias.startsWith('arn:aws:kms:')) {
      return keyAlias;
    }

    if (this.keyId) {
      return this.keyId;
    }

    const keyId = process.env.AWS_KMS_KEY_ID || process.env.KMS_KEY_ARN;
    
    if (!keyId) {
      throw new KMSAdapterNotAvailableError(
        this.name,
        'AWS_KMS_KEY_ID or KMS_KEY_ARN environment variable not set'
      );
    }

    this.keyId = keyId;
    return keyId;
  }

  /**
   * Wrap (encrypt) a DEK using AWS KMS
   */
  async wrapKey(plaintext: Buffer, keyAlias: string): Promise<{
    encryptedKey: string;
    keyAlias: string;
  }> {
    try {
      const client = this.getClient();
      const keyId = this.getKeyId(keyAlias);

      const command = new EncryptCommand({
        KeyId: keyId,
        Plaintext: plaintext
      });

      const response = await client.send(command);

      if (!response.CiphertextBlob) {
        throw new Error('AWS KMS returned no ciphertext');
      }

      return {
        encryptedKey: Buffer.from(response.CiphertextBlob).toString('base64'),
        keyAlias: keyId
      };
    } catch (error) {
      if (error instanceof KMSAdapterError) {
        throw error;
      }
      throw new KMSAdapterError(
        `AWS KMS encrypt failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Unwrap (decrypt) a DEK using AWS KMS
   */
  async unwrapKey(encryptedKey: string, keyAlias: string): Promise<Buffer> {
    try {
      const client = this.getClient();

      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
        KeyId: this.getKeyId(keyAlias)
      });

      const response = await client.send(command);

      if (!response.Plaintext) {
        throw new Error('AWS KMS returned no plaintext');
      }

      return Buffer.from(response.Plaintext);
    } catch (error) {
      if (error instanceof KMSAdapterError) {
        throw error;
      }
      throw new KMSAdapterError(
        `AWS KMS decrypt failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if AWS KMS is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!KMSClient) {
        return false;
      }

      this.getClient();
      this.getKeyId();
      
      return true;
    } catch {
      return false;
    }
  }
}
