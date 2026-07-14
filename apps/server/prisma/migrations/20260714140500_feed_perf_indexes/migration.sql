-- DropIndex
DROP INDEX "posts_circle_id_created_at_idx";

-- CreateIndex
CREATE INDEX "posts_circle_id_status_created_at_idx" ON "posts"("circle_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "job_posts_status_created_at_idx" ON "job_posts"("status", "created_at");
