-- 4. TIME BETWEEN PROJECTS
-- For users with 2+ projects, days between consecutive project
-- creation dates. Summary stats: avg, median, min, max.

WITH ordered_projects AS (
  SELECT
    pr.created_by AS user_id,
    pr.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY pr.created_by
      ORDER BY pr.created_at
    ) AS rn
  FROM projects pr
),
gaps AS (
  SELECT
    op.user_id,
    op.created_at AS current_project_date,
    LAG(op.created_at) OVER (
      PARTITION BY op.user_id
      ORDER BY op.created_at
    ) AS prev_project_date
  FROM ordered_projects op
),
project_gaps AS (
  SELECT
    user_id,
    current_project_date,
    prev_project_date,
    EXTRACT(DAY FROM (current_project_date - prev_project_date))::int AS days_between
  FROM gaps
  WHERE prev_project_date IS NOT NULL
)
SELECT
  COUNT(*)::int AS total_gaps,
  ROUND(AVG(days_between), 1) AS avg_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_between)::numeric(10,1) AS median_days,
  MIN(days_between) AS min_days,
  MAX(days_between) AS max_days,
  ROUND(STDDEV(days_between), 1) AS stddev_days
FROM project_gaps;
