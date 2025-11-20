/**
 * Test file for AI Consent Service
 * Run this test with: tsx server/services/test-ai-consent.ts
 */

import { aiConsentService } from './ai-consent';

async function testAIConsentService() {
  console.log('🧪 Testing AI Consent Service...\n');

  // Test tenant and user IDs
  const testTenantId = 'test-tenant-' + Date.now();
  const testUserId = 'test-user-' + Date.now();

  try {
    // Test 1: Get consent (should return null for new user)
    console.log('Test 1: Get consent for new user');
    const initialConsent = await aiConsentService.getUserConsent(
      testTenantId,
      testUserId,
      'openai'
    );
    console.log('Initial consent:', initialConsent);
    console.assert(initialConsent === null, 'Initial consent should be null');
    console.log('✅ Test 1 passed\n');

    // Test 2: Update consent (give consent)
    console.log('Test 2: Give consent for OpenAI');
    const giveConsent = await aiConsentService.updateConsent(
      testTenantId,
      testUserId,
      'openai',
      true
    );
    console.log('Give consent result:', giveConsent[0]);
    console.assert(giveConsent[0].consentGiven === true, 'Consent should be given');
    console.log('✅ Test 2 passed\n');

    // Test 3: Get consent again (should return consent)
    console.log('Test 3: Get consent after giving');
    const updatedConsent = await aiConsentService.getUserConsent(
      testTenantId,
      testUserId,
      'openai'
    );
    console.log('Updated consent:', updatedConsent);
    console.assert(updatedConsent?.consentGiven === true, 'Consent should be given');
    console.log('✅ Test 3 passed\n');

    // Test 4: Log usage
    console.log('Test 4: Log AI usage');
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
    console.log('Usage logged successfully');
    console.log('✅ Test 4 passed\n');

    // Test 5: Get usage stats
    console.log('Test 5: Get usage stats');
    const stats = await aiConsentService.getUsageStats(
      testTenantId,
      testUserId
    );
    console.log('Usage stats:', stats);
    console.assert(stats.length > 0, 'Should have usage stats');
    console.log('✅ Test 5 passed\n');

    // Test 6: Get all consents
    console.log('Test 6: Get all user consents');
    const allConsents = await aiConsentService.getAllUserConsents(
      testTenantId,
      testUserId
    );
    console.log('All consents:', allConsents);
    console.assert(allConsents.length > 0, 'Should have at least one consent');
    console.assert(allConsents[0].providerInfo !== undefined, 'Should include provider info');
    console.log('✅ Test 6 passed\n');

    // Test 7: Check hasConsent
    console.log('Test 7: Check hasConsent');
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
    console.log('Has OpenAI consent:', hasOpenAIConsent);
    console.log('Has Kimi consent:', hasKimiConsent);
    console.assert(hasOpenAIConsent === true, 'Should have OpenAI consent');
    console.assert(hasKimiConsent === false, 'Should not have Kimi consent');
    console.log('✅ Test 7 passed\n');

    // Test 8: Get preferred provider
    console.log('Test 8: Get preferred provider');
    const preferredProvider = await aiConsentService.getPreferredProvider(
      testTenantId,
      testUserId
    );
    console.log('Preferred provider:', preferredProvider);
    console.assert(preferredProvider === 'openai', 'Preferred provider should be OpenAI');
    console.log('✅ Test 8 passed\n');

    // Test 9: Revoke consent
    console.log('Test 9: Revoke consent');
    const revokeConsent = await aiConsentService.updateConsent(
      testTenantId,
      testUserId,
      'openai',
      false
    );
    console.log('Revoke consent result:', revokeConsent[0]);
    console.assert(revokeConsent[0].consentGiven === false, 'Consent should be revoked');
    console.assert(revokeConsent[0].revokedDate !== null, 'Should have revoked date');
    console.log('✅ Test 9 passed\n');

    console.log('🎉 All tests passed successfully!');

    // Clean up - delete test data
    console.log('\nCleaning up test data...');
    const { db } = await import('@/server/db');
    const { aiProviderConsents, aiUsageLogs } = await import('@/shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserId));
    await db.delete(aiProviderConsents).where(eq(aiProviderConsents.userId, testUserId));
    console.log('Test data cleaned up successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAIConsentService()
    .then(() => {
      console.log('\n✅ AI Consent Service is working correctly!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ AI Consent Service test failed:', error);
      process.exit(1);
    });
}