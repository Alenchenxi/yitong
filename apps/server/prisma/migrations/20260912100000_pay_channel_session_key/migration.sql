-- 岗位付费发布切换虚拟支付（XPAY 道具直购）：
-- 1) PayChannel 支付通道枚举（WXPAY_V3 = wx.requestPayment / XPAY = wx.requestVirtualPayment）
-- 2) payment_orders.channel 记录订单通道（boost 沿用 V3，JOB_PUBLISH 走 XPAY）
-- 3) users.session_key 微信登录态签名密钥（虚拟支付用户态签名必需，仅服务端持有）
-- CreateEnum
CREATE TYPE "PayChannel" AS ENUM ('WXPAY_V3', 'XPAY');

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "channel" "PayChannel" NOT NULL DEFAULT 'WXPAY_V3';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_key" TEXT;
