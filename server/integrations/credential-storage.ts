/**
 * Credential Storage Service
 * Encrypted OAuth credential storage using KMS envelope encryption
 * Integrates with database triggers that enforce encryption metadata
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { integrationConnections, type IntegrationConnection } from '@shared/schema';
import { encryptOAuthToken, decryptOAuthToken } from '../kms';
import { oauthManager } from './oauth-manager';

/**
 * OAuth Credentials (decrypted)
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  provider: string;
}

/**
 * Store Credentials Parameters
 */
export interface StoreCredentialsParams {
  tenantId: string;
  userId: string;
  provider: string;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number; // Seconds until expiration
    scope?: string;
  };
  metadata?: Record<string, any>; // Provider-specific metadata (folderId, etc.)
  providerUserId?: string;
  providerAccountName?: string;
}

/**
 * Credential Storage Service
 * All tokens are encrypted using KMS envelope encryption before storage
 */
export class CredentialStorageService {
  /**
   * Store OAuth credentials (ENCRYPTED via KMS)
   * 
   * @param params - Credential storage parameters
   * @returns Created integration connection
   */
  async storeCredentials(
    params: StoreCredentialsParams
  ): Promise<IntegrationConnection> {
    const { tenantId, userId, provider, tokens, metadata, providerUserId, providerAccountName } = params;
    
    // Encrypt access token
    const encryptedAccess = await encryptOAuthToken(
      tokens.accessToken,
      tenantId,
      userId
    );

    // Encrypt refresh token (if exists)
    let encryptedRefresh = null;
    if (tokens.refreshToken) {
      encryptedRefresh = await encryptOAuthToken(
        tokens.refreshToken,
        tenantId,
        userId
      );
    }

    // Calculate expiration time
    const expiresAt = tokens.expiresIn 
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    // Check if connection already exists
    const existing = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.tenantId, tenantId),
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, provider)
      ),
    });

    if (existing) {
      // Update existing connection
      const [updated] = await db
        .update(integrationConnections)
        .set({
          // Access token encryption metadata
          encryptedAccessToken: encryptedAccess.encryptedToken,
          accessTokenKmsKeyAlias: encryptedAccess.kmsKeyAlias,
          accessTokenEncryptedDek: encryptedAccess.encryptedDek,
          accessTokenIv: encryptedAccess.iv,
          accessTokenAuthTag: encryptedAccess.authTag,
          
          // Refresh token encryption metadata (if exists)
          encryptedRefreshToken: encryptedRefresh?.encryptedToken || null,
          refreshTokenKmsKeyAlias: encryptedRefresh?.kmsKeyAlias || null,
          refreshTokenEncryptedDek: encryptedRefresh?.encryptedDek || null,
          refreshTokenIv: encryptedRefresh?.iv || null,
          refreshTokenAuthTag: encryptedRefresh?.authTag || null,
          
          // Token metadata
          tokenExpiresAt: expiresAt,
          scopes: tokens.scope ? [tokens.scope] : null,
          
          // Connection status
          status: 'connected',
          lastVerifiedAt: new Date(),
          lastError: null,
          
          // Provider metadata
          metadata: metadata || null,
          providerUserId: providerUserId || null,
          providerAccountName: providerAccountName || null,
          
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id))
        .returning();
      
      return updated;
    }

    // Create new connection
    const [created] = await db
      .insert(integrationConnections)
      .values({
        tenantId,
        userId,
        provider,
        
        // Access token encryption metadata
        encryptedAccessToken: encryptedAccess.encryptedToken,
        accessTokenKmsKeyAlias: encryptedAccess.kmsKeyAlias,
        accessTokenEncryptedDek: encryptedAccess.encryptedDek,
        accessTokenIv: encryptedAccess.iv,
        accessTokenAuthTag: encryptedAccess.authTag,
        
        // Refresh token encryption metadata (if exists)
        encryptedRefreshToken: encryptedRefresh?.encryptedToken || null,
        refreshTokenKmsKeyAlias: encryptedRefresh?.kmsKeyAlias || null,
        refreshTokenEncryptedDek: encryptedRefresh?.encryptedDek || null,
        refreshTokenIv: encryptedRefresh?.iv || null,
        refreshTokenAuthTag: encryptedRefresh?.authTag || null,
        
        // Token metadata
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope ? [tokens.scope] : null,
        
        // Connection status
        status: 'connected',
        lastVerifiedAt: new Date(),
        
        // Provider metadata
        metadata: metadata || null,
        providerUserId: providerUserId || null,
        providerAccountName: providerAccountName || null,
      })
      .returning();
    
    return created;
  }

  /**
   * Retrieve and decrypt OAuth credentials
   * 
   * @param connectionId - Integration connection ID
   * @param tenantId - Tenant ID (for security validation)
   * @returns Decrypted credentials or null if not found
   */
  async getCredentials(
    connectionId: string,
    tenantId: string
  ): Promise<OAuthCredentials | null> {
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.tenantId, tenantId)
      ),
    });

    if (!connection) {
      return null;
    }

    // Decrypt access token
    const accessToken = await decryptOAuthToken(
      {
        encryptedToken: connection.encryptedAccessToken,
        kmsKeyAlias: connection.accessTokenKmsKeyAlias,
        encryptedDek: connection.accessTokenEncryptedDek,
        iv: connection.accessTokenIv,
        authTag: connection.accessTokenAuthTag,
      },
      tenantId
    );

    // Decrypt refresh token (if exists)
    let refreshToken: string | undefined;
    if (
      connection.encryptedRefreshToken &&
      connection.refreshTokenKmsKeyAlias &&
      connection.refreshTokenEncryptedDek &&
      connection.refreshTokenIv &&
      connection.refreshTokenAuthTag
    ) {
      refreshToken = await decryptOAuthToken(
        {
          encryptedToken: connection.encryptedRefreshToken,
          kmsKeyAlias: connection.refreshTokenKmsKeyAlias,
          encryptedDek: connection.refreshTokenEncryptedDek,
          iv: connection.refreshTokenIv,
          authTag: connection.refreshTokenAuthTag,
        },
        tenantId
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: connection.tokenExpiresAt || undefined,
      scope: Array.isArray(connection.scopes) ? connection.scopes.join(' ') : undefined,
      provider: connection.provider,
    };
  }

  /**
   * Refresh expired token and update storage
   * 
   * @param connectionId - Integration connection ID
   * @param tenantId - Tenant ID (for security validation)
   * @returns Refreshed credentials
   */
  async refreshAndUpdateToken(
    connectionId: string,
    tenantId: string
  ): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.tenantId, tenantId)
      ),
    });

    if (!connection) {
      throw new Error('Integration connection not found');
    }

    // Get decrypted refresh token
    if (
      !connection.encryptedRefreshToken ||
      !connection.refreshTokenKmsKeyAlias ||
      !connection.refreshTokenEncryptedDek ||
      !connection.refreshTokenIv ||
      !connection.refreshTokenAuthTag
    ) {
      throw new Error('No refresh token available. Re-authorization required.');
    }

    const refreshToken = await decryptOAuthToken(
      {
        encryptedToken: connection.encryptedRefreshToken,
        kmsKeyAlias: connection.refreshTokenKmsKeyAlias,
        encryptedDek: connection.refreshTokenEncryptedDek,
        iv: connection.refreshTokenIv,
        authTag: connection.refreshTokenAuthTag,
      },
      tenantId
    );

    // Refresh access token
    const refreshed = await oauthManager.refreshAccessToken(
      connection.provider,
      refreshToken
    );

    // Store updated credentials
    await this.storeCredentials({
      tenantId,
      userId: connection.userId,
      provider: connection.provider,
      tokens: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresIn: refreshed.expiresIn,
        scope: refreshed.scope,
      },
      metadata: connection.metadata as Record<string, any> | undefined,
      providerUserId: connection.providerUserId || undefined,
      providerAccountName: connection.providerAccountName || undefined,
    });

    const expiresAt = refreshed.expiresIn 
      ? new Date(Date.now() + refreshed.expiresIn * 1000)
      : undefined;

    return {
      accessToken: refreshed.accessToken,
      expiresAt,
    };
  }

  /**
   * Revoke and delete credentials
   * 
   * @param connectionId - Integration connection ID
   * @param tenantId - Tenant ID (for security validation)
   */
  async revokeCredentials(
    connectionId: string,
    tenantId: string
  ): Promise<void> {
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.tenantId, tenantId)
      ),
    });

    if (!connection) {
      return; // Already deleted
    }

    // Decrypt access token for revocation
    try {
      const accessToken = await decryptOAuthToken(
        {
          encryptedToken: connection.encryptedAccessToken,
          kmsKeyAlias: connection.accessTokenKmsKeyAlias,
          encryptedDek: connection.accessTokenEncryptedDek,
          iv: connection.accessTokenIv,
          authTag: connection.accessTokenAuthTag,
        },
        tenantId
      );

      // Revoke token at provider
      await oauthManager.revokeToken(connection.provider, accessToken, 'access_token');
    } catch (error) {
      console.error('Failed to revoke access token:', error);
      // Continue with deletion even if revocation fails
    }

    // Delete connection from database
    await db
      .delete(integrationConnections)
      .where(eq(integrationConnections.id, connectionId));
  }

  /**
   * Get connection by ID (without decrypting tokens)
   * 
   * @param connectionId - Integration connection ID
   * @param tenantId - Tenant ID (for security validation)
   * @returns Connection metadata (no tokens)
   */
  async getConnection(
    connectionId: string,
    tenantId: string
  ): Promise<IntegrationConnection | null> {
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.tenantId, tenantId)
      ),
    });

    return connection || null;
  }

  /**
   * List all connections for a tenant/user
   * 
   * @param tenantId - Tenant ID
   * @param userId - User ID (optional - filter by user)
   * @returns List of connections (no tokens)
   */
  async listConnections(
    tenantId: string,
    userId?: string
  ): Promise<IntegrationConnection[]> {
    const conditions = [eq(integrationConnections.tenantId, tenantId)];
    
    if (userId) {
      conditions.push(eq(integrationConnections.userId, userId));
    }

    return db.query.integrationConnections.findMany({
      where: and(...conditions),
      orderBy: (connections, { desc }) => [desc(connections.createdAt)],
    });
  }
}

/**
 * Singleton credential storage instance
 */
export const credentialStorage = new CredentialStorageService();

/**
 * Auto-refresh middleware
 * Automatically refreshes expired tokens before executing a function
 * 
 * @param connectionId - Integration connection ID
 * @param tenantId - Tenant ID
 * @param fn - Function to execute with valid access token
 * @returns Result of function execution
 */
export async function withAutoRefresh<T>(
  connectionId: string,
  tenantId: string,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const creds = await credentialStorage.getCredentials(connectionId, tenantId);
  
  if (!creds) {
    throw new Error('Integration connection not found');
  }

  // Check if token is expired or expiring soon (within 5 minutes)
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired = creds.expiresAt && creds.expiresAt.getTime() < Date.now() + bufferTime;

  if (isExpired) {
    // Refresh token
    const refreshed = await credentialStorage.refreshAndUpdateToken(connectionId, tenantId);
    return fn(refreshed.accessToken);
  }

  return fn(creds.accessToken);
}
