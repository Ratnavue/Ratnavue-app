-- CreateTable
CREATE TABLE "SiteBannerSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "intlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "intlMessage" TEXT,
    "lkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lkMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBannerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteFeedback" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteFeedback_market_createdAt_idx" ON "SiteFeedback"("market", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteFeedback" ADD CONSTRAINT "SiteFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

