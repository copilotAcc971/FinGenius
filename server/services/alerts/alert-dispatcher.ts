import { db } from '../../db';
import { 
  alertInstances,
  notificationRules,
  userNotificationPreferences,
  alertRateLimits,
  tenantMembers,
  type AlertInstance,
  type NotificationRule,
  type UserNotificationPreferences,
  type TenantMember
} from '@shared/schema';
import { eq, and, gt, inArray, sql } from 'drizzle-orm';
import { PushNotificationService } from '../../notifications/push-service';
import { sendReportEmail } from '../../email-service';
import { broadcastMetricsUpdate } from '../../dashboard/metrics-websocket-server';
import { RBACService } from '../../rbac/service';

/**
 * Permission mapping for alert types
 * Each alert type requires specific permissions to view
 */
const ALERT_TYPE_PERMISSIONS: Record<string, string> = {
  'aged_ar': 'invoices.read',
  'aged_ap': 'bills.read',
  'cash_deficiency': 'accounts.read',
  'pending_approval': 'approvals.read',
  'accrual_suggestion': 'journal_entries.read',
  'month_end': 'accounts.read',
  'compliance_deadline': 'compliance.kyc.read',
  'anomaly': 'audit.view',
};

/**
 * Rate limiting configuration
 * Max 5 alerts per user per hour across all types
 */
const RATE_LIMIT_MAX_ALERTS = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

interface DispatchResult {
  alertId: string;
  totalEligibleUsers: number;
  filteredByRBAC: number;
  filteredByPreferences: number;
  filteredByRateLimit: number;
  deliveryResults: {
    channel: 'websocket' | 'push' | 'email' | 'sms';
    success: boolean;
    error?: string;
    recipientCount?: number;
  }[];
  totalDelivered: number;
  totalFailed: number;
  skippedReason?: string;
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

interface EligibleRecipient {
  userId: string;
  email?: string;
  allowedChannels: ('websocket' | 'push' | 'email' | 'sms')[];
}

export class AlertDispatcherService {
  private pushService: PushNotificationService;
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 60000
  };

  constructor() {
    this.pushService = new PushNotificationService();
  }

