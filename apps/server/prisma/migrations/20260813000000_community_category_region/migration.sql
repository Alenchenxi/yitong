-- AlterTable
ALTER TABLE "communities" ADD COLUMN "category" TEXT NOT NULL DEFAULT '校园';

-- AlterTable
ALTER TABLE "communities" ADD COLUMN "location" TEXT;

-- AlterTable
ALTER TABLE "communities" ADD COLUMN "region" TEXT;
