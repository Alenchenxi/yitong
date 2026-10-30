-- CR-008 补索引：最新流排序键 updated_at（posts / anonymous_posts / job_posts）

CREATE INDEX "posts_status_updated_at_idx" ON "posts"("status", "updated_at");
CREATE INDEX "anonymous_posts_status_updated_at_idx" ON "anonymous_posts"("status", "updated_at");
CREATE INDEX "job_posts_status_updated_at_idx" ON "job_posts"("status", "updated_at");
