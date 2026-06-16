-- 2. DORMANT USERS BY PROJECT COUNT
-- Users who haven't logged in for 3+ months, grouped by how
-- many projects they created before going dormant.
-- Dormancy hits "never started" vs "actively used then stopped."

WITH dormant_users AS (
  SELECT
    p.id AS user_id,
    COALESCE(ug.last_login_date, p.created_at::date) AS last_active_date
  FROM profiles p
  LEFT JOIN user_gamification ug ON ug.user_id = p.id
  WHERE COALESCE(ug.last_login_date, p.created_at::date) < CURRENT_DATE - INTERVAL '3 months'
),
dormant_with_projects AS (
  SELECT
    du.user_id,
    du.last_active_date,
    COUNT(pr.id)::int AS project_count
  FROM dormant_users du
  LEFT JOIN projects pr ON pr.created_by = du.user_id
    AND pr.created_at <= du.last_active_date + INTERVAL '1 day'
  GROUP BY du.user_id, du.last_active_date
)
SELECT
  project_count,
  COUNT(*)::int AS dormant_user_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM dormant_users), 1) AS pct_of_dormant,
  TO_CHAR(TO_TIMESTAMP(ROUND(AVG(EXTRACT(EPOCH FROM last_active_date::timestamp)))), 'YYYY-MM-DD') AS avg_last_active
FROM dormant_with_projects
GROUP BY project_count
ORDER BY project_count;
