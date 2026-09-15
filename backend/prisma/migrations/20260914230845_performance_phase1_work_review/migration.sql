-- CreateEnum
CREATE TYPE "WorkTargetType" AS ENUM ('ACTIVITY', 'TASK', 'ITEM_REPORT', 'PRICE_REPORT', 'WASTED_OVERALL');

-- CreateEnum
CREATE TYPE "WorkOutcome" AS ENUM ('APPROVED', 'APPROVED_WITH_CORRECTION', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR');

-- CreateEnum
CREATE TYPE "WorkReviewSource" AS ENUM ('SUPERVISOR', 'BACKFILL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'WORK_REVIEW_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'WORK_REVIEW_CHANGED';

-- CreateTable
CREATE TABLE "WorkReview" (
    "id" TEXT NOT NULL,
    "targetType" "WorkTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "outcome" "WorkOutcome" NOT NULL,
    "severity" "ReviewSeverity",
    "reason" TEXT,
    "qualityPoints" DOUBLE PRECISION NOT NULL,
    "qualityMax" DOUBLE PRECISION NOT NULL,
    "profileKey" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "workCategory" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "WorkReviewSource" NOT NULL DEFAULT 'SUPERVISOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkReview_employeeId_workDate_idx" ON "WorkReview"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "WorkReview_marketId_reviewedAt_idx" ON "WorkReview"("marketId", "reviewedAt");

-- CreateIndex
CREATE INDEX "WorkReview_employeeId_outcome_idx" ON "WorkReview"("employeeId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "WorkReview_targetType_targetId_key" ON "WorkReview"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "WorkReview" ADD CONSTRAINT "WorkReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReview" ADD CONSTRAINT "WorkReview_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReview" ADD CONSTRAINT "WorkReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
