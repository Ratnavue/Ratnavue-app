-- Functional cash-on-delivery with a deposit rule for the Sri Lanka store —
-- see the schema comments on CommerceSettings.codDepositThresholdLkr/
-- codDepositPercent and Order's "Cash on delivery" block.

ALTER TABLE "CommerceSettings" ADD COLUMN "codDepositThresholdLkr" DOUBLE PRECISION NOT NULL DEFAULT 10000;
ALTER TABLE "CommerceSettings" ADD COLUMN "codDepositPercent" DOUBLE PRECISION NOT NULL DEFAULT 25;

ALTER TABLE "Order" ADD COLUMN "codDepositRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "codDepositAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "codDepositPaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "codAgentName" TEXT;
ALTER TABLE "Order" ADD COLUMN "codAgentReference" TEXT;
ALTER TABLE "Order" ADD COLUMN "codTrackingUrl" TEXT;
