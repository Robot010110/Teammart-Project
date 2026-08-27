-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('NORMAL', 'WARNING');

-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'STAFF_DIRECT';

-- DropForeignKey
ALTER TABLE "ConversationRead" DROP CONSTRAINT "ConversationRead_employeeId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "groupType" "GroupType",
ADD COLUMN     "staffParticipantBId" INTEGER;

-- AlterTable
ALTER TABLE "ConversationRead" ADD COLUMN     "staffUserId" INTEGER,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ImportantContact" (
    "id" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "contactUserId" INTEGER,
    "contactEmployeeId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportantContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportantContact_ownerUserId_idx" ON "ImportantContact"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportantContact_ownerUserId_contactUserId_key" ON "ImportantContact"("ownerUserId", "contactUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportantContact_ownerUserId_contactEmployeeId_key" ON "ImportantContact"("ownerUserId", "contactEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_type_staffParticipantId_staffParticipantBId_key" ON "Conversation"("type", "staffParticipantId", "staffParticipantBId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationRead_conversationId_staffUserId_key" ON "ConversationRead"("conversationId", "staffUserId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_staffParticipantBId_fkey" FOREIGN KEY ("staffParticipantBId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantContact" ADD CONSTRAINT "ImportantContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantContact" ADD CONSTRAINT "ImportantContact_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantContact" ADD CONSTRAINT "ImportantContact_contactEmployeeId_fkey" FOREIGN KEY ("contactEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

