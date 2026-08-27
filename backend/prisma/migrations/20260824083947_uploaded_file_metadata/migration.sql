-- CreateTable
CREATE TABLE "UploadedFile" (
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "uploaderEmployeeId" TEXT,
    "uploaderUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("filename")
);

-- CreateIndex
CREATE INDEX "UploadedFile_uploaderEmployeeId_idx" ON "UploadedFile"("uploaderEmployeeId");

-- CreateIndex
CREATE INDEX "UploadedFile_uploaderUserId_idx" ON "UploadedFile"("uploaderUserId");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploaderEmployeeId_fkey" FOREIGN KEY ("uploaderEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

