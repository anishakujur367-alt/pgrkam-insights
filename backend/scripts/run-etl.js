import prisma from '../src/db.js';

const ETL_SQL = `
WITH dau AS (
  SELECT
    (event_time AT TIME ZONE 'UTC')::date AS metric_date,
    COUNT(DISTINCT CASE
      WHEN user_id IS NOT NULL THEN 'user:' || user_id::text
      WHEN anonymous_id IS NOT NULL THEN 'anon:' || anonymous_id
      ELSE NULL
    END) AS metric_value
  FROM analytics.user_events
  WHERE event_name IN (
    'session_start',
    'page_view',
    'login',
    'job_search',
    'job_view',
    'job_save',
    'job_apply',
    'scheme_view',
    'service_view',
    'recommendation_impression',
    'recommendation_click'
  )
  GROUP BY 1
),
registrations AS (
  SELECT
    (event_time AT TIME ZONE 'UTC')::date AS metric_date,
    COALESCE(source, 'direct') AS source,
    COUNT(*) AS metric_value
  FROM analytics.user_events
  WHERE event_name = 'register'
  GROUP BY 1, 2
),
application_funnel AS (
  SELECT
    (applied_at AT TIME ZONE 'UTC')::date AS metric_date,
    status,
    COUNT(*) AS metric_value
  FROM public.applications
  GROUP BY 1, 2
),
recommendation_activity AS (
  SELECT
    (event_time AT TIME ZONE 'UTC')::date AS metric_date,
    COUNT(*) FILTER (WHERE event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE event_type = 'click') AS clicks
  FROM analytics.recommendation_events
  WHERE event_type IN ('impression', 'click')
  GROUP BY 1
),
metric_rows AS (
  SELECT metric_date, 'dau'::text AS metric_name,
         metric_value::numeric AS metric_value,
         '{}'::jsonb AS dimensions
  FROM dau

  UNION ALL

  SELECT metric_date, 'registrations_by_source',
         metric_value::numeric,
         jsonb_build_object('source', source)
  FROM registrations

  UNION ALL

  SELECT metric_date, 'application_funnel',
         metric_value::numeric,
         jsonb_build_object('status', status)
  FROM application_funnel

  UNION ALL

  SELECT metric_date, 'recommendation_ctr',
         CASE
           WHEN impressions > 0
           THEN ROUND(clicks * 100.0 / impressions, 2)
           ELSE 0
         END,
         '{}'::jsonb
  FROM recommendation_activity
)
INSERT INTO analytics.daily_metrics (
  metric_date, metric_name, metric_value, dimensions, calculated_at
)
SELECT metric_date, metric_name, metric_value, dimensions, NOW()
FROM metric_rows
ON CONFLICT (metric_date, metric_name, dimensions)
DO UPDATE SET
  metric_value = EXCLUDED.metric_value,
  calculated_at = NOW();
`;

async function runETL() {
  let etlRun;

  try {
    etlRun = await prisma.etl_runs.create({
      data: { status: 'running', rows_processed: 0 },
    });

    console.log(`ETL run started: ${etlRun.id}`);

    const rowsProcessed = await prisma.$executeRawUnsafe(ETL_SQL);

    await prisma.etl_runs.update({
      where: { id: etlRun.id },
      data: {
        status: 'completed',
        finished_at: new Date(),
        rows_processed: rowsProcessed,
      },
    });

    console.log('ETL completed successfully.');
    console.log(`Daily metric rows inserted/updated: ${rowsProcessed}`);
  } catch (error) {
    console.error('ETL failed:', error.message);

    if (etlRun) {
      await prisma.etl_runs.update({
        where: { id: etlRun.id },
        data: {
          status: 'failed',
          finished_at: new Date(),
          error: String(error.message).slice(0, 1000),
        },
      });
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runETL();
