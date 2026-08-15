-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'SUPERVISOR_DIRECT';

-- DropIndex
DROP INDEX "Conversation_marketId_type_participantAId_participantBId_key";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "punishmentReason" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "staffParticipantId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_marketId_type_participantAId_participantBId_st_key" ON "Conversation"("marketId", "type", "participantAId", "participantBId", "staffParticipantId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_staffParticipantId_fkey" FOREIGN KEY ("staffParticipantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
