-- CreateEnum
CREATE TYPE "KochOperationType" AS ENUM ('CUSTOMIZATION', 'DISCOUNT_CUSTOMIZATION');

-- CreateEnum
CREATE TYPE "KochOperationStatus" AS ENUM ('SUBMITTED');

-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'KOCH_OPERATION';

-- CreateTable
CREATE TABLE "KochProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "size" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KochProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KochOperation" (
    "id" TEXT NOT NULL,
    "operationType" "KochOperationType",
    "evidenceUrl" TEXT NOT NULL,
    "status" "KochOperationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "employeeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "department" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KochOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KochOperationProduct" (
    "id" TEXT NOT NULL,
    "kochOperationId" TEXT NOT NULL,
    "kochProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "KochOperationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KochProduct_active_idx" ON "KochProduct"("active");

-- CreateIndex
CREATE INDEX "KochOperation_employeeId_idx" ON "KochOperation"("employeeId");

-- CreateIndex
CREATE INDEX "KochOperation_marketId_idx" ON "KochOperation"("marketId");

-- CreateIndex
CREATE INDEX "KochOperation_createdAt_idx" ON "KochOperation"("createdAt");

-- CreateIndex
CREATE INDEX "KochOperationProduct_kochOperationId_idx" ON "KochOperationProduct"("kochOperationId");

-- CreateIndex
CREATE INDEX "KochOperationProduct_kochProductId_idx" ON "KochOperationProduct"("kochProductId");

-- AddForeignKey
ALTER TABLE "KochOperation" ADD CONSTRAINT "KochOperation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KochOperation" ADD CONSTRAINT "KochOperation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KochOperationProduct" ADD CONSTRAINT "KochOperationProduct_kochOperationId_fkey" FOREIGN KEY ("kochOperationId") REFERENCES "KochOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KochOperationProduct" ADD CONSTRAINT "KochOperationProduct_kochProductId_fkey" FOREIGN KEY ("kochProductId") REFERENCES "KochProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
