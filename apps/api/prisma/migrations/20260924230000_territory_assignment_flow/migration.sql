-- Correct the geographical direction to State -> Region -> City while preserving legacy data.
ALTER TABLE "Region" ADD COLUMN "stateId" TEXT;
ALTER TABLE "City" ADD COLUMN "regionId" TEXT;

UPDATE "Region" r
SET "stateId" = source."id"
FROM (
  SELECT DISTINCT ON ("regionId") "id", "regionId"
  FROM "State"
  ORDER BY "regionId", "createdAt"
) source
WHERE source."regionId" = r."id";

UPDATE "City" c
SET "regionId" = s."regionId"
FROM "State" s
WHERE s."id" = c."stateId";

ALTER TABLE "State" DROP CONSTRAINT "State_regionId_fkey";
DROP INDEX "State_regionId_name_key";
DROP INDEX "State_regionId_code_key";
DROP INDEX "State_regionId_idx";
ALTER TABLE "State" DROP COLUMN "regionId";

DROP INDEX "Region_name_key";
CREATE UNIQUE INDEX "Region_stateId_name_key" ON "Region"("stateId", "name");
CREATE INDEX "Region_stateId_idx" ON "Region"("stateId");
ALTER TABLE "Region" ADD CONSTRAINT "Region_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "State_name_key" ON "State"("name");
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

DROP INDEX "City_stateId_name_key";
CREATE UNIQUE INDEX "City_regionId_name_key" ON "City"("regionId", "name");
CREATE INDEX "City_regionId_idx" ON "City"("regionId");
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A staff member owns one current territory; older rows remain as history.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "startDate" DESC, "createdAt" DESC) AS position
  FROM "TerritoryAssignment"
  WHERE "endDate" IS NULL
)
UPDATE "TerritoryAssignment" assignment
SET "endDate" = GREATEST(assignment."startDate", CURRENT_DATE)
FROM ranked
WHERE ranked."id" = assignment."id" AND ranked.position > 1;

DROP INDEX "TerritoryAssignment_active_key";
CREATE UNIQUE INDEX "TerritoryAssignment_active_staff_key" ON "TerritoryAssignment"("userId") WHERE "endDate" IS NULL;
