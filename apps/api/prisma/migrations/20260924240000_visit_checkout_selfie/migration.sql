-- AlterTable
ALTER TABLE "VisitProof"
  ADD COLUMN "checkOutPhoto" BYTEA,
  ADD COLUMN "checkOutPhotoMime" TEXT,
  ADD COLUMN "checkOutLatitude" DECIMAL(9,6),
  ADD COLUMN "checkOutLongitude" DECIMAL(9,6),
  ADD COLUMN "checkOutDistanceMeters" INTEGER,
  ADD COLUMN "checkOutGpsVerified" BOOLEAN,
  ADD COLUMN "checkedOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Client"
  ADD COLUMN "locationSetAt" TIMESTAMP(3),
  ADD COLUMN "locationSetById" TEXT;

-- Backfill: treat any salon that already has coordinates as locked from now on
UPDATE "Client" SET "locationSetAt" = CURRENT_TIMESTAMP WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_locationSetById_fkey" FOREIGN KEY ("locationSetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: tighten the default visit-verification radius to 50m per policy
ALTER TABLE "OperationsSettings" ALTER COLUMN "visitRadiusMeters" SET DEFAULT 50;
UPDATE "OperationsSettings" SET "visitRadiusMeters" = 50 WHERE "id" = 'default' AND "visitRadiusMeters" = 150;
