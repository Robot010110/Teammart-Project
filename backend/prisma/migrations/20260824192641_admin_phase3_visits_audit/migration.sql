-- CreateEnum
CREATE TYPE "MarketVisitType" AS ENUM ('VISIT', 'INSPECTION');

-- CreateEnum
CREATE TYPE "MarketVisitStatus" AS ENUM ('STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ROLE_CHANGED', 'MARKET_ASSIGNMENT_CHANGED', 'ZONE_ASSIGNMENT_CHANGED', 'DEPARTMENT_ASSIGNMENT_CHANGED', 'SHIFT_CHANGED', 'EMPLOYEE_ID_CHANGED', 'PASSWORD_RESET', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_REACTIVATED', 'EMPLOYEE_PROMOTED', 'STAFF_DEMOTED', 'MARKET_VISIT_STARTED', 'MARKET_VISIT_COMPLETED', 'MARKET_VISIT_CANCELLED', 'INSPECTION_STARTED', 'INSPECTION_COMPLETED', 'INSPECTION_CANCELLED');

-- DropForeignKey
ALTER TABLE "MarketVisit" DROP CONSTRAINT "MarketVisit_regionalManagerId_fkey";

-- AlterTable
ALTER TABLE "MarketVisit" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "adminUserId" INTEGER,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "status" "MarketVisitStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "visitType" "MarketVisitType" NOT NULL DEFAULT 'VISIT',
ALTER COLUMN "regionalManagerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "marketId" TEXT,
    "zoneId" INTEGER,
    "reason" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_marketId_idx" ON "AuditLog"("marketId");

-- CreateIndex
CREATE INDEX "AuditLog_zoneId_idx" ON "AuditLog"("zoneId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "MarketVisit_adminUserId_idx" ON "MarketVisit"("adminUserId");

-- CreateIndex
CREATE INDEX "MarketVisit_status_idx" ON "MarketVisit"("status");

-- AddForeignKey
ALTER TABLE "MarketVisit" ADD CONSTRAINT "MarketVisit_regionalManagerId_fkey" FOREIGN KEY ("regionalManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketVisit" ADD CONSTRAINT "MarketVisit_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

