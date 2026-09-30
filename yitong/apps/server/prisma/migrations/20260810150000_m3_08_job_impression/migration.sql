-- CreateTable
CREATE TABLE "job_impressions" (
    "id" TEXT NOT NULL,
    "job_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hour_bucket" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_impressions_job_post_id_user_id_hour_bucket_key" ON "job_impressions"("job_post_id", "user_id", "hour_bucket");

-- CreateIndex
CREATE INDEX "job_impressions_job_post_id_created_at_idx" ON "job_impressions"("job_post_id", "created_at");

-- CreateIndex
CREATE INDEX "job_impressions_user_id_created_at_idx" ON "job_impressions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "job_impressions" ADD CONSTRAINT "job_impressions_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_impressions" ADD CONSTRAINT "job_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
