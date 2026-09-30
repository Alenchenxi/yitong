-- M2-04/05 候选人标记：已联系时间 + 合适/不合适标记（可修改可清除）

-- CreateEnum
CREATE TYPE "FitMark" AS ENUM ('FIT', 'UNFIT');

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN "contacted_at" TIMESTAMP(3),
ADD COLUMN "fitMark" "FitMark";
