/**
 * Integration Tests for OAuth Framework
 * Tests OAuth flow, KMS encryption, credential storage
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { oauthManager, credentialStorage } from './index';
import { getProviderConfig, isProviderConfigured } from './providers';
import { encryptOAuthToken, decryptOAuthToken } from '../kms';

/**
 * Test 1: Provider Configuration
 */
describe('OAuth Provider Configuration', () => {
  it('should list all available providers', () => {
    const providers = Object.keys(require('./providers').oauthProviders);
    expect(providers).toContain('google_drive');
    expect(providers).toContain('onedrive');
    expect(providers).toContain('stripe');
  });

  it('should check if provider is configured', () => {
    // This will be true only if environment variables are set
    const isGoogleConfigured = isProviderConfigured('google_drive');
    expect(typeof isGoogleConfigured).toBe('boolean');
  });

  it('should throw error for unknown provider', () => {
    expect(() => getProviderConfig('unknown_provider')).toThrow();
  });
});

/**
 * Test 2: Authorization URL Generation
 */
describe('OAuth Authorization URL', () => {
  it('should generate authorization URL with CSRF state', async () => {
    // Only test if provider is configured
    if (!isProviderConfigured('google_drive')) {
      console.warn('Skipping test: GOOGLE_DRIVE_CLIENT_ID not set');
      return;
    }

    const { authUrl, state } = await oauthManager.getAuthorizationUrl(
      'google_drive',
      'https://example.com/callback'
    );

    expect(authUrl).toContain('accounts.google.com');
    expect(authUrl).toContain('client_id=');
    expect(authUrl).toContain('redirect_uri=');
    expect(authUrl).toContain('state=');
    expect(state).toHaveLength(64); // 32 bytes * 2 (hex)
  });

  it('should use custom state if provided', async () => {
    if (!isProviderConfigured('google_drive')) {
      console.warn('Skipping test: GOOGLE_DRIVE_CLIENT_ID not set');
      return;
    }

    const customState = 'custom_csrf_token_123';
    const { authUrl, state } = await oauthManager.getAuthorizationUrl(
      'google_drive',
      'https://example.com/callback',
      customState
    );

    expect(state).toBe(customState);
    expect(authUrl).toContain(`state=${customState}`);
  });

  it('should use custom scopes if provided', async () => {
    if (!isProviderConfigured('google_drive')) {
      console.warn('Skipping test: GOOGLE_DRIVE_CLIENT_ID not set');
      return;
    }

    const customScopes = ['https://www.googleapis.com/auth/drive.readonly'];
    const { authUrl } = await oauthManager.getAuthorizationUrl(
      'google_drive',
      'https://example.com/callback',
      undefined,
      customScopes
    );

    expect(authUrl).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly');
  });
});

/**
 * Test 3: Token Encryption/Decryption via KMS
 */
describe('KMS Token Encryption', () => {
  const testToken = 'test_access_token_12345';
  const testTenantId = 'tenant_test_123';
  const testUserId = 'user_test_456';

  it('should encrypt and decrypt OAuth token', async () => {
    // Encrypt
    const encrypted = await encryptOAuthToken(testToken, testTenantId, testUserId);

    expect(encrypted).toHaveProperty('encryptedToken');
    expect(encrypted).toHaveProperty('kmsKeyAlias');
    expect(encrypted).toHaveProperty('encryptedDek');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted).toHaveProperty('payloadIntegrityHash');

    // Verify encrypted token is different from plaintext
    expect(encrypted.encryptedToken).not.toBe(testToken);

    // Decrypt
    const decrypted = await decryptOAuthToken(encrypted, testTenantId);

    // Verify decrypted token matches original
    expect(decrypted).toBe(testToken);
  });

  it('should fail decryption with wrong tenant ID', async () => {
    const encrypted = await encryptOAuthToken(testToken, testTenantId, testUserId);

    // Try to decrypt with different tenant ID
    await expect(
      decryptOAuthToken(encrypted, 'wrong_tenant_id')
    ).rejects.toThrow();
  });

  it('should fail decryption with tampered ciphertext', async () => {
    const encrypted = await encryptOAuthToken(testToken, testTenantId, testUserId);

    // Tamper with encrypted data
    const tampered = {
      ...encrypted,
      encryptedToken: encrypted.encryptedToken.replace('a', 'b'),
    };

    await expect(
      decryptOAuthToken(tampered, testTenantId)
    ).rejects.toThrow();
  });
});

