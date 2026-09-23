ALTER TABLE "BillingSettings"
  ADD COLUMN "logo" BYTEA,
  ADD COLUMN "logoMime" TEXT,
  ADD COLUMN "signature" BYTEA,
  ADD COLUMN "signatureMime" TEXT,
  ADD COLUMN "accountManagerName" TEXT,
  ADD COLUMN "accountManagerTitle" TEXT NOT NULL DEFAULT 'Account Manager';
