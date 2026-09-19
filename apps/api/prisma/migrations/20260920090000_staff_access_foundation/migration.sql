CREATE TYPE "Department" AS ENUM ('PURCHASE', 'SALES', 'ACCOUNTS_BILLING', 'WAREHOUSE', 'DEMO');
CREATE TYPE "DataScope" AS ENUM ('OWN', 'TEAM', 'DEPARTMENT', 'COMPANY');

ALTER TABLE "User"
ADD COLUMN "department" "Department",
ADD COLUMN "dataScope" "DataScope" NOT NULL DEFAULT 'OWN',
ADD COLUMN "managerId" TEXT;

CREATE INDEX "User_department_idx" ON "User"("department");
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

ALTER TABLE "User"
ADD CONSTRAINT "User_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
