-- P2-92 补充（用户确认对齐树洞 P2-61 / 兼职 P2-75 先例）：存量圈子帖一并回填为全圈可见。
-- 前一迁移（20261124210000）仅放宽约束未回填，本迁移补齐最后一步：
-- 与 anonymous_posts / job_posts 两次先例同款 UPDATE，存量普通帖全部转为全圈可见。
UPDATE "posts" SET "visibility_scope" = 'ALL_COMMUNITIES' WHERE "visibility_scope" = 'COMMUNITY';
