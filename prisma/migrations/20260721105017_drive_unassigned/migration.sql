-- CreateTable
CREATE TABLE "drive_unassigned_files" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'catalogue',
    "vendorToken" TEXT NOT NULL,
    "webViewLink" TEXT,
    "modifiedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_unassigned_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drive_unassigned_files_fileId_key" ON "drive_unassigned_files"("fileId");
