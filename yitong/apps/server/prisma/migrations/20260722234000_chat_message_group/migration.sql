-- P2-11 群消息
ALTER TABLE "chat_messages" ALTER COLUMN "to_id" DROP NOT NULL;
ALTER TABLE "chat_messages" ADD COLUMN "group_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at");
