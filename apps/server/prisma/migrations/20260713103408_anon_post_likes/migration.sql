-- AlterTable
ALTER TABLE "anonymous_posts" ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "anon_post_likes" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "anon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anon_post_likes_post_id_anon_id_key" ON "anon_post_likes"("post_id", "anon_id");

-- AddForeignKey
ALTER TABLE "anon_post_likes" ADD CONSTRAINT "anon_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "anonymous_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

