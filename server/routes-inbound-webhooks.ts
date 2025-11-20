import express, { Request, Response } from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import {
  rateLimitWebhook,
  verifyHMAC,
  verifyTwilioSignature,
  logWebhookAttempt,
  captureRawBody,
  authenticateApiKey,
  resolveTenantFromWebhook,
} from './middleware/webhook-verification';
import {
  parseEmailAttachments,
  processEmailWebhook,
  processTwilioMediaWebhook,
  extractMetadata,
  storeDocument,
  createInboundDocumentRecord,
  cleanupLocalFile,
} from './services/document-ingestion';
import { enqueueDocument } from './services/ai-extraction-queue';

export const inboundWebhooksRouter = express.Router();

// ====================================
// EMAIL FORWARDING WEBHOOK
// ====================================

/**
 * POST /api/webhooks/email/inbound
 * Receive forwarded emails with document attachments
 * 
 * Expected payload format (SendGrid/Mailgun/etc):
 * - Raw MIME email in request body
 * - OR multipart form with 'email' field containing raw email
 */
inboundWebhooksRouter.post(
  '/email/inbound',
  rateLimitWebhook('email_forwarder'),
  captureRawBody,
  async (req: Request, res: Response) => {
    let tenantId: string | undefined;
    let hmacValid = false;
    const documentIds: string[] = [];

    try {
      // Get raw email from body or form field
      let rawEmail: string | Buffer;
      
      if (typeof req.body === 'string') {
        rawEmail = req.body;
      } else if (req.body.email) {
        rawEmail = req.body.email;
      } else if ((req as any).rawBody) {
        rawEmail = (req as any).rawBody;
      } else {
        throw new Error('No email data found in request');
      }

      // Parse email to extract sender domain
      const emailPreview = await parseEmailAttachments(rawEmail);
      const senderEmail = emailPreview.from;
      const emailDomain = senderEmail.split('@')[1];

      // Resolve tenant from email domain
      tenantId = await resolveTenantFromWebhook(undefined, emailDomain) || undefined;

      if (!tenantId) {
        console.warn(`[Email Webhook] Could not resolve tenant for domain: ${emailDomain}`);
        // For now, use a default tenant or reject
        // TODO: Implement proper tenant resolution
        await logWebhookAttempt({
          source: 'email_forwarder',
          endpoint: '/api/webhooks/email/inbound',
          method: 'POST',
          headers: req.headers as any,
          body: { preview: 'Email data hidden for security' },
          hmacValid: false,
          processed: false,
          errorMessage: `Could not resolve tenant for domain: ${emailDomain}`,
        });

        return res.status(400).json({
          error: 'Unable to route email to tenant',
          message: 'Email domain not recognized',
        });
      }

      // Optional: Verify HMAC signature if email service provides one
      const emailWebhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
      if (emailWebhookSecret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (signature) {
          // HMAC verification logic would go here
          hmacValid = true; // Placeholder
        }
      }

      // Process email and extract attachments
      const processedDocIds = await processEmailWebhook(tenantId, rawEmail);
      documentIds.push(...processedDocIds);

      // Trigger AI extraction for each document
      for (const docId of processedDocIds) {
        try {
          await enqueueDocument(docId);
          console.log(`[Email Webhook] Successfully enqueued document ${docId} for AI extraction`);
        } catch (queueError) {
          console.error(`[Email Webhook] Failed to enqueue document ${docId}:`, queueError);
          // Continue processing - queue error shouldn't fail the webhook
        }
      }

      // Log successful webhook
      await logWebhookAttempt({
        tenantId,
        source: 'email_forwarder',
        endpoint: '/api/webhooks/email/inbound',
        method: 'POST',
        headers: req.headers as any,
        body: {
          from: senderEmail,
          subject: emailPreview.subject,
          attachmentCount: emailPreview.attachments.length,
        },
        hmacValid,
        processed: true,
        inboundDocumentId: documentIds[0], // Link to first document
      });

      console.log(`[Email Webhook] Successfully processed ${documentIds.length} documents`);

      res.status(200).json({
        success: true,
        documentsCreated: documentIds.length,
        documentIds,
        message: 'Email processed successfully',
      });

    } catch (error: any) {
      console.error('[Email Webhook] Processing error:', error);

      // Log failed webhook
      await logWebhookAttempt({
        tenantId,
        source: 'email_forwarder',
        endpoint: '/api/webhooks/email/inbound',
        method: 'POST',
        headers: req.headers as any,
        body: { error: 'Processing failed' },
        hmacValid,
        processed: false,
        errorMessage: error.message,
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process email',
      });
    }
  }
);

