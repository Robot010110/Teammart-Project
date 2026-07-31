-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('WORKER', 'CASHIER');

-- CreateEnum
CREATE TYPE "CashierShift" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "cashierShift" "CashierShift",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "role" "EmployeeRole" NOT NULL DEFAULT 'WORKER',
ADD COLUMN     "username" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- CreateTable
CREATE TABLE "CashierCleaningLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierCleaningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceReport" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "barcode" TEXT,
    "shelfPrice" DOUBLE PRECISION NOT NULL,
    "systemPrice" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "shift" "CashierShift",
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashierCleaningLog_employeeId_idx" ON "CashierCleaningLog"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CashierCleaningLog_employeeId_date_key" ON "CashierCleaningLog"("employeeId", "date");

-- CreateIndex
CREATE INDEX "PriceReport_employeeId_idx" ON "PriceReport"("employeeId");

-- CreateIndex
CREATE INDEX "PriceReport_marketId_idx" ON "PriceReport"("marketId");

-- CreateIndex
CREATE INDEX "PriceReport_reportedAt_idx" ON "PriceReport"("reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_username_key" ON "Employee"("username");

-- AddForeignKey
ALTER TABLE "CashierCleaningLog" ADD CONSTRAINT "CashierCleaningLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceReport" ADD CONSTRAINT "PriceReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceReport" ADD CONSTRAINT "PriceReport_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

