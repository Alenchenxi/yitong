-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "job_posts_merchant_id_status_deleted_at_created_at_idx" ON "job_posts"("merchant_id", "status", "deleted_at", "created_at");
