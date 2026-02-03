/**
 * Notification template management
 * Loads templates from database with fallback defaults
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationType, NotificationChannel, TemplateVariables, NotificationTemplate } from './types';

/**
 * Default templates used when database templates are unavailable
 */
const DEFAULT_TEMPLATES: Record<string, string> = {
  'order_status_change:discord': 
    '📦 **Order Update**\n\nYour order **#{{order_number}}** from {{group_buy_name}} is now **{{status}}**.\n{{invoiced_message}}\n[View Order Details]({{order_url}})',
  
  'tracking_added:discord': 
    '🚚 **Your Order Has Shipped!**\n\nOrder **#{{order_number}}** from {{group_buy_name}} is on its way.\n\n**Tracking:** {{tracking_number}}\n\n[Track Your Package]({{tracking_url}})',
  
  'payment_reminder:discord':
    '💳 **Payment Reminder**\n\nYour order **#{{order_number}}** from {{group_buy_name}} is awaiting payment.\n\nPlease check your PayPal email inbox for the invoice.\n\n[View Order Details]({{order_url}})'
};

/**
 * Interpolates template variables into a template string
 * Replaces {{variable_name}} with the corresponding value
 * Lines containing unreplaced variables are removed entirely
 */
export function interpolateTemplate(template: string, variables: TemplateVariables): string {
  // First pass: replace variables with values, mark undefined ones
  const UNDEFINED_MARKER = '___UNDEFINED___';
  
  let result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? String(value) : UNDEFINED_MARKER;
  });
  
  // Second pass: remove lines containing the undefined marker
  result = result
    .split('\n')
    .filter(line => !line.includes(UNDEFINED_MARKER))
    .join('\n');
  
  // Clean up any double blank lines that may have been created
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

/**
 * Gets a template from the database, falling back to defaults
 */
export async function getTemplate(
  supabase: SupabaseClient,
  type: NotificationType,
  channel: NotificationChannel
): Promise<string> {
  const cacheKey = `${type}:${channel}`;
  
  try {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('body_template, is_active')
      .eq('type', type)
      .eq('channel', channel)
      .single();

    if (error || !data?.is_active) {
      // Fall back to default
      return DEFAULT_TEMPLATES[cacheKey] || 'Notification: {{order_number}}';
    }

    return data.body_template;
  } catch {
    return DEFAULT_TEMPLATES[cacheKey] || 'Notification: {{order_number}}';
  }
}

/**
 * Gets all templates for admin editing
 */
export async function getAllTemplates(
  supabase: SupabaseClient
): Promise<NotificationTemplate[]> {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('type', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates a notification template
 */
export async function updateTemplate(
  supabase: SupabaseClient,
  id: string,
  updates: { body_template?: string; subject?: string; is_active?: boolean }
): Promise<NotificationTemplate> {
  const { data, error } = await supabase
    .from('notification_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`);
  }

  return data;
}

/**
 * Renders a notification message with the given variables
 */
export async function renderNotification(
  supabase: SupabaseClient,
  type: NotificationType,
  channel: NotificationChannel,
  variables: TemplateVariables
): Promise<string> {
  const template = await getTemplate(supabase, type, channel);
  return interpolateTemplate(template, variables);
}
