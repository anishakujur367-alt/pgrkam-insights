-- Restore the unique index required by the analytics ETL upsert.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_daily_metrics"
ON "analytics"."daily_metrics"("metric_date", "metric_name", "dimensions");
