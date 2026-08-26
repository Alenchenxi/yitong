-- Distinguish random soul matches from persistent author direct chats.
CREATE TYPE "MatchKind" AS ENUM ('RANDOM', 'DIRECT');

ALTER TABLE "chat_matches"
ADD COLUMN "kind" "MatchKind" NOT NULL DEFAULT 'RANDOM',
ADD COLUMN "direct_key" TEXT;

CREATE UNIQUE INDEX "chat_matches_direct_key_key"
ON "chat_matches"("direct_key");

CREATE INDEX "chat_matches_kind_status_created_at_idx"
ON "chat_matches"("kind", "status", "created_at");
