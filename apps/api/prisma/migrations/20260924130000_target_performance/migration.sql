-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('STAFF', 'TERRITORY', 'REGION');

-- CreateEnum
CREATE TYPE "TargetMetric" AS ENUM ('REVENUE', 'COLLECTION', 'NEW_ACTIVE_SALONS', 'VISITS', 'PRODUCTIVE_VISITS', 'CALLS', 'FOLLOW_UPS');

-- CreateEnum
CREATE TYPE "TargetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "metric" "TargetMetric" NOT NULL,
    "period" "TargetPeriod" NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "targetValue" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Target_scope_scopeId_metric_period_periodYear_periodIndex_key" ON "Target"("scope", "scopeId", "metric", "period", "periodYear", "periodIndex");
CREATE INDEX "Target_scope_scopeId_idx" ON "Target"("scope", "scopeId");
CREATE INDEX "Target_period_periodYear_periodIndex_idx" ON "Target"("period", "periodYear", "periodIndex");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
