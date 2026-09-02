-- CreateEnum
CREATE TYPE "SuddenTaskCategory" AS ENUM ('GENERAL', 'RESTOCKING', 'CLEANING', 'INVENTORY', 'PRICE_LABEL', 'EXPIRED_WASTE', 'DEPARTMENT_CLOSING');

-- AlterEnum
ALTER TYPE "SuddenTaskStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "SuddenTask" ADD COLUMN     "category" "SuddenTaskCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);
