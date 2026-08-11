-- CreateEnum
CREATE TYPE "MessageAttachmentType" AS ENUM ('FILE', 'AUDIO', 'VOICE');

-- CreateEnum
CREATE TYPE "WastedItem" AS ENUM ('EGGS', 'TOMATO', 'POTATO', 'CUCUMBER', 'ONION');

-- AlterEnum
ALTER TYPE "LeaveRequestType" ADD VALUE 'EARNED_DAY_OFF';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WASTED_OVERALL';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "punishmentHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "hoursSpent" INTEGER;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentDurationSec" INTEGER,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER,
ADD COLUMN     "attachmentType" "MessageAttachmentType",
ADD COLUMN     "attachmentUrl" TEXT;

-- CreateTable
CREATE TABLE "WastedOverallReport" (
    "id" TEXT NOT NULL,
    "item" "WastedItem" NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "photoUrl" TEXT,
    "notes" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WastedOverallReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WastedOverallReport_employeeId_idx" ON "WastedOverallReport"("employeeId");

-- CreateIndex
CREATE INDEX "WastedOverallReport_marketId_idx" ON "WastedOverallReport"("marketId");

-- CreateIndex
CREATE INDEX "WastedOverallReport_reportedAt_idx" ON "WastedOverallReport"("reportedAt");

-- AddForeignKey
ALTER TABLE "WastedOverallReport" ADD CONSTRAINT "WastedOverallReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastedOverallReport" ADD CONSTRAINT "WastedOverallReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastedOverallReport" ADD CONSTRAINT "WastedOverallReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

