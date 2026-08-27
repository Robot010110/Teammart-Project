-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('ANNOUNCEMENT', 'WARNING', 'TASK', 'INFORMATION');

-- CreateEnum
CREATE TYPE "CommunicationCategory" AS ENUM ('STOCK_CHECK', 'COUNTING', 'CLEANING', 'PRICE', 'LABEL', 'EXPIRY', 'INVENTORY', 'GENERAL');

-- CreateEnum
CREATE TYPE "CommunicationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CommunicationScopeType" AS ENUM ('MARKET', 'ZONE', 'ALL_MARKETS');

-- CreateEnum
CREATE TYPE "CommunicationTargetRole" AS ENUM ('WORKER', 'CASHIER', 'BUTCHER', 'EVERYONE');

-- CreateEnum
CREATE TYPE "CommunicationActionType" AS ENUM ('INFORMATIONAL', 'ACKNOWLEDGEMENT', 'COMPLETION');

-- CreateEnum
CREATE TYPE "CommunicationRecipientStatus" AS ENUM ('UNREAD', 'READ', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMUNICATION';

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderNameSnapshot" TEXT NOT NULL,
    "senderRoleSnapshot" "StaffRole" NOT NULL,
    "senderZoneSnapshot" INTEGER,
    "type" "CommunicationType" NOT NULL,
    "category" "CommunicationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "scopeType" "CommunicationScopeType" NOT NULL,
    "zoneId" INTEGER,
    "marketId" TEXT,
    "targetRole" "CommunicationTargetRole" NOT NULL,
    "targetDepartment" TEXT,
    "deadline" TIMESTAMP(3),
    "actionType" "CommunicationActionType" NOT NULL DEFAULT 'INFORMATIONAL',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "CommunicationRecipientStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Communication_senderId_createdAt_idx" ON "Communication"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Communication_zoneId_idx" ON "Communication"("zoneId");

-- CreateIndex
CREATE INDEX "Communication_marketId_idx" ON "Communication"("marketId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_employeeId_status_idx" ON "CommunicationRecipient"("employeeId", "status");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_communicationId_idx" ON "CommunicationRecipient"("communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_communicationId_employeeId_key" ON "CommunicationRecipient"("communicationId", "employeeId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

