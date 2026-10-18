-- AlterTable
ALTER TABLE "OperationsSettings" ADD COLUMN     "strictDayRulesFrom" DATE;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedById" TEXT,
ADD COLUMN     "paymentVerifiedNote" TEXT;

-- CreateTable
CREATE TABLE "DayStartApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "approvedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayStartApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayStartApproval_approvedById_idx" ON "DayStartApproval"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "DayStartApproval_userId_date_key" ON "DayStartApproval"("userId", "date");

-- CreateIndex
CREATE INDEX "Order_salespersonId_paymentVerifiedAt_idx" ON "Order"("salespersonId", "paymentVerifiedAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentVerifiedById_fkey" FOREIGN KEY ("paymentVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayStartApproval" ADD CONSTRAINT "DayStartApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayStartApproval" ADD CONSTRAINT "DayStartApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orders that already counted as sales keep counting: mark their payment as verified at the date they were fulfilled.
UPDATE "Order" SET "paymentVerifiedAt" = COALESCE("deliveredAt", "distributorFulfilledAt", "approvedAt", "createdAt")
WHERE "status" IN ('APPROVED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'DISTRIBUTOR_FULFILLED');

-- The field day rules start the day after this change goes live, so no earlier day is re-marked.
INSERT INTO "OperationsSettings" ("id", "visitRadiusMeters", "strictDayRulesFrom", "updatedAt")
VALUES ('default', 100, CURRENT_DATE + 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "strictDayRulesFrom" = COALESCE("OperationsSettings"."strictDayRulesFrom", EXCLUDED."strictDayRulesFrom");
