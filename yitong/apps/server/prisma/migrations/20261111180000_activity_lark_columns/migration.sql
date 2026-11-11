-- CreateEnum
CREATE TYPE "ActivitySyncOp" AS ENUM ('UPSERT', 'REMOVE');


-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "lark_stable_key" TEXT;


-- AlterTable
ALTER TABLE "activity_sync_records" ADD COLUMN     "op" "ActivitySyncOp" NOT NULL DEFAULT 'UPSERT';

