-- CreateEnum
CREATE TYPE "PerfPeriodType" AS ENUM ('WEEK', 'MONTH');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PERFORMANCE_SNAPSHOT_RECOMPUTED';

-- CreateTable
CREATE TABLE "PerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "periodType" "PerfPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION,
    "rawScore" DOUBLE PRECISION,
    "baseScore" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "completionScore" DOUBLE PRECISION,
    "attendanceScore" DOUBLE PRECISION,
    "reliabilityScore" DOUBLE PRECISION,
    "consistencyScore" DOUBLE PRECISION,
    "applicableMax" DOUBLE PRECISION NOT NULL,
    "inputs" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "inputsComplete" BOOLEAN NOT NULL DEFAULT true,
    "profileKey" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staleAt" TIMESTAMP(3),
    "sealedAt" TIMESTAMP(3),

    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceStreak" (
    "employeeId" TEXT NOT NULL,
    "currentApprovalStreak" INTEGER NOT NULL DEFAULT 0,
    "bestApprovalStreak" INTEGER NOT NULL DEFAULT 0,
    "currentRejectionStreak" INTEGER NOT NULL DEFAULT 0,
    "worstRejectionStreak" INTEGER NOT NULL DEFAULT 0,
    "lastOutcome" "WorkOutcome",
    "lastReviewAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceStreak_pkey" PRIMARY KEY ("employeeId")
);

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_employeeId_periodType_periodStart_idx" ON "PerformanceSnapshot"("employeeId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_marketId_periodType_periodStart_idx" ON "PerformanceSnapshot"("marketId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_periodType_periodStart_score_idx" ON "PerformanceSnapshot"("periodType", "periodStart", "score");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_staleAt_idx" ON "PerformanceSnapshot"("staleAt");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceSnapshot_employeeId_periodType_periodStart_key" ON "PerformanceSnapshot"("employeeId", "periodType", "periodStart");

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceStreak" ADD CONSTRAINT "PerformanceStreak_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
