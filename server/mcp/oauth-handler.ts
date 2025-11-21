import crypto from 'crypto';
import { db } from '../db';
import { mcpAuthCredentials, oidcConfigurations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

export interface OAuthState {
  provider: string;
  tenantId: string;
  userId: string;
  pkceVerifier: string;
  expiresAt: number;
}

export class OAuthHandler {
  private static states = new Map<string, OAuthState>();

  static generatePKCE(): PKCEChallenge {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  static generateState(provider: string, tenantId: string, userId: string): string {
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    
    this.states.set(state, {
      provider,
      tenantId,
      userId,
      pkceVerifier: codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minute expiry
    });

    return state;
  }

  static validateState(state: string): OAuthState | null {
    const oauthState = this.states.get(state);
    if (!oauthState || oauthState.expiresAt < Date.now()) {
      this.states.delete(state);
      return null;
    }
    return oauthState;
  }

  static getAuthorizationUrl(
    provider: string,
    clientId: string,
    authorizationEndpoint: string,
    redirectUri: string,
    scopes: string,
    tenantId: string,
    userId: string
  ): { url: string; state: string } {
    const state = this.generateState(provider, tenantId, userId);
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    // Store code verifier with state
    const oauthState = this.states.get(state);
    if (oauthState) {
      oauthState.pkceVerifier = codeVerifier;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `${authorizationEndpoint}?${params.toString()}`,
      state,
    };
  }

  static async exchangeCodeForToken(
    state: string,
    code: string,
    clientId: string,
    clientSecret: string,
    tokenEndpoint: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType: string;
  }> {
    const oauthState = this.validateState(state);
    if (!oauthState) {
      throw new Error('Invalid or expired state');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: oauthState.pkceVerifier,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.states.delete(state);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
    };
  }

  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    tokenEndpoint: string
  ): Promise<{ accessToken: string; expiresIn?: number }> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
}
