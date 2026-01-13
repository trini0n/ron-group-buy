-- Notifications Feature Schema
-- Migration: 20260113000000_notifications_feature.sql

-- ============================================================================
-- 1. NOTIFICATIONS TABLE (log/queue for sent notifications)
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'order_status_change', 'tracking_added'
  channel TEXT NOT NULL, -- 'discord', 'email'
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_notifications_status ON notifications(status, created_at);
CREATE INDEX idx_notifications_user_order ON notifications(user_id, order_id, type);
CREATE INDEX idx_notifications_pending ON notifications(status) WHERE status = 'pending';

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications 
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update (via API routes)
CREATE POLICY "Service role can manage notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. NOTIFICATION TEMPLATES TABLE (customizable message templates)
-- ============================================================================

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'order_status_change', 'tracking_added'
  channel TEXT NOT NULL DEFAULT 'discord', -- 'discord', 'email'
  subject TEXT, -- For email (future)
  body_template TEXT NOT NULL, -- Supports {{order_number}}, {{status}}, {{tracking_url}}, etc.
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(type, channel)
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_notification_templates_updated_at 
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (admin only for templates)
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Templates are readable by authenticated users (needed for notification sending)
CREATE POLICY "Templates readable by authenticated" ON notification_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify templates (via admin API with service role)
CREATE POLICY "Service role can manage templates" ON notification_templates
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. SEED DEFAULT TEMPLATES
-- ============================================================================

INSERT INTO notification_templates (type, channel, body_template) VALUES
  (
    'order_status_change', 
    'discord', 
    E'📦 **Order Update**\n\nYour order **#{{order_number}}** is now **{{status}}**.\n\n[View Order Details]({{order_url}})'
  ),
  (
    'tracking_added', 
    'discord', 
    E'🚚 **Your Order Has Shipped!**\n\nOrder **#{{order_number}}** is on its way.\n\n**Tracking:** {{tracking_number}}\n**Carrier:** {{tracking_carrier}}\n\n[Track Your Package]({{tracking_url}})'
  ),
  (
    'payment_reminder',
    'discord',
    E'💳 **Payment Reminder**\n\nYour order **#{{order_number}}** is awaiting payment.\n\n[Pay Invoice]({{invoice_url}})'
  );

-- ============================================================================
-- 4. UPDATE NOTIFICATION_PREFERENCES TABLE
-- ============================================================================

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS discord_order_status_change BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS discord_tracking_added BOOLEAN DEFAULT true;

-- ============================================================================
-- 5. ADD ADMIN POLICIES FOR NOTIFICATIONS TABLE
-- ============================================================================

-- Allow admins to view all notifications (for admin dashboard)
CREATE POLICY "Admins can view all notifications" ON notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );
