// First-visit storefront landing by visitor location: a visitor whose IP
// resolves to Sri Lanka lands on the Sri Lanka store (/lk/…), everyone else
// on the international store. Pure and edge-safe (no Prisma, no Node APIs) —
// proxy.ts calls it on every page request.
//
// It decides ONCE per browser. The decision (or the visitor's own pick in
// MarketSwitcher) is remembered in STORE_PREF_COOKIE, and while that cookie
// exists geo is never consulted again — otherwise a Sri Lankan visitor who
// deliberately switches to the international store would be bounced
// straight back on their next page load.

import { LK_PREFIX, isLkPath, stripMarket, type Market } from "@/lib/market-shared";

export const STORE_PREF_COOKIE = "ratnavue-store";
export const STORE_PREF_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Only the section/landing pages that exist identically in both stores. A
// product page (/gems/[slug], /jewelry/[slug], /auction/[id]) belongs to one
// storefront's catalog and would 404 in the other, so a shared deep link is
// always left exactly where it points — as are checkout, account and admin
// pages, where switching store mid-flow would lose the cart/order context.
const LANDING_PATHS = new Set([
  "/",
  "/gems",
  "/jewelry",
  "/configurator",
  "/design-studio",
  "/sourcing",
  "/about",
  "/contact",
  "/promotions",
  "/promotions/collection",
  "/auction",
  "/search",
  "/size-guide",
  "/terms",
]);

/** Country code from the hosting platform's geo header (Vercel, then Cloudflare). */
export function countryFromHeaders(headers: Headers): string | null {
  const raw = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry");
  const code = raw?.trim().toUpperCase();
  // "XX"/"T1" are Cloudflare's unknown/Tor markers — not a real location.
  if (!code || code.length !== 2 || code === "XX" || code === "T1") return null;
  return code;
}

export function marketForCountry(country: string): Market {
  return country === "LK" ? "lk" : "intl";
}

export type GeoLandingDecision =
  /** Nothing to do (already chosen, no geo info, or not a landing page). */
  | { action: "none" }
  /** Already on the right store — just remember it. */
  | { action: "remember"; market: Market }
  /** Send the visitor to the same page on their store, and remember it. */
  | { action: "redirect"; market: Market; pathname: string };

export function decideGeoLanding({
  rawPathname,
  country,
  hasStorePref,
}: {
  rawPathname: string;
  country: string | null;
  hasStorePref: boolean;
}): GeoLandingDecision {
  if (hasStorePref || !country) return { action: "none" };
  const path = stripMarket(rawPathname);
  if (!LANDING_PATHS.has(path)) return { action: "none" };

  const target = marketForCountry(country);
  const current: Market = isLkPath(rawPathname) ? "lk" : "intl";
  if (target === current) return { action: "remember", market: target };
  return {
    action: "redirect",
    market: target,
    pathname: target === "lk" ? (path === "/" ? LK_PREFIX : LK_PREFIX + path) : path,
  };
}