  /**
   * Dispatch alert with RBAC, preference, and rate limit gating
   */
  async dispatchAlert(
    alertInstance: AlertInstance,
    retryConfig: RetryConfig = this.DEFAULT_RETRY_CONFIG
  ): Promise<DispatchResult> {
    console.log(`[Alert Dispatcher] Starting dispatch for alert ${alertInstance.id} - ${alertInstance.title}`);

    // STEP 1: Check notification rules
    const rules = await this.getEnabledNotificationRules(
      alertInstance.tenantId,
      alertInstance.alertType,
      alertInstance.priority
    );

    if (rules.length === 0) {
      console.log(`[Alert Dispatcher] No enabled notification rules found for ${alertInstance.alertType}`);
      return {
        alertId: alertInstance.id,
        totalEligibleUsers: 0,
        filteredByRBAC: 0,
        filteredByPreferences: 0,
        filteredByRateLimit: 0,
        deliveryResults: [],
        totalDelivered: 0,
        totalFailed: 0,
        skippedReason: 'No enabled notification rules'
      };
    }

    // STEP 2: Get all tenant members and filter by target roles
    const targetRoles = this.getTargetRoles(rules);
    const eligibleUsers = await this.getUsersByRoles(alertInstance.tenantId, targetRoles);
    
    console.log(`[Alert Dispatcher] Found ${eligibleUsers.length} users with target roles`);

    if (eligibleUsers.length === 0) {
      console.log(`[Alert Dispatcher] No users found with target roles`);
      return {
        alertId: alertInstance.id,
        totalEligibleUsers: 0,
        filteredByRBAC: 0,
        filteredByPreferences: 0,
        filteredByRateLimit: 0,
        deliveryResults: [],
        totalDelivered: 0,
        totalFailed: 0,
        skippedReason: 'No users with target roles'
      };
    }

    // STEP 3: Filter by RBAC permissions
    const usersWithPermission = await this.filterUsersByPermission(
      alertInstance.tenantId,
      eligibleUsers,
      alertInstance.alertType
    );
    
    const filteredByRBAC = eligibleUsers.length - usersWithPermission.length;
    console.log(`[Alert Dispatcher] ${usersWithPermission.length} users have required permissions (${filteredByRBAC} filtered by RBAC)`);

    if (usersWithPermission.length === 0) {
      return {
        alertId: alertInstance.id,
        totalEligibleUsers: eligibleUsers.length,
        filteredByRBAC,
        filteredByPreferences: 0,
        filteredByRateLimit: 0,
        deliveryResults: [],
        totalDelivered: 0,
        totalFailed: 0,
        skippedReason: 'No users with required permissions'
      };
    }

    // STEP 4: Filter by user preferences (opt-outs, DND)
    const usersPassingPreferences = await this.filterUsersByPreferences(
      alertInstance.tenantId,
      usersWithPermission,
      alertInstance.alertType
    );
    
    const filteredByPreferences = usersWithPermission.length - usersPassingPreferences.length;
    console.log(`[Alert Dispatcher] ${usersPassingPreferences.length} users passed preference check (${filteredByPreferences} filtered by preferences)`);

    if (usersPassingPreferences.length === 0) {
      return {
        alertId: alertInstance.id,
        totalEligibleUsers: eligibleUsers.length,
        filteredByRBAC,
        filteredByPreferences,
        filteredByRateLimit: 0,
        deliveryResults: [],
        totalDelivered: 0,
        totalFailed: 0,
        skippedReason: 'All users filtered by preferences'
      };
    }

    // STEP 5: Filter by rate limits
    const usersPassingRateLimit = await this.filterUsersByRateLimit(
      alertInstance.tenantId,
      usersPassingPreferences,
      alertInstance.alertType
    );
    
    const filteredByRateLimit = usersPassingPreferences.length - usersPassingRateLimit.length;
    console.log(`[Alert Dispatcher] ${usersPassingRateLimit.length} users passed rate limit check (${filteredByRateLimit} filtered by rate limit)`);

    if (usersPassingRateLimit.length === 0) {
      return {
        alertId: alertInstance.id,
        totalEligibleUsers: eligibleUsers.length,
        filteredByRBAC,
        filteredByPreferences,
        filteredByRateLimit,
        deliveryResults: [],
        totalDelivered: 0,
        totalFailed: 0,
        skippedReason: 'All users filtered by rate limit'
      };
    }

    // STEP 6: Get eligible recipients with channel preferences
    const recipients = await this.getEligibleRecipients(
      alertInstance.tenantId,
      usersPassingRateLimit,
      rules
    );

    // STEP 7: Determine channels to use
    const channels = this.determineChannels(rules, alertInstance.priority);

    // STEP 8: Dispatch to each channel
    const deliveryResults: DispatchResult['deliveryResults'] = [];
    
    for (const channel of channels) {
      const channelRecipients = recipients.filter(r => r.allowedChannels.includes(channel));
      
      if (channelRecipients.length === 0) {
        console.log(`[Alert Dispatcher] No recipients for channel ${channel}`);
        continue;
      }

      const result = await this.dispatchToChannelWithRetry(
        channel,
        alertInstance,
        channelRecipients,
        retryConfig
      );
      
      deliveryResults.push(result);

      // Record successful deliveries for rate limiting
      if (result.success && result.recipientCount && result.recipientCount > 0) {
        await this.recordAlertsSent(
          alertInstance.tenantId,
          channelRecipients.map(r => r.userId),
          alertInstance.alertType,
          channel
        );
      }
    }

    const totalDelivered = deliveryResults.filter(r => r.success).length;
    const totalFailed = deliveryResults.filter(r => !r.success).length;

    // Log dispatch results
    await this.logDispatchResults(alertInstance.id, deliveryResults);

    console.log(`[Alert Dispatcher] Alert ${alertInstance.id} delivered to ${totalDelivered}/${deliveryResults.length} channels`);
    console.log(`[Alert Dispatcher] Filtering summary: Total eligible: ${eligibleUsers.length}, RBAC filtered: ${filteredByRBAC}, Preferences filtered: ${filteredByPreferences}, Rate limit filtered: ${filteredByRateLimit}`);

    return {
      alertId: alertInstance.id,
      totalEligibleUsers: eligibleUsers.length,
      filteredByRBAC,
      filteredByPreferences,
      filteredByRateLimit,
      deliveryResults,
      totalDelivered,
      totalFailed
    };
  }

