-- Admin-editable overlay on top of the static next-intl JSON message
-- catalogs — a row here takes priority over the shipped JSON for its exact
-- key+locale. See lib/translations.ts.
CREATE TABLE "TranslationOverride" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TranslationOverride_key_locale_key" ON "TranslationOverride"("key", "locale");

CREATE INDEX "TranslationOverride_key_idx" ON "TranslationOverride"("key");
