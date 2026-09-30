-- AlterTable
ALTER TABLE "chat_matches" ADD COLUMN     "match_score" INTEGER,
ADD COLUMN     "matched_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
