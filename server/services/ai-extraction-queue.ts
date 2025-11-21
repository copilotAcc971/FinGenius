import { readFile } from 'fs/promises';
import { storage } from '../storage';
import { DocumentProcessor } from '../ai-copilot/document-processor';
import { createDraftFromExtraction } from './auto-draft-service';
import type { InboundDocument } from '@shared/schema';
import { getPushService } from '../notifications/push-service';

/**
 * AI Extraction Job Queue
 * 
 * Processes inbound documents sequentially using GPT-4o Vision
 * - Extracts data from documents (invoices, bills, receipts)
 * - Creates draft accounting entries
 * - Sends notifications to users
 * - Handles retries and error logging
 */

interface QueueJob {
  inboundDocumentId: string;
  tenantId: string;
  attempts: number;
}

class AIExtractionQueue {
  private queue: QueueJob[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;
  private documentProcessor: DocumentProcessor | null = null;

  constructor() {
    this.initializeProcessor();
  }

  private initializeProcessor() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[AI Extraction Queue] OPENAI_API_KEY not configured');
      return;
    }
    this.documentProcessor = new DocumentProcessor(openaiApiKey);
  }

  /**
   * Add document to extraction queue
   */
  async enqueue(inboundDocumentId: string, tenantId: string): Promise<void> {
    this.queue.push({
      inboundDocumentId,
      tenantId,
      attempts: 0,
    });


    // Start processing if not already running
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        await this.processInboundDocument(job.inboundDocumentId);
      } catch (error: any) {
        console.error(`[AI Extraction Queue] Failed to process ${job.inboundDocumentId}:`, error);

        // Retry logic
        if (job.attempts < this.maxRetries) {
          job.attempts++;
          this.queue.push(job); // Re-queue for retry
        } else {
          console.error(`[AI Extraction Queue] Max retries exceeded for ${job.inboundDocumentId}`);
          
          // Mark as failed
          await storage.updateInboundDocument(job.inboundDocumentId, {
            status: 'failed',
            errorMessage: `Extraction failed after ${this.maxRetries} attempts: ${error.message}`,
          });
        }
      }

      // Add delay to respect OpenAI rate limits (1 second between requests)
      await this.delay(1000);
    }

    this.processing = false;
  }

  /**
   * Process a single inbound document
   */
  async processInboundDocument(inboundDocumentId: string): Promise<void> {
    if (!this.documentProcessor) {
      throw new Error('DocumentProcessor not initialized - OPENAI_API_KEY missing');
    }


    // Get document record
    const document = await storage.getInboundDocument(inboundDocumentId);
    if (!document) {
      throw new Error(`Document ${inboundDocumentId} not found`);
    }

    // Update status to processing
    await storage.updateInboundDocument(inboundDocumentId, {
      status: 'processing',
    });

    try {
      // Read file from local storage
      if (!document.localPath) {
        throw new Error('Document has no localPath');
      }

      const fileBuffer = await readFile(document.localPath);
      const base64Image = fileBuffer.toString('base64');

      // Extract data using GPT-4o Vision
      const extractionResult = await this.documentProcessor.extractDocumentData(base64Image);

      if (!extractionResult.success || !extractionResult.data) {
        throw new Error(extractionResult.error || 'Extraction failed');
      }

      const extractedData = extractionResult.data;

      // Store extracted data
      await storage.updateInboundDocument(inboundDocumentId, {
        extractedData,
        status: 'extracted',
        processedAt: new Date(),
      });

      // Create draft entry based on document type
      try {
        const draftEntry = await createDraftFromExtraction(inboundDocumentId, document.tenantId);
        
        // Link draft entry to inbound document
        await storage.updateInboundDocument(inboundDocumentId, {
          draftEntryId: draftEntry.id,
          draftEntryType: draftEntry.type,
        });

        // Send push notification to tenant users
        await this.sendExtractionNotification(document, extractedData, draftEntry);
        
        // Mark notification as sent
        await storage.updateInboundDocument(inboundDocumentId, {
          notificationSent: true,
        });

      } catch (draftError: any) {
        console.error(`[AI Extraction Queue] Failed to create draft entry:`, draftError);
        
        // Still mark as extracted but log the draft creation error
        await storage.updateInboundDocument(inboundDocumentId, {
          errorMessage: `Extraction successful but draft creation failed: ${draftError.message}`,
        });
      }

    } catch (error: any) {
      console.error(`[AI Extraction Queue] Extraction error for ${inboundDocumentId}:`, error);
      
      // Update with error
      await storage.updateInboundDocument(inboundDocumentId, {
        status: 'failed',
        errorMessage: error.message || 'Unknown extraction error',
      });

      throw error; // Re-throw for retry logic
    }
  }

  /**
   * Send notification about extracted document
   */
  private async sendExtractionNotification(
    document: InboundDocument,
    extractedData: any,
    draftEntry: { id: string; type: string; summary: string }
  ): Promise<void> {
    try {
      const pushService = getPushService();
      
      // Get all tenant users (could be filtered by role in the future)
      const tenantMembers = await storage.getTenantMembers(document.tenantId);
      const userIds = tenantMembers.map(m => m.userId);

      const { title, body } = this.buildNotificationContent(extractedData, draftEntry);

      for (const userId of userIds) {
        await pushService.sendToUser({
          tenantId: document.tenantId,
          userId,
          notificationType: 'approval_request',
          payload: {
            title,
            body,
            icon: '/icons/document-extracted.png',
            tag: `draft-${draftEntry.type}-${draftEntry.id}`,
            requireInteraction: true,
            data: {
              type: 'draft_approval',
              inboundDocumentId: document.id,
              draftEntryId: draftEntry.id,
              draftEntryType: draftEntry.type,
              url: `/documents/${document.id}`,
            },
            actions: [
              { action: 'approve', title: 'Approve' },
              { action: 'review', title: 'Review' },
              { action: 'reject', title: 'Reject' },
            ],
          },
        });
      }

    } catch (error) {
      console.error('[AI Extraction Queue] Failed to send notification:', error);
      // Don't fail the whole process if notification fails
    }
  }

  /**
   * Build notification content based on extracted data
   */
  private buildNotificationContent(
    extractedData: any,
    draftEntry: { type: string; summary: string }
  ): { title: string; body: string } {
    const docType = extractedData.documentType || 'document';
    const vendor = extractedData.vendorName || 'Unknown vendor';
    const customer = extractedData.customerName || 'Unknown customer';
    const total = extractedData.total ? `$${extractedData.total.toFixed(2)}` : '';

    let title = '';
    let body = '';

    switch (draftEntry.type) {
      case 'bill':
        title = '📄 New Bill Extracted';
        body = `${vendor} - ${total}. ${draftEntry.summary}`;
        break;
      case 'invoice':
        title = '📄 New Invoice Extracted';
        body = `${customer} - ${total}. ${draftEntry.summary}`;
        break;
      case 'journal_entry':
        title = '📄 New Journal Entry Extracted';
        body = draftEntry.summary;
        break;
      default:
        title = '📄 New Document Extracted';
        body = `${docType} processed. ${draftEntry.summary}`;
    }

    return { title, body };
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }
}

