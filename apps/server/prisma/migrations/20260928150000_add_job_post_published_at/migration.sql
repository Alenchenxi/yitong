-- P2-74 编辑后免付费重发：JobPost 首次发布时间（只设不清，判定“PENDING+已发布过+有效期内”免付费重发）
ALTER TABLE "job_posts" ADD COLUMN "published_at" TIMESTAMP(3);

-- 存量回填 1：有 PAID 发布订单的岗位取最近一次支付时间（编辑回退中的 PENDING 岗依赖此判定）
UPDATE "job_posts" SET "published_at" = sub.latest_paid
FROM (
  SELECT "job_post_id", MAX("paid_at") AS latest_paid
  FROM "payment_orders"
  WHERE "scene" = 'JOB_PUBLISH' AND "status" = 'PAID' AND "job_post_id" IS NOT NULL
  GROUP BY "job_post_id"
) AS sub
WHERE "job_posts"."id" = sub."job_post_id" AND "job_posts"."published_at" IS NULL;

-- 存量回填 2：其余曾发布过的岗位（PUBLISHED/TAKEN_DOWN/EXPIRED 均以发布为前提）回填创建时间
UPDATE "job_posts" SET "published_at" = "created_at"
WHERE "published_at" IS NULL AND "status" IN ('PUBLISHED', 'TAKEN_DOWN', 'EXPIRED');
