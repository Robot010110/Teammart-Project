-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "demotedFromUserId" INTEGER,
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "promotedFromEmployeeId" TEXT,
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_demotedFromUserId_key" ON "Employee"("demotedFromUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_promotedFromEmployeeId_key" ON "User"("promotedFromEmployeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_promotedFromEmployeeId_fkey" FOREIGN KEY ("promotedFromEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_demotedFromUserId_fkey" FOREIGN KEY ("demotedFromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

