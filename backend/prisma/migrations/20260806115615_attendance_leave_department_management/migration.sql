-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('IMPORT', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LeaveRequestType" AS ENUM ('MONTHLY_OFF', 'PERSONAL_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'EARLY_LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'APPROVED_LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'INCOMPLETE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'PENDING_REVIEW';

-- DropForeignKey
ALTER TABLE "AttendanceAdjustment" DROP CONSTRAINT "AttendanceAdjustment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceAdjustment" DROP CONSTRAINT "AttendanceAdjustment_employeeId_fkey";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "rawImportData" JSONB,
ADD COLUMN     "requiredHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL';

-- DropTable
DROP TABLE "AttendanceAdjustment";

-- DropEnum
DROP TYPE "AttendanceAdjustmentType";

-- CreateTable
CREATE TABLE "RequiredHoursAdjustment" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "previousRequiredHours" INTEGER NOT NULL,
    "newRequiredHours" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "adjustedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequiredHoursAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "unmatchedCount" INTEGER NOT NULL,
    "rejectedCount" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketId" TEXT NOT NULL,
    "uploadedById" INTEGER NOT NULL,

    CONSTRAINT "AttendanceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "LeaveRequestType" NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "employeeId" TEXT,
    "performedById" INTEGER NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentAssignment" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "assignedById" INTEGER NOT NULL,

    CONSTRAINT "DepartmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequiredHoursAdjustment_employeeId_idx" ON "RequiredHoursAdjustment"("employeeId");

-- CreateIndex
CREATE INDEX "RequiredHoursAdjustment_date_idx" ON "RequiredHoursAdjustment"("date");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_marketId_idx" ON "AttendanceImportBatch"("marketId");

-- CreateIndex
CREATE INDEX "LeaveRequest_marketId_idx" ON "LeaveRequest"("marketId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_employeeId_date_key" ON "LeaveRequest"("employeeId", "date");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_employeeId_idx" ON "AttendanceAuditLog"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_createdAt_idx" ON "AttendanceAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DepartmentAssignment_employeeId_idx" ON "DepartmentAssignment"("employeeId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredHoursAdjustment" ADD CONSTRAINT "RequiredHoursAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredHoursAdjustment" ADD CONSTRAINT "RequiredHoursAdjustment_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAssignment" ADD CONSTRAINT "DepartmentAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAssignment" ADD CONSTRAINT "DepartmentAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

