-- CreateTable
CREATE TABLE "anon_follows" (
    "id" TEXT NOT NULL,
    "follower_anon_id" TEXT NOT NULL,
    "followee_anon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_follows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anon_follows_no_self_follow_check"
      CHECK ("follower_anon_id" <> "followee_anon_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anon_follows_follower_anon_id_followee_anon_id_key"
ON "anon_follows"("follower_anon_id", "followee_anon_id");

-- CreateIndex
CREATE INDEX "anon_follows_follower_anon_id_created_at_idx"
ON "anon_follows"("follower_anon_id", "created_at");

-- CreateIndex
CREATE INDEX "anon_follows_followee_anon_id_created_at_idx"
ON "anon_follows"("followee_anon_id", "created_at");

-- AddForeignKey
ALTER TABLE "anon_follows"
ADD CONSTRAINT "anon_follows_follower_anon_id_fkey"
FOREIGN KEY ("follower_anon_id") REFERENCES "anonymous_profiles"("anon_id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anon_follows"
ADD CONSTRAINT "anon_follows_followee_anon_id_fkey"
FOREIGN KEY ("followee_anon_id") REFERENCES "anonymous_profiles"("anon_id")
ON DELETE CASCADE ON UPDATE CASCADE;
