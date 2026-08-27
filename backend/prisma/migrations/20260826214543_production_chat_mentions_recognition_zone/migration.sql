-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationType" ADD VALUE 'ZONE_GROUP';
ALTER TYPE "ConversationType" ADD VALUE 'ZONE_ANNOUNCEMENTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'MANAGEMENT_RECOGNITION';

-- AlterTable
ALTER TABLE "MessageReaction" ADD COLUMN     "isRecognition" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MessageMention" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageMention_employeeId_idx" ON "MessageMention"("employeeId");

-- CreateIndex
CREATE INDEX "MessageMention_userId_idx" ON "MessageMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMention_messageId_employeeId_key" ON "MessageMention"("messageId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMention_messageId_userId_key" ON "MessageMention"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "MessageMention" ADD CONSTRAINT "MessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMention" ADD CONSTRAINT "MessageMention_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMention" ADD CONSTRAINT "MessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

