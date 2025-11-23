import { db } from '../db';
import { aiProviderConsents, aiUsageLogs } from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { queryOptimizer } from '../utils/query-optimizer';

export type AIProvider = 'openai' | 'kimi' | 'qwen' | 'deepseek';

export const AI_PROVIDER_CONFIG = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'whisper-1', 'tts-1'],
    requiresApiKey: true,
    costPerMillion: { input: 2.50, output: 10.00 }, // GPT-4o pricing
  },
  kimi: {
    name: 'Kimi AI',
    models: ['kimi-v2', 'kimi-plus'],
    requiresApiKey: false, // FREE tier available
    costPerMillion: { input: 0, output: 0 }, // FREE
  },
  qwen: {
    name: 'Qwen (Alibaba)',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    requiresApiKey: false, // FREE tier available
    costPerMillion: { input: 0, output: 0 }, // FREE
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    requiresApiKey: false, // FREE tier available
    costPerMillion: { input: 0, output: 0 }, // FREE
  },
} as const;

class AIConsentService {
  // Get user consent status for a provider
  async getUserConsent(tenantId: string, userId: string, provider: AIProvider) {
    const consent = await db.select()
      .from(aiProviderConsents)
      .where(and(
        eq(aiProviderConsents.tenantId, tenantId),
        eq(aiProviderConsents.userId, userId),
        eq(aiProviderConsents.provider, provider)
      ))
      .limit(1);
    
    return consent[0] || null;
  }

  // Update consent (give or revoke)
  async updateConsent(
    tenantId: string,
    userId: string,
    provider: AIProvider,
    consentGiven: boolean
  ) {
    const existing = await this.getUserConsent(tenantId, userId, provider);
    
    if (existing) {
      // Update existing consent
      return await db.update(aiProviderConsents)
        .set({
          consentGiven,
          consentDate: consentGiven ? new Date() : existing.consentDate,
          revokedDate: consentGiven ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(aiProviderConsents.tenantId, tenantId),
          eq(aiProviderConsents.userId, userId),
          eq(aiProviderConsents.provider, provider)
        ))
        .returning();
    } else {
      // Create new consent record
      return await db.insert(aiProviderConsents)
        .values({
          tenantId,
          userId,
          provider,
          consentGiven,
          consentDate: consentGiven ? new Date() : null,
          revokedDate: consentGiven ? null : new Date(),
        })
        .returning();
    }
  }

  // Get all consents for a user
  async getAllUserConsents(tenantId: string, userId: string) {
    const consents = await db.select()
      .from(aiProviderConsents)
      .where(and(
        eq(aiProviderConsents.tenantId, tenantId),
        eq(aiProviderConsents.userId, userId)
      ));
    
    // Include provider info
    return consents.map(consent => ({
      ...consent,
      providerInfo: AI_PROVIDER_CONFIG[consent.provider as AIProvider],
    }));
  }

  // Log AI usage
  async logUsage(
    tenantId: string,
    userId: string,
    provider: AIProvider,
    usage: {
      model: string;
      feature: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      requestId?: string;
      duration?: number;
      success?: boolean;
      errorMessage?: string;
    }
  ) {
    // Log the usage
    await db.insert(aiUsageLogs)
      .values({
        tenantId,
        userId,
        provider,
        model: usage.model,
        feature: usage.feature,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        costUsd: usage.costUsd.toString(),
        requestId: usage.requestId,
        duration: usage.duration,
        success: usage.success ?? true,
        errorMessage: usage.errorMessage,
      });
    
    // Update cumulative stats in consent table
    await db.update(aiProviderConsents)
      .set({
        totalTokensUsed: sql`${aiProviderConsents.totalTokensUsed} + ${usage.inputTokens + usage.outputTokens}`,
        totalCostUsd: sql`${aiProviderConsents.totalCostUsd} + ${usage.costUsd}`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(aiProviderConsents.tenantId, tenantId),
        eq(aiProviderConsents.userId, userId),
        eq(aiProviderConsents.provider, provider)
      ));
  }

  // Get usage stats for a user
  async getUsageStats(
    tenantId: string,
    userId: string,
    provider?: AIProvider,
    startDate?: Date,
    endDate?: Date
  ) {
    let query = db.select({
      provider: aiUsageLogs.provider,
      totalTokens: sql`SUM(${aiUsageLogs.totalTokens})`.as('totalTokens'),
      totalCost: sql`SUM(${aiUsageLogs.costUsd})`.as('totalCost'),
      requestCount: sql`COUNT(*)`.as('requestCount'),
      successCount: sql`COUNT(CASE WHEN ${aiUsageLogs.success} = true THEN 1 END)`.as('successCount'),
    })
    .from(aiUsageLogs)
    .where(and(
      eq(aiUsageLogs.tenantId, tenantId),
      eq(aiUsageLogs.userId, userId),
      provider ? eq(aiUsageLogs.provider, provider) : undefined,
      startDate ? gte(aiUsageLogs.createdAt, startDate) : undefined,
      endDate ? sql`${aiUsageLogs.createdAt} <= ${endDate}` : undefined
    ))
    .groupBy(aiUsageLogs.provider);
    
    return await query;
  }

  // Check if user has consent for a provider
  async hasConsent(tenantId: string, userId: string, provider: AIProvider): Promise<boolean> {
    const consent = await this.getUserConsent(tenantId, userId, provider);
    return consent?.consentGiven === true;
  }

  // Get preferred AI provider (first consented provider in order)
  async getPreferredProvider(tenantId: string, userId: string): Promise<AIProvider | null> {
    // Priority order: OpenAI (if available), then free providers
    const priorityOrder: AIProvider[] = ['openai', 'kimi', 'qwen', 'deepseek'];
    
    for (const provider of priorityOrder) {
      const hasConsent = await this.hasConsent(tenantId, userId, provider);
      if (hasConsent) {
        return provider;
      }
    }
    
    return null;
  }
}

export const aiConsentService = new AIConsentService();