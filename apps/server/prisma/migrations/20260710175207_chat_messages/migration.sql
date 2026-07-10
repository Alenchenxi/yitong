-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "peer_id" TEXT NOT NULL,
    "last_message" TEXT NOT NULL,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_from_id_to_id_created_at_idx" ON "chat_messages"("from_id", "to_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_to_id_created_at_idx" ON "chat_messages"("to_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_sessions_owner_id_last_at_idx" ON "chat_sessions"("owner_id", "last_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_owner_id_peer_id_key" ON "chat_sessions"("owner_id", "peer_id");

