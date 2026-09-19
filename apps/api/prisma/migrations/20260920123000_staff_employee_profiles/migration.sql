CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

CREATE TABLE "StaffProfile" (
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "bloodGroup" "BloodGroup",
    "workLocation" TEXT,
    "residentialAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactMobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "EmployeeCounter" (
    "key" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeCounter_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");
CREATE INDEX "StaffProfile_mobile_idx" ON "StaffProfile"("mobile");
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
