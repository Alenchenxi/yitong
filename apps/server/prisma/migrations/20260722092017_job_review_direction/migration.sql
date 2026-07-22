-- AlterTable
ALTER TABLE "job_reviews" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'stu_to_merchant',
ADD COLUMN     "reviewer_id" TEXT;

-- CreateIndex
CREATE INDEX "job_reviews_reviewer_id_idx" ON "job_reviews"("reviewer_id");
