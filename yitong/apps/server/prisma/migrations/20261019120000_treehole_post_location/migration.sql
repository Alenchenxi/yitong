-- CR-006 树洞发布地：市/区文本（可选，纯展示；不存坐标——匿名红线：精确坐标可用于去匿名化）
ALTER TABLE "anonymous_posts" ADD COLUMN "location_city" TEXT;
ALTER TABLE "anonymous_posts" ADD COLUMN "location_district" TEXT;
