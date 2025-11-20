/**
 * OneDrive Cloud Storage Service
 * Uses encrypted OAuth framework with auto-refresh
 * Integrates with Microsoft Graph API
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { credentialStorage, withAutoRefresh } from '../integrations/credential-storage';
import axios from 'axios';

export class OneDriveService {
  /**
   * Upload file to OneDrive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param buffer - File buffer to upload
   * @param filename - Name of file
   * @param folderId - Optional folder ID to upload to
   * @returns OneDrive file ID
   */
  async uploadFile(
    tenantId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    folderId?: string
  ): Promise<string> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const fileId = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      // Create Microsoft Graph client
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
      
      // Build upload path
      const uploadPath = folderId
        ? `/me/drive/items/${folderId}:/${filename}:/content`
        : `/me/drive/root:/${filename}:/content`;
      
      // Upload file
      const response = await client.api(uploadPath).put(buffer);
      
      if (!response.id) {
        throw new Error('Failed to upload file to OneDrive: No file ID returned');
      }
      
      console.log(`[OneDrive] ✓ Uploaded file: ${filename} (ID: ${response.id})`);
      return response.id;
    });

    return fileId;
  }

  /**
   * Download file from OneDrive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param fileId - OneDrive file ID
   * @returns File buffer
   */
  async downloadFile(
    tenantId: string,
    userId: string,
    fileId: string
  ): Promise<Buffer> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const fileBuffer = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
      
      // Download file content
      const response = await client.api(`/me/drive/items/${fileId}/content`).get();
      
      // Microsoft Graph returns ArrayBuffer or stream
      if (Buffer.isBuffer(response)) {
        console.log(`[OneDrive] ✓ Downloaded file: ${fileId}`);
        return response;
      }
      
      // Convert ArrayBuffer to Buffer
      if (response instanceof ArrayBuffer) {
        console.log(`[OneDrive] ✓ Downloaded file: ${fileId}`);
        return Buffer.from(response);
      }
      
      throw new Error('Unexpected response type from OneDrive download');
    });

    return fileBuffer;
  }

  /**
   * Get file metadata from OneDrive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param fileId - OneDrive file ID
   * @returns File metadata
   */
  async getFileMetadata(
    tenantId: string,
    userId: string,
    fileId: string
  ): Promise<{
    id: string;
    name: string;
    size?: number;
    webUrl?: string;
    lastModifiedDateTime?: string;
  }> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const metadata = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
      
      const response = await client
        .api(`/me/drive/items/${fileId}`)
        .select('id,name,size,webUrl,lastModifiedDateTime')
        .get();
      
      return response;
    });

    return metadata;
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
    size?: number;
    lastModifiedDateTime?: string;
  }>> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const files = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
      
      const apiPath = folderId
        ? `/me/drive/items/${folderId}/children`
        : '/me/drive/root/children';
      
      const response = await client
        .api(apiPath)
        .select('id,name,size,lastModifiedDateTime')
        .orderby('name')
        .get();
      
      return response.value || [];
    });

    return files;
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
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const folderId = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      try {
        // ✅ Escape single quotes by doubling them
        const escapedName = folderName.replace(/'/g, "''");
        
        // ✅ Build URL manually (no SDK double-encoding!)
        let url: string | null = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${escapedName}')`;
        
        // ✅ Paginate through all results
        while (url) {
          const response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            validateStatus: (status) => status < 500,
          });
          
          // ✅ Surface non-404 errors
          if (response.status >= 400) {
            if (response.status === 404) {
              return null;
            }
            throw new Error(`OneDrive API error ${response.status}: ${JSON.stringify(response.data)}`);
          }
          
          const data = response.data;
          
          // ✅ Search for exact folder match (case-insensitive)
          if (data.value && data.value.length > 0) {
            const folder = data.value.find(
              (item: any) => 
                item.name?.toLowerCase() === folderName.toLowerCase() && 
                item.folder
            );
            
            if (folder) {
              console.log(`[OneDrive] ✓ Found folder: ${folderName} (ID: ${folder.id})`);
              return folder.id;
            }
          }
          
          // ✅ Follow pagination link
          url = data['@odata.nextLink'] || null;
        }
        
        // Not found after checking all pages
        console.log(`[OneDrive] Folder not found: ${folderName}`);
        return null;
        
      } catch (error: any) {
        // Only swallow 404s, throw everything else
        if (error.response?.status === 404 || error.message?.includes('404')) {
          return null;
        }
        console.error('[OneDrive] Error finding folder:', error);
        throw error;
      }
    });

    return folderId;
  }

  /**
   * Create folder in OneDrive
   * 
   * @param tenantId - Tenant ID for security validation
   * @param userId - User ID who owns the connection
   * @param folderName - Name of folder to create
   * @param parentFolderId - Optional parent folder ID
   * @returns Created folder ID
   */
  async createFolder(
    tenantId: string,
    userId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<string> {
    const connectionId = await this.getConnectionId(tenantId, userId);
    
    if (!connectionId) {
      throw new Error('OneDrive not connected. Please authenticate first.');
    }

    const folderId = await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
      
      const apiPath = parentFolderId
        ? `/me/drive/items/${parentFolderId}/children`
        : '/me/drive/root/children';
      
      const response = await client.api(apiPath).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      });
      
      console.log(`[OneDrive] ✓ Created folder: ${folderName} (ID: ${response.id})`);
      return response.id;
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
        eq(integrationConnections.provider, 'onedrive')
      ),
    });
    
    return connection?.id || null;
  }
}

// Export singleton instance
export const oneDriveService = new OneDriveService();
