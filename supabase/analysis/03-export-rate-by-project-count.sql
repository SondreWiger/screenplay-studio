-- 3. EXPORT RATE BY PROJECT COUNT
-- For users grouped by total projects, what % of their projects
-- were ever exported? Uses audit_log 'data_export' events.
-- Note: Individual script exports (PDF/Fountain/FDX) happen
-- client-side and are not logged server-side. This captures
-- GDPR data-export requests only.

WITH user_project_counts AS (
  SELECT
    p.id AS user_id,
    COUNT(pr.id)::int AS total_projects
  FROM profiles p
  LEFT JOIN projects pr ON pr.created_by = p.id
  GROUP BY p.id
  HAVING COUNT(pr.id) > 0
),
user_exports AS (
  SELECT
    al.user_id,
    COUNT(DISTINCT al.entity_id)::int AS exported_projects
  FROM audit_log al
  WHERE al.action = 'data_export'
  GROUP BY al.user_id
)
SELECT
  upc.total_projects,
  COUNT(DISTINCT upc.user_id)::int AS user_count,
  SUM(COALESCE(ue.exported_projects, 0))::int AS total_exports,
  ROUND(
    100.0 * SUM(COALESCE(ue.exported_projects, 0))::numeric
    / NULLIF(SUM(upc.total_projects), 0),
    1
  ) AS export_rate_pct
FROM user_project_counts upc
LEFT JOIN user_exports ue ON ue.user_id = upc.user_id
GROUP BY upc.total_projects
ORDER BY upc.total_projects;
