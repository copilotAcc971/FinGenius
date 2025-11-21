import { readFile, mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { googleDriveService } from './google-drive';
import { oneDriveService } from './onedrive';
import { credentialStorage } from '../integrations/credential-storage';

const UPLOAD_BASE_DIR = 'attached_assets/inbound-documents';
const CACHE_DIR = 'attached_assets/document-cache';

export async function retrieveDocument(
  tenantId: string,
  userId: string,
  localPath: string,
  cloudFileIds?: {
    googleDriveFileId?: string;
    oneDriveFileId?: string;
  }
): Promise<{
  buffer: Buffer;
  source: 'local' | 'google_drive' | 'onedrive';
}> {
  // Try local first (should always exist)
  try {
    const fullLocalPath = resolve(localPath);
    if (existsSync(fullLocalPath)) {
      const buffer = await readFile(fullLocalPath);
      console.log(`[Document Retrieval] ✓ Retrieved from local: ${localPath}`);
      return { buffer, source: 'local' };
    }
  } catch (error) {
    console.error(`[Document Retrieval] Local read failed:`, error);
  }

  // Fallback to Google Drive
  if (cloudFileIds?.googleDriveFileId) {
    try {
      const hasConsent = await credentialStorage.hasCredentials(tenantId, userId, 'google_drive');
      if (hasConsent) {
        const buffer = await googleDriveService.downloadFile(
          tenantId,
          userId,
          cloudFileIds.googleDriveFileId
        );
        
        // Cache locally
        await cacheDocument(localPath, buffer);
        console.log(`[Document Retrieval] ✓ Retrieved from Google Drive: ${cloudFileIds.googleDriveFileId}`);
        return { buffer, source: 'google_drive' };
      }
    } catch (error) {
      console.error(`[Document Retrieval] Google Drive fallback failed:`, error);
    }
  }

  // Fallback to OneDrive
  if (cloudFileIds?.oneDriveFileId) {
    try {
      const hasConsent = await credentialStorage.hasCredentials(tenantId, userId, 'onedrive');
      if (hasConsent) {
        const buffer = await oneDriveService.downloadFile(
          tenantId,
          userId,
          cloudFileIds.oneDriveFileId
        );
        
        // Cache locally
        await cacheDocument(localPath, buffer);
        console.log(`[Document Retrieval] ✓ Retrieved from OneDrive: ${cloudFileIds.oneDriveFileId}`);
        return { buffer, source: 'onedrive' };
      }
    } catch (error) {
      console.error(`[Document Retrieval] OneDrive fallback failed:`, error);
    }
  }

  throw new Error('Document not found in local or cloud storage');
}

async function cacheDocument(localPath: string, buffer: Buffer): Promise<void> {
  try {
    const cachePath = join(CACHE_DIR, localPath.split('/').pop() || 'document');
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, buffer);
    console.log(`[Document Retrieval] Cached to: ${cachePath}`);
  } catch (error) {
    console.error(`[Document Retrieval] Cache write failed:`, error);
    // Non-fatal: cache failure doesn't block retrieval
  }
}
