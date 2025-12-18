-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'simple',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAdsAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedCampaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "budget" BIGINT NOT NULL,
    "metrics" JSONB NOT NULL,
    "aiScore" INTEGER,
    "recommendations" JSONB,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sorting" JSONB NOT NULL,
    "columns" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "GoogleAdsAccount_userId_idx" ON "GoogleAdsAccount"("userId");

-- CreateIndex
CREATE INDEX "GoogleAdsAccount_googleAccountId_idx" ON "GoogleAdsAccount"("googleAccountId");

-- CreateIndex
CREATE INDEX "CachedCampaign_accountId_idx" ON "CachedCampaign"("accountId");

-- CreateIndex
CREATE INDEX "CachedCampaign_campaignId_idx" ON "CachedCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "PendingAction_userId_idx" ON "PendingAction"("userId");

-- CreateIndex
CREATE INDEX "PendingAction_accountId_idx" ON "PendingAction"("accountId");

-- CreateIndex
CREATE INDEX "PendingAction_status_idx" ON "PendingAction"("status");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_accountId_idx" ON "ActivityLog"("accountId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "SavedView_userId_idx" ON "SavedView"("userId");

-- CreateIndex
CREATE INDEX "SavedView_accountId_idx" ON "SavedView"("accountId");

-- AddForeignKey
ALTER TABLE "GoogleAdsAccount" ADD CONSTRAINT "GoogleAdsAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CachedCampaign" ADD CONSTRAINT "CachedCampaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
