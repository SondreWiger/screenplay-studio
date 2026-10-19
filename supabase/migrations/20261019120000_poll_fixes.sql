-- Polls: keep response_count right when a response is rolled back (failed answer insert),
-- and make is_global a real boolean so the popup filter never trips on NULL.

CREATE OR REPLACE FUNCTION decrement_poll_response_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE poll_sessions
  SET response_count = GREATEST(response_count - 1, 0),
      updated_at = now()
  WHERE id = OLD.session_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_poll_response_delete ON poll_responses;
CREATE TRIGGER on_poll_response_delete
  AFTER DELETE ON poll_responses
  FOR EACH ROW EXECUTE FUNCTION decrement_poll_response_count();

UPDATE poll_sessions SET is_global = false WHERE is_global IS NULL;
ALTER TABLE poll_sessions ALTER COLUMN is_global SET DEFAULT false;
ALTER TABLE poll_sessions ALTER COLUMN is_global SET NOT NULL;
