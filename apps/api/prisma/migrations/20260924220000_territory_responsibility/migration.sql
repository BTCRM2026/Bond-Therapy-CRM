-- Add configurable hierarchy metadata.
ALTER TABLE "Region" ADD COLUMN "description" TEXT;
ALTER TABLE "State" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "State_regionId_code_key" ON "State"("regionId", "code");

-- Add Areas without losing existing Territory records.
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Area_cityId_name_key" ON "Area"("cityId", "name");
CREATE INDEX "Area_cityId_idx" ON "Area"("cityId");
ALTER TABLE "Area" ADD CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Area" ("id", "name", "cityId", "isActive", "createdAt", "updatedAt")
SELECT 'area_' || md5("id"), 'General', "id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "City";

ALTER TABLE "Territory"
  ADD COLUMN "areaId" TEXT,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "effectiveFrom" DATE NOT NULL DEFAULT CURRENT_DATE;
UPDATE "Territory" t SET "areaId" = a."id" FROM "Area" a WHERE a."cityId" = t."cityId" AND a."name" = 'General';
ALTER TABLE "Territory" ALTER COLUMN "areaId" SET NOT NULL;
DROP INDEX "Territory_cityId_name_key";
CREATE UNIQUE INDEX "Territory_areaId_name_key" ON "Territory"("areaId", "name");
CREATE UNIQUE INDEX "Territory_code_key" ON "Territory"("code");
CREATE INDEX "Territory_areaId_idx" ON "Territory"("areaId");
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve staff responsibility as dated history instead of overwriting it.
CREATE TABLE "TerritoryAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "assignedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerritoryAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TerritoryAssignment_userId_startDate_idx" ON "TerritoryAssignment"("userId", "startDate");
CREATE INDEX "TerritoryAssignment_territoryId_startDate_idx" ON "TerritoryAssignment"("territoryId", "startDate");
CREATE INDEX "TerritoryAssignment_endDate_idx" ON "TerritoryAssignment"("endDate");
CREATE UNIQUE INDEX "TerritoryAssignment_active_key" ON "TerritoryAssignment"("userId", "territoryId") WHERE "endDate" IS NULL;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TerritoryAssignment" ("id", "userId", "territoryId", "startDate", "createdAt")
SELECT 'ta_' || md5("assignedStaffId" || ':' || "territoryId"), "assignedStaffId", "territoryId", MIN("createdAt")::date, MIN("createdAt")
FROM "Beat"
WHERE "assignedStaffId" IS NOT NULL
GROUP BY "assignedStaffId", "territoryId";
