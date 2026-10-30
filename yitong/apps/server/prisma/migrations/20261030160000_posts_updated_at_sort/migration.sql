-- CR-008 编辑刷新更新时间 + 最新列表按更新时间排序:
-- posts / anonymous_posts / job_posts 加 updated_at（手动维护，仅编辑动作刷新，非 Prisma @updatedAt）
-- 存量回填 = created_at（保证迁移后排序与迁移前完全一致，不会集体浮顶）

ALTER TABLE "posts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
UPDATE "posts" SET "updated_at" = "created_at";

ALTER TABLE "anonymous_posts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
UPDATE "anonymous_posts" SET "updated_at" = "created_at";

ALTER TABLE "job_posts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
UPDATE "job_posts" SET "updated_at" = "created_at";
