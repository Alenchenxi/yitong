CREATE TYPE "ActivityScope" AS ENUM ('PLATFORM', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ActivityFormat" AS ENUM ('OFFLINE', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ActivityJoinMode" AS ENUM ('DIRECT', 'REVIEW');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UPCOMING', 'ONGOING', 'ENDED', 'CANCELLED', 'DELISTED');

-- CreateEnum
CREATE TYPE "ActivityInfoVisibility" AS ENUM ('PUBLIC', 'APPROVED_ONLY');

-- CreateEnum
CREATE TYPE "ActivityEnrollmentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'WAITLIST', 'CANCELLED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActivityInterestState" AS ENUM ('INTERESTED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "ActivityReminderKind" AS ENUM ('AUTO_3D', 'AUTO_1D', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActivitySyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- DropForeignKey

CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "scope" "ActivityScope" NOT NULL DEFAULT 'PLATFORM',
    "community_id" TEXT,
    "title" TEXT NOT NULL,
    "cover_image" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "format" "ActivityFormat" NOT NULL,
    "location" TEXT,
    "join_link" TEXT,
    "info_visibility" "ActivityInfoVisibility" NOT NULL DEFAULT 'PUBLIC',
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "enroll_start_at" TIMESTAMP(3),
    "enroll_end_at" TIMESTAMP(3),
    "join_mode" "ActivityJoinMode" NOT NULL,
    "capacity" INTEGER,
    "form" JSONB NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "initiator_id" TEXT NOT NULL,
    "lark_connection_id" TEXT,
    "lark_bitable_app" TEXT,
    "lark_bitable_table" TEXT,
    "published_at" TIMESTAMP(3),
    "chat_readonly_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_admins" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_enrollments" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ActivityEnrollmentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "data" JSONB NOT NULL,
    "approved_data" JSONB,
    "pending_data" JSONB,
    "waitlisted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_interests" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" "ActivityInterestState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_reminders" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "ActivityReminderKind" NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "sent_by" TEXT,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lark_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "app_secret" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lark_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_sync_records" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "status" "ActivitySyncStatus" NOT NULL DEFAULT 'PENDING',
    "remote_record_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex

-- CreateIndex
CREATE INDEX "activity_admins_user_id_idx" ON "activity_admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_admins_activity_id_user_id_key" ON "activity_admins"("activity_id", "user_id");

-- CreateIndex
CREATE INDEX "activity_enrollments_activity_id_status_waitlisted_at_idx" ON "activity_enrollments"("activity_id", "status", "waitlisted_at");

-- CreateIndex
CREATE INDEX "activity_enrollments_user_id_updated_at_idx" ON "activity_enrollments"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "activity_enrollments_activity_id_user_id_key" ON "activity_enrollments"("activity_id", "user_id");

-- CreateIndex
CREATE INDEX "activity_interests_user_id_state_idx" ON "activity_interests"("user_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "activity_interests_activity_id_user_id_key" ON "activity_interests"("activity_id", "user_id");

-- CreateIndex
CREATE INDEX "activity_reminders_activity_id_kind_created_at_idx" ON "activity_reminders"("activity_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "activity_reminders_user_id_created_at_idx" ON "activity_reminders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "activity_reminders_activity_id_user_id_dedup_key_key" ON "activity_reminders"("activity_id", "user_id", "dedup_key");

-- CreateIndex
CREATE INDEX "lark_connections_owner_id_idx" ON "lark_connections"("owner_id");

-- CreateIndex
CREATE INDEX "activity_sync_records_activity_id_status_idx" ON "activity_sync_records"("activity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "activity_sync_records_activity_id_enrollment_id_key" ON "activity_sync_records"("activity_id", "enrollment_id");

