-- CreateEnum
CREATE TYPE "DistributorStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AgreementPartyType" AS ENUM ('DISTRIBUTOR', 'SUPPLIER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "territory" TEXT,
    "creditLimit" DECIMAL(12,2),
    "status" "DistributorStatus" NOT NULL DEFAULT 'ONBOARDING',
    "assignedSalespersonId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "partyType" "AgreementPartyType" NOT NULL,
    "partyName" TEXT NOT NULL,
    "distributorId" TEXT,
    "title" TEXT NOT NULL,
    "signedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Distributor_assignedSalespersonId_idx" ON "Distributor"("assignedSalespersonId");

-- CreateIndex
CREATE INDEX "Distributor_status_idx" ON "Distributor"("status");

-- CreateIndex
CREATE INDEX "Agreement_distributorId_idx" ON "Agreement"("distributorId");

-- CreateIndex
CREATE INDEX "Agreement_expiryDate_idx" ON "Agreement"("expiryDate");

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_sourceKey_key" ON "Notification"("sourceKey");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_assignedSalespersonId_fkey" FOREIGN KEY ("assignedSalespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
