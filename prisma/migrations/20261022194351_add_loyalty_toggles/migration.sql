-- Admin on/off switches for the rewards-points and referral programs,
-- independent of each other — see the schema comment on
-- LoyaltySettings.pointsEnabled/referralsEnabled.

ALTER TABLE "LoyaltySettings" ADD COLUMN "pointsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LoyaltySettings" ADD COLUMN "referralsEnabled" BOOLEAN NOT NULL DEFAULT true;
