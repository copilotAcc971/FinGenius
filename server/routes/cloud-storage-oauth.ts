/**
 * Cloud Storage OAuth Routes
 * Handles OAuth 2.0 authorization flow for Google Drive and OneDrive
 * Uses encrypted OAuth framework with KMS encryption
 */

import { Router } from 'express';
import { oauthManager } from '../integrations/oauth-manager';
import { credentialStorage } from '../integrations/credential-storage';

const router = Router();

/**
 * Initiate Google Drive OAuth flow
 * GET /api/oauth/google-drive/authorize
 */
router.get('/google-drive/authorize', async (req, res) => {
  try {
    const { tenantId, userId } = req.query;
    
    if (!tenantId || !userId || typeof tenantId !== 'string' || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameters: tenantId and userId',
      });
    }
    
    // Generate authorization URL
    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/google-drive/callback`;
    const { authUrl, state } = await oauthManager.getAuthorizationUrl(
      'google_drive',
      redirectUri
    );
    
    // Store state in session for CSRF validation
    if (!req.session) {
      return res.status(500).json({ error: 'Session not initialized' });
    }
    
    req.session.oauthState = state;
    req.session.oauthTenantId = tenantId;
    req.session.oauthUserId = userId;
    
    // Redirect to Google OAuth page
    return res.redirect(authUrl);
  } catch (error: any) {
    console.error('[OAuth] Google Drive authorization failed:', error);
    return res.status(500).json({
      error: 'Failed to initiate Google Drive authorization',
      message: error.message,
    });
  }
});

/**
 * Google Drive OAuth callback
 * GET /api/oauth/google-drive/callback
 */
router.get('/google-drive/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('[OAuth] Google Drive authorization error:', error_description);
      return res.status(400).json({
        error: error as string,
        error_description: error_description as string,
      });
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // Validate CSRF state
    if (!req.session || state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter (CSRF protection)' });
    }
    
    const tenantId = req.session.oauthTenantId;
    const userId = req.session.oauthUserId;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Session expired. Please try again.' });
    }
    
    // Exchange code for tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/google-drive/callback`;
    const tokens = await oauthManager.exchangeCodeForToken('google_drive', code, redirectUri);
    
    // Store encrypted credentials
    await credentialStorage.storeCredentials({
      tenantId,
      userId,
      provider: 'google_drive',
      tokens,
    });
    
    // Clear session data
    delete req.session.oauthState;
    delete req.session.oauthTenantId;
    delete req.session.oauthUserId;
    
    console.log('[OAuth] ✓ Google Drive connected successfully');
    
    return res.json({
      success: true,
      message: 'Google Drive connected successfully',
      provider: 'google_drive',
    });
  } catch (error: any) {
    console.error('[OAuth] Google Drive callback error:', error);
    return res.status(500).json({
      error: 'Failed to complete Google Drive authorization',
      message: error.message,
    });
  }
});

/**
 * Initiate OneDrive OAuth flow
 * GET /api/oauth/onedrive/authorize
 */
router.get('/onedrive/authorize', async (req, res) => {
  try {
    const { tenantId, userId } = req.query;
    
    if (!tenantId || !userId || typeof tenantId !== 'string' || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameters: tenantId and userId',
      });
    }
    
    // Generate authorization URL
    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/onedrive/callback`;
    const { authUrl, state } = await oauthManager.getAuthorizationUrl(
      'onedrive',
      redirectUri
    );
    
    // Store state in session for CSRF validation
    if (!req.session) {
      return res.status(500).json({ error: 'Session not initialized' });
    }
    
    req.session.oauthState = state;
    req.session.oauthTenantId = tenantId;
    req.session.oauthUserId = userId;
    
    // Redirect to Microsoft OAuth page
    return res.redirect(authUrl);
  } catch (error: any) {
    console.error('[OAuth] OneDrive authorization failed:', error);
    return res.status(500).json({
      error: 'Failed to initiate OneDrive authorization',
      message: error.message,
    });
  }
});

/**
 * OneDrive OAuth callback
 * GET /api/oauth/onedrive/callback
 */
router.get('/onedrive/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('[OAuth] OneDrive authorization error:', error_description);
      return res.status(400).json({
        error: error as string,
        error_description: error_description as string,
      });
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // Validate CSRF state
    if (!req.session || state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter (CSRF protection)' });
    }
    
    const tenantId = req.session.oauthTenantId;
    const userId = req.session.oauthUserId;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Session expired. Please try again.' });
    }
    
    // Exchange code for tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/onedrive/callback`;
    const tokens = await oauthManager.exchangeCodeForToken('onedrive', code, redirectUri);
    
    // Store encrypted credentials
    await credentialStorage.storeCredentials({
      tenantId,
      userId,
      provider: 'onedrive',
      tokens,
    });
    
    // Clear session data
    delete req.session.oauthState;
    delete req.session.oauthTenantId;
    delete req.session.oauthUserId;
    
    console.log('[OAuth] ✓ OneDrive connected successfully');
    
    return res.json({
      success: true,
      message: 'OneDrive connected successfully',
      provider: 'onedrive',
    });
  } catch (error: any) {
    console.error('[OAuth] OneDrive callback error:', error);
    return res.status(500).json({
      error: 'Failed to complete OneDrive authorization',
      message: error.message,
    });
  }
});

/**
 * Get connection status for a provider
 * GET /api/oauth/:provider/status
 */
router.get('/:provider/status', async (req, res) => {
  try {
    const { provider } = req.params;
    const { tenantId, userId } = req.query;
    
    if (!tenantId || !userId || typeof tenantId !== 'string' || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameters: tenantId and userId',
      });
    }
    
    // Check if connection exists
    const { db } = await import('../db');
    const { integrationConnections } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.tenantId, tenantId),
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, provider)
      ),
    });
    
    if (!connection) {
      return res.json({
        connected: false,
        provider,
      });
    }
    
    return res.json({
      connected: true,
      provider,
      status: connection.status,
      lastVerifiedAt: connection.lastVerifiedAt,
    });
  } catch (error: any) {
    console.error('[OAuth] Status check error:', error);
    return res.status(500).json({
      error: 'Failed to check connection status',
      message: error.message,
    });
  }
});

/**
 * Disconnect a provider
 * DELETE /api/oauth/:provider/disconnect
 */
router.delete('/:provider/disconnect', async (req, res) => {
  try {
    const { provider } = req.params;
    const { tenantId, userId } = req.body;
    
    if (!tenantId || !userId) {
      return res.status(400).json({
        error: 'Missing required parameters: tenantId and userId',
      });
    }
    
    // Delete connection
    const { db } = await import('../db');
    const { integrationConnections } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    await db
      .delete(integrationConnections)
      .where(
        and(
          eq(integrationConnections.tenantId, tenantId),
          eq(integrationConnections.userId, userId),
          eq(integrationConnections.provider, provider)
        )
      );
    
    console.log(`[OAuth] ✓ Disconnected ${provider} for user ${userId}`);
    
    return res.json({
      success: true,
      message: `${provider} disconnected successfully`,
    });
  } catch (error: any) {
    console.error('[OAuth] Disconnect error:', error);
    return res.status(500).json({
      error: 'Failed to disconnect provider',
      message: error.message,
    });
  }
});

export default router;
