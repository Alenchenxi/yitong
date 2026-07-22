-- Drop the existing application_id unique constraint and replace with composite (application_id, direction)
ALTER TABLE "job_reviews" DROP CONSTRAINT IF EXISTS "job_reviews_application_id_key";
-- Existing duplicate rows from earlier smoke runs would block this; delete them first.
DELETE FROM "job_reviews" a USING "job_reviews" b
  WHERE a."ctid" < b."ctid"
    AND a."application_id" = b."application_id";
ALTER TABLE "job_reviews" ADD CONSTRAINT "job_reviews_application_id_direction_key" UNIQUE ("application_id", "direction");
