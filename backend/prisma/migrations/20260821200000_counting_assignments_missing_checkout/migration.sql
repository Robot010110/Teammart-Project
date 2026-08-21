-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COUNTING_ASSIGNMENT_VERIFICATION_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'COUNTING_ASSIGNMENT_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'MISSING_CHECKOUT';
ALTER TYPE "NotificationType" ADD VALUE 'EXCESSIVE_EXTRA_HOURS';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "countingAssignmentId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "missingCheckoutAlertedAt" TIMESTAMP(3),
ADD COLUMN     "stillWorkingConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CountingAssignment" (
    "id" TEXT NOT NULL,
    "originalDepartment" TEXT,
    "assignedDepartment" TEXT NOT NULL,
    "countingArea" TEXT,
    "employeeId" TEXT NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountingAssignment_employeeId_idx" ON "CountingAssignment"("employeeId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_countingAssignmentId_fkey" FOREIGN KEY ("countingAssignmentId") REFERENCES "CountingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountingAssignment" ADD CONSTRAINT "CountingAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountingAssignment" ADD CONSTRAINT "CountingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountingAssignment" ADD CONSTRAINT "CountingAssignment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

