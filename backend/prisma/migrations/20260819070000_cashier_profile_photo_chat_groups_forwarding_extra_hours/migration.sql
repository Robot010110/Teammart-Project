-- CreateEnum
CREATE TYPE "AttendanceAdjustmentType" AS ENUM ('EXTRA_WORK');

-- CreateEnum
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'CUSTOM_GROUP';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EXTRA_HOURS_SUBMITTED';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "forwardedFromSenderName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "price" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AttendanceAdjustmentType" NOT NULL DEFAULT 'EXTRA_WORK',
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationMember_conversationId_idx" ON "ConversationMember"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_employeeId_key" ON "ConversationMember"("conversationId", "employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAdjustmentRequest_employeeId_idx" ON "AttendanceAdjustmentRequest"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAdjustmentRequest_status_idx" ON "AttendanceAdjustmentRequest"("status");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustmentRequest" ADD CONSTRAINT "AttendanceAdjustmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustmentRequest" ADD CONSTRAINT "AttendanceAdjustmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

