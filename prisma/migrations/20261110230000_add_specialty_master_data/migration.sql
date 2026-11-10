-- Gem specialities become a managed list (like the clarity scale) instead of
-- a fixed enum. The four existing values are seeded as rows and every gem's
-- current tags are copied across. Additive: the old "specialties" column is
-- left in place (and untouched) so the previous deployment keeps working
-- until the new one is live.

CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");
CREATE UNIQUE INDEX "Specialty_slug_key" ON "Specialty"("slug");

-- Prisma's implicit many-to-many table for Gemstone.specialtyTags
-- ("A" = Gemstone, "B" = Specialty, by model name order).
CREATE TABLE "_GemstoneSpecialties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GemstoneSpecialties_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_GemstoneSpecialties_B_index" ON "_GemstoneSpecialties"("B");

ALTER TABLE "_GemstoneSpecialties" ADD CONSTRAINT "_GemstoneSpecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "Gemstone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GemstoneSpecialties" ADD CONSTRAINT "_GemstoneSpecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The four specialities the fixed list had. Their slugs map onto the
-- storefront's existing translated labels (messages catalog.specialty.*).
INSERT INTO "Specialty" ("id", "name", "slug", "description", "sortOrder") VALUES
  ('spec-color-change', 'Colour change', 'color-change', 'Shows a different colour in daylight and incandescent light (alexandrite effect).', 1),
  ('spec-star', 'Star', 'star', 'Asterism — a star of light across a cabochon.', 2),
  ('spec-cats-eye', 'Cat''s eye', 'cats-eye', 'Chatoyancy — a single bright band across a cabochon.', 3),
  ('spec-bi-color', 'Bi-colour', 'bi-color', 'Two distinct colour zones in one stone.', 4);

-- Copy each gem's current tags across.
INSERT INTO "_GemstoneSpecialties" ("A", "B")
SELECT DISTINCT g."id", s."id"
FROM "Gemstone" g
CROSS JOIN LATERAL unnest(g."specialties") AS tag(value)
JOIN "Specialty" s ON s."slug" = lower(replace(tag.value::text, '_', '-'));
