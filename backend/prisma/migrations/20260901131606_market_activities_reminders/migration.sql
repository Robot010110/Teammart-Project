-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CARD_SALES_REMINDER';

-- CreateTable
CREATE TABLE "CardSalesReminder" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sentById" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSalesReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardSalesReminder_marketId_date_idx" ON "CardSalesReminder"("marketId", "date");

-- AddForeignKey
ALTER TABLE "CardSalesReminder" ADD CONSTRAINT "CardSalesReminder_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSalesReminder" ADD CONSTRAINT "CardSalesReminder_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
