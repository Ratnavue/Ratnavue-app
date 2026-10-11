import { unstable_cache, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CUSTOM_LOCALES_TAG = "locales";

export interface CustomLocale {
  code: string;
  name: string;
  nativeName: string;
  active: boolean;
}

async function fetchActiveCustomLocales(): Promise<CustomLocale[]> {
  return prisma.locale.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, nativeName: true, active: true },
  });
}

// Cached the same way site-config-cache.ts / lib/translations.ts cache
// their own per-request reads — src/i18n/request.ts needs this on every
// page view to know whether a given locale code is valid at all.
export const getActiveCustomLocales = unstable_cache(fetchActiveCustomLocales, ["active-custom-locales"], {
  revalidate: 60,
  tags: [CUSTOM_LOCALES_TAG],
});

// Admin management reads — every locale regardless of active state, so a
// deactivated one still shows up to be re-activated. Not cached: this only
// runs on the admin page itself, not on every public page view.
export function getAllCustomLocales(): Promise<CustomLocale[]> {
  return prisma.locale.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, name: true, nativeName: true, active: true } });
}

// Used to validate a translation-override save against *any* added
// locale, active or not — an admin can fill in a new language's text
// before switching it on for customers (LocaleManager controls that
// separately). Not cached, same reasoning as getAllCustomLocales.
export async function customLocaleExists(code: string): Promise<boolean> {
  return (await prisma.locale.count({ where: { code } })) > 0;
}

const CODE_PATTERN = /^[a-z]{2,3}$/;

export async function addCustomLocale(code: string, name: string, nativeName: string, builtInCodes: readonly string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = code.trim().toLowerCase();
  if (!CODE_PATTERN.test(normalized)) return { ok: false, error: "Use a 2-3 letter language code, e.g. \"ja\"." };
  if (!name.trim() || !nativeName.trim()) return { ok: false, error: "Enter both a name and a native name." };
  if ((builtInCodes as readonly string[]).includes(normalized)) return { ok: false, error: `"${normalized}" is already a built-in language.` };

  const count = await prisma.locale.count();
  try {
    await prisma.locale.create({ data: { code: normalized, name: name.trim(), nativeName: nativeName.trim(), sortOrder: count } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `"${normalized}" has already been added.` };
    }
    throw err;
  }
  revalidateTag(CUSTOM_LOCALES_TAG, { expire: 0 });
  return { ok: true };
}

export async function setCustomLocaleActive(code: string, active: boolean): Promise<void> {
  await prisma.locale.update({ where: { code }, data: { active } });
  revalidateTag(CUSTOM_LOCALES_TAG, { expire: 0 });
}

// Also clears any translations an admin entered for this locale — a
// deleted locale's overrides are meaningless on their own (nothing would
// ever read them again), so there's nothing worth preserving by leaving
// them behind. Locale metadata carries no order/business history the way
// catalog items do, so unlike deleteGemstone/deleteJewelry this needs no
// "has it been used" guard — removing a language is always reversible by
// adding it back and re-entering its translations.
export async function deleteCustomLocale(code: string): Promise<void> {
  await prisma.$transaction([
    prisma.translationOverride.deleteMany({ where: { locale: code } }),
    prisma.locale.delete({ where: { code } }),
  ]);
  revalidateTag(CUSTOM_LOCALES_TAG, { expire: 0 });
}
