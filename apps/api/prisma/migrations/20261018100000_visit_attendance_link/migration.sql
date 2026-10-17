-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "fromVisits" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DailySalesReport" ADD COLUMN     "tomorrowExtraStops" JSONB;

-- AlterTable
ALTER TABLE "DailySalesCall" ADD COLUMN     "visitActivityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesCall_visitActivityId_key" ON "DailySalesCall"("visitActivityId");
