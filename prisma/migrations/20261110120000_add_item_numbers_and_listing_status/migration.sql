-- Permanent item numbers (G-000001 for gemstones, J-000001 for jewelry) that
-- printed QR labels point at, and a Draft / Finished / Live listing status.
--
-- Additive and safe to apply before the code that uses it ships: item numbers
-- come from a column default, so the previous code's inserts (which don't send
-- one) still get a number; listingStatus has a default too.

-- Listing status ------------------------------------------------------------

CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'FINISHED', 'LIVE');

ALTER TABLE "Gemstone" ADD COLUMN "listingStatus" "ListingStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "JewelryPiece" ADD COLUMN "listingStatus" "ListingStatus" NOT NULL DEFAULT 'DRAFT';

-- Published items are live; everything currently hidden starts as a draft.
UPDATE "Gemstone" SET "listingStatus" = 'LIVE' WHERE "isPublished" = true;
UPDATE "JewelryPiece" SET "listingStatus" = 'LIVE' WHERE "isPublished" = true;

CREATE INDEX "Gemstone_listingStatus_idx" ON "Gemstone"("listingStatus");
CREATE INDEX "JewelryPiece_listingStatus_idx" ON "JewelryPiece"("listingStatus");

-- Item numbers --------------------------------------------------------------

CREATE SEQUENCE "gemstone_item_number_seq";
CREATE SEQUENCE "jewelry_item_number_seq";

ALTER TABLE "Gemstone" ADD COLUMN "itemNumber" TEXT;
ALTER TABLE "JewelryPiece" ADD COLUMN "itemNumber" TEXT;

-- Existing items are numbered in the order they were created.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "Gemstone"
)
UPDATE "Gemstone" g SET "itemNumber" = 'G-' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE g."id" = numbered."id";

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "JewelryPiece"
)
UPDATE "JewelryPiece" j SET "itemNumber" = 'J-' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE j."id" = numbered."id";

-- Continue each sequence after the last backfilled number (an empty table
-- starts at 1).
SELECT setval('"gemstone_item_number_seq"', GREATEST((SELECT COUNT(*) FROM "Gemstone"), 1), (SELECT COUNT(*) FROM "Gemstone") > 0);
SELECT setval('"jewelry_item_number_seq"', GREATEST((SELECT COUNT(*) FROM "JewelryPiece"), 1), (SELECT COUNT(*) FROM "JewelryPiece") > 0);

ALTER TABLE "Gemstone"
  ALTER COLUMN "itemNumber" SET DEFAULT ('G-'::text || lpad((nextval('gemstone_item_number_seq'::regclass))::text, 6, '0'::text)),
  ALTER COLUMN "itemNumber" SET NOT NULL;
ALTER TABLE "JewelryPiece"
  ALTER COLUMN "itemNumber" SET DEFAULT ('J-'::text || lpad((nextval('jewelry_item_number_seq'::regclass))::text, 6, '0'::text)),
  ALTER COLUMN "itemNumber" SET NOT NULL;

-- Dropping a table later drops its sequence with it.
ALTER SEQUENCE "gemstone_item_number_seq" OWNED BY "Gemstone"."itemNumber";
ALTER SEQUENCE "jewelry_item_number_seq" OWNED BY "JewelryPiece"."itemNumber";

CREATE UNIQUE INDEX "Gemstone_itemNumber_key" ON "Gemstone"("itemNumber");
CREATE UNIQUE INDEX "JewelryPiece_itemNumber_key" ON "JewelryPiece"("itemNumber");
