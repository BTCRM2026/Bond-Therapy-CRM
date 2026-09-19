ALTER TABLE "Notification" ADD COLUMN "portal" "PortalType" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Notification" ADD COLUMN "recipientId" TEXT;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_recipientId_portal_isRead_idx"
ON "Notification"("recipientId", "portal", "isRead");
