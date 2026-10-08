-- P2-83 配套修复（P2-61 遗漏）：树洞帖全圈可见——
-- P2-61 已将应用层改为统一写 visibility_scope = ALL_COMMUNITIES，但未同步放宽 P2-52 遗留的
-- 严格约束 anonymous_posts_publication_scope_check（COMMUNITY 发布者只能 COMMUNITY 可见），
-- 导致普通用户（COMMUNITY 发布者）创建树洞帖必触发 Postgres 23514 → 50000。
-- 对齐 P2-75 job_posts_all_communities_visibility 先例：
-- 1) 放宽约束：全圈可见不再限定 PLATFORM 发布者；COMMUNITY 可见仅保留给 COMMUNITY 发布者（迁移窗口兜底），
--    PLATFORM + COMMUNITY 组合仍被禁止
-- 2) 存量 COMMUNITY 可见范围的树洞帖一次性迁移为全圈可见（新发帖在应用层统一写 ALL_COMMUNITIES）
ALTER TABLE "anonymous_posts" DROP CONSTRAINT "anonymous_posts_publication_scope_check";
ALTER TABLE "anonymous_posts" ADD CONSTRAINT "anonymous_posts_publication_scope_check"
  CHECK (("visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));
UPDATE "anonymous_posts" SET "visibility_scope" = 'ALL_COMMUNITIES' WHERE "visibility_scope" = 'COMMUNITY';
