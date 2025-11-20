import { storage } from '../storage';
import { notifyComplianceDeadline } from '../notifications/push-service';

/**
 * Weekly Job: Send push notifications for upcoming compliance deadlines
 * 
 * Runs weekly to notify users about compliance deadlines that are approaching.
 * Helps ensure regulatory requirements are met on time.
 */

export async function notifyComplianceDeadlinesJob() {
  console.log('[NotifyComplianceDeadlines] Starting weekly job...');

  try {
    // Get all tenants
    const allTenants = await storage.getAllTenants();
    console.log(`[NotifyComplianceDeadlines] Processing ${allTenants.length} tenant(s)`);

    let totalNotificationsSent = 0;
    let totalDeadlines = 0;

    for (const tenant of allTenants) {
      try {
        // Get all compliance deadlines for this tenant
        const deadlines = await storage.getComplianceDeadlines(tenant.id);
        const today = new Date();
        
        // Filter upcoming deadlines (within next 30 days)
        const upcomingDeadlines = deadlines.filter(deadline => {
          if (!deadline.dueDate) return false;
          const dueDate = new Date(deadline.dueDate);
          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only notify for deadlines within next 30 days and not yet completed
          return daysUntilDue > 0 && daysUntilDue <= 30 && deadline.status !== 'completed';
        });

        if (upcomingDeadlines.length === 0) {
          console.log(`[NotifyComplianceDeadlines] No upcoming deadlines for tenant ${tenant.name}`);
          continue;
        }

        totalDeadlines += upcomingDeadlines.length;
        console.log(`[NotifyComplianceDeadlines] Found ${upcomingDeadlines.length} upcoming deadline(s) for tenant ${tenant.name}`);

        // Get tenant members who should be notified (owners, accountants, compliance officers)
        const tenantMembers = await storage.getTenantMembersWithRoles(tenant.id);
        const relevantMembers = tenantMembers.filter(member => 
          member.roles.includes('owner') || 
          member.roles.includes('accountant') || 
          member.roles.includes('controller') ||
          member.roles.includes('compliance_officer')
        );

        if (relevantMembers.length === 0) {
          console.log(`[NotifyComplianceDeadlines] No relevant members found for tenant ${tenant.name}`);
          continue;
        }

        // Send notifications for each upcoming deadline
        for (const deadline of upcomingDeadlines) {
          const dueDate = new Date(deadline.dueDate!);
          const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Send notifications at specific intervals: 30, 14, 7, 3, 1 days before
          const notificationTriggers = [30, 14, 7, 3, 1];
          const shouldNotify = notificationTriggers.includes(daysRemaining);

          if (!shouldNotify) {
            continue;
          }

          // Get user IDs to notify
          const userIds = relevantMembers.map(m => m.userId);

          try {
            await notifyComplianceDeadline({
              tenantId: tenant.id,
              userIds,
              deadline: {
                id: deadline.id!,
                title: deadline.title,
                dueDate: dueDate.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }),
                daysRemaining,
              },
            });

            totalNotificationsSent += userIds.length;
          } catch (error: any) {
            console.error(`[NotifyComplianceDeadlines] Failed to send notification for deadline ${deadline.title}:`, error.message);
          }
        }
      } catch (tenantError: any) {
        console.error(`[NotifyComplianceDeadlines] Error processing tenant ${tenant.name}:`, tenantError.message);
      }
    }

    console.log(`[NotifyComplianceDeadlines] Job completed. Sent ${totalNotificationsSent} notification(s) for ${totalDeadlines} deadline(s)`);
  } catch (error: any) {
    console.error('[NotifyComplianceDeadlines] Job failed:', error);
    throw error;
  }
}
