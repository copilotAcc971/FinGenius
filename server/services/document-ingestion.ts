import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { inboundDocuments, type InsertInboundDocument } from '@shared/schema';
import { googleDriveService } from '../cloud-storage/google-drive';
import { oneDriveService } from '../cloud-storage/onedrive';

const UPLOAD_BASE_DIR = 'attached_assets/inbound-documents';

/**
 * Parse email attachments from raw email data
 * Supports MIME parsing for email forwarding webhooks
 */
export async function parseEmailAttachments(
  rawEmail: string | Buffer
): Promise<{
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
}> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  return {
    from: parsed.from?.text || '',
    subject: parsed.subject || '',
    bodyText: parsed.text || '',
    bodyHtml: parsed.html || '',
    attachments: parsed.attachments.map((att: Attachment) => ({
      filename: att.filename || 'unknown',
      content: att.content,
      contentType: att.contentType,
      size: att.size,
    })),
  };
}

/**
 * Download media from Twilio media URL
 * Twilio provides authenticated media URLs that expire
 */
export async function downloadTwilioMedia(
  mediaUrl: string,
  accountSid: string,
  authToken: string
): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
}> {
  const response = await axios.get(mediaUrl, {
    auth: {
      username: accountSid,
      password: authToken,
    },
    responseType: 'arraybuffer',
    timeout: 30000, // 30 second timeout
  });

  const contentType = response.headers['content-type'] || 'application/octet-stream';
  
  // Extract filename from URL or generate one
  const urlPath = new URL(mediaUrl).pathname;
  const fileExt = extname(urlPath) || getExtensionFromMimeType(contentType);
  const filename = basename(urlPath) || `media_${Date.now()}${fileExt}`;

  return {
    buffer: Buffer.from(response.data),
    contentType,
    filename,
  };
}

/**
 * Extract metadata from file buffer
 */
export function extractMetadata(
  filename: string,
  buffer: Buffer,
  contentType?: string
): {
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
} {
  const fileSize = buffer.length;
  const extension = extname(filename).toLowerCase();
  const mimeType = contentType || getMimeTypeFromExtension(extension);

  return {
    fileName: filename,
    fileSize,
    mimeType,
    extension,
  };
}

/**
 * Store document to local and optionally cloud storage
 * Returns local path and cloud file IDs (if applicable)
 * 
 * RESILIENT DESIGN:
 * - Local storage ALWAYS succeeds (primary storage)
 * - Cloud uploads run in parallel with Promise.allSettled
 * - Partial failures are acceptable (local + 1 cloud = success)
 * - Errors are logged but don't block the operation
 */
export async function storeDocument(
  tenantId: string,
  buffer: Buffer,
  filename: string,
  options?: {
    userId?: string;  // Optional, defaults to 'system' for webhooks
    uploadToGoogleDrive?: boolean;
    uploadToOneDrive?: boolean;
    folderId?: string;
  }
): Promise<{
  localPath: string;
  googleDriveFileId?: string;
  oneDriveFileId?: string;
  errors?: { provider: string; error: string }[];
}> {
  // Default userId to 'system' for webhook/unauthenticated uploads
  const userId = options?.userId || 'system';

  // Step 1: Save to local disk (ALWAYS succeeds)
  const uploadDir = join(UPLOAD_BASE_DIR, tenantId);
  await mkdir(uploadDir, { recursive: true });

  const uniqueId = randomBytes(8).toString('hex');
  const ext = extname(filename);
  const baseName = basename(filename, ext);
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueFilename = `${uniqueId}-${sanitizedBaseName}${ext}`;
  const localPath = join(uploadDir, uniqueFilename);

  await writeFile(localPath, buffer);

  // Step 2: Parallel cloud uploads with Promise.allSettled
  // Tag promises with provider names
  const taggedUploads: Promise<{ provider: string; fileId?: string; error?: any }>[] = [];

  if (options?.uploadToGoogleDrive) {
    taggedUploads.push(
      googleDriveService
        .uploadFile(tenantId, userId, buffer, filename, options?.folderId)
        .then((fileId) => ({ provider: 'google_drive', fileId }))
        .catch((error) => ({ provider: 'google_drive', error }))
    );
  }

  if (options?.uploadToOneDrive) {
    taggedUploads.push(
      oneDriveService
        .uploadFile(tenantId, userId, buffer, filename, options?.folderId)
        .then((fileId) => ({ provider: 'onedrive', fileId }))
        .catch((error) => ({ provider: 'onedrive', error }))
    );
  }

  // Step 3: Wait for all cloud uploads (don't fail on partial errors)
  const results = await Promise.allSettled(taggedUploads);

  // Step 4: Process results
  const finalResult: {
    localPath: string;
    googleDriveFileId?: string;
    oneDriveFileId?: string;
    errors?: { provider: string; error: string }[];
  } = { localPath };

  const errors: { provider: string; error: string }[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { provider, fileId, error } = result.value;
      if (fileId) {
        if (provider === 'google_drive') {
          finalResult.googleDriveFileId = fileId;
        } else if (provider === 'onedrive') {
          finalResult.oneDriveFileId = fileId;
        }
      } else if (error) {
        errors.push({
          provider,
          error: error.message || 'Upload failed',
        });
        console.error(`[Document Ingestion] ✗ ${provider} upload failed:`, error);
      }
    }
  });

  if (errors.length > 0) {
    finalResult.errors = errors;
  }

  return finalResult;
}

