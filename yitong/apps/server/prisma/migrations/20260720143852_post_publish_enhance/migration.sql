-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "anon_name" TEXT,
ADD COLUMN     "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "video_cover" TEXT,
ADD COLUMN     "video_url" TEXT;
