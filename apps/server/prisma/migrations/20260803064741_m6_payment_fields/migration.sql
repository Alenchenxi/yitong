-- AlterEnum
ALTER TYPE "PayStatus" ADD VALUE 'REFUNDING';

-- DropIndex
DROP INDEX "job_reviews_application_id_key";

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "unread_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "refund_status" TEXT,
ADD COLUMN     "wx_refund_id" TEXT,
ADD COLUMN     "wx_transaction_id" TEXT;
