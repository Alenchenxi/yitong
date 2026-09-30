-- P2-26 圈子创建审核 + 拒绝通知

-- AlterEnum: CommunityStatus 加 PENDING（与 PENDING/APPROVED/REJECTED 命名惯例一致）
ALTER TYPE "CommunityStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- AlterTable: Community 加审核留痕字段
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "reject_reason" VARCHAR(200);

-- CreateIndex: creator 视角查"我的全部圈子"
CREATE INDEX IF NOT EXISTS "communities_owner_id_status_idx" ON "communities"("owner_id", "status");

-- CreateTable: 全局配置 KV（通用 FeatureFlag / 系统参数）
CREATE TABLE IF NOT EXISTS "app_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "app_configs_key_key" ON "app_configs"("key");
