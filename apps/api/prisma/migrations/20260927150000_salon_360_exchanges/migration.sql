CREATE TYPE "ExchangeStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'RECEIVED', 'INSPECTED', 'REPLACEMENT_APPROVED', 'CREDIT_NOTE_APPROVED', 'REPLACEMENT_DISPATCHED', 'CLOSED');
CREATE TYPE "ExchangeReason" AS ENUM ('DAMAGED_OR_LEAKING', 'WRONG_PRODUCT', 'QUALITY_COMPLAINT', 'EXPIRED_OR_NEAR_EXPIRY', 'UNOPENED_COMMERCIAL_EXCHANGE', 'DELIVERY_SHORTAGE', 'OTHER');
CREATE TYPE "ExchangeDisposition" AS ENUM ('SALEABLE', 'QUARANTINE', 'DAMAGED_WRITE_OFF', 'RETURN_TO_SUPPLIER');

CREATE TABLE "ExchangeRequest" (
  "id" TEXT NOT NULL,
  "exchangeNumber" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "status" "ExchangeStatus" NOT NULL DEFAULT 'SUBMITTED',
  "pickupRequired" BOOLEAN NOT NULL DEFAULT false,
  "salonRemarks" TEXT,
  "reviewComment" TEXT,
  "rejectionReason" TEXT,
  "resolutionReference" TEXT,
  "creditAmount" DECIMAL(12,2),
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "receivedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "inspectedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangeItem" (
  "id" TEXT NOT NULL,
  "exchangeId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "originalProductId" TEXT NOT NULL,
  "replacementProductId" TEXT,
  "requestedQuantity" INTEGER NOT NULL,
  "approvedQuantity" INTEGER,
  "receivedQuantity" INTEGER,
  "reason" "ExchangeReason" NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "conditionPhoto" BYTEA,
  "conditionPhotoMime" TEXT,
  "disposition" "ExchangeDisposition",
  "inspectionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangeStatusHistory" (
  "id" TEXT NOT NULL,
  "exchangeId" TEXT NOT NULL,
  "fromStatus" "ExchangeStatus",
  "toStatus" "ExchangeStatus" NOT NULL,
  "note" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRequest_exchangeNumber_key" ON "ExchangeRequest"("exchangeNumber");
CREATE INDEX "ExchangeRequest_clientId_createdAt_idx" ON "ExchangeRequest"("clientId", "createdAt");
CREATE INDEX "ExchangeRequest_orderId_idx" ON "ExchangeRequest"("orderId");
CREATE INDEX "ExchangeRequest_invoiceId_idx" ON "ExchangeRequest"("invoiceId");
CREATE INDEX "ExchangeRequest_status_createdAt_idx" ON "ExchangeRequest"("status", "createdAt");
CREATE INDEX "ExchangeItem_exchangeId_idx" ON "ExchangeItem"("exchangeId");
CREATE INDEX "ExchangeItem_orderItemId_idx" ON "ExchangeItem"("orderItemId");
CREATE INDEX "ExchangeItem_originalProductId_idx" ON "ExchangeItem"("originalProductId");
CREATE INDEX "ExchangeItem_replacementProductId_idx" ON "ExchangeItem"("replacementProductId");
CREATE INDEX "ExchangeStatusHistory_exchangeId_createdAt_idx" ON "ExchangeStatusHistory"("exchangeId", "createdAt");
CREATE INDEX "ExchangeStatusHistory_actorId_idx" ON "ExchangeStatusHistory"("actorId");

ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ExchangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_originalProductId_fkey" FOREIGN KEY ("originalProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_replacementProductId_fkey" FOREIGN KEY ("replacementProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExchangeStatusHistory" ADD CONSTRAINT "ExchangeStatusHistory_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ExchangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeStatusHistory" ADD CONSTRAINT "ExchangeStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
