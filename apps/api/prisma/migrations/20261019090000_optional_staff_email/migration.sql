-- Staff add their own email from Settings, so the column may be empty (unique still applies to real addresses).
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Remove the placeholder addresses created when staff accounts were set up with only a Login ID.
UPDATE "User" SET "email" = NULL WHERE "email" LIKE '%@pending.bondtherapy.local';
