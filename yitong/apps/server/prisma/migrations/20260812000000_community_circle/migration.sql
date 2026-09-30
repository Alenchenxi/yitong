-- 圈子（Community）概念迁移：ADD-only + 存量回填 + seed
-- 说明：现有「circles」表为表白墙发帖分类，不动。

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommunityMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "BannerStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "owner_id" TEXT,
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "CommunityMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "community_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "BannerStatus" NOT NULL DEFAULT 'ENABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_views" (
    "id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "viewer_key" TEXT NOT NULL,
    "hour_bucket" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_views_pkey" PRIMARY KEY ("id")
);

-- 默认圈子（供存量回填 + 新用户惰性加入）
INSERT INTO "communities" ("id", "name", "logo", "status", "member_count", "post_count", "created_at")
VALUES ('cm_default', '综合大学', NULL, 'ACTIVE', 0, 0, NOW());

-- 唯一索引需在回填 ON CONFLICT 前创建
CREATE UNIQUE INDEX "community_members_community_id_user_id_key" ON "community_members"("community_id", "user_id");

-- 存量回填：先加可空列 → 回填默认圈子 → 收紧 NOT NULL
ALTER TABLE "posts" ADD COLUMN "community_id" TEXT;
ALTER TABLE "anonymous_posts" ADD COLUMN "community_id" TEXT;
ALTER TABLE "job_posts" ADD COLUMN "community_id" TEXT;
ALTER TABLE "users" ADD COLUMN "active_community_id" TEXT;

UPDATE "posts" SET "community_id" = 'cm_default' WHERE "community_id" IS NULL;
UPDATE "anonymous_posts" SET "community_id" = 'cm_default' WHERE "community_id" IS NULL;
UPDATE "job_posts" SET "community_id" = 'cm_default' WHERE "community_id" IS NULL;

ALTER TABLE "posts" ALTER COLUMN "community_id" SET NOT NULL;
ALTER TABLE "anonymous_posts" ALTER COLUMN "community_id" SET NOT NULL;
ALTER TABLE "job_posts" ALTER COLUMN "community_id" SET NOT NULL;

-- 存量用户全部加入默认圈子并置为 active（member_count 同步）
INSERT INTO "community_members" ("id", "community_id", "user_id", "role", "joined_at")
SELECT 'cm_member_' || replace(gen_random_uuid()::text, '-', ''), 'cm_default', "id", 'MEMBER', NOW()
FROM "users" WHERE "deleted_at" IS NULL
ON CONFLICT ("community_id", "user_id") DO NOTHING;

UPDATE "users" SET "active_community_id" = 'cm_default' WHERE "active_community_id" IS NULL AND "deleted_at" IS NULL;

UPDATE "communities" SET
  "member_count" = (SELECT COUNT(*) FROM "community_members" WHERE "community_id" = 'cm_default'),
  "post_count"   = (SELECT COUNT(*) FROM "posts" WHERE "community_id" = 'cm_default')
WHERE "id" = 'cm_default';

-- CreateIndex
CREATE INDEX "communities_status_created_at_idx" ON "communities"("status", "created_at");
CREATE INDEX "communities_status_member_count_idx" ON "communities"("status", "member_count");
CREATE INDEX "community_members_user_id_joined_at_idx" ON "community_members"("user_id", "joined_at");
CREATE INDEX "banners_community_id_status_sort_order_idx" ON "banners"("community_id", "status", "sort_order");
CREATE INDEX "content_views_target_type_target_id_created_at_idx" ON "content_views"("target_type", "target_id", "created_at");
CREATE INDEX "content_views_created_at_idx" ON "content_views"("created_at");
CREATE UNIQUE INDEX "content_views_target_type_target_id_viewer_key_hour_bucket_key" ON "content_views"("target_type", "target_id", "viewer_key", "hour_bucket");
CREATE INDEX "anonymous_posts_community_id_status_created_at_idx" ON "anonymous_posts"("community_id", "status", "created_at");
CREATE INDEX "job_posts_community_id_status_created_at_idx" ON "job_posts"("community_id", "status", "created_at");
CREATE INDEX "posts_community_id_status_visibility_created_at_idx" ON "posts"("community_id", "status", "visibility", "created_at");
CREATE INDEX "users_active_community_id_idx" ON "users"("active_community_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_active_community_id_fkey" FOREIGN KEY ("active_community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anonymous_posts" ADD CONSTRAINT "anonymous_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "banners" ADD CONSTRAINT "banners_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- seed 占位 Banner（prod 由管理端换真图）
INSERT INTO "banners" ("id", "title", "image_url", "link_url", "community_id", "sort_order", "status", "created_at") VALUES
('bn_seed_1', '欢迎来到综合大学圈', 'https://mock-minio.example.com/banners/seed-1.png', NULL, 'cm_default', 1, 'ENABLED', NOW()),
('bn_seed_2', '新学期招新活动', 'https://mock-minio.example.com/banners/seed-2.png', NULL, 'cm_default', 2, 'ENABLED', NOW()),
('bn_seed_g1', '平台公告：文明发言', 'https://mock-minio.example.com/banners/seed-global-1.png', NULL, NULL, 1, 'ENABLED', NOW());
