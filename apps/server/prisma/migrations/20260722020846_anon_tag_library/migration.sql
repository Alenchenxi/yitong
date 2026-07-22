-- CreateTable
CREATE TABLE "anon_tags" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anon_tags_category_active_sort_order_idx" ON "anon_tags"("category", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "anon_tags_category_name_key" ON "anon_tags"("category", "name");
