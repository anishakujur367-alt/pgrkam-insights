-- DropIndex
DROP INDEX "analytics"."uq_daily_metrics";

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "education_required" TEXT;
