-- CreateEnum
CREATE TYPE "JobVisibilityScope" AS ENUM ('COMMUNITY', 'ALL_COMMUNITIES');

-- CreateEnum
CREATE TYPE "JobApplyMode" AS ENUM ('IN_APP', 'CONTACT_ONLY');

-- AlterTable
ALTER TABLE "job_posts"
  ALTER COLUMN "expire_at" DROP NOT NULL,
  ADD COLUMN "visibility_scope" "JobVisibilityScope" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "apply_mode" "JobApplyMode" NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN "publisher_name" TEXT;

-- CreateTable
CREATE TABLE "tutor_job_sync_bindings" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "job_post_id" TEXT NOT NULL,
  "platform_blocked_at" TIMESTAMP(3),
  "source_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutor_job_sync_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_job_sync_bindings_job_post_id_key"
  ON "tutor_job_sync_bindings"("job_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_job_sync_bindings_source_external_id_key"
  ON "tutor_job_sync_bindings"("source", "external_id");

-- CreateIndex
CREATE INDEX "tutor_job_sync_bindings_source_updated_at_idx"
  ON "tutor_job_sync_bindings"("source", "updated_at");

-- Keep reconciliation bounded to the current snapshot and bindings that were
-- active in the previous successful snapshot.
CREATE INDEX "tutor_job_sync_bindings_source_source_active_idx"
  ON "tutor_job_sync_bindings"("source", "source_active");

-- Nearest-job queries expand an indexed bounding box before calculating the
-- exact Haversine distance. Separate indexes allow PostgreSQL bitmap scans.
CREATE INDEX "job_posts_nearest_location_lat_idx"
  ON "job_posts"("location_lat")
  WHERE "status" = 'PUBLISHED'
    AND "deleted_at" IS NULL
    AND "location_lat" IS NOT NULL
    AND "location_lng" IS NOT NULL;

CREATE INDEX "job_posts_nearest_location_lng_idx"
  ON "job_posts"("location_lng")
  WHERE "status" = 'PUBLISHED'
    AND "deleted_at" IS NULL
    AND "location_lat" IS NOT NULL
    AND "location_lng" IS NOT NULL;

-- CreateTable
CREATE TABLE "tutor_sync_states" (
  "source" TEXT NOT NULL,
  "last_generated_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutor_sync_states_pkey" PRIMARY KEY ("source")
);

-- AddForeignKey
ALTER TABLE "tutor_job_sync_bindings"
  ADD CONSTRAINT "tutor_job_sync_bindings_job_post_id_fkey"
  FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
