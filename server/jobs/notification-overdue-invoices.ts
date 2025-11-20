import { storage } from '../storage';
import { notifyOverdueInvoice } from '../notifications/push-service';

/**
 * Daily Job: Send push notifications for overdue invoices
 * 
 * Runs daily to notify users about invoices that are past their due date.
 * This helps ensure timely follow-up on outstanding payments.
 */

export async function notifyOverdueInvoicesJob() {
  console.log('[NotifyOverdueInvoices] Starting daily job...');

  try {
    // Get all tenants
    const allTenants = await storage.getAllTenants();
    console.log(`[NotifyOverdueInvoices] Processing ${allTenants.length} tenant(s)`);

    let totalNotificationsSent = 0;
    let totalOverdueInvoices = 0;

    for (const tenant of allTenants) {
      try {
        // Get all invoices for this tenant
        const invoices = await storage.getInvoicesByTenant(tenant.id, false);
        const today = new Date();

        // Filter overdue invoices
        const overdueInvoices = invoices.filter(inv => {
          if (inv.status !== 'sent' && inv.status !== 'partial') return false;
          if (!inv.dueDate) return false;
          const dueDate = new Date(inv.dueDate);
          return dueDate < today;
        });

        if (overdueInvoices.length === 0) {
          console.log(`[NotifyOverdueInvoices] No overdue invoices for tenant ${tenant.name}`);
          continue;
        }

        totalOverdueInvoices += overdueInvoices.length;
        console.log(`[NotifyOverdueInvoices] Found ${overdueInvoices.length} overdue invoice(s) for tenant ${tenant.name}`);

        // Get tenant owner to send notifications
        const tenantMembers = await storage.getTenantMembersWithRoles(tenant.id);
        const ownersAndAccountants = tenantMembers.filter(member => 
          member.roles.includes('owner') || member.roles.includes('accountant') || member.roles.includes('accounts_receivable')
        );

        if (ownersAndAccountants.length === 0) {
          console.log(`[NotifyOverdueInvoices] No owner/accountant found for tenant ${tenant.name}`);
          continue;
        }

        // Send notifications for each overdue invoice
        for (const invoice of overdueInvoices) {
          const dueDate = new Date(invoice.dueDate!);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Only send notifications for invoices that are 1, 7, 14, 30, or 60+ days overdue
          // This prevents spam while ensuring regular reminders
          const notificationTriggers = [1, 7, 14, 30, 60, 90];
          const shouldNotify = notificationTriggers.includes(daysOverdue) || 
                              (daysOverdue > 90 && daysOverdue % 30 === 0);

          if (!shouldNotify) {
            continue;
          }

          // Send to all owners and accountants
          for (const member of ownersAndAccountants) {
            try {
              await notifyOverdueInvoice({
                tenantId: tenant.id,
                userId: member.userId,
                invoice: {
                  id: invoice.id!,
                  invoiceNumber: invoice.invoiceNumber || 'Draft',
                  customerName: invoice.customerName || 'Unknown Customer',
                  total: `${invoice.currencyCode || 'USD'} ${invoice.total}`,
                  daysOverdue,
                },
              });

              totalNotificationsSent++;
            } catch (error: any) {
              console.error(`[NotifyOverdueInvoices] Failed to send notification for invoice ${invoice.invoiceNumber}:`, error.message);
            }
          }
        }
      } catch (tenantError: any) {
        console.error(`[NotifyOverdueInvoices] Error processing tenant ${tenant.name}:`, tenantError.message);
      }
    }

    console.log(`[NotifyOverdueInvoices] Job completed. Sent ${totalNotificationsSent} notification(s) for ${totalOverdueInvoices} overdue invoice(s)`);
  } catch (error: any) {
    console.error('[NotifyOverdueInvoices] Job failed:', error);
    throw error;
  }
}
