-- AlterEnum
ALTER TYPE "WastedItem" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "WastedOverallReport" ADD COLUMN     "otherItemName" TEXT,
ADD COLUMN     "quantityCount" INTEGER,
ALTER COLUMN "quantityKg" DROP NOT NULL;
