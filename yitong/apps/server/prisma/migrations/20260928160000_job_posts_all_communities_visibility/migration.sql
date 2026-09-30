-- P2-75 发岗仅选归属圈子，发布后全圈同步：
-- 1) 放宽 job_posts_publication_scope_check（原 P2-52：COMMUNITY 发布者只能 COMMUNITY 可见）：
--    全圈可见不再限定 PLATFORM 发布者；COMMUNITY 可见仅保留给 COMMUNITY 发布者（迁移窗口兜底），
--    PLATFORM + COMMUNITY 组合仍被禁止
-- 2) 存量 COMMUNITY 可见范围的岗位一次性迁移为全圈可见（新发岗在应用层统一写 ALL_COMMUNITIES）
ALTER TABLE "job_posts" DROP CONSTRAINT "job_posts_publication_scope_check";
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_publication_scope_check"
  CHECK (("visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));
UPDATE "job_posts" SET "visibility_scope" = 'ALL_COMMUNITIES' WHERE "visibility_scope" = 'COMMUNITY';
