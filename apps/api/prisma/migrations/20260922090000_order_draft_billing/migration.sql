ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED_FOR_CORRECTION';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'STOCK_RESERVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DISPATCH';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ARRIVED_AT_CUSTOMER';

CREATE TYPE "InvoiceStatus" AS ENUM ('GENERATED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER');
CREATE TYPE "DeliveryMode" AS ENUM ('VADODARA_LOCAL', 'OUTSTATION_COURIER');

ALTER TABLE "Client"
  ADD COLUMN "billingName" TEXT,
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "stateCode" TEXT;

ALTER TABLE "Product"
  ADD COLUMN "hsnCode" TEXT,
  ADD COLUMN "gstRate" DECIMAL(5,2);

ALTER TABLE "Order"
  ADD COLUMN "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewStartedAt" TIMESTAMP(3),
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "stockReservedAt" TIMESTAMP(3),
  ADD COLUMN "pickingStartedAt" TIMESTAMP(3),
  ADD COLUMN "packedAt" TIMESTAMP(3),
  ADD COLUMN "readyForDispatchAt" TIMESTAMP(3),
  ADD COLUMN "deliveryMode" "DeliveryMode",
  ADD COLUMN "deliveryPersonName" TEXT,
  ADD COLUMN "deliveryPersonMobile" TEXT,
  ADD COLUMN "courierName" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "outForDeliveryAt" TIMESTAMP(3),
  ADD COLUMN "arrivedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OrderItem"
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Order" SET "taxableAmount" = "subtotal" - "discountAmount" WHERE "taxableAmount" = 0;
UPDATE "OrderItem" SET "taxableAmount" = "lineTotal" WHERE "taxableAmount" = 0;

CREATE TABLE "BillingSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "legalName" TEXT NOT NULL DEFAULT 'Bond Therapy',
  "tradeName" TEXT NOT NULL DEFAULT 'Bond Therapy Professional',
  "gstin" TEXT,
  "pan" TEXT,
  "registeredAddress" TEXT,
  "city" TEXT,
  "state" TEXT,
  "stateCode" TEXT,
  "pincode" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "bankName" TEXT,
  "accountName" TEXT,
  "accountNumber" TEXT,
  "ifsc" TEXT,
  "branch" TEXT,
  "upiId" TEXT,
  "invoicePrefix" TEXT NOT NULL DEFAULT 'BT',
  "defaultGstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
  "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "allowSalesDiscount" BOOLEAN NOT NULL DEFAULT false,
  "maxSalesDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "invoiceTerms" TEXT,
  "footerNote" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'GENERATED',
  "companySnapshot" JSONB NOT NULL,
  "customerSnapshot" JSONB NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableAmount" DECIMAL(12,2) NOT NULL,
  "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(12,2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "generatedById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "productId" TEXT,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "hsnCode" TEXT,
  "unit" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableAmount" DECIMAL(12,2) NOT NULL,
  "gstRate" DECIMAL(5,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentDate" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "mode" "PaymentMode" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryProof" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "arrivalPhoto" BYTEA,
  "arrivalPhotoMime" TEXT,
  "deliveryPhoto" BYTEA,
  "deliveryPhotoMime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");
CREATE INDEX "Invoice_clientId_issuedAt_idx" ON "Invoice"("clientId", "issuedAt");
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");
CREATE INDEX "Invoice_generatedById_idx" ON "Invoice"("generatedById");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");
CREATE INDEX "Payment_invoiceId_paymentDate_idx" ON "Payment"("invoiceId", "paymentDate");
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");
CREATE INDEX "Order_reviewedById_idx" ON "Order"("reviewedById");
CREATE UNIQUE INDEX "DeliveryProof_orderId_key" ON "DeliveryProof"("orderId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingSettings" ADD CONSTRAINT "BillingSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
