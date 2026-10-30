-- CR-007 树洞公开/私密发布 + 编辑删除: AnonymousPost 加 visibility/edited_at/deleted_at
-- visibility 复用表白墙 posts 的 "PostVisibility" 枚举（PUBLIC/PRIVATE/DRAFT；树洞仅用 PUBLIC/PRIVATE）

ALTER TABLE "anonymous_posts" ADD COLUMN "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "edited_at" TIMESTAMP(3),
ADD COLUMN "deleted_at" TIMESTAMP(3);
