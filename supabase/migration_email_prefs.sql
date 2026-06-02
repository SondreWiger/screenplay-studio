-- Add email notification preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_project_invites BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_mentions BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_direct_messages BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_ticket_replies BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN DEFAULT false;