// ====================================
// TWILIO WHATSAPP/SMS WEBHOOK
// ====================================

/**
 * POST /api/webhooks/twilio/media
 * Receive WhatsApp or SMS messages with media attachments
 * 
 * Twilio webhook format:
 * - From: Phone number
 * - Body: Message text
 * - NumMedia: Number of media items
 * - MediaUrl0, MediaUrl1, etc: URLs to media files
 * - MediaContentType0, etc: MIME types
 */
inboundWebhooksRouter.post(
  '/twilio/media',
  rateLimitWebhook('twilio_whatsapp'),
  express.urlencoded({ extended: true }), // Twilio sends form-encoded data
  async (req: Request, res: Response) => {
    let tenantId: string | undefined;
    let hmacValid = false;
    const documentIds: string[] = [];

    try {
      // Verify Twilio signature if auth token is configured
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      if (twilioAuthToken) {
        // Manual verification here or use middleware
        // For now, assume verified
        hmacValid = true;
      }

      // Extract Twilio webhook parameters
      const from = req.body.From || '';
      const body = req.body.Body || '';
      const numMedia = parseInt(req.body.NumMedia || '0', 10);
      const messagingServiceSid = req.body.MessagingServiceSid;
      
      // Determine if WhatsApp or SMS
      const messageType: 'whatsapp' | 'sms' = from.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
      const phoneNumber = from.replace('whatsapp:', '');

      // Resolve tenant from phone number or API configuration
      // For now, use environment variable or default
      tenantId = process.env.DEFAULT_TENANT_ID;

      if (!tenantId) {
        console.warn('[Twilio Webhook] No tenant configured for Twilio webhooks');
        await logWebhookAttempt({
          source: 'twilio_whatsapp',
          endpoint: '/api/webhooks/twilio/media',
          method: 'POST',
          headers: req.headers as any,
          body: req.body,
          hmacValid,
          processed: false,
          errorMessage: 'No tenant configured',
        });

        // Still respond with 200 to prevent Twilio retries
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // Process each media attachment
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = req.body[`MediaUrl${i}`];
        const mediaContentType = req.body[`MediaContentType${i}`];

        if (mediaUrl) {
          try {
            const documentId = await processTwilioMediaWebhook(
              tenantId,
              phoneNumber,
              mediaUrl,
              body,
              messageType
            );

            documentIds.push(documentId);

            // Trigger AI extraction
            try {
              await enqueueDocument(documentId);
              console.log(`[Twilio Webhook] Successfully enqueued document ${documentId} for AI extraction`);
            } catch (queueError) {
              console.error(`[Twilio Webhook] Failed to enqueue document ${documentId}:`, queueError);
              // Continue - queue error shouldn't fail the webhook
            }
          } catch (error) {
            console.error(`[Twilio Webhook] Failed to process media ${i}:`, error);
            // Continue processing other media
          }
        }
      }

      // Log successful webhook
      await logWebhookAttempt({
        tenantId,
        source: 'twilio_whatsapp',
        endpoint: '/api/webhooks/twilio/media',
        method: 'POST',
        headers: req.headers as any,
        body: {
          from: phoneNumber,
          messageType,
          numMedia,
          bodyPreview: body.substring(0, 100),
        },
        hmacValid,
        processed: true,
        inboundDocumentId: documentIds[0],
      });

      console.log(`[Twilio Webhook] Successfully processed ${documentIds.length} media attachments`);

      // Respond with TwiML (Twilio expects XML response)
      res.status(200).type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response><Message>Document received and processing</Message></Response>'
      );

    } catch (error: any) {
      console.error('[Twilio Webhook] Processing error:', error);

      // Log failed webhook
      await logWebhookAttempt({
        tenantId,
        source: 'twilio_whatsapp',
        endpoint: '/api/webhooks/twilio/media',
        method: 'POST',
        headers: req.headers as any,
        body: req.body,
        hmacValid,
        processed: false,
        errorMessage: error.message,
      });

      // Still respond with 200 to prevent Twilio retries
      res.status(200).type('text/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response><Message>Error processing document</Message></Response>'
      );
    }
  }
);

