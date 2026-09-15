-- AlterTable
ALTER TABLE "AttendanceAdjustmentRequest" ADD COLUMN     "marketId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "previousMarketId" TEXT;

-- AlterTable
ALTER TABLE "CountingAssignment" ADD COLUMN     "marketId" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceAdjustmentRequest_marketId_idx" ON "AttendanceAdjustmentRequest"("marketId");

-- CreateIndex
CREATE INDEX "AuditLog_previousMarketId_idx" ON "AuditLog"("previousMarketId");

-- CreateIndex
CREATE INDEX "CountingAssignment_marketId_idx" ON "CountingAssignment"("marketId");

-- AddForeignKey
ALTER TABLE "CountingAssignment" ADD CONSTRAINT "CountingAssignment_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustmentRequest" ADD CONSTRAINT "AttendanceAdjustmentRequest_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
