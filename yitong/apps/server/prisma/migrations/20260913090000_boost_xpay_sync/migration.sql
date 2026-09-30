-- XPAY 道具自动同步状态（BoostPlan）：改价后自动上传+发布编码价格的新道具（与 pricing_config 同构）
ALTER TABLE "boost_plans" ADD COLUMN "xpay_product_id" TEXT;
ALTER TABLE "boost_plans" ADD COLUMN "xpay_prop_status" TEXT;
ALTER TABLE "boost_plans" ADD COLUMN "xpay_sync_step" TEXT;
ALTER TABLE "boost_plans" ADD COLUMN "xpay_sync_started_at" TIMESTAMP(3);
ALTER TABLE "boost_plans" ADD COLUMN "xpay_published_at" TIMESTAMP(3);
ALTER TABLE "boost_plans" ADD COLUMN "xpay_sync_error" TEXT;
