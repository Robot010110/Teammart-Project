-- AlterEnum
ALTER TYPE "SuddenTaskStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "SuddenTask" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "cancelledReason" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "cancelledReason" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SuddenTask_employeeId_assignedAt_idx" ON "SuddenTask"("employeeId", "assignedAt");

-- CreateIndex
CREATE INDEX "Task_employeeId_createdAt_idx" ON "Task"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuddenTask" ADD CONSTRAINT "SuddenTask_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
