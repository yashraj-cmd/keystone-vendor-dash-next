-- CreateTable
CREATE TABLE "catalogue_items" (
    "id" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "hsn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalogue_items_catalogueId_idx" ON "catalogue_items"("catalogueId");

-- AddForeignKey
ALTER TABLE "catalogue_items" ADD CONSTRAINT "catalogue_items_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "catalogues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
