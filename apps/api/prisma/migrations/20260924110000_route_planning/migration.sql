-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('PRODUCTIVE', 'ORDER_GENERATED', 'QUOTATION_REQUIRED', 'FOLLOW_UP_REQUIRED', 'OWNER_UNAVAILABLE', 'CLOSED', 'NOT_INTERESTED', 'RESCHEDULED', 'OTHER');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('PLANNED', 'VISITED', 'UNABLE_TO_MEET', 'RESCHEDULED', 'REMOVED');

-- CreateEnum
CREATE TYPE "RouteChangeType" AS ENUM ('ADDED', 'REMOVED', 'REORDERED', 'RESCHEDULED', 'STATUS_CHANGE');

-- AlterTable
ALTER TABLE "ClientActivity"
  ADD COLUMN "routeStopId" TEXT,
  ADD COLUMN "checkInAt" TIMESTAMP(3),
  ADD COLUMN "checkOutAt" TIMESTAMP(3),
  ADD COLUMN "visitOutcome" "VisitOutcome",
  ADD COLUMN "sampleGiven" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nextAction" TEXT;

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "routeDate" DATE NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "plannedTime" TIMESTAMP(3),
    "status" "RouteStopStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteChangeLog" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeType" "RouteChangeType" NOT NULL,
    "clientId" TEXT,
    "reason" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientActivity_routeStopId_key" ON "ClientActivity"("routeStopId");

-- CreateIndex
CREATE UNIQUE INDEX "Route_staffId_routeDate_key" ON "Route"("staffId", "routeDate");
CREATE INDEX "Route_staffId_routeDate_idx" ON "Route"("staffId", "routeDate");
CREATE INDEX "Route_status_idx" ON "Route"("status");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId");
CREATE INDEX "RouteStop_clientId_idx" ON "RouteStop"("clientId");

-- CreateIndex
CREATE INDEX "RouteChangeLog_routeId_createdAt_idx" ON "RouteChangeLog"("routeId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteChangeLog" ADD CONSTRAINT "RouteChangeLog_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteChangeLog" ADD CONSTRAINT "RouteChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
