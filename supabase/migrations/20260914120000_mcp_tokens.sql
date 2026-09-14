-- Personal access tokens for the MCP endpoint (/api/mcp).
--
-- A token lets an AI client (Claude Code, Claude Desktop, Cursor, ...) act as
-- the person who created it. Only a SHA-256 hash is stored: the plaintext is
-- shown once at creation and can never be read back, so a leaked database
-- dump does not leak working tokens.
--
-- Every read and write of this table goes through the service role
-- (/api/mcp/tokens and /api/mcp). The policies below only let people see and
-- revoke their own tokens from the client, never mint one.
BEGIN;

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL UNIQUE,
  -- First characters of the plaintext, so a person can tell tokens apart.
  token_prefix TEXT NOT NULL,
  -- read: look only. write: read + change project data. admin: write + platform administration.
  scope TEXT NOT NULL DEFAULT 'write' CHECK (scope IN ('read', 'write', 'admin')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user_id ON mcp_tokens(user_id);

ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_tokens_select_own" ON mcp_tokens;
CREATE POLICY "mcp_tokens_select_own" ON mcp_tokens FOR SELECT USING (
  user_id = auth.uid()
);

COMMIT;
