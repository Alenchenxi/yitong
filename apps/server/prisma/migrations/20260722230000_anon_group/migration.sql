-- P2-07~P2-14 树洞群聊
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'DISBANDED');
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "anon_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "description" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "announcement" TEXT,
  "max_members" INTEGER NOT NULL DEFAULT 100,
  "is_private" BOOLEAN NOT NULL DEFAULT false,
  "owner_anon_id" TEXT NOT NULL,
  "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "member_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "anon_groups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "anon_groups_is_private_status_member_count_idx" ON "anon_groups"("is_private", "status", "member_count");
CREATE INDEX "anon_groups_is_private_status_created_at_idx" ON "anon_groups"("is_private", "status", "created_at");

CREATE TABLE "anon_group_members" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "anon_id" TEXT NOT NULL,
  "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "muted_until" TIMESTAMP(3),
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anon_group_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anon_group_members_group_id_anon_id_key" UNIQUE ("group_id", "anon_id")
);
CREATE INDEX "anon_group_members_group_id_idx" ON "anon_group_members"("group_id");
CREATE INDEX "anon_group_members_anon_id_idx" ON "anon_group_members"("anon_id");
ALTER TABLE "anon_group_members" ADD CONSTRAINT "anon_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "anon_groups"("id") ON DELETE CASCADE;
