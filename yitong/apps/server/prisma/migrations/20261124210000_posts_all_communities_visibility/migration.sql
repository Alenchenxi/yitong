-- P2-92 表白墙帖全圈可见（对齐 P2-75 job_posts / P2-83 anonymous_posts 先例）：
-- 放宽 posts_publication_scope_check（原 P2-52：COMMUNITY 发布者只能 COMMUNITY 可见）——
-- 全圈可见不再限定 PLATFORM 发布者；COMMUNITY 可见保留给 COMMUNITY 发布者；PLATFORM + COMMUNITY 组合仍被禁止。
-- 与两次先例不同：不回填存量帖——线上存量普通帖是真实用户内容，保持仅归属圈子可见，是否放开历史帖另行决定。
ALTER TABLE "posts" DROP CONSTRAINT "posts_publication_scope_check";
ALTER TABLE "posts" ADD CONSTRAINT "posts_publication_scope_check"
  CHECK (("visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));
