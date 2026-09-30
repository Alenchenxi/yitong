-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'DRAFT');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "posts_author_id_visibility_created_at_idx" ON "posts"("author_id", "visibility", "created_at");
