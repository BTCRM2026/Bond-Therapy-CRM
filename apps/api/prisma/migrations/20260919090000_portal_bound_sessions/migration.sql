CREATE TYPE "PortalType" AS ENUM ('ADMIN', 'STAFF', 'DISTRIBUTOR');

ALTER TABLE "Role" ADD COLUMN "portal" "PortalType";
UPDATE "Role" SET "portal" = CASE WHEN "key" = 'SUPER_ADMIN' THEN 'ADMIN'::"PortalType" ELSE 'STAFF'::"PortalType" END;
ALTER TABLE "Role" ALTER COLUMN "portal" SET NOT NULL;

ALTER TABLE "Session" ADD COLUMN "portal" "PortalType" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Session" ALTER COLUMN "portal" DROP DEFAULT;

CREATE INDEX "Role_portal_isActive_idx" ON "Role"("portal", "isActive");
CREATE INDEX "Session_portal_expiresAt_idx" ON "Session"("portal", "expiresAt");
