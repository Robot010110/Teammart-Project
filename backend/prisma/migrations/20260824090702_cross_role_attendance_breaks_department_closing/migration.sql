-- CreateEnum
CREATE TYPE "BreakStatus" AS ENUM ('PENDING_CONFIRMATION', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FingerprintEventType" AS ENUM ('BREAK_START');

-- AlterEnum
ALTER TYPE "ActivityCategory" ADD VALUE 'DEPARTMENT_CLOSING';

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_employeeId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "department" TEXT,
ADD COLUMN     "submittedByStaffId" INTEGER;

-- AlterTable
ALTER TABLE "ActivityImage" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "marketId" TEXT,
ADD COLUMN     "staffUserId" INTEGER,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Break" (
    "id" TEXT NOT NULL,
    "status" "BreakStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "expectedEndTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "cancelReason" TEXT,
    "employeeId" TEXT,
    "staffUserId" INTEGER,
    "marketId" TEXT NOT NULL,
    "fingerprintEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Break_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintEvent" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" "FingerprintEventType" NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "sourceDeviceId" TEXT,
    "rawPayload" JSONB,
    "employeeId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FingerprintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Break_fingerprintEventId_key" ON "Break"("fingerprintEventId");

-- CreateIndex
CREATE INDEX "Break_employeeId_idx" ON "Break"("employeeId");

-- CreateIndex
CREATE INDEX "Break_staffUserId_idx" ON "Break"("staffUserId");

-- CreateIndex
CREATE INDEX "Break_marketId_idx" ON "Break"("marketId");

-- CreateIndex
CREATE INDEX "Break_status_idx" ON "Break"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintEvent_externalEventId_key" ON "FingerprintEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "FingerprintEvent_employeeId_idx" ON "FingerprintEvent"("employeeId");

-- CreateIndex
CREATE INDEX "FingerprintEvent_eventTimestamp_idx" ON "FingerprintEvent"("eventTimestamp");

-- CreateIndex
CREATE INDEX "ActivityImage_expiresAt_idx" ON "ActivityImage"("expiresAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_staffUserId_idx" ON "AttendanceRecord"("staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_staffUserId_date_key" ON "AttendanceRecord"("staffUserId", "date");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_submittedByStaffId_fkey" FOREIGN KEY ("submittedByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Break" ADD CONSTRAINT "Break_fingerprintEventId_fkey" FOREIGN KEY ("fingerprintEventId") REFERENCES "FingerprintEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEvent" ADD CONSTRAINT "FingerprintEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-added (not expressible in schema.prisma): guarantees at most one
-- PENDING_CONFIRMATION or ACTIVE break per employee/staff owner, even
-- under concurrent requests. This is the real race-condition guard for
-- "one active break per employee" (Phase 1 spec) — the application also
-- checks first for a fast, friendly error, but this index is what
-- actually prevents two simultaneous requests from both succeeding.
CREATE UNIQUE INDEX "Break_one_active_per_employee" ON "Break" ("employeeId") WHERE status IN ('PENDING_CONFIRMATION', 'ACTIVE') AND "employeeId" IS NOT NULL;
CREATE UNIQUE INDEX "Break_one_active_per_staff" ON "Break" ("staffUserId") WHERE status IN ('PENDING_CONFIRMATION', 'ACTIVE') AND "staffUserId" IS NOT NULL;
