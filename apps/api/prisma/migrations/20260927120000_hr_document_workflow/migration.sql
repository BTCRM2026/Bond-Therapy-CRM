CREATE TYPE "HrLetterStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'GENERATED', 'SENT', 'ACKNOWLEDGED', 'REJECTED', 'SUPERSEDED', 'CANCELLED');

ALTER TABLE "HrLetter"
ADD COLUMN "snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "status" "HrLetterStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "verificationToken" TEXT,
ADD COLUMN "supersedesId" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "submittedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "managementApprovedAt" TIMESTAMP(3),
ADD COLUMN "managementApprovedById" TEXT,
ADD COLUMN "generatedAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "HrLetter"
SET "verificationToken" = md5(random()::text || clock_timestamp()::text || "id"),
    "status" = 'GENERATED',
    "generatedAt" = "createdAt",
    "snapshot" = jsonb_build_object(
      'employee', jsonb_build_object(
        'name', "recipientName",
        'designation', "recipientDesignation",
        'department', "recipientDepartment"
      ),
      'company', jsonb_build_object('displayName', 'Bond Therapy Professional')
    );

ALTER TABLE "HrLetter" ALTER COLUMN "verificationToken" SET NOT NULL;
CREATE UNIQUE INDEX "HrLetter_verificationToken_key" ON "HrLetter"("verificationToken");
CREATE INDEX "HrLetter_status_idx" ON "HrLetter"("status");
CREATE INDEX "HrLetter_supersedesId_idx" ON "HrLetter"("supersedesId");

CREATE TABLE "HrLetterActivity" (
  "id" TEXT NOT NULL,
  "letterId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "HrLetterStatus",
  "toStatus" "HrLetterStatus",
  "actorId" TEXT,
  "actorName" TEXT,
  "comment" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrLetterActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HrLetterActivity_letterId_createdAt_idx" ON "HrLetterActivity"("letterId", "createdAt");
ALTER TABLE "HrLetterActivity" ADD CONSTRAINT "HrLetterActivity_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "HrLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
