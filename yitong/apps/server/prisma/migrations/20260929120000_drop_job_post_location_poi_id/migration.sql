-- P2-79 去百度地图: locationPoiId 无任何消费方, 全链路删除(服务端/前端/DB)

ALTER TABLE "job_posts" DROP COLUMN "location_poi_id";
