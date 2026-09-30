-- AlterTable
ALTER TABLE "anonymous_posts" ADD COLUMN     "mood" TEXT;

-- CreateIndex
CREATE INDEX "anonymous_posts_mood_created_at_idx" ON "anonymous_posts"("mood", "created_at");
