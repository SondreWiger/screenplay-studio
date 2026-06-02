CREATE TABLE IF NOT EXISTS email_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  errors JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS email_batch_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES email_batches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(batch_id, user_id)
);

ALTER TABLE email_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_batch_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email batches"
  ON email_batches FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Admins can manage batch recipients"
  ON email_batch_recipients FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
