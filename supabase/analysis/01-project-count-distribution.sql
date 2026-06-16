-- 1. PROJECT COUNT DISTRIBUTION
-- How many users have 0 projects, 1, 2, 3, etc.
-- Reveals if the "average" is real engagement or power-user skew.

WITH user_project_counts AS (
  SELECT
    p.id AS user_id,
    COUNT(pr.id)::int AS project_count
  FROM profiles p
  LEFT JOIN projects pr ON pr.created_by = p.id
  GROUP BY p.id
)
SELECT
  project_count,
  COUNT(*)::int AS user_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM profiles), 1) AS pct
FROM user_project_counts
GROUP BY project_count
ORDER BY project_count;
