CREATE TABLE "admin_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,
    "system_protected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "admin_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_type_permissions" (
    "id" TEXT NOT NULL,
    "admin_type_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    CONSTRAINT "admin_type_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_community_scopes" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_community_scopes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_admin_id" TEXT,
    "actor_openid" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_types_name_key" ON "admin_types"("name");
CREATE UNIQUE INDEX "admin_types_code_key" ON "admin_types"("code");
CREATE INDEX "admin_types_active_deleted_at_idx" ON "admin_types"("active", "deleted_at");
CREATE UNIQUE INDEX "admin_permissions_code_key" ON "admin_permissions"("code");
CREATE INDEX "admin_permissions_module_sort_order_idx" ON "admin_permissions"("module", "sort_order");
CREATE UNIQUE INDEX "admin_type_permissions_admin_type_id_permission_id_key" ON "admin_type_permissions"("admin_type_id", "permission_id");
CREATE INDEX "admin_type_permissions_permission_id_idx" ON "admin_type_permissions"("permission_id");
CREATE UNIQUE INDEX "admin_community_scopes_admin_user_id_community_id_key" ON "admin_community_scopes"("admin_user_id", "community_id");
CREATE INDEX "admin_community_scopes_community_id_idx" ON "admin_community_scopes"("community_id");
CREATE INDEX "admin_audit_logs_actor_admin_id_created_at_idx" ON "admin_audit_logs"("actor_admin_id", "created_at");
CREATE INDEX "admin_audit_logs_target_type_target_id_created_at_idx" ON "admin_audit_logs"("target_type", "target_id", "created_at");

INSERT INTO "admin_types" ("id", "name", "code", "description", "active", "is_platform", "system_protected")
VALUES ('at_platform', '平台管理员', 'PLATFORM_ADMIN', '拥有平台全部权限', true, true, true);

INSERT INTO "admin_types" ("id", "name", "code", "description", "active", "is_platform", "system_protected")
VALUES ('at_community', '圈子管理员', 'COMMUNITY_ADMIN', '维护授权圈子的资料、广告位和内容', true, false, true);

ALTER TABLE "admin_users" ADD COLUMN "admin_type_id" TEXT;
ALTER TABLE "admin_users" ADD COLUMN "all_communities" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "admin_users" SET "admin_type_id" = 'at_platform', "all_communities" = true;
ALTER TABLE "admin_users" ALTER COLUMN "admin_type_id" SET NOT NULL;

-- 历史无圈子广告来自旧版种子；保留内容并明确归入默认圈子。
UPDATE "banners" SET "community_id" = 'cm_default' WHERE "community_id" IS NULL;
ALTER TABLE "banners" ALTER COLUMN "community_id" SET NOT NULL;

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_admin_type_id_fkey" FOREIGN KEY ("admin_type_id") REFERENCES "admin_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_type_permissions" ADD CONSTRAINT "admin_type_permissions_admin_type_id_fkey" FOREIGN KEY ("admin_type_id") REFERENCES "admin_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_type_permissions" ADD CONSTRAINT "admin_type_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_community_scopes" ADD CONSTRAINT "admin_community_scopes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_community_scopes" ADD CONSTRAINT "admin_community_scopes_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "admin_users_admin_type_id_idx" ON "admin_users"("admin_type_id");
