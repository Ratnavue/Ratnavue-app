"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SUPPORTED_LOCALES, LOCALE_COOKIE, type AppLocale } from "@/i18n/request";
import { getActiveCustomLocales } from "@/lib/locales";

// A year — this is a customer's standing language preference, not a
// session-scoped setting, so it should survive well past a single visit
// (same reasoning as any other long-lived preference cookie).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: AppLocale): Promise<void> {
  const isBuiltIn = (SUPPORTED_LOCALES as readonly string[]).includes(locale);
  if (!isBuiltIn) {
    const customLocales = await getActiveCustomLocales();
    if (!customLocales.some((l) => l.code === locale)) return;
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
  // The locale is read in the root layout (via src/i18n/request.ts), so
  // every route needs to re-render under the new language — "layout"
  // scope invalidates from the very top rather than just the current page.
  revalidatePath("/", "layout");
}
