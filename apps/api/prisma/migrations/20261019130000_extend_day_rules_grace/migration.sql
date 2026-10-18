-- Give staff a week to complete client profiles before enforcing the field day rules.
UPDATE "OperationsSettings"
SET "strictDayRulesFrom" = CURRENT_DATE + 7
WHERE "id" = 'default' AND ("strictDayRulesFrom" IS NULL OR "strictDayRulesFrom" < CURRENT_DATE + 7);