  /**
   * Get enabled notification rules for alert type and priority
   */
  private async getEnabledNotificationRules(
    tenantId: string,
    alertType: string,
    priority: string
  ): Promise<NotificationRule[]> {
    const rules = await db
      .select()
      .from(notificationRules)
      .where(
        and(
          eq(notificationRules.tenantId, tenantId),
          eq(notificationRules.enabled, true),
          eq(notificationRules.ruleType, alertType)
        )
      );

    // Filter by priority (rule minPriority <= alert priority)
    return rules.filter(rule => {
      const matchesPriority = rule.priority === priority || 
        this.comparePriority(priority, rule.priority) >= 0;
      return matchesPriority;
    });
  }

  /**
   * Get target roles from notification rules
   */
  private getTargetRoles(rules: NotificationRule[]): string[] {
    const roleSet = new Set<string>();
    
    for (const rule of rules) {
      const targetRoles = rule.targetRoles as string[] | null;
      if (targetRoles && Array.isArray(targetRoles)) {
        targetRoles.forEach(role => roleSet.add(role));
      }
    }
    
    // If no target roles specified, default to all users
    if (roleSet.size === 0) {
      return ['*']; // Wildcard means all users
    }
    
    return Array.from(roleSet);
  }

  /**
   * Get users by their roles in tenant
   */
  private async getUsersByRoles(tenantId: string, targetRoles: string[]): Promise<string[]> {
    // If wildcard, get all tenant members
    if (targetRoles.includes('*')) {
      const members = await db.query.tenantMembers.findMany({
        where: (members, { eq }) => eq(members.tenantId, tenantId)
      });
      return members.map(m => m.userId);
    }

    // Get users with specific roles
    const members = await db.query.tenantMembers.findMany({
      where: (members, { eq }) => eq(members.tenantId, tenantId),
      with: {
        tenantMemberRoles: {
          with: {
            role: true
          }
        }
      }
    });

    // Filter members who have at least one of the target roles
    const userIds = members
      .filter(member => {
        const userRoles = member.tenantMemberRoles?.map(tmr => tmr.role?.name) || [];
        return userRoles.some(role => role && targetRoles.includes(role));
      })
      .map(member => member.userId);

    return userIds;
  }

  /**
   * Filter users by RBAC permissions
   * Only users who have permission to view the alert entity are eligible
   */
  private async filterUsersByPermission(
    tenantId: string,
    userIds: string[],
    alertType: string
  ): Promise<string[]> {
    const requiredPermission = ALERT_TYPE_PERMISSIONS[alertType];
    
    // If no specific permission required, allow all users
    if (!requiredPermission) {
      console.log(`[Alert Dispatcher] No specific permission required for ${alertType}`);
      return userIds;
    }

    const rbacService = new RBACService(tenantId);
    const usersWithPermission: string[] = [];

    for (const userId of userIds) {
      const hasPermission = await rbacService.hasPermission(userId, requiredPermission);
      if (hasPermission) {
        usersWithPermission.push(userId);
      } else {
        console.log(`[Alert Dispatcher] User ${userId} does not have ${requiredPermission}`);
      }
    }

    return usersWithPermission;
  }

