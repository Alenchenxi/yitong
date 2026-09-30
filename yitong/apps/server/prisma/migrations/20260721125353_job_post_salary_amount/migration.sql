-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "salary_amount" INTEGER;

-- CreateIndex
CREATE INDEX "job_posts_status_salary_amount_idx" ON "job_posts"("status", "salary_amount");
