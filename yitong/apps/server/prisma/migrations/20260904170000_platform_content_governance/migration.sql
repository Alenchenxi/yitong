CREATE TYPE "PublicationScope" AS ENUM ('COMMUNITY', 'PLATFORM');
CREATE TYPE "ContentVisibilityScope" AS ENUM ('COMMUNITY', 'ALL_COMMUNITIES');
CREATE TYPE "ModerationAuthority" AS ENUM ('COMMUNITY', 'PLATFORM');

ALTER TABLE "users"
  ADD COLUMN "ban_authority" "ModerationAuthority";

ALTER TABLE "payment_orders"
  ADD COLUMN "fulfillment_applied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refund_attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refund_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "payment_orders"
SET "fulfillment_applied" = true
WHERE "status" IN ('PAID', 'REFUNDING', 'REFUNDED');

ALTER TABLE "posts"
  ADD COLUMN "publisher_scope" "PublicationScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "visibility_scope" "ContentVisibilityScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "moderation_authority" "ModerationAuthority",
  ADD COLUMN "moderation_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "anonymous_posts"
  ADD COLUMN "publisher_scope" "PublicationScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "visibility_scope" "ContentVisibilityScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "moderation_authority" "ModerationAuthority",
  ADD COLUMN "moderation_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "job_posts"
  ADD COLUMN "publisher_scope" "PublicationScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "moderation_authority" "ModerationAuthority",
  ADD COLUMN "moderation_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "moderation_records"
  ADD COLUMN "target_publisher_scope" "PublicationScope",
  ADD COLUMN "target_community_id" TEXT;

UPDATE "job_posts"
SET "publisher_scope" = 'PLATFORM'
WHERE "visibility_scope" = 'ALL_COMMUNITIES';

UPDATE "users"
SET "ban_authority" = 'PLATFORM'
WHERE "deleted_at" IS NOT NULL;

UPDATE "posts"
SET "moderation_authority" = 'PLATFORM'
WHERE "status" = 'REJECTED';

UPDATE "anonymous_posts"
SET "moderation_authority" = 'PLATFORM'
WHERE "status" = 'REJECTED';

-- Historical TAKEN_DOWN jobs remain without governance authority because legacy rows do not
-- contain a durable causal link to the moderation action. They therefore cannot be restored
-- through the administrator governance flow.

UPDATE "moderation_records" mr
SET "target_publisher_scope" = p."publisher_scope",
    "target_community_id" = p."community_id"
FROM "posts" p
WHERE mr."reporter_id" IS NOT NULL AND mr."target_type" = 'post' AND mr."target_id" = p."id";

UPDATE "moderation_records" mr
SET "target_publisher_scope" = p."publisher_scope",
    "target_community_id" = p."community_id"
FROM "anonymous_posts" p
WHERE mr."reporter_id" IS NOT NULL AND mr."target_type" = 'anon-post' AND mr."target_id" = p."id";

UPDATE "moderation_records" mr
SET "target_publisher_scope" = p."publisher_scope",
    "target_community_id" = p."community_id"
FROM "job_posts" p
WHERE mr."reporter_id" IS NOT NULL AND mr."target_type" = 'job_post' AND mr."target_id" = p."id";

UPDATE "moderation_records" mr
SET "target_publisher_scope" = p."publisher_scope",
    "target_community_id" = p."community_id"
FROM "job_applications" a
JOIN "job_posts" p ON p."id" = a."job_post_id"
WHERE mr."reporter_id" IS NOT NULL AND mr."target_type" = 'application' AND mr."target_id" = a."id";

UPDATE "moderation_records"
SET "target_publisher_scope" = 'PLATFORM'
WHERE "reporter_id" IS NOT NULL AND "target_publisher_scope" IS NULL;

ALTER TABLE "posts" ADD CONSTRAINT "posts_publication_scope_check"
  CHECK (("publisher_scope" = 'PLATFORM' AND "visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));
ALTER TABLE "anonymous_posts" ADD CONSTRAINT "anonymous_posts_publication_scope_check"
  CHECK (("publisher_scope" = 'PLATFORM' AND "visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_publication_scope_check"
  CHECK (("publisher_scope" = 'PLATFORM' AND "visibility_scope" = 'ALL_COMMUNITIES')
    OR ("publisher_scope" = 'COMMUNITY' AND "visibility_scope" = 'COMMUNITY'));

CREATE TABLE "community_user_bans" (
  "id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "authority" "ModerationAuthority" NOT NULL DEFAULT 'COMMUNITY',
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "banned_by" TEXT NOT NULL,
  "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lifted_by" TEXT,
  "lifted_at" TIMESTAMP(3),
  CONSTRAINT "community_user_bans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_user_bans_community_id_user_id_key"
  ON "community_user_bans"("community_id", "user_id");
CREATE INDEX "community_user_bans_user_id_active_idx"
  ON "community_user_bans"("user_id", "active");
CREATE INDEX "community_user_bans_community_id_active_idx"
  ON "community_user_bans"("community_id", "active");
CREATE INDEX "payment_orders_refund_retry_queue_idx"
  ON "payment_orders"("status", "refund_status", "refund_retry_at", "created_at");
CREATE INDEX "posts_publisher_scope_status_created_at_idx"
  ON "posts"("publisher_scope", "status", "created_at");
CREATE INDEX "posts_visibility_scope_status_created_at_idx"
  ON "posts"("visibility_scope", "status", "created_at");
CREATE INDEX "anonymous_posts_publisher_scope_status_created_at_idx"
  ON "anonymous_posts"("publisher_scope", "status", "created_at");
CREATE INDEX "anonymous_posts_visibility_scope_status_created_at_idx"
  ON "anonymous_posts"("visibility_scope", "status", "created_at");
CREATE INDEX "job_posts_publisher_scope_status_created_at_idx"
  ON "job_posts"("publisher_scope", "status", "created_at");
CREATE INDEX "moderation_records_reporter_id_target_scope_community_created_at_idx"
  ON "moderation_records"("reporter_id", "target_publisher_scope", "target_community_id", "created_at");

ALTER TABLE "community_user_bans"
  ADD CONSTRAINT "community_user_bans_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_user_bans"
  ADD CONSTRAINT "community_user_bans_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
