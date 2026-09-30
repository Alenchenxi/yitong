-- AlterTable：Merchant 加 contactWechat（智能生成流程落地：发岗位时回填用）
ALTER TABLE "merchants" ADD COLUMN "contact_wechat" TEXT;

-- AlterTable：JobPost 工作地点结构化（强制百度地图选点，老数据 location 文本保留）
ALTER TABLE "job_posts" ADD COLUMN "location_poi_id" TEXT;
ALTER TABLE "job_posts" ADD COLUMN "location_lng" DECIMAL(10, 6);
ALTER TABLE "job_posts" ADD COLUMN "location_lat" DECIMAL(10, 6);
ALTER TABLE "job_posts" ADD COLUMN "location_city" TEXT;

-- CreateIndex：同城岗位筛选
CREATE INDEX "job_posts_location_city_status_idx" ON "job_posts"("location_city", "status");