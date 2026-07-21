-- AlterEnum
ALTER TYPE "DocumentSource" ADD VALUE 'ZOHO_SYNC';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "zohoId" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "zohoVendorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_zohoId_key" ON "invoices"("zohoId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_zohoVendorId_key" ON "vendors"("zohoVendorId");
