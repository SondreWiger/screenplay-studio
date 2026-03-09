-- ============================================================
-- Actors / Actresses — Payroll & Documents
-- cast_members: actor profiles with pay rates
-- cast_payments: per-payment ledger
-- cast_documents: document vault per actor
-- ============================================================

-- Cast Members
CREATE TABLE IF NOT EXISTS cast_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),

  -- Profile
  name            TEXT NOT NULL,
  character_roles TEXT[] DEFAULT '{}',
  email           TEXT,
  phone           TEXT,
  photo_url       TEXT,
  bio             TEXT,
  notes           TEXT,
  availability    TEXT,

  -- Pay rate
  pay_amount      DECIMAL(12,2),
  pay_unit        TEXT DEFAULT 'flat',   -- hourly | daily | weekly | monthly | flat | per_episode
  pay_currency    TEXT DEFAULT 'USD',

  -- Contract status
  contract_status TEXT DEFAULT 'negotiating',  -- negotiating | pending | signed | on_set | completed | released

  -- Custom metadata
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cast Payments
CREATE TABLE IF NOT EXISTS cast_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cast_member_id  UUID NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,

  amount          DECIMAL(12,2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  description     TEXT,

  period_start    DATE,
  period_end      DATE,
  due_date        DATE,
  paid_at         TIMESTAMPTZ,

  status          TEXT DEFAULT 'unpaid',  -- unpaid | paid | overdue | cancelled
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cast Documents
CREATE TABLE IF NOT EXISTS cast_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cast_member_id  UUID NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),

  doc_type        TEXT DEFAULT 'other',  -- nda | contract | work_agreement | id_proof | insurance | work_permit | citizenship | negotiation | other
  title           TEXT NOT NULL,
  file_url        TEXT,
  file_name       TEXT,
  notes           TEXT,
  expires_at      DATE,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cast_members_project   ON cast_members(project_id);
CREATE INDEX IF NOT EXISTS idx_cast_payments_member   ON cast_payments(cast_member_id);
CREATE INDEX IF NOT EXISTS idx_cast_payments_project  ON cast_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_cast_documents_member  ON cast_documents(cast_member_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cast_member_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS cast_members_updated_at ON cast_members;
CREATE TRIGGER cast_members_updated_at
  BEFORE UPDATE ON cast_members
  FOR EACH ROW EXECUTE FUNCTION update_cast_member_updated_at();

-- RLS
ALTER TABLE cast_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_documents ENABLE ROW LEVEL SECURITY;

-- cast_members policies
CREATE POLICY "Project members can read cast_members"  ON cast_members  FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_members" ON cast_members FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_members" ON cast_members FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_members" ON cast_members FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

-- cast_payments policies (mirror cast_members)
CREATE POLICY "Project members can read cast_payments"   ON cast_payments  FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_payments" ON cast_payments FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_payments" ON cast_payments FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_payments" ON cast_payments FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

-- cast_documents policies
CREATE POLICY "Project members can read cast_documents"   ON cast_documents FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can insert cast_documents" ON cast_documents FOR INSERT WITH CHECK (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can update cast_documents" ON cast_documents FOR UPDATE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role <> 'viewer')
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
CREATE POLICY "Project members can delete cast_documents" ON cast_documents FOR DELETE USING (
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);
