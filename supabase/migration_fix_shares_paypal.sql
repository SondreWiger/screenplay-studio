-- ============================================================
-- Migration: Fix external shares for anonymous access + PayPal rename
-- Run this if you already applied migration_pro_subscription.sql
-- ============================================================

-- 1. Add content_snapshot column for storing share content (avoids RLS issues on anonymous access)
ALTER TABLE external_shares ADD COLUMN IF NOT EXISTS content_snapshot JSONB DEFAULT NULL;

-- 2. Rename Stripe columns to PayPal
ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO paypal_customer_id;
ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;

-- 3. Add anonymous-friendly RLS policies for external share viewing
-- Anyone with the token can read active shares (the token itself is the access control)
CREATE POLICY "Public read active shares by token" ON external_shares
  FOR SELECT USING (is_active = true);

-- Anyone can increment view count on active shares
CREATE POLICY "Public update view count" ON external_shares
  FOR UPDATE USING (is_active = true) WITH CHECK (is_active = true);
