-- Sales referral (affiliate) program for admin/staff promoters — see
-- the schema comment on SalesReferralPromoter and lib/sales-referrals.ts.

ALTER TABLE "Order" ADD COLUMN "referredByPromoterId" TEXT;

CREATE TABLE "SalesReferralPromoter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReferralPromoter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesReferralPromoter_userId_key" ON "SalesReferralPromoter"("userId");
CREATE UNIQUE INDEX "SalesReferralPromoter_token_key" ON "SalesReferralPromoter"("token");

CREATE TYPE "PayoutRequestStatus" AS ENUM ('REQUESTED', 'PAID', 'DENIED');

CREATE TABLE "SalesReferralPayoutRequest" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentReference" TEXT,
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReferralPayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesReferralPayoutRequest_promoterId_idx" ON "SalesReferralPayoutRequest"("promoterId");
CREATE INDEX "SalesReferralPayoutRequest_status_idx" ON "SalesReferralPayoutRequest"("status");

CREATE TABLE "SalesReferralCommission" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "orderTotal" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "payoutRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesReferralCommission_orderId_key" ON "SalesReferralCommission"("orderId");
CREATE INDEX "SalesReferralCommission_promoterId_idx" ON "SalesReferralCommission"("promoterId");

CREATE INDEX "Order_referredByPromoterId_idx" ON "Order"("referredByPromoterId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_referredByPromoterId_fkey" FOREIGN KEY ("referredByPromoterId") REFERENCES "SalesReferralPromoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesReferralPromoter" ADD CONSTRAINT "SalesReferralPromoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesReferralPayoutRequest" ADD CONSTRAINT "SalesReferralPayoutRequest_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "SalesReferralPromoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesReferralCommission" ADD CONSTRAINT "SalesReferralCommission_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "SalesReferralPromoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesReferralCommission" ADD CONSTRAINT "SalesReferralCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesReferralCommission" ADD CONSTRAINT "SalesReferralCommission_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "SalesReferralPayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
