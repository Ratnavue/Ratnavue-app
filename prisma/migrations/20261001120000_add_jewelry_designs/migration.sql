-- Design Studio: 2D jewelry sketches (panes/shapes stored as JSON),
-- usable by admin/staff always and by customers once an admin turns the
-- "design-studio" PageVisibility key LIVE.
CREATE TYPE "DesignSource" AS ENUM ('ADMIN', 'CUSTOMER');

CREATE TABLE "JewelryDesign" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Untitled design',
    "data" JSONB NOT NULL,
    "thumbnailUrl" TEXT,
    "source" "DesignSource" NOT NULL DEFAULT 'ADMIN',
    "quoteRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JewelryDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JewelryDesign_quoteRequestId_key" ON "JewelryDesign"("quoteRequestId");
CREATE INDEX "JewelryDesign_userId_idx" ON "JewelryDesign"("userId");

ALTER TABLE "JewelryDesign" ADD CONSTRAINT "JewelryDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JewelryDesign" ADD CONSTRAINT "JewelryDesign_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
