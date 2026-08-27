-- CreateEnum
CREATE TYPE "MarketProblemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "MarketProblem" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "problemType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "MarketProblemStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "reportedByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketProblem_marketId_status_idx" ON "MarketProblem"("marketId", "status");

-- CreateIndex
CREATE INDEX "MarketProblem_marketId_resolvedAt_idx" ON "MarketProblem"("marketId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "MarketProblem" ADD CONSTRAINT "MarketProblem_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketProblem" ADD CONSTRAINT "MarketProblem_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

