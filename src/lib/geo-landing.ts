// Storefront landing by visitor location: a visitor whose IP resolves to Sri
// Lanka lands on the Sri Lanka store (/lk/…), everyone else on the
// international store. Pure and edge-safe (no Prisma, no Node APIs) —
// proxy.ts calls it on every page request.
//
// It applies to DIRECT entries only — a typed or pasted URL, a bookmark, or a
// link from another site (Google, social, email). Navigating inside the site
// never redirects, so browsing is never yanked between stores mid-visit.
//
// A visitor who explicitly picks a store in MarketSwitcher gets that choice
// stored in STORE_CHOICE_COOKIE, and from then on every direct entry lands on
// the store they chose instead of the one their IP suggests — a Sri Lankan
// visitor who picks International stays on International.

import { LK_PREFIX, isLkPath, stripMarket, type Market } from "@/lib/market-shared";

/** Set ONLY by the visitor's own pick in MarketSwitcher — never by geo.
 * (Renamed from the earlier "ratnavue-store", which geo itself used to set on
 * first visit; those automatic values are deliberately ignored.) */
export const STORE_CHOICE_COOKIE = "ratnavue-store-choice";
export const STORE_CHOICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

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

export function parseStoreChoice(value: string | undefined | null): Market | null {
  return value === "lk" || value === "intl" ? value : null;
}

/**
 * Whether this page load came from outside the site. `Sec-Fetch-Site` is
 * "none" for a typed/pasted URL or bookmark and "cross-site"/"same-site" for a
 * link from elsewhere; "same-origin" is a click inside the site. Browsers too
 * old to send it fall back to the Referer: none, or one from another host.
 */
export function isDirectEntry(headers: Headers, origin: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site !== "same-origin";
  const referer = headers.get("referer");
  if (!referer) return true;
  try {
    return new URL(referer).origin !== origin;
  } catch {
    return true;
  }
}

export type GeoLandingDecision =
  | { action: "none" }
  /** Send the visitor to the same page on their store. */
  | { action: "redirect"; market: Market; pathname: string };

export function decideGeoLanding({
  rawPathname,
  country,
  storeChoice,
  directEntry,
}: {
  rawPathname: string;
  country: string | null;
  /** The visitor's own pick from MarketSwitcher, if they ever made one. */
  storeChoice: Market | null;
  directEntry: boolean;
}): GeoLandingDecision {
  if (!directEntry) return { action: "none" };
  const path = stripMarket(rawPathname);
  if (!LANDING_PATHS.has(path)) return { action: "none" };

  const target = storeChoice ?? (country ? marketForCountry(country) : null);
  if (!target) return { action: "none" };

  const current: Market = isLkPath(rawPathname) ? "lk" : "intl";
  if (target === current) return { action: "none" };
  return {
    action: "redirect",
    market: target,
    pathname: target === "lk" ? (path === "/" ? LK_PREFIX : LK_PREFIX + path) : path,
  };
}
