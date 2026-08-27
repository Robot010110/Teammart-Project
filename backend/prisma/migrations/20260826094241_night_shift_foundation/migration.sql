-- CreateEnum
CREATE TYPE "NightShiftTaskFrequency" AS ENUM ('DAILY', 'ONCE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "DepartmentAssignmentRole" AS ENUM ('MAIN', 'ADDITIONAL');

-- AlterEnum
ALTER TYPE "ActivityCategory" ADD VALUE 'NIGHT_SHIFT_TASK';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "nightShiftTaskDefinitionId" TEXT,
ADD COLUMN     "operationalDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DepartmentAssignment" ADD COLUMN     "role" "DepartmentAssignmentRole" NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "operationalShift" "Shift";

-- CreateTable
CREATE TABLE "NightShiftTaskDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shift" "Shift" NOT NULL DEFAULT 'NIGHT',
    "departmentRestriction" TEXT,
    "marketId" TEXT,
    "zoneId" INTEGER,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "minPhotos" INTEGER NOT NULL DEFAULT 0,
    "frequency" "NightShiftTaskFrequency" NOT NULL DEFAULT 'DAILY',
    "dueTime" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NightShiftTaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NightShiftTaskDefinition_key_key" ON "NightShiftTaskDefinition"("key");

-- CreateIndex
CREATE INDEX "NightShiftTaskDefinition_active_idx" ON "NightShiftTaskDefinition"("active");

-- CreateIndex
CREATE INDEX "NightShiftTaskDefinition_marketId_idx" ON "NightShiftTaskDefinition"("marketId");

-- CreateIndex
CREATE INDEX "NightShiftTaskDefinition_zoneId_idx" ON "NightShiftTaskDefinition"("zoneId");

-- CreateIndex
CREATE INDEX "Activity_nightShiftTaskDefinitionId_idx" ON "Activity"("nightShiftTaskDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_employeeId_nightShiftTaskDefinitionId_operationalD_key" ON "Activity"("employeeId", "nightShiftTaskDefinitionId", "operationalDate");

-- CreateIndex
CREATE INDEX "DepartmentAssignment_employeeId_role_idx" ON "DepartmentAssignment"("employeeId", "role");

-- CreateIndex
CREATE INDEX "Employee_operationalShift_idx" ON "Employee"("operationalShift");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_nightShiftTaskDefinitionId_fkey" FOREIGN KEY ("nightShiftTaskDefinitionId") REFERENCES "NightShiftTaskDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightShiftTaskDefinition" ADD CONSTRAINT "NightShiftTaskDefinition_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightShiftTaskDefinition" ADD CONSTRAINT "NightShiftTaskDefinition_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightShiftTaskDefinition" ADD CONSTRAINT "NightShiftTaskDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

