-- Fix: infinite recursion in conversation_members RLS policies
-- Run this against your existing Supabase database.

-- 1. Create a SECURITY DEFINER helper that bypasses RLS
CREATE OR REPLACE FUNCTION get_my_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid();
$$;

-- 2. Drop ALL old policies on the three DM tables
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON conversations;
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Users can manage conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can insert conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can update own membership" ON conversation_members;
DROP POLICY IF EXISTS "Admins can delete conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can view messages" ON direct_messages;
DROP POLICY IF EXISTS "Members can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Senders can edit own messages" ON direct_messages;

-- 3. Recreate policies using the helper function (no self-reference)

-- conversations
CREATE POLICY "Members can view their conversations" ON conversations
  FOR SELECT USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update conversations" ON conversations
  FOR UPDATE USING (
    id IN (SELECT get_my_conversation_ids())
    OR created_by = auth.uid()
  );

-- conversation_members
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can insert conversation members" ON conversation_members
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT get_my_conversation_ids())
    OR user_id = auth.uid()
    OR conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  );

CREATE POLICY "Members can update own membership" ON conversation_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can delete conversation members" ON conversation_members
  FOR DELETE USING (
    conversation_id IN (SELECT get_my_conversation_ids())
    OR user_id = auth.uid()
  );

-- direct_messages
CREATE POLICY "Members can view messages" ON direct_messages
  FOR SELECT USING (conversation_id IN (SELECT get_my_conversation_ids()));

CREATE POLICY "Members can send messages" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (SELECT get_my_conversation_ids())
  );

CREATE POLICY "Senders can edit own messages" ON direct_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- 4. Grant access
GRANT ALL ON conversations TO authenticated, anon, service_role;
GRANT ALL ON conversation_members TO authenticated, anon, service_role;
GRANT ALL ON direct_messages TO authenticated, anon, service_role;

-- 5. Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
