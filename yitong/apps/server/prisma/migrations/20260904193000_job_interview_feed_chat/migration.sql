-- Preserve the existing enum type and convert historical active invitations to pending.
ALTER TYPE "InterviewInvitationStatus" RENAME VALUE 'ACTIVE' TO 'PENDING';
ALTER TYPE "InterviewInvitationStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "InterviewInvitationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "interview_invitations"
ADD COLUMN "responded_at" TIMESTAMP(3);

-- Keep the SENYANG_TUTOR source identity and only rename its publisher presentation.
UPDATE "users"
SET "nickname" = '燚桐家教'
WHERE "id" = 'system_tutor_sync_user'
   OR "openid" = 'internal:tutor-sync:senyang';

UPDATE "merchants"
SET "shop_name" = '燚桐家教'
WHERE "id" = 'system_tutor_sync_merchant'
   OR "user_id" IN (
     SELECT "id"
     FROM "users"
     WHERE "openid" = 'internal:tutor-sync:senyang'
   );

UPDATE "job_posts"
SET "publisher_name" = '燚桐家教'
WHERE "id" IN (
  SELECT "job_post_id"
  FROM "tutor_job_sync_bindings"
  WHERE "source" = 'SENYANG_TUTOR'
);
