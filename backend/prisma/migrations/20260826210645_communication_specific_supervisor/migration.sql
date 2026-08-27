-- AlterEnum
ALTER TYPE "CommunicationScopeType" ADD VALUE 'SPECIFIC_SUPERVISOR';

-- DropForeignKey
ALTER TABLE "CommunicationRecipient" DROP CONSTRAINT "CommunicationRecipient_employeeId_fkey";

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "targetSupervisorId" INTEGER,
ALTER COLUMN "targetRole" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CommunicationRecipient" ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CommunicationRecipient_userId_status_idx" ON "CommunicationRecipient"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_communicationId_userId_key" ON "CommunicationRecipient"("communicationId", "userId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_targetSupervisorId_fkey" FOREIGN KEY ("targetSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

