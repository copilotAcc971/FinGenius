import crypto from 'crypto';
import { db } from '../db';
import { mcpAuthCredentials, mcpProviderTemplates, oidcConfigurations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export class ProviderService {
  private static encryptionKey = process.env.MCP_ENCRYPTION_KEY || crypto.randomBytes(32);

  static encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  static decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  static async getProviderTemplate(provider: string) {
    const template = await db
      .select()
      .from(mcpProviderTemplates)
      .where(eq(mcpProviderTemplates.provider, provider))
      .limit(1);

    return template[0] || null;
  }

  static async saveCredential(
    tenantId: string,
    userId: string,
    provider: string,
    credentialType: string,
    value: string,
    options?: {
      tokenType?: string;
      expiresAt?: Date;
      refreshToken?: string;
      scope?: string;
    }
  ) {
    const { encrypted, iv, authTag } = this.encrypt(value);

    // Combine encrypted data for storage
    const encryptedData = JSON.stringify({ encrypted, iv, authTag });

    const existing = await db
      .select()
      .from(mcpAuthCredentials)
      .where(
        and(
          eq(mcpAuthCredentials.tenantId, tenantId),
          eq(mcpAuthCredentials.userId, userId),
          eq(mcpAuthCredentials.provider, provider)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return await db
        .update(mcpAuthCredentials)
        .set({
          encryptedValue: encryptedData,
          credentialType,
          tokenType: options?.tokenType,
          expiresAt: options?.expiresAt,
          refreshToken: options?.refreshToken ? this.encrypt(options.refreshToken).encrypted : null,
          scope: options?.scope,
          isValid: true,
          updatedAt: new Date(),
        })
        .where(eq(mcpAuthCredentials.id, existing[0].id))
        .returning();
    }

    return await db
      .insert(mcpAuthCredentials)
      .values({
        tenantId,
        userId,
        provider,
        credentialType,
        encryptedValue: encryptedData,
        encryptionKeyVersion: 1,
        tokenType: options?.tokenType,
        expiresAt: options?.expiresAt,
        refreshToken: options?.refreshToken ? this.encrypt(options.refreshToken).encrypted : null,
        scope: options?.scope,
      })
      .returning();
  }

  static async getCredential(tenantId: string, userId: string, provider: string) {
    const credential = await db
      .select()
      .from(mcpAuthCredentials)
      .where(
        and(
          eq(mcpAuthCredentials.tenantId, tenantId),
          eq(mcpAuthCredentials.userId, userId),
          eq(mcpAuthCredentials.provider, provider)
        )
      )
      .limit(1);

    if (!credential[0]) return null;

    try {
      const { encrypted, iv, authTag } = JSON.parse(credential[0].encryptedValue);
      const decrypted = this.decrypt(encrypted, iv, authTag);
      return {
        ...credential[0],
        decryptedValue: decrypted,
      };
    } catch {
      return credential[0];
    }
  }

  static async initializeProviderTemplates() {
    const templates = [
      {
        provider: 'kimi',
        name: 'Kimi AI',
        description: 'High-quality Chinese LLM with vision capabilities',
        authMethod: 'none',
        requiresCredentials: false,
        apiBaseUrl: 'https://api.moonshot.cn/v1',
        costPerMilTokens: '0',
        metadata: { models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], features: ['chat', 'vision'] },
      },
      {
        provider: 'qwen',
        name: 'Qwen (Alibaba)',
        description: 'Multimodal models from Alibaba DashScope',
        authMethod: 'api_key',
        requiresCredentials: true,
        apiBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        costPerMilTokens: '0',
        metadata: { models: ['qwen-max', 'qwen-plus', 'qwen-turbo'], features: ['chat', 'vision'] },
      },
      {
        provider: 'deepseek',
        name: 'DeepSeek',
        description: 'Efficient reasoning model',
        authMethod: 'api_key',
        requiresCredentials: true,
        apiBaseUrl: 'https://api.deepseek.com/v1',
        costPerMilTokens: '0.001',
        metadata: { models: ['deepseek-chat', 'deepseek-coder'], features: ['chat', 'reasoning'] },
      },
      {
        provider: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o and other OpenAI models',
        authMethod: 'api_key',
        requiresCredentials: true,
        apiBaseUrl: 'https://api.openai.com/v1',
        costPerMilTokens: '2.50',
        metadata: { models: ['gpt-4o', 'gpt-4o-mini'], features: ['chat', 'vision', 'embeddings'] },
      },
    ];

    for (const template of templates) {
      const existing = await db
        .select()
        .from(mcpProviderTemplates)
        .where(eq(mcpProviderTemplates.provider, template.provider))
        .limit(1);

      if (!existing[0]) {
        await db.insert(mcpProviderTemplates).values({
          provider: template.provider as any,
          name: template.name,
          description: template.description,
          authMethod: template.authMethod as any,
          requiresCredentials: template.requiresCredentials,
          apiBaseUrl: template.apiBaseUrl,
          costPerMilTokens: template.costPerMilTokens,
          isOfficial: true,
          metadata: template.metadata as any,
        });
      }
    }
  }
}

// Initialize templates on import
ProviderService.initializeProviderTemplates().catch(console.error);
