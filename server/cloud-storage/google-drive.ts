/**
 * Google Drive Cloud Storage Service
 * Uses encrypted OAuth framework with auto-refresh
 * Stores credentials in integrationConnections table via KMS encryption
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import { credentialStorage, withAutoRefresh } from '../integrations/credential-storage';

export class GoogleDriveService {
  /**
   * Upload file to Google Drive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param buffer - File buffer to upload
   * @param filename - Name of file
   * @param folderId - Optional folder ID to upload to
   * @returns Google Drive file ID
   */
  async uploadFile(
    tenantId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    folderId?: string
  ): Promise<string> {
    // Get connection ID for this user/tenant/provider combination
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    // Use auto-refresh middleware to ensure valid token
    const fileId = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      // Create Drive API client
      const drive = google.drive({ version: 'v3', auth });
      
      // Upload file
      const response = await drive.files.create({
        requestBody: {
          name: filename,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: 'application/octet-stream',
          body: Readable.from(buffer),
        },
        fields: 'id,name,webViewLink',
      });
      
      if (!response.data.id) {
        throw new Error('Failed to upload file to Google Drive: No file ID returned');
      }
      
      console.log(`[Google Drive] ✓ Uploaded file: ${filename} (ID: ${response.data.id})`);
      return response.data.id;
    });

    return fileId;
  }

  /**
   * Download file from Google Drive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param fileId - Google Drive file ID
   * @returns File buffer
   */
  async downloadFile(
    tenantId: string,
    userId: string,
    fileId: string
  ): Promise<Buffer> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    const fileBuffer = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const drive = google.drive({ version: 'v3', auth });
      
      // Download file
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        {
          responseType: 'arraybuffer',
        }
      );
      
      console.log(`[Google Drive] ✓ Downloaded file: ${fileId}`);
      return Buffer.from(response.data as ArrayBuffer);
    });

    return fileBuffer;
  }

  /**
   * Get file metadata from Google Drive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param fileId - Google Drive file ID
   * @returns File metadata
   */
  async getFileMetadata(
    tenantId: string,
    userId: string,
    fileId: string
  ): Promise<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
    modifiedTime?: string;
  }> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    const metadata = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, modifiedTime',
      });
      
      return response.data;
    });

    return metadata as any;
  }

  /**
   * List files in a folder
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param folderId - Optional folder ID (defaults to root)
   * @returns List of files
   */
  async listFiles(
    tenantId: string,
    userId: string,
    folderId?: string
  ): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
  }>> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    const files = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const drive = google.drive({ version: 'v3', auth });
      
      const query = folderId
        ? `'${folderId}' in parents and trashed=false`
        : 'trashed=false';
      
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        spaces: 'drive',
        orderBy: 'name',
      });
      
      return response.data.files || [];
    });

    return files as any;
  }

  /**
   * Find folder by name
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param folderName - Name of folder to find
   * @returns Folder ID or null if not found
   */
  async findFolderByName(
    tenantId: string,
    userId: string,
    folderName: string
  ): Promise<string | null> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    const folderId = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.list({
        q: `name contains '${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      
      const folders = response.data.files;
      if (!folders || folders.length === 0) {
        return null;
      }
      
      // Prefer exact match
      const exactMatch = folders.find(f => f.name === folderName);
      return exactMatch?.id || folders[0].id || null;
    });

    return folderId;
  }

  /**
   * Get connection ID for user/tenant/provider
   * Helper method to retrieve connection from database
   */
  private async getConnectionId(
    tenantId: string,
    userId: string
  ): Promise<string | null> {
    const { db } = await import('../db');
    const { integrationConnections } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const connection = await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.tenantId, tenantId),
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, 'google_drive')
      ),
    });
    
    return connection?.id || null;
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
