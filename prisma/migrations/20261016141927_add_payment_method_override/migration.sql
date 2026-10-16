-- Admin-editable override on top of the hardcoded default live/coming_soon
-- status for a (market, payment method) pair. See lib/payment-methods.ts
-- and lib/payment-method-settings.ts. No rows are seeded — absence means
-- "use the hardcoded default", so this changes nothing on its own.
CREATE TABLE "PaymentMethodOverride" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "methodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethodOverride_market_methodKey_key" ON "PaymentMethodOverride"("market", "methodKey");
