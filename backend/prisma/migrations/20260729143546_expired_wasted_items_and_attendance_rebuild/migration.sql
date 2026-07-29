-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('EXPIRED', 'WASTED');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'DAY_OFF');

-- CreateEnum
CREATE TYPE "DayOffType" AS ENUM ('WEEKLY', 'MONTHLY', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceAdjustmentType" AS ENUM ('REWARD', 'EXTRA', 'PENALTY');

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_recordedById_fkey";

-- AlterTable
ALTER TABLE "AttendanceAdjustment" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "type" "AttendanceAdjustmentType" NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "hoursWorked",
DROP COLUMN "recordedById",
ADD COLUMN     "breakEnd" TIMESTAMP(3),
ADD COLUMN     "breakStart" TIMESTAMP(3),
ADD COLUMN     "checkIn" TIMESTAMP(3),
ADD COLUMN     "checkOut" TIMESTAMP(3),
ADD COLUMN     "dayOffType" "DayOffType",
ADD COLUMN     "importedById" INTEGER,
ADD COLUMN     "shift" "Shift",
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "monthlyRequiredHours";

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "marketId" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemReport" (
    "id" TEXT NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "imageUrl" TEXT,
    "productId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_marketId_idx" ON "Product"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_marketId_key" ON "Product"("barcode", "marketId");

-- CreateIndex
CREATE INDEX "ItemReport_employeeId_idx" ON "ItemReport"("employeeId");

-- CreateIndex
CREATE INDEX "ItemReport_productId_idx" ON "ItemReport"("productId");

-- CreateIndex
CREATE INDEX "ItemReport_marketId_idx" ON "ItemReport"("marketId");

-- CreateIndex
CREATE INDEX "ItemReport_reportedAt_idx" ON "ItemReport"("reportedAt");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_date_idx" ON "AttendanceAdjustment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

