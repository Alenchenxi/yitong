CREATE TYPE "JobExchangeKind" AS ENUM ('PHONE', 'WECHAT', 'RESUME');
CREATE TYPE "JobExchangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

ALTER TABLE "job_conversation_messages"
ADD COLUMN "exchange_kind" "JobExchangeKind",
ADD COLUMN "exchange_status" "JobExchangeStatus",
ADD COLUMN "exchange_responded_at" TIMESTAMP(3);

UPDATE "job_conversation_messages"
SET
  "exchange_kind" = CASE
    WHEN "type" = 'RESUME_EXCHANGE' THEN 'RESUME'::"JobExchangeKind"
    WHEN "type" = 'CONTACT_EXCHANGE' AND "exchange_payload"->>'kind' = 'PHONE' THEN 'PHONE'::"JobExchangeKind"
    WHEN "type" = 'CONTACT_EXCHANGE' AND "exchange_payload"->>'kind' = 'WECHAT' THEN 'WECHAT'::"JobExchangeKind"
    ELSE NULL
  END,
  "exchange_status" = 'ACCEPTED'::"JobExchangeStatus",
  "exchange_responded_at" = "created_at"
WHERE "type" IN ('CONTACT_EXCHANGE', 'RESUME_EXCHANGE')
  AND "exchange_payload" IS NOT NULL;

CREATE INDEX "job_conversation_messages_conversation_id_exchange_kind_exchange_status_idx"
ON "job_conversation_messages"("conversation_id", "exchange_kind", "exchange_status");
