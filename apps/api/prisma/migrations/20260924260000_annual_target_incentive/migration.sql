-- AlterEnum
ALTER TYPE "TargetPeriod" ADD VALUE 'HALF_YEARLY';
ALTER TYPE "TargetPeriod" ADD VALUE 'YEARLY';
ALTER TYPE "TargetPeriod" ADD VALUE 'SEASONAL';

-- AlterTable
ALTER TABLE "Target" ADD COLUMN "periodStart" DATE;
ALTER TABLE "Target" ADD COLUMN "periodEnd" DATE;
ALTER TABLE "Target" ADD COLUMN "annualPlanId" TEXT;

-- CreateEnum
CREATE TYPE "AnnualDistributionType" AS ENUM ('EQUAL', 'SEASONAL');

-- CreateEnum
CREATE TYPE "TargetIncentiveType" AS ENUM ('PERCENTAGE', 'FIXED', 'SLAB');

-- CreateEnum
CREATE TYPE "IncentiveBasis" AS ENUM ('TOTAL_ELIGIBLE_SALES', 'SALES_ABOVE_TARGET', 'TARGET_AMOUNT');

-- CreateEnum
CREATE TYPE "SlabValueType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "AnnualTargetPlan" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "annualTarget" DECIMAL(12,2) NOT NULL,
    "distributionType" "AnnualDistributionType" NOT NULL,
    "seasons" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualTargetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetIncentiveConfig" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "incentiveType" "TargetIncentiveType" NOT NULL,
    "calculationBasis" "IncentiveBasis" NOT NULL,
    "percentValue" DECIMAL(5,2),
    "fixedAmount" DECIMAL(12,2),
    "minAchievementPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetIncentiveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetIncentiveSlab" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "minAchievementPercent" DECIMAL(5,2) NOT NULL,
    "maxAchievementPercent" DECIMAL(5,2),
    "valueType" "SlabValueType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "TargetIncentiveSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Target_annualPlanId_idx" ON "Target"("annualPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualTargetPlan_staffId_targetYear_key" ON "AnnualTargetPlan"("staffId", "targetYear");

-- CreateIndex
CREATE UNIQUE INDEX "TargetIncentiveConfig_planId_key" ON "TargetIncentiveConfig"("planId");

-- CreateIndex
CREATE INDEX "TargetIncentiveSlab_configId_idx" ON "TargetIncentiveSlab"("configId");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_annualPlanId_fkey" FOREIGN KEY ("annualPlanId") REFERENCES "AnnualTargetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualTargetPlan" ADD CONSTRAINT "AnnualTargetPlan_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnualTargetPlan" ADD CONSTRAINT "AnnualTargetPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetIncentiveConfig" ADD CONSTRAINT "TargetIncentiveConfig_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AnnualTargetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetIncentiveSlab" ADD CONSTRAINT "TargetIncentiveSlab_configId_fkey" FOREIGN KEY ("configId") REFERENCES "TargetIncentiveConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
