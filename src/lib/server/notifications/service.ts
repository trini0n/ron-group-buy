/**
 * NotificationService - Main orchestrator for sending notifications
 * Handles user preferences, template rendering, and delivery
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  NotificationPayload, 
  NotificationType, 
  NotificationUser, 
  NotificationPreferences,
  SendResult 
} from './types';
import { sendDiscordDM, isDiscordConfigured } from './discord';
import { renderNotification } from './templates';
import { logger } from '$lib/server/logger';

/**
 * Default notification preferences for users without explicit settings
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  discord_order_status_change: true,
  discord_tracking_added: true,
  discord_order_shipped: true,
  discord_payment_reminder: true
};

/**
 * Maps notification types to preference field names
 */
const TYPE_TO_PREFERENCE: Record<NotificationType, keyof NotificationPreferences> = {
  'order_status_change': 'discord_order_status_change',
  'tracking_added': 'discord_tracking_added',
  'payment_reminder': 'discord_payment_reminder'
};

export class NotificationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Gets user's notification preferences
   */
  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const { data } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      return DEFAULT_PREFERENCES;
    }

    return {
      discord_order_status_change: data.discord_order_status_change ?? true,
      discord_tracking_added: data.discord_tracking_added ?? true,
      discord_order_shipped: data.discord_order_shipped ?? true,
      discord_payment_reminder: data.discord_payment_reminder ?? true
    };
  }

  /**
   * Gets user data needed for sending notifications
   */
  private async getUser(userId: string): Promise<NotificationUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, discord_id, email, name')
      .eq('id', userId)
      .single();

    if (error || !data) {
      logger.error({ userId, error }, 'Failed to fetch user for notification');
      return null;
    }

    return data;
  }

  /**
   * Records a notification in the database
   */
  private async recordNotification(
    payload: NotificationPayload,
    channel: 'discord' | 'email',
    status: 'pending' | 'sent' | 'failed',
    error?: string
  ): Promise<string | null> {
    const { data, error: insertError } = await this.supabase
      .from('notifications')
      .insert({
        user_id: payload.userId,
        order_id: payload.orderId,
        type: payload.type,
        channel,
        payload: payload.variables,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        error: error || null
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error({ payload, error: insertError }, 'Failed to record notification');
      return null;
    }

    return data?.id || null;
  }

  /**
   * Updates notification status after send attempt
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: 'sent' | 'failed',
    error?: string
  ): Promise<void> {
    await this.supabase
      .from('notifications')
      .update({
        status,
        attempts: this.supabase.rpc('increment', { row_id: notificationId }),
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        error: error || null
      })
      .eq('id', notificationId);
  }

  /**
   * Check if user should receive this notification type via Discord
   */
  private async shouldSendDiscord(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    if (!isDiscordConfigured()) {
      return false;
    }

    const preferences = await this.getUserPreferences(userId);
    const prefKey = TYPE_TO_PREFERENCE[type];
    return preferences[prefKey] ?? true;
  }

  /**
   * Gets the active group buy name for notifications
   */
  private async getActiveGroupBuyName(): Promise<string> {
    const { data, error } = await this.supabase
      .from('group_buy_config')
      .select('name')
      .eq('is_active', true)
      .single();

    if (error) {
      logger.error({ error }, 'Failed to fetch active group buy name, using fallback');
    }

    if (!data?.name) {
      // Fallback using current month/year
      const now = new Date();
      const month = now.toLocaleString('en-US', { month: 'long' });
      const year = now.getFullYear();
      const fallbackName = `Ron's ${month} ${year} Group Buy`;
      logger.warn({ error, data }, `No active group buy found, using fallback: ${fallbackName}`);
      return fallbackName;
    }

    // Transform config name like "January 2026 Group Buy" to "Ron's January 2026 Group Buy"
    const name = data.name;
    if (name.startsWith("Ron's")) {
      return name;
    }
    return `Ron's ${name}`;
  }

  /**
   * Sends a notification to a user
   * Checks preferences and delivers via appropriate channels
   */
  async send(payload: NotificationPayload): Promise<SendResult> {
    const { userId, type, variables } = payload;

    logger.info({ userId, type, orderId: payload.orderId }, 'Processing notification');

    // Get user data
    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if Discord notification should be sent
    const shouldDiscord = await this.shouldSendDiscord(userId, type);
    
    if (!shouldDiscord) {
      logger.info({ userId, type }, 'Notification disabled by user preferences');
      return { success: true }; // Not sending is still a "success" - user opted out
    }

    if (!user.discord_id) {
      logger.warn({ userId, type }, 'User has no Discord ID linked');
      return { success: false, error: 'User has no Discord account linked' };
    }

    // Get active group buy name and inject into variables
    const groupBuyName = await this.getActiveGroupBuyName();
    const enrichedVariables = {
      ...variables,
      group_buy_name: variables.group_buy_name || groupBuyName
    };

    // Render the notification message
    const message = await renderNotification(this.supabase, type, 'discord', enrichedVariables);

    // Record notification as pending
    const notificationId = await this.recordNotification(payload, 'discord', 'pending');

    // Send via Discord
    const result = await sendDiscordDM(user.discord_id, message);

    // Update notification record
    if (notificationId) {
      if (result.success) {
        await this.supabase
          .from('notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notificationId);
      } else {
        await this.supabase
          .from('notifications')
          .update({ status: 'failed', error: result.error, attempts: 1 })
          .eq('id', notificationId);
      }
    }

    if (result.success) {
      logger.info({ userId, type, messageId: result.messageId }, 'Notification sent successfully');
    } else {
      logger.error({ userId, type, error: result.error }, 'Failed to send notification');
    }

    return result;
  }

  /**
   * Sends a custom message (for admin manual trigger with custom text)
   */
  async sendCustom(
    userId: string,
    orderId: string,
    message: string
  ): Promise<SendResult> {
    const user = await this.getUser(userId);
    if (!user?.discord_id) {
      return { success: false, error: 'User has no Discord account linked' };
    }

    // Record with type 'custom'
    await this.recordNotification(
      { userId, orderId, type: 'order_status_change', variables: { order_number: orderId, order_url: '' } },
      'discord',
      'pending'
    );

    return await sendDiscordDM(user.discord_id, message);
  }
}

/**
 * Create a notification service instance
 */
export function createNotificationService(supabase: SupabaseClient): NotificationService {
  return new NotificationService(supabase);
}
