-- AlterTable（表白墙累计浏览数 PV）
ALTER TABLE "posts" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable（树洞累计浏览数 PV）
ALTER TABLE "anonymous_posts" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable（树洞匿名评论，0 真实 uid）
CREATE TABLE "anon_comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "anon_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable（树洞匿名评论点赞）
CREATE TABLE "anon_comment_likes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "anon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anon_comments_post_id_created_at_idx" ON "anon_comments"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "anon_comment_likes_comment_id_anon_id_key" ON "anon_comment_likes"("comment_id", "anon_id");

-- CreateIndex
CREATE INDEX "anon_comment_likes_comment_id_idx" ON "anon_comment_likes"("comment_id");

-- AddForeignKey
ALTER TABLE "anon_comments" ADD CONSTRAINT "anon_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "anonymous_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anon_comment_likes" ADD CONSTRAINT "anon_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "anon_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
