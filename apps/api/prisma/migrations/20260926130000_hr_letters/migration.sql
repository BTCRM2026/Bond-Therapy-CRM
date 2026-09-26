-- CreateEnum
CREATE TYPE "HrLetterType" AS ENUM ('OFFER', 'APPOINTMENT', 'PROBATION', 'CONFIRMATION', 'INTERNSHIP', 'PROMOTION', 'SALARY_INCREMENT', 'WARNING', 'NOC', 'EXPERIENCE', 'RESIGNATION_ACCEPTANCE', 'RELIEVING', 'TERMINATION');

-- CreateTable
CREATE TABLE "HrLetter" (
    "id" TEXT NOT NULL,
    "letterNumber" TEXT NOT NULL,
    "type" "HrLetterType" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientDesignation" TEXT,
    "recipientDepartment" TEXT,
    "staffUserId" TEXT,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "details" JSONB NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HrLetter_letterNumber_key" ON "HrLetter"("letterNumber");
CREATE INDEX "HrLetter_type_idx" ON "HrLetter"("type");
CREATE INDEX "HrLetter_staffUserId_idx" ON "HrLetter"("staffUserId");
CREATE INDEX "HrLetter_createdAt_idx" ON "HrLetter"("createdAt");

-- AddForeignKey
ALTER TABLE "HrLetter" ADD CONSTRAINT "HrLetter_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrLetter" ADD CONSTRAINT "HrLetter_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