// Singleton instance
let queueInstance: AIExtractionQueue | null = null;

export function getExtractionQueue(): AIExtractionQueue {
  if (!queueInstance) {
    queueInstance = new AIExtractionQueue();
  }
  return queueInstance;
}

/**
 * Enqueue document for AI extraction
 * Fetches the document to get tenantId automatically
 * 
 * @param inboundDocumentId - ID of the inbound document to process
 */
export async function enqueueDocument(inboundDocumentId: string): Promise<void> {
  try {
    // Fetch document to get tenantId
    const document = await storage.getInboundDocument(inboundDocumentId);
    
    if (!document) {
      throw new Error(`Document ${inboundDocumentId} not found - cannot enqueue`);
    }

    if (!document.tenantId) {
      throw new Error(`Document ${inboundDocumentId} has no tenantId - cannot enqueue`);
    }

    // Enqueue for processing
    const queue = getExtractionQueue();
    await queue.enqueue(inboundDocumentId, document.tenantId);

  } catch (error: any) {
    console.error(`[AI Extraction Queue] Failed to enqueue document ${inboundDocumentId}:`, error);
    throw error; // Re-throw so webhook handlers can log it
  }
}

/**
 * Process a single inbound document (convenience wrapper)
 * Use this when you already have the tenantId
 * Otherwise use enqueueDocument() which fetches it automatically
 */
export async function processInboundDocument(
  inboundDocumentId: string,
  tenantId: string
): Promise<void> {
  const queue = getExtractionQueue();
  await queue.enqueue(inboundDocumentId, tenantId);
}
