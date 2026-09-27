CREATE TYPE "DistributionPartnerType" AS ENUM ('SUPER_STOCKIST', 'DISTRIBUTOR');

ALTER TYPE "DistributorStockMovementType" ADD VALUE 'RECEIVED_FROM_PARTNER';
ALTER TYPE "DistributorStockMovementType" ADD VALUE 'SENT_TO_PARTNER';
ALTER TYPE "ReplenishmentStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "ReplenishmentStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "ReplenishmentStatus" ADD VALUE 'PICKING';
ALTER TYPE "ReplenishmentStatus" ADD VALUE 'PACKED';
ALTER TYPE "ReplenishmentStatus" ADD VALUE 'PARTIALLY_RECEIVED';

ALTER TABLE "Distributor"
ADD COLUMN "partnerType" "DistributionPartnerType" NOT NULL DEFAULT 'DISTRIBUTOR',
ADD COLUMN "parentId" TEXT;

ALTER TABLE "ReplenishmentRequest"
ADD COLUMN "sourceDistributorId" TEXT,
ADD COLUMN "invoiceReference" TEXT,
ADD COLUMN "invoiceFinancialYear" TEXT,
ADD COLUMN "invoiceDate" TIMESTAMP(3),
ADD COLUMN "invoiceFile" BYTEA,
ADD COLUMN "invoiceFileName" TEXT,
ADD COLUMN "invoiceMime" TEXT,
ADD COLUMN "confirmationToken" TEXT,
ADD COLUMN "dispatchedAt" TIMESTAMP(3),
ADD COLUMN "receivedAt" TIMESTAMP(3);

ALTER TABLE "ReplenishmentItem"
ADD COLUMN "acceptedQuantity" INTEGER,
ADD COLUMN "dispatchedQuantity" INTEGER,
ADD COLUMN "receivedQuantity" INTEGER,
ADD COLUMN "damagedQuantity" INTEGER;

CREATE INDEX "Distributor_partnerType_parentId_idx" ON "Distributor"("partnerType", "parentId");
CREATE INDEX "ReplenishmentRequest_sourceDistributorId_status_idx" ON "ReplenishmentRequest"("sourceDistributorId", "status");
CREATE UNIQUE INDEX "ReplenishmentRequest_confirmationToken_key" ON "ReplenishmentRequest"("confirmationToken");
UPDATE "ReplenishmentRequest" SET "confirmationToken" = md5(random()::text || clock_timestamp()::text || "id") || md5(random()::text || "id" || clock_timestamp()::text) WHERE "confirmationToken" IS NULL;
UPDATE "ReplenishmentRequest" SET "invoiceFinancialYear" = CASE WHEN EXTRACT(MONTH FROM COALESCE("invoiceDate", "createdAt")) >= 4 THEN to_char(COALESCE("invoiceDate", "createdAt"), 'YY') || '-' || to_char(COALESCE("invoiceDate", "createdAt") + INTERVAL '1 year', 'YY') ELSE to_char(COALESCE("invoiceDate", "createdAt") - INTERVAL '1 year', 'YY') || '-' || to_char(COALESCE("invoiceDate", "createdAt"), 'YY') END WHERE "invoiceReference" IS NOT NULL AND "invoiceFinancialYear" IS NULL;
CREATE UNIQUE INDEX "ReplenishmentRequest_sourceDistributorId_invoiceFinancialYear_invoiceReference_key" ON "ReplenishmentRequest"("sourceDistributorId", "invoiceFinancialYear", "invoiceReference");

ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_sourceDistributorId_fkey" FOREIGN KEY ("sourceDistributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "distributorInvoiceFinancialYear" TEXT;
UPDATE "Order" SET "distributorInvoiceFinancialYear" = CASE WHEN EXTRACT(MONTH FROM COALESCE("distributorFulfilledAt", "updatedAt")) >= 4 THEN to_char(COALESCE("distributorFulfilledAt", "updatedAt"), 'YY') || '-' || to_char(COALESCE("distributorFulfilledAt", "updatedAt") + INTERVAL '1 year', 'YY') ELSE to_char(COALESCE("distributorFulfilledAt", "updatedAt") - INTERVAL '1 year', 'YY') || '-' || to_char(COALESCE("distributorFulfilledAt", "updatedAt"), 'YY') END WHERE "distributorInvoiceReference" IS NOT NULL;
CREATE UNIQUE INDEX "Order_distributorId_distributorInvoiceFinancialYear_distributorInvoiceReference_key" ON "Order"("distributorId", "distributorInvoiceFinancialYear", "distributorInvoiceReference");
ALTER TABLE "Order" ADD COLUMN "partnerToken" TEXT;
CREATE UNIQUE INDEX "Order_partnerToken_key" ON "Order"("partnerToken");
UPDATE "Order" SET "partnerToken" = md5(random()::text || clock_timestamp()::text || "id") || md5(random()::text || "id" || clock_timestamp()::text) WHERE "partnerToken" IS NULL;

CREATE TABLE "DistributorInvoiceAttachment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "file" BYTEA NOT NULL,
  "fileName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistributorInvoiceAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DistributorInvoiceAttachment_orderId_key" ON "DistributorInvoiceAttachment"("orderId");
ALTER TABLE "DistributorInvoiceAttachment" ADD CONSTRAINT "DistributorInvoiceAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
