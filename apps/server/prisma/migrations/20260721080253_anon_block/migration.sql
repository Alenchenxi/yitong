-- CreateTable
CREATE TABLE "anon_blocks" (
    "id" TEXT NOT NULL,
    "blocker_anon_id" TEXT NOT NULL,
    "blocked_anon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anon_blocks_blocker_anon_id_idx" ON "anon_blocks"("blocker_anon_id");

-- CreateIndex
CREATE INDEX "anon_blocks_blocked_anon_id_idx" ON "anon_blocks"("blocked_anon_id");

-- CreateIndex
CREATE UNIQUE INDEX "anon_blocks_blocker_anon_id_blocked_anon_id_key" ON "anon_blocks"("blocker_anon_id", "blocked_anon_id");
