ALTER TABLE "users"
  ADD COLUMN "phone" VARCHAR(20),
  ADD COLUMN "wechat" VARCHAR(50);

ALTER TABLE "communities"
  ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "communities_deleted_at_status_created_at_idx"
  ON "communities"("deleted_at", "status", "created_at");