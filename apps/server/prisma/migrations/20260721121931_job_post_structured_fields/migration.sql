-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('CATERING', 'RETAIL', 'PROMOTION', 'EXHIBITION', 'TUTORING', 'CAMPUS_AGENT', 'ONLINE', 'SURVEY', 'INTERNSHIP', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "Settlement" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'COMPLETION');

-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "category" "JobCategory",
ADD COLUMN     "headcount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settlement" "Settlement",
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "work_dates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "work_periods" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "job_posts_status_urgent_created_at_idx" ON "job_posts"("status", "urgent", "created_at");

-- CreateIndex
CREATE INDEX "job_posts_status_category_created_at_idx" ON "job_posts"("status", "category", "created_at");
