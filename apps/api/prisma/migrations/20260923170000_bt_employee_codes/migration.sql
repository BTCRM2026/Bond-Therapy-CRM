-- Renumber all existing staff records using the Bond Therapy employee prefix.
-- Temporary unique values prevent collisions while old PMB/BT values are rearranged.
UPDATE "StaffProfile"
SET "employeeCode" = 'BT-MIGRATION-' || "userId";

UPDATE "User" AS users
SET "loginId" = REGEXP_REPLACE(
  users."loginId",
  '\.(pmb|bt)[0-9]+$',
  '.bt-migration-' || users."id",
  'i'
)
WHERE users."id" IN (SELECT "userId" FROM "StaffProfile")
  AND users."loginId" ~* '\.(pmb|bt)[0-9]+$';

WITH ranked AS (
  SELECT "userId", ROW_NUMBER() OVER (ORDER BY "createdAt", "userId") AS sequence
  FROM "StaffProfile"
)
UPDATE "User" AS users
SET "loginId" = REGEXP_REPLACE(
  users."loginId",
  '\.bt-migration-[^.]+$',
  '.bt' || LPAD(ranked.sequence::TEXT, 2, '0'),
  'i'
)
FROM ranked
WHERE users."id" = ranked."userId"
  AND users."loginId" ~* '\.bt-migration-[^.]+$';

WITH ranked AS (
  SELECT "userId", ROW_NUMBER() OVER (ORDER BY "createdAt", "userId") AS sequence
  FROM "StaffProfile"
)
UPDATE "StaffProfile" AS profiles
SET "employeeCode" = 'BT-' || LPAD(ranked.sequence::TEXT, 2, '0')
FROM ranked
WHERE profiles."userId" = ranked."userId";

DELETE FROM "EmployeeCounter" WHERE "key" IN ('PMB', 'BT');

INSERT INTO "EmployeeCounter" ("key", "nextNumber", "updatedAt")
SELECT 'BT', COUNT(*)::INTEGER, CURRENT_TIMESTAMP FROM "StaffProfile";
