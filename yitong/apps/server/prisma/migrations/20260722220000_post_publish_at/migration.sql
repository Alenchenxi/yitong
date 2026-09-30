-- P2-06 定时发布
ALTER TABLE "posts" ADD COLUMN "publish_at" TIMESTAMP(3);
CREATE INDEX "posts_publish_at_idx" ON "posts"("publish_at");
