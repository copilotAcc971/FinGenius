import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from './db';
import { openBankingConnections, bankAccounts, bankTransactions, openBankingPayments } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TransactionSyncService } from './open-banking/transaction-sync-service';

export const webhookRouter = express.Router();

// Apply raw body middleware ONLY to this router
webhookRouter.use(express.raw({ type: 'application/json', limit: '1mb' }));

// POST /lean - Handle Lean webhook events
webhookRouter.post('/lean', async (req, res) => {
  try {
    const signature = req.headers['lean-signature'] as string;
    const webhookSecret = process.env.LEAN_WEBHOOK_SECRET;
    
    // Parse the body (it's a Buffer because we used express.raw)
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    const payload = JSON.parse(rawBody.toString());
    
    // CRITICAL: Verify webhook signature using raw body
    if (webhookSecret && signature) {
      // Calculate expected signature
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      
      // CRITICAL: Check buffer lengths BEFORE timingSafeEqual to prevent DoS
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        console.error('[Lean Webhook] Invalid signature length', {
          receivedLength: signatureBuffer.length,
          expectedLength: expectedBuffer.length,
          clientIp: req.ip || (req as any).connection?.remoteAddress,
        });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
      
      // Timing-safe comparison (now safe because lengths are equal)
      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
      
      if (!isValid) {
        console.error('[Lean Webhook] Invalid signature - possible spoofing attempt', {
          clientIp: req.ip || (req as any).connection?.remoteAddress,
        });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
      
      console.log('[Lean Webhook] Signature verified successfully');
    } else if (process.env.LEAN_SANDBOX_MODE === 'true') {
      // SANDBOX MODE: Explicitly enabled for testing - allow webhooks without HMAC
      console.log('[Lean Webhook] Sandbox mode enabled - signature verification skipped');
    } else {
      // PRODUCTION MODE: Reject all webhooks without proper HMAC authentication
      console.error('[Lean Webhook] Webhook authentication failed - missing or invalid credentials', {
        hasSecret: !!webhookSecret,
        hasSignature: !!signature,
        sandboxMode: process.env.LEAN_SANDBOX_MODE,
        clientIp: req.ip || (req as any).connection?.remoteAddress,
      });
      return res.status(401).json({ error: 'Webhook authentication required' });
    }
    
    console.log('[Lean Webhook] Received event:', {
      type: payload.event_type,
      entityId: payload.entity_id,
      timestamp: payload.timestamp,
    });

    // Handle different event types
    switch (payload.event_type) {
      case 'ACCOUNT_CONNECTED':
        console.log('[Lean Webhook] Account connected:', {
          entityId: payload.entity_id,
          customerId: payload.customer_id,
        });
        break;
      
      case 'ACCOUNT_DISCONNECTED':
        console.log('[Lean Webhook] Account disconnected:', {
          entityId: payload.entity_id,
        });
        
        await db.update(openBankingConnections)
          .set({ status: 'disconnected' })
          .where(eq(openBankingConnections.entityId, payload.entity_id));
        break;
      
      case 'TRANSACTION_UPDATE':
        console.log('[Lean Webhook] Transaction update:', {
          entityId: payload.entity_id,
          accountId: payload.account_id,
        });
        
        if (payload.account_id) {
          const [bankAccount] = await db.select()
            .from(bankAccounts)
            .where(eq(bankAccounts.accountId, payload.account_id))
            .limit(1);
          
          if (bankAccount) {
            console.log('[Lean Webhook] Triggering transaction sync for account:', bankAccount.id);
            
            const syncService = new TransactionSyncService(bankAccount.tenantId);
            
            syncService.syncAccountTransactions(
              bankAccount.id,
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              new Date()
            ).catch((error) => {
              console.error('[Lean Webhook] Background transaction sync failed:', error);
            });
          }
        }
        break;
      
      case 'PAYMENT_STATUS_CHANGED':
        console.log('[Lean Webhook] Payment status changed:', {
          paymentId: payload.payment_id,
          status: payload.status,
        });
        
        if (payload.payment_id && payload.status) {
          const [updatedPayment] = await db.update(openBankingPayments)
            .set({ 
              status: payload.status,
              completedAt: payload.status === 'completed' ? sql`CURRENT_TIMESTAMP` : null,
              failedAt: payload.status === 'failed' ? sql`CURRENT_TIMESTAMP` : null,
              errorMessage: payload.error_message || null,
              metadata: {
                ...payload,
                leanTransactionId: payload.transaction_id,
                leanPaymentMethod: payload.payment_method,
                leanTimestamp: payload.timestamp,
              },
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(openBankingPayments.providerPaymentId, payload.payment_id))
            .returning();
          
          if (updatedPayment && payload.status === 'completed' && payload.transaction_id) {
            try {
              const [bankTxn] = await db.select()
                .from(bankTransactions)
                .where(and(
                  eq(bankTransactions.providerTransactionId, payload.transaction_id),
                  eq(bankTransactions.tenantId, updatedPayment.tenantId)
                ))
                .limit(1);
              
              if (bankTxn) {
                console.log('[Lean Webhook] Auto-matching completed payment with bank transaction:', {
                  paymentId: updatedPayment.id,
                  bankTransactionId: bankTxn.id,
                });
              }
            } catch (error) {
              console.error('[Lean Webhook] Payment-transaction matching error (non-critical):', error);
            }
          }
          
          console.log('[Lean Webhook] Payment status updated:', {
            paymentId: payload.payment_id,
            newStatus: payload.status,
          });
        }
        break;
      
      default:
        console.log('[Lean Webhook] Unknown event type:', {
          eventType: payload.event_type,
          payload,
        });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Lean Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