  /**
   * Filter users by their notification preferences
   * - Check global opt-out
   * - Check alert type opt-out
   * - Check DND schedule
   */
  private async filterUsersByPreferences(
    tenantId: string,
    userIds: string[],
    alertType: string
  ): Promise<string[]> {
    const preferences = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.tenantId, tenantId),
          inArray(userNotificationPreferences.userId, userIds)
        )
      );

    // Create a map of user preferences
    const prefsMap = new Map<string, UserNotificationPreferences>();
    preferences.forEach(pref => {
      prefsMap.set(pref.userId, pref);
    });

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const usersPassingPreferences: string[] = [];

    for (const userId of userIds) {
      const userPrefs = prefsMap.get(userId);
      
      // If no preferences set, user passes (default: receive all)
      if (!userPrefs) {
        usersPassingPreferences.push(userId);
        continue;
      }

      // Check global opt-out
      if (userPrefs.globallyOptedOut) {
        console.log(`[Alert Dispatcher] User ${userId} globally opted out`);
        continue;
      }

      // Check alert type opt-out
      const optOutTypes = userPrefs.optOutAlertTypes as string[] | null;
      if (optOutTypes && Array.isArray(optOutTypes) && optOutTypes.includes(alertType)) {
        console.log(`[Alert Dispatcher] User ${userId} opted out of ${alertType}`);
        continue;
      }

      // Check DND schedule
      const dndSchedule = userPrefs.dndSchedule as any;
      if (dndSchedule && typeof dndSchedule === 'object') {
        const daySchedule = dndSchedule[currentDay];
        if (daySchedule && daySchedule.start && daySchedule.end) {
          // Convert user's time to their timezone
          const userTimezone = userPrefs.timezone || 'UTC';
          const userTime = now.toLocaleTimeString('en-US', { 
            timeZone: userTimezone, 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });

          if (this.isInDNDWindow(userTime, daySchedule.start, daySchedule.end)) {
            console.log(`[Alert Dispatcher] User ${userId} in DND window (${daySchedule.start}-${daySchedule.end})`);
            continue;
          }
        }
      }

      // User passed all preference checks
      usersPassingPreferences.push(userId);
    }

    return usersPassingPreferences;
  }

  /**
   * Check if current time is within DND window
   */
  private isInDNDWindow(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    // Handle overnight DND (e.g., 22:00 to 07:00)
    if (end < start) {
      return current >= start || current < end;
    }

    // Normal DND window
    return current >= start && current < end;
  }

  /**
   * Convert HH:MM time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Filter users by rate limits
   * Max 5 alerts per user per hour
   */
  private async filterUsersByRateLimit(
    tenantId: string,
    userIds: string[],
    alertType: string
  ): Promise<string[]> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - RATE_LIMIT_WINDOW_HOURS);

    // Get recent alerts sent to these users
    const recentAlerts = await db
      .select({
        userId: alertRateLimits.userId,
        count: sql<number>`count(*)::int`
      })
      .from(alertRateLimits)
      .where(
        and(
          eq(alertRateLimits.tenantId, tenantId),
          inArray(alertRateLimits.userId, userIds),
          gt(alertRateLimits.sentAt, oneHourAgo)
        )
      )
      .groupBy(alertRateLimits.userId);

    // Create map of user -> alert count
    const alertCounts = new Map<string, number>();
    recentAlerts.forEach(row => {
      alertCounts.set(row.userId, row.count);
    });

    // Filter users under rate limit
    const usersPassingRateLimit: string[] = [];
    for (const userId of userIds) {
      const count = alertCounts.get(userId) || 0;
      if (count < RATE_LIMIT_MAX_ALERTS) {
        usersPassingRateLimit.push(userId);
      } else {
        console.log(`[Alert Dispatcher] User ${userId} exceeded rate limit (${count}/${RATE_LIMIT_MAX_ALERTS} in last hour)`);
      }
    }

    return usersPassingRateLimit;
  }

  /**
   * Get eligible recipients with their channel preferences
   */
  private async getEligibleRecipients(
    tenantId: string,
    userIds: string[],
    rules: NotificationRule[]
  ): Promise<EligibleRecipient[]> {
    // Get user preferences
    const preferences = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.tenantId, tenantId),
          inArray(userNotificationPreferences.userId, userIds)
        )
      );

    // Get user emails
    const members = await db.query.tenantMembers.findMany({
      where: (members, { eq, inArray }) => 
        and(
          eq(members.tenantId, tenantId),
          inArray(members.userId, userIds)
        ),
      with: {
        user: true
      }
    });

    // Get rule channels
    const ruleChannels = this.getRuleChannels(rules);

    const prefsMap = new Map<string, UserNotificationPreferences>();
    preferences.forEach(pref => prefsMap.set(pref.userId, pref));

    const recipients: EligibleRecipient[] = [];

    for (const member of members) {
      const userPrefs = prefsMap.get(member.userId);
      let allowedChannels: ('websocket' | 'push' | 'email' | 'sms')[] = [];

      if (userPrefs && userPrefs.preferredChannels) {
        // User has channel preferences - respect them
        const preferred = userPrefs.preferredChannels as string[];
        allowedChannels = ruleChannels.filter(ch => 
          preferred.includes(ch)
        ) as ('websocket' | 'push' | 'email' | 'sms')[];
      } else {
        // No preferences - use all rule channels
        allowedChannels = ruleChannels;
      }

      if (allowedChannels.length > 0) {
        recipients.push({
          userId: member.userId,
          email: member.user?.email || undefined,
          allowedChannels
        });
      }
    }

    return recipients;
  }

  /**
   * Get notification channels from rules
   */
  private getRuleChannels(rules: NotificationRule[]): ('websocket' | 'push' | 'email' | 'sms')[] {
    const channelSet = new Set<'websocket' | 'push' | 'email' | 'sms'>();
    
    for (const rule of rules) {
      const channels = rule.notificationChannels as string[] | null;
      if (channels && Array.isArray(channels)) {
        channels.forEach(ch => {
          if (['websocket', 'push', 'email', 'sms'].includes(ch)) {
            channelSet.add(ch as any);
          }
        });
      }
    }

    return Array.from(channelSet);
  }

  /**
   * Record alerts sent for rate limiting
   */
  private async recordAlertsSent(
    tenantId: string,
    userIds: string[],
    alertType: string,
    channel: 'websocket' | 'push' | 'email' | 'sms'
  ): Promise<void> {
    const records = userIds.map(userId => ({
      tenantId,
      userId,
      alertType,
      channel
    }));

    if (records.length > 0) {
      await db.insert(alertRateLimits).values(records);
    }
  }

  /**
   * Dispatch to a channel with retry logic
   */
  private async dispatchToChannelWithRetry(
    channel: 'websocket' | 'push' | 'email' | 'sms',
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[],
    retryConfig: RetryConfig
  ): Promise<DispatchResult['deliveryResults'][0]> {
    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await this.dispatchToChannel(channel, alertInstance, recipients);
        
        if (result.success) {
          console.log(`[Alert Dispatcher] ${channel} delivery succeeded on attempt ${attempt}`);
          return result;
        }
        
        lastError = result.error;
      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        console.error(`[Alert Dispatcher] ${channel} delivery failed on attempt ${attempt}:`, error);
      }

      // Wait before retry
      if (attempt < retryConfig.maxAttempts) {
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(2, attempt - 1),
          retryConfig.maxDelay
        );
        await this.sleep(delay);
      }
    }

    return {
      channel,
      success: false,
      error: lastError || `Failed after ${retryConfig.maxAttempts} attempts`
    };
  }

  /**
   * Dispatch to a specific channel
   */
  private async dispatchToChannel(
    channel: 'websocket' | 'push' | 'email' | 'sms',
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[]
  ): Promise<DispatchResult['deliveryResults'][0]> {
    switch (channel) {
      case 'websocket':
        return this.dispatchToWebSocket(alertInstance, recipients);
      
      case 'push':
        return this.dispatchToPush(alertInstance, recipients);
      
      case 'email':
        return this.dispatchToEmail(alertInstance, recipients);
      
      case 'sms':
        return this.dispatchToSMS(alertInstance, recipients);
      
      default:
        return {
          channel,
          success: false,
          error: `Unsupported channel: ${channel}`
        };
    }
  }

  /**
   * Dispatch to WebSocket
   */
  private async dispatchToWebSocket(
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[]
  ): Promise<DispatchResult['deliveryResults'][0]> {
    try {
      // Broadcast to Dashboard Metrics WebSocket
      await broadcastMetricsUpdate(alertInstance.tenantId);

      // Note: Quick actions are now for display only
      // User must confirm before any action is executed (2-step)
      const wsMessage = {
        type: 'alert_notification',
        alert: {
          id: alertInstance.id,
          type: alertInstance.alertType,
          priority: alertInstance.priority,
          title: alertInstance.title,
          message: alertInstance.message,
          quickActions: alertInstance.quickActions, // Display only, require confirmation
          actionUrl: alertInstance.actionUrl,
          createdAt: alertInstance.createdAt
        }
      };

      return {
        channel: 'websocket',
        success: true,
        recipientCount: recipients.length
      };
    } catch (error: any) {
      return {
        channel: 'websocket',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dispatch to Push Notification
   */
  private async dispatchToPush(
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[]
  ): Promise<DispatchResult['deliveryResults'][0]> {
    try {
      const userIds = recipients.map(r => r.userId);

      // Quick actions shown but require confirmation (2-step)
      const pushPayload = {
        title: alertInstance.title,
        body: alertInstance.message.substring(0, 200),
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: {
          alertId: alertInstance.id,
          alertType: alertInstance.alertType,
          priority: alertInstance.priority,
          actionUrl: alertInstance.actionUrl,
          quickActions: alertInstance.quickActions, // For display, require confirmation
          requiresConfirmation: true // Flag indicating 2-step required
        },
        tag: `alert_${alertInstance.id}`,
        requireInteraction: alertInstance.priority === 'critical',
        actions: [] // No direct actions - require confirmation dialog
      };

      const results = await this.pushService.sendToUsers({
        tenantId: alertInstance.tenantId,
        userIds,
        notificationType: alertInstance.alertType,
        payload: pushPayload
      });

      return {
        channel: 'push',
        success: results.sent > 0,
        recipientCount: results.sent,
        error: results.failed > 0 ? `${results.failed} failed` : undefined
      };
    } catch (error: any) {
      return {
        channel: 'push',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dispatch to Email
   */
  private async dispatchToEmail(
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[]
  ): Promise<DispatchResult['deliveryResults'][0]> {
    try {
      const emailRecipients = recipients
        .filter(r => r.email)
        .map(r => r.email!);

      if (emailRecipients.length === 0) {
        return {
          channel: 'email',
          success: false,
          error: 'No email recipients'
        };
      }

      // Email shows actions but requires user to confirm in app (2-step)
      const quickActionsHtml = (alertInstance.quickActions as any[] || [])
        .map((action: any) => `
          <p style="margin: 5px 0; padding: 10px; background-color: #f5f5f5; border-left: 3px solid #0070f3;">
            <strong>${action.label}</strong><br>
            <span style="font-size: 12px; color: #666;">
              Click to view in app (confirmation required)
            </span>
          </p>
        `)
        .join('');

      const emailBody = `
        <html>
          <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${this.getPriorityColor(alertInstance.priority)};">${alertInstance.title}</h2>
              <p style="white-space: pre-line;">${alertInstance.message}</p>
              ${quickActionsHtml ? `
                <div style="margin: 20px 0;">
                  <h3 style="font-size: 16px; margin-bottom: 10px;">Suggested Actions:</h3>
                  ${quickActionsHtml}
                  <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    <em>Note: All actions require confirmation in the application.</em>
                  </p>
                </div>
              ` : ''}
              ${alertInstance.actionUrl ? `
                <div style="margin: 20px 0;">
                  <a href="${this.getFullUrl(alertInstance.actionUrl)}" 
                     style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
                    View in Application
                  </a>
                </div>
              ` : ''}
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #666;">
                Alert Type: ${alertInstance.alertType}<br>
                Priority: ${alertInstance.priority}<br>
                Created: ${new Date(alertInstance.createdAt).toLocaleString()}
              </p>
            </div>
          </body>
        </html>
      `;

      const success = await sendReportEmail({
        recipients: emailRecipients,
        subject: `[${alertInstance.priority.toUpperCase()}] ${alertInstance.title}`,
        body: emailBody
      });

      return {
        channel: 'email',
        success,
        recipientCount: emailRecipients.length,
        error: success ? undefined : 'Email sending failed'
      };
    } catch (error: any) {
      return {
        channel: 'email',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dispatch to SMS (Twilio)
   */
  private async dispatchToSMS(
    alertInstance: AlertInstance,
    recipients: EligibleRecipient[]
  ): Promise<DispatchResult['deliveryResults'][0]> {
    // SMS only for critical alerts
    if (alertInstance.priority !== 'critical') {
      return {
        channel: 'sms',
        success: false,
        error: 'SMS only sent for critical alerts'
      };
    }

    try {
      console.log('[Alert Dispatcher] SMS dispatch not yet implemented (Twilio integration required)');
      
      return {
        channel: 'sms',
        success: false,
        error: 'SMS integration not configured'
      };
    } catch (error: any) {
      return {
        channel: 'sms',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Determine which channels to use
   */
  private determineChannels(
    rules: NotificationRule[],
    priority: string
  ): ('websocket' | 'push' | 'email' | 'sms')[] {
    const channels = new Set<'websocket' | 'push' | 'email' | 'sms'>();

    // Always use WebSocket
    channels.add('websocket');

    // Get channels from rules
    for (const rule of rules) {
      const ruleChannels = rule.notificationChannels as string[] | null;
      if (ruleChannels && Array.isArray(ruleChannels)) {
        ruleChannels.forEach(ch => {
          if (['push', 'email', 'sms'].includes(ch)) {
            channels.add(ch as any);
          }
        });
      }
    }

    return Array.from(channels);
  }

  /**
   * Compare priority levels
   */
  private comparePriority(priority1: string, priority2: string): number {
    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    const level1 = levels[priority1 as keyof typeof levels] || 0;
    const level2 = levels[priority2 as keyof typeof levels] || 0;
    return level1 - level2;
  }

  /**
   * Get color for priority level
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical': return '#DC2626';
      case 'high': return '#D97706';
      case 'medium': return '#2563EB';
      case 'low': return '#16A34A';
      default: return '#666666';
    }
  }

  /**
   * Get full URL from relative path
   */
  private getFullUrl(path: string): string {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
    return path.startsWith('http') ? path : `${baseUrl}${path}`;
  }

  /**
   * Log dispatch results
   */
  private async logDispatchResults(
    alertId: string,
    results: DispatchResult['deliveryResults']
  ): Promise<void> {
    const deliveryMetadata = {
      dispatched: true,
      dispatchedAt: new Date().toISOString(),
      channels: results.map(r => ({
        channel: r.channel,
        success: r.success,
        error: r.error,
        recipientCount: r.recipientCount
      }))
    };

    await db
      .update(alertInstances)
      .set({
        metadata: sql`COALESCE(${alertInstances.metadata}, '{}'::jsonb) || ${JSON.stringify(deliveryMetadata)}::jsonb`,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(alertInstances.id, alertId));
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispatch all new alerts for a tenant
   */
  async dispatchNewAlerts(tenantId: string): Promise<DispatchResult[]> {
    const newAlerts = await db
      .select()
      .from(alertInstances)
      .where(
        and(
          eq(alertInstances.tenantId, tenantId),
          eq(alertInstances.status, 'new')
        )
      );

    const results: DispatchResult[] = [];

    for (const alert of newAlerts) {
      // Check if already dispatched
      const metadata = alert.metadata as any;
      if (metadata?.dispatched) continue;

      const result = await this.dispatchAlert(alert);
      results.push(result);

      // Only mark as viewed if actually delivered
      if (result.totalDelivered > 0) {
        await db
          .update(alertInstances)
          .set({ status: 'viewed' })
          .where(eq(alertInstances.id, alert.id));
      }
    }

    return results;
  }
}

export const alertDispatcherService = new AlertDispatcherService();
