-- P1-27/P1-28 ModerationRecord 举报人 + 处理结果 + 处理时间
ALTER TABLE "moderation_records"
  ADD COLUMN "reporter_id" TEXT,
  ADD COLUMN "result" TEXT,
  ADD COLUMN "resolved_at" TIMESTAMP(3);
