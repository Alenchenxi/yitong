-- P2-12 加入申请
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "anon_group_join_requests" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "anon_id" TEXT NOT NULL,
  "message" TEXT,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "anon_group_join_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "anon_group_join_requests_group_id_anon_id_status_key" ON "anon_group_join_requests"("group_id", "anon_id", "status");
CREATE INDEX "anon_group_join_requests_group_id_status_idx" ON "anon_group_join_requests"("group_id", "status");
ALTER TABLE "anon_group_join_requests" ADD CONSTRAINT "anon_group_join_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "anon_groups"("id") ON DELETE CASCADE;
