/**
 * Notification system types and interfaces
 */

export type NotificationType = 
  | 'order_status_change'
  | 'tracking_added'
  | 'payment_reminder';

export type NotificationChannel = 'discord' | 'email';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

/**
 * Template variables available for interpolation
 */
export interface TemplateVariables {
  order_number: string;
  status?: string;
  previous_status?: string;
  tracking_number?: string;
  tracking_carrier?: string;
  tracking_url?: string;
  order_url: string;
  invoice_url?: string;
  user_name?: string;
}

/**
 * Payload for creating a notification
 */
export interface NotificationPayload {
  userId: string;
  orderId: string;
  type: NotificationType;
  variables: TemplateVariables;
}

/**
 * Database notification record
 */
export interface NotificationRecord {
  id: string;
  user_id: string;
  order_id: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

/**
 * Database notification template record
 */
export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body_template: string;
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

/**
 * Result from sending a notification
 */
export interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  discord_order_status_change: boolean;
  discord_tracking_added: boolean;
  discord_order_shipped: boolean;
  discord_payment_reminder: boolean;
}

/**
 * User data needed for sending notifications
 */
export interface NotificationUser {
  id: string;
  discord_id: string | null;
  email: string;
  name: string | null;
}
