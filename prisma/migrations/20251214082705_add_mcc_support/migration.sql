-- AlterTable
ALTER TABLE "GoogleAdsAccount" ADD COLUMN     "isManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentManagerId" TEXT;

-- CreateIndex
CREATE INDEX "GoogleAdsAccount_parentManagerId_idx" ON "GoogleAdsAccount"("parentManagerId");
