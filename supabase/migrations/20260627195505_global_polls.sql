-- Add is_global flag to poll_sessions
ALTER TABLE poll_sessions
ADD COLUMN is_global BOOLEAN DEFAULT false;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_poll_sessions_is_global ON poll_sessions (is_global) WHERE is_global = true;
