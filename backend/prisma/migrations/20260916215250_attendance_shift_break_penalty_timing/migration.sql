-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BREAK_HALFWAY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'BREAK_TEN_MINUTE_WARNING';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "breakExpiredAlertedAt" TIMESTAMP(3),
ADD COLUMN     "breakHalfwayAlertedAt" TIMESTAMP(3),
ADD COLUMN     "breakTenMinuteAlertedAt" TIMESTAMP(3);
