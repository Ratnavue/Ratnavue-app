import { prisma } from "@/lib/prisma";
import { flattenEnglishKeys, flattenToMap, type Messages } from "@/lib/translations";
import { getAllCustomLocales } from "@/lib/locales";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n/request";
import { BackLink } from "@/components/admin/BackLink";
import { TranslationManager } from "@/components/admin/TranslationManager";
import { LocaleManager } from "@/components/admin/LocaleManager";

const BUILT_IN_NAMES: Record<string, string> = {
  es: "Español", fr: "Français", de: "Deutsch", pt: "Português", si: "සිංහල", ta: "தமிழ්",
};

export default async function AdminTranslationsPage() {
  const nonEnglishBuiltIns = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  const [overrideRows, customLocales, ...localeModules] = await Promise.all([
    prisma.translationOverride.findMany({ select: { key: true, locale: true, value: true } }),
    getAllCustomLocales(),
    ...nonEnglishBuiltIns.map((locale) => import(`../../../../messages/${locale}.json`)),
  ]);

  // Each built-in locale's own shipped JSON (before any DB override),
  // flattened the same way the English key list is — shown in the editor
  // as the fallback tier between an override and the English reference. A
  // custom (admin-added) locale has no such file, so it gets an empty map
  // — every key falls straight to English until an override fills it in.
  const localeFileValues: Record<string, Record<string, string>> = {};
  nonEnglishBuiltIns.forEach((locale, i) => {
    localeFileValues[locale] = flattenToMap(localeModules[i].default as Messages);
  });

  const overridesByKey: Record<string, Record<string, string>> = {};
  for (const row of overrideRows) {
    (overridesByKey[row.key] ??= {})[row.locale] = row.value;
  }

  // Every custom locale is editable here regardless of active state — an
  // admin may want to fill in a new language's translations before
  // switching it on for customers (LocaleManager above controls that).
  const editableLocales = [
    ...nonEnglishBuiltIns.map((code) => ({ code, name: BUILT_IN_NAMES[code] ?? code })),
    ...customLocales.map((l) => ({ code: l.code, name: l.nativeName })),
  ];

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Translations</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Search for any text shown on the site, then set its translation for any language — saved changes go live
        immediately, with no deploy needed.
      </p>

      <div className="mt-6">
        <LocaleManager locales={customLocales} />
      </div>

      <div className="mt-6">
        <TranslationManager
          keys={flattenEnglishKeys()}
          locales={editableLocales}
          localeFileValues={localeFileValues}
          overridesByKey={overridesByKey}
        />
      </div>
    </div>
  );
}
