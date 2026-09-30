-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "edited_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_author_id_deleted_at_idx" ON "posts"("author_id", "deleted_at");
