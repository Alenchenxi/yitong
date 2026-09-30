ALTER TABLE "payment_orders"
  ADD COLUMN "refunded_at" TIMESTAMP(3),
  ADD COLUMN "refund_reason" TEXT;
