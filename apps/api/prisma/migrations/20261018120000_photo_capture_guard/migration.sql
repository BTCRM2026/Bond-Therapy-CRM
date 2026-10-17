-- AlterTable
ALTER TABLE "VisitProof" ADD COLUMN     "checkInPhotoHash" TEXT;

-- AlterTable
ALTER TABLE "DailySalesCall" ADD COLUMN     "photoHash" TEXT;

-- CreateTable
CREATE TABLE "PhotoCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scopeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoCapture_userId_createdAt_idx" ON "PhotoCapture"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoCapture_expiresAt_idx" ON "PhotoCapture"("expiresAt");

-- CreateIndex
CREATE INDEX "VisitProof_checkInPhotoHash_idx" ON "VisitProof"("checkInPhotoHash");

-- CreateIndex
CREATE INDEX "DailySalesCall_photoHash_idx" ON "DailySalesCall"("photoHash");

-- AddForeignKey
ALTER TABLE "PhotoCapture" ADD CONSTRAINT "PhotoCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
