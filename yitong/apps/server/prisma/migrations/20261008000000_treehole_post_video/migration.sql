-- P2-83 树洞视频发布: AnonymousPost 加视频字段(与图片互斥, 对齐表白墙 posts 的 video_url/video_cover)

ALTER TABLE "anonymous_posts" ADD COLUMN "video_url" TEXT,
ADD COLUMN "video_cover" TEXT;
