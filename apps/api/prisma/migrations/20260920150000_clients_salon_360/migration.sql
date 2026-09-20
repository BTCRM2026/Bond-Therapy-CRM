CREATE TYPE "ClientCategory" AS ENUM ('SALON', 'SPA', 'STUDIO', 'ACADEMY');
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ClientPotential" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "CustomerSegment" AS ENUM ('PREMIUM', 'MID', 'VALUE');
CREATE TYPE "ClientActivityType" AS ENUM ('VISIT', 'FOLLOW_UP', 'DEMO', 'SAMPLE', 'NOTE');
CREATE TYPE "ClientActivityStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "salonName" TEXT NOT NULL,
  "category" "ClientCategory" NOT NULL,
  "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
  "ownerName" TEXT,
  "managerName" TEXT,
  "primaryContact" TEXT NOT NULL,
  "whatsappNumber" TEXT,
  "email" TEXT,
  "keyProfessional" TEXT,
  "fullAddress" TEXT,
  "area" TEXT,
  "city" TEXT NOT NULL,
  "pincode" TEXT,
  "googleMapsUrl" TEXT,
  "chairCount" INTEGER,
  "staffCount" INTEGER,
  "stylistCount" INTEGER,
  "approximateDailyCustomers" INTEGER,
  "potential" "ClientPotential",
  "customerSegment" "CustomerSegment",
  "estimatedMonthlyBusiness" DECIMAL(12,2),
  "purchasingFrequency" TEXT,
  "territory" TEXT,
  "routeBeat" TEXT,
  "businessPotentialRating" INTEGER,
  "relationshipRating" INTEGER,
  "paymentBehaviourRating" INTEGER,
  "productOpportunityRating" INTEGER,
  "overallRating" INTEGER,
  "assignedSalespersonId" TEXT,
  "assignedTrainerId" TEXT,
  "distributorId" TEXT,
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientActivity" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "ClientActivityType" NOT NULL,
  "status" "ClientActivityStatus" NOT NULL DEFAULT 'OPEN',
  "purpose" TEXT,
  "personMet" TEXT,
  "note" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_assignedSalespersonId_status_idx" ON "Client"("assignedSalespersonId", "status");
CREATE INDEX "Client_assignedTrainerId_status_idx" ON "Client"("assignedTrainerId", "status");
CREATE INDEX "Client_createdById_idx" ON "Client"("createdById");
CREATE INDEX "Client_distributorId_idx" ON "Client"("distributorId");
CREATE INDEX "Client_city_area_idx" ON "Client"("city", "area");
CREATE INDEX "Client_salonName_idx" ON "Client"("salonName");
CREATE INDEX "Client_primaryContact_idx" ON "Client"("primaryContact");
CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt");
CREATE INDEX "ClientActivity_clientId_createdAt_idx" ON "ClientActivity"("clientId", "createdAt");
CREATE INDEX "ClientActivity_clientId_status_scheduledAt_idx" ON "ClientActivity"("clientId", "status", "scheduledAt");
CREATE INDEX "ClientActivity_createdById_idx" ON "ClientActivity"("createdById");

ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedSalespersonId_fkey" FOREIGN KEY ("assignedSalespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedTrainerId_fkey" FOREIGN KEY ("assignedTrainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
