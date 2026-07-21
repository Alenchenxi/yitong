-- AlterTable
ALTER TABLE "anonymous_profiles" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "interest_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mood_state" TEXT,
ADD COLUMN     "personality_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
