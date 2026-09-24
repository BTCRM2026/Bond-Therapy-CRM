-- CreateEnum
CREATE TYPE "IncentiveSourceType" AS ENUM ('INVOICE', 'PAYMENT', 'ORDER');

-- CreateEnum
CREATE TYPE "IncentiveCalcType" AS ENUM ('PERCENT', 'FIXED', 'SLAB');

-- CreateEnum
CREATE TYPE "IncentiveRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "IncentiveCalcStatus" AS ENUM ('CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "IncentiveRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sourceType" "IncentiveSourceType" NOT NULL,
    "calcType" "IncentiveCalcType" NOT NULL,
    "percent" DECIMAL(5,2),
    "fixedAmount" DECIMAL(12,2),
    "slabs" JSONB,
    "roleEligibility" JSONB,
    "territoryEligibility" JSONB,
    "productCategoryEligibility" JSONB,
    "minThreshold" DECIMAL(12,2),
    "maxThreshold" DECIMAL(12,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "status" "IncentiveRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveCalculation" (
    "id" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "IncentiveSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "eligibleAmount" DECIMAL(12,2) NOT NULL,
    "calculation" JSONB NOT NULL,
    "incentiveAmount" DECIMAL(12,2) NOT NULL,
    "status" "IncentiveCalcStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveRuleVersion_ruleId_versionNumber_key" ON "IncentiveRuleVersion"("ruleId", "versionNumber");
CREATE INDEX "IncentiveRuleVersion_ruleId_idx" ON "IncentiveRuleVersion"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveCalculation_ruleVersionId_sourceType_sourceId_key" ON "IncentiveCalculation"("ruleVersionId", "sourceType", "sourceId");
CREATE INDEX "IncentiveCalculation_userId_status_idx" ON "IncentiveCalculation"("userId", "status");
CREATE INDEX "IncentiveCalculation_ruleVersionId_idx" ON "IncentiveCalculation"("ruleVersionId");

-- AddForeignKey
ALTER TABLE "IncentiveRule" ADD CONSTRAINT "IncentiveRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveRuleVersion" ADD CONSTRAINT "IncentiveRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "IncentiveRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "IncentiveRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
