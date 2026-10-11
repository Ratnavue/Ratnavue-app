import { prisma } from "@/lib/prisma";
import { flattenEnglishKeys, flattenToMap, type Messages } from "@/lib/translations";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n/request";
import { BackLink } from "@/components/admin/BackLink";
import { TranslationManager } from "@/components/admin/TranslationManager";

export default async function AdminTranslationsPage() {
  const nonEnglishLocales = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  const [overrideRows, ...localeModules] = await Promise.all([
    prisma.translationOverride.findMany({ select: { key: true, locale: true, value: true } }),
    ...nonEnglishLocales.map((locale) => import(`../../../../messages/${locale}.json`)),
  ]);

  // Each locale's own shipped JSON (before any DB override), flattened the
  // same way the English key list is — shown in the editor as the "locale
  // file" fallback tier, between an override and the English reference.
  const localeFileValues: Record<string, Record<string, string>> = {};
  nonEnglishLocales.forEach((locale, i) => {
    localeFileValues[locale] = flattenToMap(localeModules[i].default as Messages);
  });

  const overridesByKey: Record<string, Record<string, string>> = {};
  for (const row of overrideRows) {
    (overridesByKey[row.key] ??= {})[row.locale] = row.value;
  }

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Translations</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Search for any text shown on the site, then set its translation for any language — saved changes go live
        immediately, with no deploy needed.
      </p>
      <div className="mt-6">
        <TranslationManager
          keys={flattenEnglishKeys()}
          locales={nonEnglishLocales}
          localeFileValues={localeFileValues}
          overridesByKey={overridesByKey}
        />
      </div>
    </div>
  );
}
