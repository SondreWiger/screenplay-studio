-- 5. LAST ACTION BEFORE DORMANCY
-- For each dormant user (no login in 3+ months), what was the
-- most recent thing they did in audit_log before going dark?
-- Reveals the friction point / final interaction pattern.

WITH dormant_users AS (
  SELECT
    p.id AS user_id,
    COALESCE(ug.last_login_date, p.created_at::date) AS last_active_date
  FROM profiles p
  LEFT JOIN user_gamification ug ON ug.user_id = p.id
  WHERE COALESCE(ug.last_login_date, p.created_at::date) < CURRENT_DATE - INTERVAL '3 months'
),
last_actions AS (
  SELECT DISTINCT ON (al.user_id)
    al.user_id,
    al.action,
    al.entity_type,
    al.metadata,
    al.created_at AS action_at
  FROM audit_log al
  INNER JOIN dormant_users du ON du.user_id = al.user_id
  WHERE al.created_at <= du.last_active_date + INTERVAL '1 day'
  ORDER BY al.user_id, al.created_at DESC
)
SELECT
  la.action,
  la.entity_type,
  COUNT(*)::int AS user_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM dormant_users), 1) AS pct_of_dormant,
  TO_CHAR(TO_TIMESTAMP(ROUND(AVG(EXTRACT(EPOCH FROM la.action_at)))), 'YYYY-MM-DD') AS avg_action_date
FROM last_actions la
GROUP BY la.action, la.entity_type
ORDER BY user_count DESC;
