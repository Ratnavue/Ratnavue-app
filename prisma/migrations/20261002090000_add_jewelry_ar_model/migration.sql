-- Mobile AR try-on (live neck-tracking) pilot: one GLB model per piece,
-- NECKLACE/PENDANT only in practice (enforced in app code, not the DB).
-- Null means no AR for that piece.
ALTER TABLE "JewelryPiece" ADD COLUMN "arModelUrl" TEXT;
