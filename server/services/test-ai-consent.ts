/**
 * Test file for AI Consent Service
 * Run this test with: tsx server/services/test-ai-consent.ts
 */

import { aiConsentService } from './ai-consent';

async function testAIConsentService() {

  // Test tenant and user IDs
  const testTenantId = 'test-tenant-' + Date.now();
  const testUserId = 'test-user-' + Date.now();

  try {
    // Test 1: Get consent (should return null for new user)
    const initialConsent = await aiConsentService.getUserConsent(
      testTenantId,
      testUserId,
      'openai'
    );
    console.assert(initialConsent === null, 'Initial consent should be null');

    // Test 2: Update consent (give consent)
    const giveConsent = await aiConsentService.updateConsent(
      testTenantId,
      testUserId,
      'openai',
      true
    );
    console.assert(giveConsent[0].consentGiven === true, 'Consent should be given');

    // Test 3: Get consent again (should return consent)
    const updatedConsent = await aiConsentService.getUserConsent(
      testTenantId,
      testUserId,
      'openai'
    );
    console.assert(updatedConsent?.consentGiven === true, 'Consent should be given');

    // Test 4: Log usage
    await aiConsentService.logUsage(testTenantId, testUserId, 'openai', {
      model: 'gpt-4o',
      feature: 'chat',
      inputTokens: 150,
      outputTokens: 250,
      costUsd: 0.004,
      requestId: 'test-request-1',
      duration: 2500,
      success: true,
    });

    // Test 5: Get usage stats
    const stats = await aiConsentService.getUsageStats(
      testTenantId,
      testUserId
    );
    console.assert(stats.length > 0, 'Should have usage stats');

    // Test 6: Get all consents
    const allConsents = await aiConsentService.getAllUserConsents(
      testTenantId,
      testUserId
    );
    console.assert(allConsents.length > 0, 'Should have at least one consent');
    console.assert(allConsents[0].providerInfo !== undefined, 'Should include provider info');

    // Test 7: Check hasConsent
    const hasOpenAIConsent = await aiConsentService.hasConsent(
      testTenantId,
      testUserId,
      'openai'
    );
    const hasKimiConsent = await aiConsentService.hasConsent(
      testTenantId,
      testUserId,
      'kimi'
    );
    console.assert(hasOpenAIConsent === true, 'Should have OpenAI consent');
    console.assert(hasKimiConsent === false, 'Should not have Kimi consent');

    // Test 8: Get preferred provider
    const preferredProvider = await aiConsentService.getPreferredProvider(
      testTenantId,
      testUserId
    );
    console.assert(preferredProvider === 'openai', 'Preferred provider should be OpenAI');

    // Test 9: Revoke consent
    const revokeConsent = await aiConsentService.updateConsent(
      testTenantId,
      testUserId,
      'openai',
      false
    );
    console.assert(revokeConsent[0].consentGiven === false, 'Consent should be revoked');
    console.assert(revokeConsent[0].revokedDate !== null, 'Should have revoked date');


    // Clean up - delete test data
    const { db } = await import('@/server/db');
    const { aiProviderConsents, aiUsageLogs } = await import('@/shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserId));
    await db.delete(aiProviderConsents).where(eq(aiProviderConsents.userId, testUserId));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAIConsentService()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ AI Consent Service test failed:', error);
      process.exit(1);
    });
}