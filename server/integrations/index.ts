/**
 * Integrations Module - Main Export
 * Portable OAuth 2.0 framework with KMS encryption
 * Works on Replit, AWS, Azure, self-hosted environments
 */

// OAuth Flow Manager
export { OAuthManager, oauthManager, OAuthError } from './oauth-manager';
export type { OAuthTokenResponse, OAuthErrorResponse } from './oauth-manager';

// Credential Storage Service
export { CredentialStorageService, credentialStorage, withAutoRefresh } from './credential-storage';
export type { OAuthCredentials, StoreCredentialsParams } from './credential-storage';

// OAuth Provider Configurations
export {
  getProviderConfig,
  listProviders,
  isProviderConfigured,
  oauthProviders,
  ENV_VAR_DOCS,
} from './providers';
export type { OAuthProviderConfig } from './providers';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { oauthManager, credentialStorage } from 'server/integrations';
 * 
 * // 1. Generate authorization URL
 * const { authUrl, state } = await oauthManager.getAuthorizationUrl(
 *   'google_drive',
 *   'https://myapp.com/oauth/callback'
 * );
 * 
 * // 2. Exchange code for tokens (after user authorizes)
 * const tokens = await oauthManager.exchangeCodeForToken(
 *   'google_drive',
 *   code,
 *   'https://myapp.com/oauth/callback'
 * );
 * 
 * // 3. Store encrypted credentials
 * await credentialStorage.storeCredentials({
 *   tenantId: 'tenant_123',
 *   userId: 'user_456',
 *   provider: 'google_drive',
 *   tokens,
 * });
 * 
 * // 4. Retrieve and auto-refresh (if expired)
 * const creds = await credentialStorage.getCredentials(connectionId, tenantId);
 * 
 * // OR use auto-refresh middleware
 * await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
 *   // Use accessToken to call API
 *   const response = await fetch('https://api.provider.com/data', {
 *     headers: { Authorization: `Bearer ${accessToken}` },
 *   });
 * });
 * ```
 */

/**
 * Migration Guide for Existing Connectors:
 * 
 * If you have existing connectors storing plaintext tokens:
 * 
 * ```typescript
 * // OLD (plaintext storage - INSECURE):
 * const accessToken = await getAccessToken(); // Stored in plaintext
 * 
 * // NEW (encrypted storage via KMS):
 * import { credentialStorage, withAutoRefresh } from 'server/integrations';
 * 
 * // Store tokens after OAuth flow
 * await credentialStorage.storeCredentials({
 *   tenantId: 'tenant_123',
 *   userId: 'user_456',
 *   provider: 'google_drive',
 *   tokens: { accessToken, refreshToken, expiresIn },
 * });
 * 
 * // Use auto-refresh middleware
 * await withAutoRefresh(connectionId, tenantId, async (token) => {
 *   // Your API calls
 * });
 * ```
 */
