ALTER TYPE "JobConversationMessageType" ADD VALUE 'CONTACT_EXCHANGE';
ALTER TYPE "JobConversationMessageType" ADD VALUE 'RESUME_EXCHANGE';

ALTER TABLE "resumes"
ADD COLUMN "wechat" TEXT;

ALTER TABLE "job_conversation_messages"
ADD COLUMN "exchange_payload" JSONB;
