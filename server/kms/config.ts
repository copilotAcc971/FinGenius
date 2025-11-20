/**
 * KMS Configuration Resolver
 * Detects platform and selects appropriate KMS adapter
 * Supports: Replit, AWS, self-hosted environments
 */

import { KMSAdapter } from './adapters/base';
import { EnvironmentKMSAdapter } from './adapters/environment';
import { AWSKMSAdapter } from './adapters/aws-kms';

export type Platform = 'replit' | 'aws' | 'self-hosted';
export type AdapterType = 'environment' | 'aws-kms';

export class KMSConfig {
  private platform: Platform | null = null;
  private defaultAdapter: KMSAdapter | null = null;

  /**
   * Detect current platform
   */
  getPlatform(): Platform {
    if (this.platform) {
      return this.platform;
    }

    // Replit detection
    if (process.env.REPL_ID || process.env.REPLIT_DB_URL) {
      this.platform = 'replit';
      return this.platform;
    }

    // AWS detection (Lambda, EC2, ECS)
    if (
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.AWS_REGION
    ) {
      this.platform = 'aws';
      return this.platform;
    }

    // Default to self-hosted
    this.platform = 'self-hosted';
    return this.platform;
  }

  /**
   * Get master encryption key from environment
   */
  getMasterKey(): string {
    const key = process.env.MASTER_ENCRYPTION_KEY;
    
    if (!key) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY environment variable not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    return key;
  }

  /**
   * Get AWS configuration if available
   */
  getAWSConfig(): {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    kmsKeyId?: string;
  } | null {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    
    if (!region) {
      return null;
    }

    return {
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      kmsKeyId: process.env.AWS_KMS_KEY_ID || process.env.KMS_KEY_ARN
    };
  }

  /**
   * Get default KMS adapter based on platform and configuration
   */
  async getDefaultAdapter(): Promise<KMSAdapter> {
    if (this.defaultAdapter) {
      return this.defaultAdapter;
    }

    // Check if user explicitly set adapter preference
    const preferredAdapter = process.env.KMS_ADAPTER as AdapterType | undefined;
    
    if (preferredAdapter === 'aws-kms') {
      const awsAdapter = new AWSKMSAdapter();
      if (await awsAdapter.isAvailable()) {
        this.defaultAdapter = awsAdapter;
        return awsAdapter;
      }
      console.warn('AWS KMS adapter requested but not available, falling back to environment adapter');
    }

    // Try AWS KMS on AWS platform (if not explicitly disabled)
    if (preferredAdapter !== 'environment') {
      const platform = this.getPlatform();
      
      if (platform === 'aws') {
        const awsAdapter = new AWSKMSAdapter();
        if (await awsAdapter.isAvailable()) {
          this.defaultAdapter = awsAdapter;
          return awsAdapter;
        }
      }
    }

    // Default to environment adapter
    const envAdapter = new EnvironmentKMSAdapter();
    if (!await envAdapter.isAvailable()) {
      throw new Error(
        'No KMS adapter available. Please set MASTER_ENCRYPTION_KEY environment variable.'
      );
    }

    this.defaultAdapter = envAdapter;
    return envAdapter;
  }

  /**
   * Get adapter by name
   */
  async getAdapter(name: AdapterType): Promise<KMSAdapter> {
    switch (name) {
      case 'environment':
        return new EnvironmentKMSAdapter();
      case 'aws-kms':
        return new AWSKMSAdapter();
      default:
        throw new Error(`Unknown KMS adapter: ${name}`);
    }
  }

  /**
   * Check if KMS is properly configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const adapter = await this.getDefaultAdapter();
      return await adapter.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Get configuration summary (for debugging)
   */
  async getSummary(): Promise<{
    platform: Platform;
    masterKeySet: boolean;
    awsConfigured: boolean;
    defaultAdapter: string;
  }> {
    const platform = this.getPlatform();
    const masterKeySet = !!process.env.MASTER_ENCRYPTION_KEY;
    const awsConfig = this.getAWSConfig();
    const adapter = await this.getDefaultAdapter();

    return {
      platform,
      masterKeySet,
      awsConfigured: !!awsConfig?.region,
      defaultAdapter: adapter.name
    };
  }
}

// Singleton instance
export const kmsConfig = new KMSConfig();
