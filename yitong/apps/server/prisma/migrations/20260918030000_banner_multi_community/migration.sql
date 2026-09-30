-- 广告位多圈投放：Banner 增加全部圈子标记，新增指定圈子关联表
ALTER TABLE "banners" ADD COLUMN "all_communities" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "banners_all_communities_status_sort_order_idx" ON "banners"("all_communities", "status", "sort_order");

CREATE TABLE "banner_communities" (
    "id" TEXT NOT NULL,
    "banner_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_communities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "banner_communities_banner_id_community_id_key" ON "banner_communities"("banner_id", "community_id");

CREATE INDEX "banner_communities_community_id_idx" ON "banner_communities"("community_id");

ALTER TABLE "banner_communities" ADD CONSTRAINT "banner_communities_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "banner_communities" ADD CONSTRAINT "banner_communities_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