/**
 * Create inbound document record in database
 */
export async function createInboundDocumentRecord(
  data: InsertInboundDocument
): Promise<string> {
  const [record] = await db
    .insert(inboundDocuments)
    .values({
      ...data,
      status: 'pending',
      notificationSent: false,
    })
    .returning();

  return record.id;
}

/**
 * Clean up local file if processing fails
 */
export async function cleanupLocalFile(localPath: string): Promise<void> {
  try {
    await unlink(localPath);
  } catch (error) {
    console.error(`[Document Ingestion] Failed to cleanup file ${localPath}:`, error);
  }
}

/**
 * Process email webhook payload
 * Parses email, extracts attachments, stores them, and creates DB records
 */
export async function processEmailWebhook(
  tenantId: string,
  rawEmail: string | Buffer,
  options?: {
    userId?: string;  // Optional, defaults to 'system' for webhooks
    uploadToGoogleDrive?: boolean;
    uploadToOneDrive?: boolean;
  }
): Promise<string[]> {
  const parsed = await parseEmailAttachments(rawEmail);
  const documentIds: string[] = [];

  for (const attachment of parsed.attachments) {
    try {
      const metadata = extractMetadata(
        attachment.filename,
        attachment.content,
        attachment.contentType
      );

      const { localPath, googleDriveFileId, oneDriveFileId, errors } = await storeDocument(
        tenantId,
        attachment.content,
        metadata.fileName,
        options
      );

      const documentId = await createInboundDocumentRecord({
        tenantId,
        source: 'email',
        sourceIdentifier: parsed.from,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        localPath,
        googleDriveFileId,
        oneDriveFileId,
        extractedData: {
          emailSubject: parsed.subject,
          emailFrom: parsed.from,
          emailBodyText: parsed.bodyText.substring(0, 1000), // Store first 1000 chars
          emailBodyHtml: parsed.bodyHtml.substring(0, 1000),
        },
      });

      documentIds.push(documentId);
    } catch (error) {
      console.error('[Document Ingestion] Failed to process email attachment:', error);
      // Continue processing other attachments
    }
  }

  return documentIds;
}

/**
 * Process Twilio media webhook payload
 */
export async function processTwilioMediaWebhook(
  tenantId: string,
  phoneNumber: string,
  mediaUrl: string,
  messageText: string,
  messageType: 'whatsapp' | 'sms',
  options?: {
    userId?: string;  // Optional, defaults to 'system' for webhooks
    uploadToGoogleDrive?: boolean;
    uploadToOneDrive?: boolean;
  }
): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  const { buffer, contentType, filename } = await downloadTwilioMedia(
    mediaUrl,
    accountSid,
    authToken
  );

  const metadata = extractMetadata(filename, buffer, contentType);

  const { localPath, googleDriveFileId, oneDriveFileId, errors } = await storeDocument(
    tenantId,
    buffer,
    metadata.fileName,
    options
  );

  const documentId = await createInboundDocumentRecord({
    tenantId,
    source: messageType,
    sourceIdentifier: phoneNumber,
    fileName: metadata.fileName,
    fileSize: metadata.fileSize,
    mimeType: metadata.mimeType,
    localPath,
    googleDriveFileId,
    oneDriveFileId,
    extractedData: {
      phoneNumber,
      messageText,
      mediaUrl,
      messageType,
    },
  });

  return documentId;
}

// Helper functions

function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  };

  return mimeMap[mimeType] || '';
}

function getMimeTypeFromExtension(extension: string): string {
  const extMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  return extMap[extension.toLowerCase()] || 'application/octet-stream';
}
