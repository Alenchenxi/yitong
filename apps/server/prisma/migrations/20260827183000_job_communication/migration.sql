ALTER TABLE "job_posts"
ADD COLUMN "contact_phone_snapshot" TEXT,
ADD COLUMN "contact_wechat_snapshot" TEXT;

ALTER TABLE "job_applications"
ADD COLUMN "resume_snapshot" JSONB;

CREATE TYPE "JobConversationMessageType" AS ENUM ('TEXT', 'INTERVIEW');
CREATE TYPE "InterviewInvitationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "job_conversations" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "merchant_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_conversation_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "type" "JobConversationMessageType" NOT NULL DEFAULT 'TEXT',
  "content" TEXT NOT NULL,
  "client_message_id" TEXT,
  "interview_invitation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_invitations" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "meeting_url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "meeting_date" TEXT NOT NULL,
  "meeting_time" TEXT NOT NULL,
  "meeting_no" TEXT,
  "password" TEXT,
  "interviewer_name" TEXT NOT NULL,
  "status" "InterviewInvitationStatus" NOT NULL DEFAULT 'ACTIVE',
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interview_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_conversations_application_id_key" ON "job_conversations"("application_id");
CREATE INDEX "job_conversations_student_id_updated_at_idx" ON "job_conversations"("student_id", "updated_at");
CREATE INDEX "job_conversations_merchant_user_id_updated_at_idx" ON "job_conversations"("merchant_user_id", "updated_at");
CREATE UNIQUE INDEX "job_conversation_messages_interview_invitation_id_key" ON "job_conversation_messages"("interview_invitation_id");
CREATE UNIQUE INDEX "job_conversation_messages_conversation_id_sender_id_client_message_id_key" ON "job_conversation_messages"("conversation_id", "sender_id", "client_message_id");
CREATE INDEX "job_conversation_messages_conversation_id_created_at_idx" ON "job_conversation_messages"("conversation_id", "created_at");
CREATE INDEX "interview_invitations_application_id_created_at_idx" ON "interview_invitations"("application_id", "created_at");
CREATE INDEX "interview_invitations_conversation_id_created_at_idx" ON "interview_invitations"("conversation_id", "created_at");

ALTER TABLE "job_conversations" ADD CONSTRAINT "job_conversations_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_conversations" ADD CONSTRAINT "job_conversations_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_conversations" ADD CONSTRAINT "job_conversations_merchant_user_id_fkey"
FOREIGN KEY ("merchant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_conversation_messages" ADD CONSTRAINT "job_conversation_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "job_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_conversation_messages" ADD CONSTRAINT "job_conversation_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_conversation_messages" ADD CONSTRAINT "job_conversation_messages_interview_invitation_id_fkey"
FOREIGN KEY ("interview_invitation_id") REFERENCES "interview_invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interview_invitations" ADD CONSTRAINT "interview_invitations_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_invitations" ADD CONSTRAINT "interview_invitations_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "job_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_invitations" ADD CONSTRAINT "interview_invitations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
