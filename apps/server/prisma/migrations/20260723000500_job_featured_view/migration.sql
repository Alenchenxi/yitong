-- P2-15 兼职精品 + P2-16 招聘浏览
ALTER TABLE "job_posts" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "job_posts" ADD COLUMN "featured_at" TIMESTAMP(3);
CREATE INDEX "job_posts_status_featured_featured_at_idx" ON "job_posts"("status", "featured", "featured_at");

CREATE TABLE "job_views" (
  "id" TEXT NOT NULL,
  "job_post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_views_job_post_id_created_at_idx" ON "job_views"("job_post_id", "created_at");
CREATE INDEX "job_views_user_id_created_at_idx" ON "job_views"("user_id", "created_at");
ALTER TABLE "job_views" ADD CONSTRAINT "job_views_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE;
