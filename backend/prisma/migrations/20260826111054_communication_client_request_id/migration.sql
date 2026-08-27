-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Communication_clientRequestId_key" ON "Communication"("clientRequestId");

