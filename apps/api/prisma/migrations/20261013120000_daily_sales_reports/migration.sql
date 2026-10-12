CREATE TYPE "DailyCallCustomerType" AS ENUM ('EXISTING', 'NEW');
CREATE TYPE "DailyCallResult" AS ENUM ('ORDER', 'NO_ORDER', 'FOLLOW_UP');

CREATE TABLE "DailySalesReport" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "headquarter" TEXT,
    "workingTown" TEXT NOT NULL,
    "coworkerId" TEXT,
    "tomorrowTown" TEXT NOT NULL,
    "tomorrowRouteId" TEXT,
    "noOrderReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailySalesReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailySalesCall" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerType" "DailyCallCustomerType" NOT NULL,
    "result" "DailyCallResult" NOT NULL,
    "orderValue" DECIMAL(12,2),
    "remark" TEXT,
    "visitPhoto" BYTEA NOT NULL,
    "photoMime" TEXT NOT NULL,
    "photoCapturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailySalesCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailySalesReport_tomorrowRouteId_key" ON "DailySalesReport"("tomorrowRouteId");
CREATE UNIQUE INDEX "DailySalesReport_staffId_reportDate_key" ON "DailySalesReport"("staffId", "reportDate");
CREATE INDEX "DailySalesReport_staffId_submittedAt_idx" ON "DailySalesReport"("staffId", "submittedAt");
CREATE INDEX "DailySalesReport_coworkerId_idx" ON "DailySalesReport"("coworkerId");
CREATE INDEX "DailySalesCall_reportId_sequence_idx" ON "DailySalesCall"("reportId", "sequence");
CREATE INDEX "DailySalesCall_customerType_idx" ON "DailySalesCall"("customerType");
CREATE INDEX "DailySalesCall_result_idx" ON "DailySalesCall"("result");

ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_tomorrowRouteId_fkey" FOREIGN KEY ("tomorrowRouteId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailySalesCall" ADD CONSTRAINT "DailySalesCall_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailySalesReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