/**
 * Test 4: Credential Storage (Database Integration)
 * Note: Requires database connection
 */
describe('Credential Storage Service', () => {
  const testTenantId = 'tenant_storage_test';
  const testUserId = 'user_storage_test';
  const testProvider = 'google_drive';
  let createdConnectionId: string | null = null;

  afterAll(async () => {
    // Cleanup: Delete test connection
    if (createdConnectionId) {
      try {
        await credentialStorage.revokeCredentials(createdConnectionId, testTenantId);
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
  });

  it('should store encrypted credentials', async () => {
    const connection = await credentialStorage.storeCredentials({
      tenantId: testTenantId,
      userId: testUserId,
      provider: testProvider,
      tokens: {
        accessToken: 'test_access_token_abc123',
        refreshToken: 'test_refresh_token_xyz789',
        expiresIn: 3600, // 1 hour
        scope: 'drive.file drive.readonly',
      },
      providerUserId: 'test@example.com',
      providerAccountName: 'Test User',
    });

    expect(connection).toHaveProperty('id');
    expect(connection.tenantId).toBe(testTenantId);
    expect(connection.userId).toBe(testUserId);
    expect(connection.provider).toBe(testProvider);
    expect(connection.status).toBe('connected');
    
    // Verify tokens are encrypted (not plaintext)
    expect(connection.encryptedAccessToken).not.toBe('test_access_token_abc123');
    expect(connection.encryptedRefreshToken).not.toBe('test_refresh_token_xyz789');
    
    // Verify encryption metadata exists
    expect(connection.kmsKeyAlias).toBeTruthy();
    expect(connection.encryptedDataKey).toBeTruthy();
    expect(connection.tokenIntegrityHash).toBeTruthy();

    createdConnectionId = connection.id;
  });

  it('CRITICAL: Refresh token encryption metadata must be different from access token metadata', async () => {
    if (!createdConnectionId) {
      throw new Error('No connection created in previous test');
    }

    // Get the stored connection to verify metadata
    const connection = await credentialStorage.getConnection(
      createdConnectionId,
      testTenantId
    );

    expect(connection).not.toBeNull();
    if (!connection) return;

    // Verify refresh token metadata exists
    expect(connection.refreshTokenKmsKeyAlias).toBeTruthy();
    expect(connection.refreshTokenEncryptedDataKey).toBeTruthy();
    expect(connection.refreshTokenEncryptionIv).toBeTruthy();
    expect(connection.refreshTokenEncryptionAuthTag).toBeTruthy();
    expect(connection.refreshTokenIntegrityHash).toBeTruthy();

    // CRITICAL: Refresh token metadata MUST be DIFFERENT from access token metadata
    // If they're the same, decryption will fail with wrong DEK
    expect(connection.refreshTokenKmsKeyAlias).not.toBe(connection.kmsKeyAlias);
    expect(connection.refreshTokenEncryptedDataKey).not.toBe(connection.encryptedDataKey);
    expect(connection.refreshTokenEncryptionIv).not.toBe(connection.encryptionIv);
    expect(connection.refreshTokenEncryptionAuthTag).not.toBe(connection.encryptionAuthTag);
    expect(connection.refreshTokenIntegrityHash).not.toBe(connection.tokenIntegrityHash);

    // Most importantly: Decrypt refresh token successfully
    // This will fail if metadata is wrong (wrong DEK, invalid auth tag)
    const decrypted = await credentialStorage.getCredentials(
      createdConnectionId,
      testTenantId
    );

    expect(decrypted).not.toBeNull();
    expect(decrypted?.refreshToken).toBe('test_refresh_token_xyz789'); // ✅ Must succeed
  });

  it('should retrieve and decrypt credentials', async () => {
    if (!createdConnectionId) {
      throw new Error('No connection created in previous test');
    }

    const creds = await credentialStorage.getCredentials(
      createdConnectionId,
      testTenantId
    );

    expect(creds).not.toBeNull();
    expect(creds?.accessToken).toBe('test_access_token_abc123');
    expect(creds?.refreshToken).toBe('test_refresh_token_xyz789');
    expect(creds?.provider).toBe(testProvider);
    expect(creds?.expiresAt).toBeInstanceOf(Date);
  });

  it('should return null for non-existent connection', async () => {
    const creds = await credentialStorage.getCredentials(
      'non_existent_id',
      testTenantId
    );

    expect(creds).toBeNull();
  });

  it('should list connections for tenant', async () => {
    const connections = await credentialStorage.listConnections(testTenantId);

    expect(Array.isArray(connections)).toBe(true);
    expect(connections.length).toBeGreaterThan(0);
    
    const testConnection = connections.find(c => c.id === createdConnectionId);
    expect(testConnection).toBeTruthy();
  });
});

/**
 * Test 5: Auto-Refresh Middleware
 * Note: This test uses mocked token refresh
 */
describe('Auto-Refresh Middleware', () => {
  it('should not refresh if token is still valid', async () => {
    // Create connection with future expiration
    const futureExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    const connection = await credentialStorage.storeCredentials({
      tenantId: 'tenant_refresh_test',
      userId: 'user_refresh_test',
      provider: 'google_drive',
      tokens: {
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      },
    });

    // This should use the existing token without refreshing
    let usedToken: string | null = null;
    await require('./credential-storage').withAutoRefresh(
      connection.id,
      'tenant_refresh_test',
      async (token: string) => {
        usedToken = token;
      }
    );

    expect(usedToken).toBe('valid_token');

    // Cleanup
    await credentialStorage.revokeCredentials(connection.id, 'tenant_refresh_test');
  });
});

/**
 * Test 6: OAuth Error Handling
 */
describe('OAuth Error Handling', () => {
  it('should handle invalid provider', async () => {
    await expect(
      oauthManager.getAuthorizationUrl('invalid_provider', 'https://example.com')
    ).rejects.toThrow('OAuth provider');
  });

  it('should handle missing credentials', async () => {
    // This test assumes a provider exists but credentials are not set
    // You may need to adjust based on your environment
    try {
      await oauthManager.getAuthorizationUrl('twilio', 'https://example.com');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('credentials missing');
    }
  });
});

/**
 * Manual Testing Guide
 * 
 * To fully test the OAuth flow with real providers:
 * 
 * 1. Set up OAuth credentials:
 *    - GOOGLE_DRIVE_CLIENT_ID
 *    - GOOGLE_DRIVE_CLIENT_SECRET
 *    - Or other provider credentials
 * 
 * 2. Run authorization flow:
 *    ```typescript
 *    const { authUrl, state } = await oauthManager.getAuthorizationUrl(
 *      'google_drive',
 *      'http://localhost:5000/oauth/callback'
 *    );
 *    
 *    // Open authUrl in browser, authorize, get code
 *    ```
 * 
 * 3. Exchange code for tokens:
 *    ```typescript
 *    const tokens = await oauthManager.exchangeCodeForToken(
 *      'google_drive',
 *      code,
 *      'http://localhost:5000/oauth/callback'
 *    );
 *    ```
 * 
 * 4. Store encrypted tokens:
 *    ```typescript
 *    const connection = await credentialStorage.storeCredentials({
 *      tenantId: 'your_tenant_id',
 *      userId: 'your_user_id',
 *      provider: 'google_drive',
 *      tokens,
 *    });
 *    ```
 * 
 * 5. Test auto-refresh:
 *    ```typescript
 *    await withAutoRefresh(connection.id, tenantId, async (token) => {
 *      // Use token for API calls
 *    });
 *    ```
 */

export {
  // Export test suite for external use if needed
};
