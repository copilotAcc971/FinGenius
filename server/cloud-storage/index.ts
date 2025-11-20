/**
 * Cloud Storage Services
 * Encrypted OAuth-based cloud storage integrations
 * 
 * Supports:
 * - Google Drive (via googleapis)
 * - OneDrive (via Microsoft Graph API)
 * 
 * All credentials are encrypted with KMS envelope encryption
 * Auto-refresh tokens when expired
 */

export { GoogleDriveService, googleDriveService } from './google-drive';
export { OneDriveService, oneDriveService } from './onedrive';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { googleDriveService, oneDriveService } from 'server/cloud-storage';
 * 
 * // Upload to Google Drive
 * const googleFileId = await googleDriveService.uploadFile(
 *   tenantId,
 *   userId,
 *   fileBuffer,
 *   'invoice.pdf'
 * );
 * 
 * // Upload to OneDrive
 * const onedriveFileId = await oneDriveService.uploadFile(
 *   tenantId,
 *   userId,
 *   fileBuffer,
 *   'invoice.pdf'
 * );
 * 
 * // Download from Google Drive
 * const fileBuffer = await googleDriveService.downloadFile(
 *   tenantId,
 *   userId,
 *   googleFileId
 * );
 * ```
 * 
 * OAuth Setup:
 * 
 * 1. User initiates OAuth: GET /api/oauth/google-drive/authorize?tenantId=X&userId=Y
 * 2. User authorizes and is redirected to: /api/oauth/google-drive/callback
 * 3. System stores encrypted credentials in integrationConnections table
 * 4. Services automatically refresh tokens when expired
 */
