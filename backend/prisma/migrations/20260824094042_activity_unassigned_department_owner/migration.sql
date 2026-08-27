-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_employeeId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "marketId" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

