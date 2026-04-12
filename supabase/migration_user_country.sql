-- Add country column to profiles for analytics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT; 