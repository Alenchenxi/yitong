-- AlterTable
ALTER TABLE "chat_matches" ADD COLUMN     "expire_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "chat_matches_status_expire_at_idx" ON "chat_matches"("status", "expire_at");
