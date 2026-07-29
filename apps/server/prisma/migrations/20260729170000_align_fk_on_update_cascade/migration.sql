-- 修复 schema drift：给 7 个 FK 补 ON UPDATE CASCADE（cuid 不可变，行为无影响）
-- 此前 schema.prisma 声明了 relation 但未生成迁移，DB 缺 ON UPDATE CASCADE 导致 migrate diff 持续报警告。
-- 删除时行为保持不变（与既有迁移一致）：CASCADE 6 个 + posts.topicId SET NULL。

-- DropForeignKey
ALTER TABLE "activity_topic_posts" DROP CONSTRAINT "activity_topic_posts_post_id_fkey";
ALTER TABLE "activity_topic_posts" DROP CONSTRAINT "activity_topic_posts_topic_id_fkey";
ALTER TABLE "anon_group_join_requests" DROP CONSTRAINT "anon_group_join_requests_group_id_fkey";
ALTER TABLE "anon_group_members" DROP CONSTRAINT "anon_group_members_group_id_fkey";
ALTER TABLE "job_views" DROP CONSTRAINT "job_views_job_post_id_fkey";
ALTER TABLE "posts" DROP CONSTRAINT "posts_topic_id_fkey";
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_user_id_fkey";

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anon_group_members" ADD CONSTRAINT "anon_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "anon_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anon_group_join_requests" ADD CONSTRAINT "anon_group_join_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "anon_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_topic_posts" ADD CONSTRAINT "activity_topic_posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "activity_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_topic_posts" ADD CONSTRAINT "activity_topic_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_views" ADD CONSTRAINT "job_views_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
