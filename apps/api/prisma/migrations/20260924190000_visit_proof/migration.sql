ALTER TABLE "Client"
  ADD COLUMN "latitude" DECIMAL(9,6),
  ADD COLUMN "longitude" DECIMAL(9,6);

CREATE TABLE "VisitProof" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "checkInPhoto" BYTEA NOT NULL,
  "checkInPhotoMime" TEXT NOT NULL,
  "checkInLatitude" DECIMAL(9,6) NOT NULL,
  "checkInLongitude" DECIMAL(9,6) NOT NULL,
  "distanceMeters" INTEGER,
  "gpsVerified" BOOLEAN,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitProof_activityId_key" ON "VisitProof"("activityId");
CREATE INDEX "VisitProof_gpsVerified_capturedAt_idx" ON "VisitProof"("gpsVerified", "capturedAt");
ALTER TABLE "VisitProof" ADD CONSTRAINT "VisitProof_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClientActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
