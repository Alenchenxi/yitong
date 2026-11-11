-- 稳定数据项需求取消：回退 lark_stable_key 列（首迁移 20261111180000 误加，此句幂等）
ALTER TABLE "activities" DROP COLUMN IF EXISTS "lark_stable_key";

-- 补建活动表索引（首迁移提取时遗漏；本地已由临时 diff 建成，生产经此文件补齐）
CREATE INDEX "activities_scope_community_id_status_published_at_idx" ON "activities"("scope", "community_id", "status", "published_at");
CREATE INDEX "activities_status_start_time_idx" ON "activities"("status", "start_time");
CREATE INDEX "activities_initiator_id_status_idx" ON "activities"("initiator_id", "status");
CREATE INDEX "activities_status_published_at_idx" ON "activities"("status", "published_at");
