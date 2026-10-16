-- CreateEnum
CREATE TYPE "StaffRequestStatus" AS ENUM ('SUBMITTED', 'NEEDS_INFO', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StaffRequestEventType" AS ENUM ('SUBMITTED', 'INFO_REQUESTED', 'REPLIED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "StaffRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requesterId" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "approvedValue" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "StaffRequestEventType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRequest_requestNumber_key" ON "StaffRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "StaffRequest_requesterId_createdAt_idx" ON "StaffRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffRequest_status_createdAt_idx" ON "StaffRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffRequestEvent_requestId_createdAt_idx" ON "StaffRequestEvent"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequestEvent" ADD CONSTRAINT "StaffRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequestEvent" ADD CONSTRAINT "StaffRequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
