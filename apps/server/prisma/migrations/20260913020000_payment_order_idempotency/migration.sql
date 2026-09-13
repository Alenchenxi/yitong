-- 取消支付后的重试必须复用同一待支付订单；先关闭历史重复项，再建立并发兜底约束。
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY merchant_id, job_post_id, duration
    ORDER BY created_at DESC, id DESC
  ) AS rn
  FROM payment_orders
  WHERE scene = 'JOB_PUBLISH'
    AND status = 'PENDING'
    AND merchant_id IS NOT NULL
    AND job_post_id IS NOT NULL
    AND duration IS NOT NULL
)
UPDATE payment_orders AS p
SET status = 'CLOSED'
FROM ranked AS r
WHERE p.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, post_id, boost_plan_id
    ORDER BY created_at DESC, id DESC
  ) AS rn
  FROM payment_orders
  WHERE scene = 'POST_BOOST'
    AND status = 'PENDING'
    AND user_id IS NOT NULL
    AND post_id IS NOT NULL
    AND boost_plan_id IS NOT NULL
)
UPDATE payment_orders AS p
SET status = 'CLOSED'
FROM ranked AS r
WHERE p.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, anon_post_id, boost_plan_id
    ORDER BY created_at DESC, id DESC
  ) AS rn
  FROM payment_orders
  WHERE scene = 'ANON_POST_BOOST'
    AND status = 'PENDING'
    AND user_id IS NOT NULL
    AND anon_post_id IS NOT NULL
    AND boost_plan_id IS NOT NULL
)
UPDATE payment_orders AS p
SET status = 'CLOSED'
FROM ranked AS r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX payment_orders_pending_job_publish_unique
  ON payment_orders (merchant_id, job_post_id, duration)
  WHERE scene = 'JOB_PUBLISH' AND status = 'PENDING';

CREATE UNIQUE INDEX payment_orders_pending_post_boost_unique
  ON payment_orders (user_id, post_id, boost_plan_id)
  WHERE scene = 'POST_BOOST' AND status = 'PENDING';

CREATE UNIQUE INDEX payment_orders_pending_anon_post_boost_unique
  ON payment_orders (user_id, anon_post_id, boost_plan_id)
  WHERE scene = 'ANON_POST_BOOST' AND status = 'PENDING';