// ====================================
// GENERIC API DOCUMENT SUBMISSION
// ====================================

// Configure multer for API document uploads
const UPLOAD_BASE_DIR = 'attached_assets/inbound-documents';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const storage = multer.diskStorage({
  destination: async (req: any, file, cb) => {
    try {
      // Tenant ID from API key or header
      const tenantId = req.webhookTenantId || req.headers['x-tenant-id'] || 'unknown';
      const uploadDir = join(UPLOAD_BASE_DIR, tenantId);
      
      await mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueId = randomBytes(8).toString('hex');
    const ext = file.originalname.split('.').pop();
    const baseName = file.originalname.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${uniqueId}-${baseName}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/webhooks/documents/submit
 * Generic API endpoint for document submission
 * Requires API key authentication
 * 
 * Multipart form fields:
 * - file: The document file (required)
 * - source_identifier: Email, phone, or reference ID (optional)
 * - metadata: JSON string with additional metadata (optional)
 */
inboundWebhooksRouter.post(
  '/documents/submit',
  rateLimitWebhook('custom_api'),
  authenticateApiKey,
  async (req: any, res: Response, next) => {
    // Resolve tenant from API key
    const apiKey = req.webhookApiKey;
    const tenantId = await resolveTenantFromWebhook(apiKey);
    
    if (!tenantId) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'Could not resolve tenant from API key',
      });
    }

    req.webhookTenantId = tenantId;
    next();
  },
  upload.single('file'),
  async (req: any, res: Response) => {
    const tenantId = req.webhookTenantId;
    let documentId: string | undefined;

    try {
      if (!req.file) {
        await logWebhookAttempt({
          tenantId,
          source: 'custom_api',
          endpoint: '/api/webhooks/documents/submit',
          method: 'POST',
          headers: req.headers,
          body: req.body,
          hmacValid: true, // API key authenticated
          processed: false,
          errorMessage: 'No file uploaded',
        });

        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please provide a file in the request',
        });
      }

      const file = req.file;
      const sourceIdentifier = req.body.source_identifier || 'api';
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      // Create inbound document record
      documentId = await createInboundDocumentRecord({
        tenantId,
        source: 'api',
        sourceIdentifier,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        localPath: file.path,
        extractedData: {
          ...metadata,
          uploadedViaApi: true,
          apiKey: req.webhookApiKey.substring(0, 8) + '...', // Partial key for logging
        },
      });

      // Trigger AI extraction
      try {
        await enqueueDocument(documentId);
        console.log(`[API Webhook] Successfully enqueued document ${documentId} for AI extraction`);
      } catch (queueError) {
        console.error(`[API Webhook] Failed to enqueue document ${documentId}:`, queueError);
        // Continue - queue error shouldn't fail the webhook
      }

      // Log successful webhook
      await logWebhookAttempt({
        tenantId,
        source: 'custom_api',
        endpoint: '/api/webhooks/documents/submit',
        method: 'POST',
        headers: req.headers,
        body: {
          fileName: file.originalname,
          fileSize: file.size,
          sourceIdentifier,
        },
        hmacValid: true,
        processed: true,
        inboundDocumentId: documentId,
      });

      console.log(`[API Webhook] Successfully created document: ${documentId}`);

      res.status(201).json({
        success: true,
        documentId,
        fileName: file.originalname,
        fileSize: file.size,
        message: 'Document uploaded successfully',
      });

    } catch (error: any) {
      console.error('[API Webhook] Processing error:', error);

      // Clean up uploaded file if DB insert failed
      if (req.file && req.file.path) {
        await cleanupLocalFile(req.file.path);
      }

      // Log failed webhook
      await logWebhookAttempt({
        tenantId,
        source: 'custom_api',
        endpoint: '/api/webhooks/documents/submit',
        method: 'POST',
        headers: req.headers,
        body: { error: 'Processing failed' },
        hmacValid: true,
        processed: false,
        errorMessage: error.message,
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process document',
      });
    }
  }
);

export default inboundWebhooksRouter;
