CREATE TABLE IF NOT EXISTS reengagement_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT NOT NULL
);
ALTER TABLE reengagement_log ENABLE ROW LEVEL SECURITY;
