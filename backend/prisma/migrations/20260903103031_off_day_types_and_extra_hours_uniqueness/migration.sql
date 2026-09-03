-- AlterEnum
ALTER TYPE "DayOffType" ADD VALUE 'EMERGENCY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeaveRequestType" ADD VALUE 'WEEKLY_OFF';
ALTER TYPE "LeaveRequestType" ADD VALUE 'EMERGENCY_OFF';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'OFF_DAY_RECORDED';

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAdjustmentRequest_employeeId_date_key" ON "AttendanceAdjustmentRequest"("employeeId", "date");

