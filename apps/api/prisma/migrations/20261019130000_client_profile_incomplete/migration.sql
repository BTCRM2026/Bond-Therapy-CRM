-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "profileIncomplete" BOOLEAN NOT NULL DEFAULT false;

-- Salons typed into a route before they had a profile (prospects with no contact and no location) are marked as not filled yet.
UPDATE "Client" SET "profileIncomplete" = true WHERE "status" = 'PROSPECT' AND "primaryContact" = '' AND "latitude" IS NULL;
