-- P2-03 活动专题
CREATE TYPE "ActivityTopicStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TABLE "activity_topics" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "cover_url" TEXT,
  "description" TEXT,
  "status" "ActivityTopicStatus" NOT NULL DEFAULT 'DRAFT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_topic_posts" (
  "id" TEXT NOT NULL,
  "topic_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_topic_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_topic_posts_topic_id_post_id_key" ON "activity_topic_posts"("topic_id", "post_id");
CREATE INDEX "activity_topic_posts_topic_id_sort_order_idx" ON "activity_topic_posts"("topic_id", "sort_order");
ALTER TABLE "activity_topic_posts" ADD CONSTRAINT "activity_topic_posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "activity_topics"("id") ON DELETE CASCADE;
ALTER TABLE "activity_topic_posts" ADD CONSTRAINT "activity_topic_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;

-- P2-04 校园话题运营
CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TABLE "topics" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "cover_url" TEXT,
  "status" "TopicStatus" NOT NULL DEFAULT 'DRAFT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "topics_name_key" UNIQUE ("name")
);

-- posts 加 topic_id
ALTER TABLE "posts" ADD COLUMN "topic_id" TEXT;
ALTER TABLE "posts" ADD CONSTRAINT "posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL;
CREATE INDEX "posts_topic_id_idx" ON "posts"("topic_id");
