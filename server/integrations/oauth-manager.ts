/**
 * OAuth Flow Manager
 * Platform-agnostic OAuth 2.0 authorization flow
 * Handles authorization URLs, token exchange, and token refresh
 */

import crypto from 'crypto';
import { getProviderConfig, type OAuthProviderConfig } from './providers';

/**
 * OAuth Token Response
 * Standard token response from OAuth 2.0 providers
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
}

/**
 * OAuth Error Response
 * Standard error response from OAuth 2.0 providers
 */
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * OAuth Manager Class
 * Stateless OAuth 2.0 flow manager
 */
export class OAuthManager {
  /**
   * Generate authorization URL for OAuth provider
   * 
   * @param provider - OAuth provider (google_drive, onedrive, etc.)
   * @param redirectUri - Callback URL after authorization
   * @param state - CSRF token (auto-generated if not provided)
   * @param scopes - OAuth scopes (defaults to provider's default scopes)
   * @returns Authorization URL and state token
   */
  async getAuthorizationUrl(
    provider: string,
    redirectUri: string,
    state?: string,
    scopes?: string[]
  ): Promise<{
    authUrl: string;
    state: string;
  }> {
    const config = getProviderConfig(provider);
    
    // Generate CSRF state token if not provided
    const csrfState = state || this.generateState();
    
    // Use provided scopes or default scopes
    const requestScopes = scopes || config.defaultScopes;
    const scopeString = requestScopes.join(config.scopeSeparator || ' ');
    
    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopeString,
      state: csrfState,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen (ensures refresh token)
    });

    const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;
    
    return {
      authUrl,
      state: csrfState,
    };
  }

  /**
   * Exchange authorization code for access token
   * 
   * @param provider - OAuth provider
   * @param code - Authorization code from OAuth redirect
   * @param redirectUri - Same redirect URI used in authorization request
   * @returns OAuth tokens
   */
  async exchangeCodeForToken(
    provider: string,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> {
    const config = getProviderConfig(provider);
    
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json() as OAuthErrorResponse;
      throw new OAuthError(
        errorData.error || 'token_exchange_failed',
        errorData.error_description || `Failed to exchange authorization code: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    
    return this.normalizeTokenResponse(data);
  }

  /**
   * Refresh expired access token
   * 
   * @param provider - OAuth provider
   * @param refreshToken - Refresh token from previous authorization
   * @returns New OAuth tokens
   */
  async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<OAuthTokenResponse> {
    const config = getProviderConfig(provider);
    
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json() as OAuthErrorResponse;
      
      // Handle expired/invalid refresh token
      if (errorData.error === 'invalid_grant') {
        throw new OAuthError(
          'refresh_token_expired',
          'Refresh token has expired or been revoked. Re-authorization required.',
          401
        );
      }
      
      throw new OAuthError(
        errorData.error || 'token_refresh_failed',
        errorData.error_description || `Failed to refresh access token: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    
    return this.normalizeTokenResponse(data, refreshToken);
  }

  /**
   * Revoke OAuth token
   * 
   * @param provider - OAuth provider
   * @param token - Token to revoke (access or refresh token)
   * @param tokenTypeHint - Type of token ('access_token' or 'refresh_token')
   */
  async revokeToken(
    provider: string,
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token'
  ): Promise<void> {
    const config = getProviderConfig(provider);
    
    if (!config.revokeEndpoint) {
      console.warn(`Provider '${provider}' does not support token revocation`);
      return;
    }

    const body = new URLSearchParams({
      token: token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (tokenTypeHint) {
      body.append('token_type_hint', tokenTypeHint);
    }

    const response = await fetch(config.revokeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error(`Failed to revoke token for provider '${provider}':`, response.statusText);
      // Don't throw - revocation is best-effort
    }
  }

  /**
   * Generate CSRF state token
   * @returns Random state token
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Normalize token response
   * Different providers use different field names (snake_case vs camelCase)
   * 
   * @param data - Raw token response from provider
   * @param existingRefreshToken - Existing refresh token to use if not returned
   * @returns Normalized token response
   */
  private normalizeTokenResponse(
    data: any,
    existingRefreshToken?: string
  ): OAuthTokenResponse {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || existingRefreshToken,
      expiresIn: data.expires_in ? parseInt(data.expires_in, 10) : undefined,
      scope: data.scope,
      tokenType: data.token_type || 'Bearer',
    };
  }
}

/**
 * OAuth Error Class
 * Custom error for OAuth-specific errors
 */
export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * Singleton OAuth Manager instance
 */
export const oauthManager = new OAuthManager();
