-- M3-05 商家主动下架岗位：新增 takenDownAt 字段记录下架时间（null=未下架或非下架状态）
ALTER TABLE "job_posts" ADD COLUMN "taken_down_at" TIMESTAMP(3);
