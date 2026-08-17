-- CreateEnum
CREATE TYPE "MarketFeedbackType" AS ENUM ('WARNING', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "MarketFeedbackPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'RM_DIRECT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MARKET_FEEDBACK';

-- DropIndex
DROP INDEX "Zone_managerId_key";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MarketVisit" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "regionalManagerId" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRating" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "regionalManagerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "notes" TEXT,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketNote" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "regionalManagerId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketFeedback" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "regionalManagerId" INTEGER NOT NULL,
    "type" "MarketFeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "priority" "MarketFeedbackPriority" NOT NULL DEFAULT 'NORMAL',
    "photoUrl" TEXT,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketVisit_marketId_idx" ON "MarketVisit"("marketId");

-- CreateIndex
CREATE INDEX "MarketVisit_regionalManagerId_idx" ON "MarketVisit"("regionalManagerId");

-- CreateIndex
CREATE INDEX "MarketRating_marketId_createdAt_idx" ON "MarketRating"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketNote_marketId_createdAt_idx" ON "MarketNote"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketFeedback_marketId_createdAt_idx" ON "MarketFeedback"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "Zone_managerId_idx" ON "Zone"("managerId");

-- AddForeignKey
ALTER TABLE "MarketVisit" ADD CONSTRAINT "MarketVisit_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketVisit" ADD CONSTRAINT "MarketVisit_regionalManagerId_fkey" FOREIGN KEY ("regionalManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRating" ADD CONSTRAINT "MarketRating_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRating" ADD CONSTRAINT "MarketRating_regionalManagerId_fkey" FOREIGN KEY ("regionalManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRating" ADD CONSTRAINT "MarketRating_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "MarketVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNote" ADD CONSTRAINT "MarketNote_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNote" ADD CONSTRAINT "MarketNote_regionalManagerId_fkey" FOREIGN KEY ("regionalManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNote" ADD CONSTRAINT "MarketNote_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "MarketVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFeedback" ADD CONSTRAINT "MarketFeedback_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFeedback" ADD CONSTRAINT "MarketFeedback_regionalManagerId_fkey" FOREIGN KEY ("regionalManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFeedback" ADD CONSTRAINT "MarketFeedback_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "MarketVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

