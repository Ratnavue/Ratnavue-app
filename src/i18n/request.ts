import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { applyOverrides, getTranslationOverrides, type Messages } from "@/lib/translations";

// Deliberately no `[locale]` URL segment (see the multi-language plan) —
// the whole existing route tree, middleware.ts's scoped matcher, and
// sitemap.ts all stay untouched. Locale lives in a cookie instead, read
// here per request, same as any other per-request preference this app
// reads via next/headers.
export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt", "si", "ta"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

function isSupportedLocale(value: string | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// A returning visitor's explicit choice (the cookie, set by the
// LocaleSwitcher) always wins. A first-time visitor gets their browser's
// own language preference, which is only ever a light nudge — nothing
// here should ever silently show a customer a page they can't switch out
// of, so falling back to English for anything unsupported/unparseable is
// always safe.
function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null): AppLocale {
  if (isSupportedLocale(cookieValue)) return cookieValue;
  const preferred = acceptLanguage
    ?.split(",")[0]
    ?.split("-")[0]
    ?.trim()
    .toLowerCase();
  if (isSupportedLocale(preferred)) return preferred;
  return DEFAULT_LOCALE;
}

// English underneath every locale: a key that hasn't been translated yet
// renders its English text instead of a raw "checkout.placeOrder" key (or
// throwing), so a locale can ship with partial coverage and fill in over
// time.
function mergeMessages(base: Messages, overrides: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    merged[key] =
      typeof value === "object" && typeof existing === "object" ? mergeMessages(existing, value) : value;
  }
  return merged;
}

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get("accept-language"));
  const english = (await import("../../messages/en.json")).default as Messages;
  const localized = locale === DEFAULT_LOCALE ? english : mergeMessages(english, (await import(`../../messages/${locale}.json`)).default as Messages);
  // Admin-editable overlay on top of the shipped JSON catalogs — see
  // lib/translations.ts. Applies to English too, so an admin can tweak
  // base copy without a deploy, not just non-English locales.
  const overrides = await getTranslationOverrides(locale);
  const withOverrides = Object.keys(overrides).length === 0 ? localized : applyOverrides(localized, overrides);
  return { locale, messages: withOverrides };
});
