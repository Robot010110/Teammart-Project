-- CreateEnum
CREATE TYPE "CardSalesShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- AlterEnum
ALTER TYPE "EmployeeRole" ADD VALUE 'BUTCHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TOTAL_SALES_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'CARD_SALES_SUBMITTED';

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'OVERLOOKING_SUPERVISOR';

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_marketId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMember" DROP CONSTRAINT "ConversationMember_employeeId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "pictureUrl" TEXT,
ADD COLUMN     "zoneId" INTEGER,
ALTER COLUMN "marketId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "overlookingSupervisorId" INTEGER;

-- CreateTable
CREATE TABLE "TotalSalesReport" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotalSalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSalesReport" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shift" "CardSalesShift" NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoUrl2" TEXT,
    "submittedById" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TotalSalesReport_marketId_date_idx" ON "TotalSalesReport"("marketId", "date");

-- CreateIndex
CREATE INDEX "CardSalesReport_marketId_date_idx" ON "CardSalesReport"("marketId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_overlookingSupervisorId_key" ON "Market"("overlookingSupervisorId");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_overlookingSupervisorId_fkey" FOREIGN KEY ("overlookingSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotalSalesReport" ADD CONSTRAINT "TotalSalesReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotalSalesReport" ADD CONSTRAINT "TotalSalesReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSalesReport" ADD CONSTRAINT "CardSalesReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSalesReport" ADD CONSTRAINT "CardSalesReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

