-- 内容推广（付费置顶曝光）：Post / AnonymousPost 加推广到期时间
-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "boost_until" TIMESTAMP(3);
ALTER TABLE "anonymous_posts" ADD COLUMN     "boost_until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_boost_until_idx" ON "posts"("boost_until");
CREATE INDEX "anonymous_posts_boost_until_idx" ON "anonymous_posts"("boost_until");

-- 内容推广档位表
-- CreateTable
CREATE TABLE "boost_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration_hours" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boost_plans_code_key" ON "boost_plans"("code");

-- 支付订单场景判别：加 scene + boost 字段，job 三列改可空（boost 订单不填）
-- CreateEnum
CREATE TYPE "PayScene" AS ENUM ('JOB_PUBLISH', 'POST_BOOST', 'ANON_POST_BOOST');

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "scene" "PayScene" NOT NULL DEFAULT 'JOB_PUBLISH';
ALTER TABLE "payment_orders" ADD COLUMN     "user_id" TEXT;
ALTER TABLE "payment_orders" ADD COLUMN     "post_id" TEXT;
ALTER TABLE "payment_orders" ADD COLUMN     "anon_post_id" TEXT;
ALTER TABLE "payment_orders" ADD COLUMN     "boost_plan_id" TEXT;
ALTER TABLE "payment_orders" ALTER COLUMN "merchant_id" DROP NOT NULL;
ALTER TABLE "payment_orders" ALTER COLUMN "job_post_id" DROP NOT NULL;
ALTER TABLE "payment_orders" ALTER COLUMN "duration" DROP NOT NULL;
