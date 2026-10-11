import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import english from "../../messages/en.json";

export const TRANSLATION_OVERRIDES_TAG = "translations";

export type Messages = { [key: string]: string | Messages };

// Recursively flattens a nested message tree into dot-paths, e.g.
// { nav: { shopGems: "Shop Gems" } } -> { "nav.shopGems": "Shop Gems" }.
// Non-string leaves (there aren't any today, but next-intl allows nested
// ICU/plural objects) are skipped — this is a flat-string editor, not a
// general message-format one.
export function flattenToMap(obj: Messages, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flattenToMap(v, key));
  }
  return out;
}

// English is the authoritative, always-complete key list — every other
// locale (including partially-translated ones) is missing some of these,
// which is exactly the gap this admin tool exists to fill in without a
// deploy. Computed once per process; messages/en.json only changes via a
// code deploy, which restarts the process anyway.
let flattenedEnglishCache: { key: string; english: string }[] | null = null;
export function flattenEnglishKeys(): { key: string; english: string }[] {
  if (!flattenedEnglishCache) {
    flattenedEnglishCache = Object.entries(flattenToMap(english as Messages)).map(([key, value]) => ({ key, english: value }));
  }
  return flattenedEnglishCache;
}

// Immutably sets `value` at a dot-path inside a nested message tree,
// creating any intermediate objects that don't exist yet (an override can
// target a key a given locale's JSON never defined at all, not just one it
// already has). Used to layer DB overrides on top of the JSON-merged
// messages in src/i18n/request.ts.
function setPath(obj: Messages, parts: string[], value: string): Messages {
  const [head, ...rest] = parts;
  if (!head) return obj;
  if (rest.length === 0) return { ...obj, [head]: value };
  const existing = obj[head];
  const child: Messages = existing && typeof existing === "object" ? existing : {};
  return { ...obj, [head]: setPath(child, rest, value) };
}

export function applyOverrides(messages: Messages, overrides: Record<string, string>): Messages {
  let result = messages;
  for (const [key, value] of Object.entries(overrides)) {
    result = setPath(result, key.split("."), value);
  }
  return result;
}

async function fetchOverrides(locale: string): Promise<Record<string, string>> {
  const rows = await prisma.translationOverride.findMany({ where: { locale }, select: { key: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Cached the same way site-config-cache.ts caches its two per-request reads
// — this runs on every single page view (src/i18n/request.ts), so it has to
// stay cheap. Dropped immediately by setTranslationOverride below, so a
// save is live right away rather than after the 60s window.
export const getTranslationOverrides = unstable_cache(fetchOverrides, ["translation-overrides"], {
  revalidate: 60,
  tags: [TRANSLATION_OVERRIDES_TAG],
});

// Blank value clears the override (falls back to the JSON/English chain
// again) rather than saving an empty string — same "blank means unset"
// convention this app's other admin forms use for money/measurement fields.
export async function setTranslationOverride(key: string, locale: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed === "") {
    await prisma.translationOverride.deleteMany({ where: { key, locale } });
  } else {
    await prisma.translationOverride.upsert({
      where: { key_locale: { key, locale } },
      create: { key, locale, value: trimmed },
      update: { value: trimmed },
    });
  }
  revalidateTag(TRANSLATION_OVERRIDES_TAG, { expire: 0 });
}
