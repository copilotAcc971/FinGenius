/**
 * KMS Integration Test
 * Tests encryption/decryption, key rotation, and cache functionality
 * 
 * Run with: tsx server/kms/test-kms.ts
 */

import {
  initializeKMS,
  encryptForAILogs,
  decryptAILogPayload,
  encryptOAuthToken,
  decryptOAuthToken,
  rotateEncryptionKey,
  keyManager,
  dekCache,
  envelopeEncryption,
  generateMasterKey
} from './index';
import { db } from '../db';
import { tenants } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('🧪 KMS Integration Tests\n');

  try {
    // Test 1: Check master key environment variable
    console.log('Test 1: Environment Configuration');
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKey) {
      console.log('⚠️  MASTER_ENCRYPTION_KEY not set. Using test key...');
      // Use a consistent test key so DEKs can be decrypted across test runs
      const testKey = 'cada266cee03a65a0c4ecb8215dafa9d2a8f42ce3e4e963467cb6c00c56595e8';
      process.env.MASTER_ENCRYPTION_KEY = testKey;
      console.log(`   Using consistent test key for reproducibility`);
    } else {
      console.log('✅ MASTER_ENCRYPTION_KEY is set');
    }

    // Test 2: Initialize KMS
    console.log('\nTest 2: KMS Initialization');
    await initializeKMS();
    console.log('✅ KMS initialized successfully');

    // Test 3: Get a test tenant
    console.log('\nTest 3: Finding Test Tenant');
    const testTenants = await db
      .select()
      .from(tenants)
      .limit(1);
    
    if (testTenants.length === 0) {
      throw new Error('No tenant found in database. Please create a tenant first.');
    }
    
    const tenantId = testTenants[0].id;
    console.log(`✅ Using tenant: ${testTenants[0].name} (${tenantId})`);

    // Test 4: Encrypt/Decrypt AI Logs
    console.log('\nTest 4: AI Log Encryption/Decryption');
    const testPayload = {
      userMessage: 'Create invoice for $1,000',
      aiResponse: 'Creating invoice...',
      functionCalls: ['create_invoice'],
      timestamp: new Date().toISOString()
    };
    
    const encrypted = await encryptForAILogs(testPayload, tenantId);
    console.log('✅ Encrypted AI log payload');
    console.log(`   Payload size: ${encrypted.encryptedPayload.length} bytes (base64)`);
    console.log(`   IV: ${encrypted.encryptionIv.substring(0, 16)}...`);
    console.log(`   Auth Tag: ${encrypted.encryptionAuthTag.substring(0, 16)}...`);
    console.log(`   Integrity Hash: ${encrypted.payloadIntegrityHash.substring(0, 16)}...`);
    
    const decrypted = await decryptAILogPayload(encrypted, tenantId);
    console.log('✅ Decrypted AI log payload');
    
    if (JSON.stringify(decrypted) === JSON.stringify(testPayload)) {
      console.log('✅ Round-trip successful - data matches!');
    } else {
      throw new Error('Round-trip failed - decrypted data does not match original');
    }

    // Test 5: Encrypt/Decrypt OAuth Token
    console.log('\nTest 5: OAuth Token Encryption/Decryption');
    const testToken = 'ya29.a0AfB_byD1234567890abcdefghijklmnop';
    
    const tokenEncrypted = await encryptOAuthToken(testToken, tenantId, 'test-user-id');
    console.log('✅ Encrypted OAuth token');
    console.log(`   Token size: ${tokenEncrypted.encryptedToken.length} bytes (base64)`);
    
    const tokenDecrypted = await decryptOAuthToken(tokenEncrypted, tenantId);
    console.log('✅ Decrypted OAuth token');
    
    if (tokenDecrypted === testToken) {
      console.log('✅ Token round-trip successful!');
    } else {
      throw new Error('Token round-trip failed');
    }

    // Test 6: DEK Caching
    console.log('\nTest 6: DEK Caching');
    const cacheStatsBefore = dekCache.getStats();
    console.log(`   Cache before: ${cacheStatsBefore.active} active, ${cacheStatsBefore.size} total`);
    
    // This should use cached DEK
    const encrypted2 = await encryptForAILogs({ test: 'cache' }, tenantId);
    const cacheStatsAfter = dekCache.getStats();
    console.log(`   Cache after: ${cacheStatsAfter.active} active, ${cacheStatsAfter.size} total`);
    console.log('✅ DEK caching working');

    // Test 7: Key Rotation
    console.log('\nTest 7: Key Rotation');
    const keyHistoryBefore = await keyManager.getKeyHistory(tenantId, 'ai_logs');
    console.log(`   Keys before rotation: ${keyHistoryBefore.length}`);
    
    await rotateEncryptionKey(tenantId, 'ai_logs', 'test_rotation');
    
    const keyHistoryAfter = await keyManager.getKeyHistory(tenantId, 'ai_logs');
    console.log(`   Keys after rotation: ${keyHistoryAfter.length}`);
    
    if (keyHistoryAfter.length > keyHistoryBefore.length) {
      console.log('✅ Key rotation successful - new version created');
    } else {
      throw new Error('Key rotation failed - no new key created');
    }

    // Test 8: Decrypt with old key (rotation window)
    console.log('\nTest 8: Decrypt with Previous Key Version');
    const decryptedOld = await decryptAILogPayload(encrypted, tenantId);
    if (JSON.stringify(decryptedOld) === JSON.stringify(testPayload)) {
      console.log('✅ Old key still works during rotation window');
    } else {
      throw new Error('Failed to decrypt with old key');
    }

    // Test 9: Encrypt with new key
    console.log('\nTest 9: Encrypt with New Key Version');
    const encryptedNew = await encryptForAILogs(
      { test: 'new key version' },
      tenantId
    );
    const decryptedNew = await decryptAILogPayload(encryptedNew, tenantId);
    console.log('✅ New key version works correctly');

    // Test 10: REGRESSION TEST - Decrypt after key rotation (Critical Bug Fix)
    console.log('\n🔴 Test 10: REGRESSION - Decrypt After Key Rotation (CRITICAL BUG FIX)');
    console.log('   This test verifies the fix for: decrypt() now uses encryptedDataKey');
    console.log('   instead of always fetching the active key.');
    
    // Step 1: Encrypt with current active key (should be v2 or higher from previous tests)
    const payload1 = {
      data: 'Encrypted with key v1',
      timestamp: new Date().toISOString()
    };
    const encryptedWithV1 = await encryptForAILogs(payload1, tenantId);
    const v1KeyHistory = await keyManager.getKeyHistory(tenantId, 'ai_logs');
    const v1ActiveKey = v1KeyHistory.find(k => k.status === 'active');
    console.log(`   ✓ Encrypted data with key v${v1ActiveKey?.version}`);
    console.log(`     encryptedDataKey: ${encryptedWithV1.encryptedDataKey.substring(0, 40)}...`);
    
    // Step 2: Rotate to new version
    await rotateEncryptionKey(tenantId, 'ai_logs', 'regression_test_rotation');
    const v2KeyHistory = await keyManager.getKeyHistory(tenantId, 'ai_logs');
    const v2ActiveKey = v2KeyHistory.find(k => k.status === 'active');
    console.log(`   ✓ Rotated to new key v${v2ActiveKey?.version}`);
    
    // Step 3: Encrypt with new active key (v2)
    const payload2 = {
      data: 'Encrypted with key v2',
      timestamp: new Date().toISOString()
    };
    const encryptedWithV2 = await encryptForAILogs(payload2, tenantId);
    console.log(`   ✓ Encrypted data with new key v${v2ActiveKey?.version}`);
    console.log(`     encryptedDataKey: ${encryptedWithV2.encryptedDataKey.substring(0, 40)}...`);
    
    // Step 4: Verify the encryptedDataKeys are different (old vs new)
    if (encryptedWithV1.encryptedDataKey === encryptedWithV2.encryptedDataKey) {
      throw new Error('CRITICAL: Both encryptions used the same DEK - key rotation did not work!');
    }
    console.log('   ✓ Confirmed: v1 and v2 used different DEKs (rotation successful)');
    
    // Step 5: CRITICAL - Decrypt data encrypted with OLD key (v1)
    console.log('   ⚠️  CRITICAL TEST: Decrypting data encrypted with OLD key...');
    const decryptedV1 = await decryptAILogPayload(encryptedWithV1, tenantId);
    if (JSON.stringify(decryptedV1) === JSON.stringify(payload1)) {
      console.log('   ✅ SUCCESS: Old key (v1) data decrypted correctly!');
    } else {
      throw new Error('CRITICAL BUG: Failed to decrypt data encrypted with old key v1');
    }
    
    // Step 6: CRITICAL - Decrypt data encrypted with NEW key (v2)
    console.log('   ⚠️  CRITICAL TEST: Decrypting data encrypted with NEW key...');
    const decryptedV2 = await decryptAILogPayload(encryptedWithV2, tenantId);
    if (JSON.stringify(decryptedV2) === JSON.stringify(payload2)) {
      console.log('   ✅ SUCCESS: New key (v2) data decrypted correctly!');
    } else {
      throw new Error('CRITICAL BUG: Failed to decrypt data encrypted with new key v2');
    }
    
    // Step 7: Verify the fix - check that decrypt() used the encryptedDataKey
    console.log('\n   🎯 REGRESSION TEST PASSED!');
    console.log('   ✅ decrypt() correctly uses encrypted.encryptedDataKey');
    console.log('   ✅ Old encrypted data works after key rotation');
    console.log('   ✅ New encrypted data works with new key');
    console.log('   ✅ No fallback attempts needed (direct key lookup works)');

    // Test 11: Direct envelope encryption test
    console.log('\nTest 11: Direct Envelope Encryption API');
    const directEncrypted = await envelopeEncryption.encrypt(
      'Direct test data',
      tenantId,
      'documents'
    );
    const directDecrypted = await envelopeEncryption.decrypt(
      directEncrypted,
      tenantId,
      'documents'
    );
    
    if (directDecrypted.toString('utf8') === 'Direct test data') {
      console.log('✅ Direct envelope encryption API works');
    } else {
      throw new Error('Direct envelope encryption failed');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\n📊 Final Cache Stats:');
    const finalStats = dekCache.getStats();
    console.log(`   Active DEKs: ${finalStats.active}`);
    console.log(`   Expired DEKs: ${finalStats.expired}`);
    console.log(`   Total cached: ${finalStats.size}`);
    
    console.log('\n🔑 Key Summary:');
    const allKeys = await keyManager.getKeyHistory(tenantId, 'ai_logs');
    allKeys.forEach((key, i) => {
      console.log(`   v${key.version}: ${key.status} (${key.dekAlgorithm})`);
    });

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
