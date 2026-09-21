-- CreateEnum
CREATE TYPE "DemoOutcome" AS ENUM ('INTERESTED', 'TRIAL_REQUIRED', 'QUOTATION_REQUESTED', 'NOT_INTERESTED', 'FOLLOW_UP_REQUIRED');

-- CreateEnum
CREATE TYPE "IncentiveStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- Extend client activities for demos and staff assignment
ALTER TABLE "ClientActivity"
    ADD COLUMN "assignedToId" TEXT,
    ADD COLUMN "attendeeCount" INTEGER,
    ADD COLUMN "requestedProducts" JSONB,
    ADD COLUMN "outcome" "DemoOutcome";

CREATE INDEX "ClientActivity_assignedToId_type_idx" ON "ClientActivity"("assignedToId", "type");

ALTER TABLE "ClientActivity"
    ADD CONSTRAINT "ClientActivity_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Monthly staff incentive statements
CREATE TABLE "IncentiveStatement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "eligibleRevenue" DECIMAL(12,2) NOT NULL,
    "incentiveAmount" DECIMAL(12,2) NOT NULL,
    "status" "IncentiveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncentiveStatement_userId_periodYear_periodMonth_key"
    ON "IncentiveStatement"("userId", "periodYear", "periodMonth");
CREATE INDEX "IncentiveStatement_periodYear_periodMonth_idx"
    ON "IncentiveStatement"("periodYear", "periodMonth");
CREATE INDEX "IncentiveStatement_status_idx"
    ON "IncentiveStatement"("status");

ALTER TABLE "IncentiveStatement"
    ADD CONSTRAINT "IncentiveStatement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncentiveStatement"
    ADD CONSTRAINT "IncentiveStatement_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Daily staff attendance records
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "punchInAt" TIMESTAMP(3),
    "punchOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceRecord_userId_date_key"
    ON "AttendanceRecord"("userId", "date");
CREATE INDEX "AttendanceRecord_userId_date_idx"
    ON "AttendanceRecord"("userId", "date");

ALTER TABLE "AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
