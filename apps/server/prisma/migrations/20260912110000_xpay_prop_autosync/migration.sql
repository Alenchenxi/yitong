-- XPAY 道具自动同步状态（PricingConfig）：改价后自动上传+发布编码价格的新道具
ALTER TABLE "pricing_config" ADD COLUMN "xpay_product_id" TEXT;
ALTER TABLE "pricing_config" ADD COLUMN "xpay_prop_status" TEXT;
ALTER TABLE "pricing_config" ADD COLUMN "xpay_sync_step" TEXT;
ALTER TABLE "pricing_config" ADD COLUMN "xpay_sync_started_at" TIMESTAMP(3);
ALTER TABLE "pricing_config" ADD COLUMN "xpay_published_at" TIMESTAMP(3);
ALTER TABLE "pricing_config" ADD COLUMN "xpay_sync_error" TEXT;

-- 平台管理员发岗免支付标记
ALTER TABLE "payment_orders" ADD COLUMN "waived" BOOLEAN NOT NULL DEFAULT false;
