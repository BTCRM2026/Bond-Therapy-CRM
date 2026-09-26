-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'FORWARDED_TO_DISTRIBUTOR';
ALTER TYPE "OrderStatus" ADD VALUE 'DISTRIBUTOR_FULFILLED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "distributorId" TEXT;
ALTER TABLE "Order" ADD COLUMN "forwardedToDistributorAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "distributorFulfilledAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "DistributorStockMovementType" AS ENUM ('RECEIVED_FROM_HQ', 'SOLD_TO_SALON', 'ADJUSTMENT', 'RETURNED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "DistributorStock" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorStockMovement" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "DistributorStockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "replenishmentRequestId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReplenishmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_distributorId_idx" ON "User"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributorStock_distributorId_productId_key" ON "DistributorStock"("distributorId", "productId");
CREATE INDEX "DistributorStock_productId_idx" ON "DistributorStock"("productId");

-- CreateIndex
CREATE INDEX "DistributorStockMovement_distributorId_productId_idx" ON "DistributorStockMovement"("distributorId", "productId");
CREATE INDEX "DistributorStockMovement_orderId_idx" ON "DistributorStockMovement"("orderId");
CREATE INDEX "DistributorStockMovement_replenishmentRequestId_idx" ON "DistributorStockMovement"("replenishmentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentRequest_requestNumber_key" ON "ReplenishmentRequest"("requestNumber");
CREATE INDEX "ReplenishmentRequest_distributorId_status_idx" ON "ReplenishmentRequest"("distributorId", "status");

-- CreateIndex
CREATE INDEX "ReplenishmentItem_requestId_idx" ON "ReplenishmentItem"("requestId");
CREATE INDEX "ReplenishmentItem_productId_idx" ON "ReplenishmentItem"("productId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorStock" ADD CONSTRAINT "DistributorStock_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorStock" ADD CONSTRAINT "DistributorStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorStockMovement" ADD CONSTRAINT "DistributorStockMovement_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorStockMovement" ADD CONSTRAINT "DistributorStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorStockMovement" ADD CONSTRAINT "DistributorStockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorStockMovement" ADD CONSTRAINT "DistributorStockMovement_replenishmentRequestId_fkey" FOREIGN KEY ("replenishmentRequestId") REFERENCES "ReplenishmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorStockMovement" ADD CONSTRAINT "DistributorStockMovement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentItem" ADD CONSTRAINT "ReplenishmentItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReplenishmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentItem" ADD CONSTRAINT "ReplenishmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
