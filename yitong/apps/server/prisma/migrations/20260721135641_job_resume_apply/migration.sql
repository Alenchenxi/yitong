-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "resume_id" TEXT;

-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "questions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "self_intro" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_user_id_key" ON "resumes"("user_id");
