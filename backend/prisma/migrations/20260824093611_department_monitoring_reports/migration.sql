-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DEPARTMENT_CLOSING_SUBMITTED';

-- AlterTable
ALTER TABLE "ActivityImage" ADD COLUMN     "expiredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MarketDepartment" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentReport" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shift" "Shift" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "overrideUsed" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "sentById" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT,
    "messageId" TEXT,

    CONSTRAINT "DepartmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketDepartment_marketId_idx" ON "MarketDepartment"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketDepartment_marketId_name_key" ON "MarketDepartment"("marketId", "name");

-- CreateIndex
CREATE INDEX "DepartmentReport_marketId_date_idx" ON "DepartmentReport"("marketId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentReport_marketId_date_shift_key" ON "DepartmentReport"("marketId", "date", "shift");

-- AddForeignKey
ALTER TABLE "MarketDepartment" ADD CONSTRAINT "MarketDepartment_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDepartment" ADD CONSTRAINT "MarketDepartment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

