-- AlterTable
ALTER TABLE "TotalSalesReport" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER,
ADD COLUMN     "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "TotalSalesReport_marketId_status_idx" ON "TotalSalesReport"("marketId", "status");

-- AddForeignKey
ALTER TABLE "TotalSalesReport" ADD CONSTRAINT "TotalSalesReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

