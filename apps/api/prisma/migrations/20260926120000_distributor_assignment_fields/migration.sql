-- AlterTable
ALTER TABLE "User" ADD COLUMN "assignedDistributorId" TEXT;
ALTER TABLE "Order" ADD COLUMN "distributorId" TEXT;
ALTER TABLE "Order" ADD COLUMN "distributorInvoiceReference" TEXT;

-- CreateIndex
CREATE INDEX "User_assignedDistributorId_idx" ON "User"("assignedDistributorId");
CREATE INDEX "Order_distributorId_idx" ON "Order"("distributorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedDistributorId_fkey" FOREIGN KEY ("assignedDistributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
