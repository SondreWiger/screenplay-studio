-- Fix: grant missing table-level permissions so anon + authenticated users
-- can actually submit feedback (RLS policy alone isn't enough in Supabase).

GRANT SELECT, INSERT                ON feedback_items         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_votes         TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_comments      TO anon, authenticated;
GRANT SELECT                        ON feedback_similar_links TO anon, authenticated;
GRANT SELECT, INSERT, DELETE        ON feedback_subscriptions TO anon, authenticated;
GRANT SELECT                        ON public_testimonials    TO anon, authenticated;
GRANT SELECT                        ON public_roadmap         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_feedback(TEXT,TEXT,TEXT,INT) TO anon, authenticated;
