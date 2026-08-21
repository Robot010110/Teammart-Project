-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "employeeCode" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loginId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

