// Search-engine / link-preview metadata shared by every public page.
//
// Next.js merges metadata SHALLOWLY: a page that sets `openGraph` replaces the
// root layout's whole `openGraph` object. So pages don't hand-roll it — they
// call pageMetadata(), which always emits the complete set (title,
// description, canonical-matching og:url, site name, type, locale). The
// share image itself comes from app/opengraph-image.tsx, which Next attaches
// to every route automatically.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { APP_PATH_HEADER, withMarket, type Market } from "@/lib/market-shared";
import { getMarket } from "@/lib/market";

export const SITE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
export const SITE_NAME = "Ratnavue";
// The branded share image (app/opengraph-image.tsx). Listed explicitly: the
// file convention only attaches it to routes that don't set their own
// openGraph block, which every page using pageMetadata() does.
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Ratnavue — Ceylon gemstones and fine jewelry from Sri Lanka",
};

/** The <title> suffix per store — the two stores' versions of a page shouldn't share a title. */
export function siteNameFor(market: Market): string {
  return market === "lk" ? `${SITE_NAME} Sri Lanka` : SITE_NAME;
}

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

// Appended to a page's description on the Sri Lanka store, so its copy of a
// page doesn't duplicate the international one. Copy that already says Sri
// Lanka gets the shorter note; copy that already mentions rupees needs none.
export const LK_NOTE = " Prices in rupees, for Sri Lanka.";
export const LK_NOTE_SHORT = " Prices in rupees.";
/** Longest page description that still fits the full Sri Lanka note untrimmed. */
export const MAX_PAGE_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH - LK_NOTE.length;

export function lkDescription(description: string): string {
  if (/rupee/i.test(description)) return metaDescription(description, MAX_DESCRIPTION_LENGTH);
  const note = description.includes("Sri Lanka") ? LK_NOTE_SHORT : LK_NOTE;
  return metaDescription(description, MAX_DESCRIPTION_LENGTH - note.length) + note;
}

export const DEFAULT_DESCRIPTION =
  "Ratnavue is a Ceylon gemstone and jewelry house offering ethically sourced sapphires, rubies, and fine jewelry, with bespoke gem sourcing and quotation.";

/** The canonical absolute URL of the current request's page (market-prefixed, no query). */
export async function currentCanonicalUrl(): Promise<{ url: string; market: Market; path: string }> {
  const [headerStore, market] = await Promise.all([headers(), getMarket()]);
  const path = headerStore.get(APP_PATH_HEADER) ?? "/";
  return { url: SITE_URL + withMarket(path, market), market, path };
}

/**
 * A public page's metadata: <title>, meta description, and the matching Open
 * Graph block (with a share image).
 */
export async function pageMetadata({
  title,
  description,
  noindex = false,
  image,
  canonicalQuery,
}: {
  /** A plain string gets the store's suffix ("· Ratnavue" / "· Ratnavue
   * Sri Lanka"); { absolute } is used as-is (the home page). */
  title: string | { absolute: string };
  description: string;
  /** e.g. search results: crawlable for links, but not a page to rank. */
  noindex?: boolean;
  /** A page-specific share image (a product's photo); defaults to the brand image. */
  image?: string | null;
  /** The query parameters that make this URL its own page — a category
   * (?mineral=sapphire) or a later page of a list (?page=2). The canonical
   * tag, og:url and both stores' hreflang alternates keep exactly these, in
   * this order; any other parameter (a sort, a price filter) is dropped, so
   * those variants consolidate onto this page. Without it the canonical is
   * the bare path (RootLayout's default). */
  canonicalQuery?: Record<string, string | undefined>;
}): Promise<Metadata> {
  const { url: baseUrl, market, path } = await currentCanonicalUrl();
  const qs = canonicalQuery ? buildQuery(canonicalQuery) : "";
  const url = baseUrl + qs;
  // The Sri Lanka store's copy of a page says so, in both title and
  // description, so it isn't a duplicate of the international one.
  const fullDescription = market === "lk" ? lkDescription(description) : description;
  // Search results show ~60 characters: a long name (a product) drops to the
  // shorter suffix, then to no suffix, rather than being cut off mid-word.
  const absoluteTitle =
    typeof title === "string"
      ? ([`${title} · ${siteNameFor(market)}`, `${title} · ${SITE_NAME}`].find((t) => t.length <= MAX_TITLE_LENGTH) ?? title)
      : title.absolute;
  return {
    title: { absolute: absoluteTitle },
    description: fullDescription,
    openGraph: {
      title: absoluteTitle,
      description: fullDescription,
      url,
      siteName: siteNameFor(market),
      type: "website",
      locale: market === "lk" ? "en_LK" : "en_US",
      images: [image ? { url: image, alt: typeof title === "string" ? title : title.absolute } : DEFAULT_OG_IMAGE],
    },
    // The root layout's twitter block always carries the brand image, and a
    // page's own openGraph image doesn't replace it — so a shared product
    // showed the logo card on X instead of the product. Set per page when
    // there is a page-specific image.
    ...(image ? { twitter: { card: "summary_large_image" as const, title: absoluteTitle, description: fullDescription, images: [image] } } : {}),
    // Replaces RootLayout's alternates (metadata merges shallowly), so it
    // restates the same hreflang pair — with the same query on both stores.
    ...(qs
      ? { alternates: { canonical: url, languages: { "en-LK": SITE_URL + withMarket(path, "lk") + qs, "x-default": SITE_URL + path + qs } } }
      : {}),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** "?a=1&b=2" from the defined entries, in the order given; "" when none. */
export function buildQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/** A list page's number from ?page=, or 1. */
export function pageNumber(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** "Rings" -> "Rings — Page 2" from page 2 on, so later pages don't share page 1's title. */
export function withPageSuffix(title: string, page: number): string {
  return page > 1 ? `${title} — Page ${page}` : title;
}

/** Organization + WebSite (with sitelinks search) structured data for the home page. */
export function homeJsonLd(market: Market) {
  const home = SITE_URL + withMarket("/", market);
  // A fixed-shape tuple (not an array of a union) so each entry keeps its own type.
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon.png`,
      description: DEFAULT_DESCRIPTION,
      areaServed: market === "lk" ? "LK" : "Worldwide",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: home,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}${withMarket("/search", market)}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ] as const;
}

/**
 * Product structured data for a gem or jewelry page — lets search results
 * show price and availability. The offer is only included when the price is
 * actually public on the page (a quote-only piece has none).
 */
export function productJsonLd({
  name,
  description,
  url,
  images,
  sku,
  category,
  price,
  currency,
  stockStatus,
  rating,
}: {
  name: string;
  description: string | null;
  url: string;
  images: string[];
  sku: string;
  category: string;
  price: number | null;
  currency: string;
  stockStatus: string;
  /** Approved reviews — only included when there is at least one. */
  rating?: { average: number | null; count: number };
}) {
  const absolute = (src: string) => (src.startsWith("http") ? src : SITE_URL + src);
  const aggregateRating =
    rating && rating.count > 0 && rating.average != null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average.toFixed(1), reviewCount: rating.count, bestRating: 5, worstRating: 1 } }
      : {};
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images.map(absolute) } : {}),
    sku,
    category,
    brand: { "@type": "Brand", name: SITE_NAME },
    url,
    ...aggregateRating,
    ...(price != null
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: price.toFixed(2),
            priceCurrency: currency,
            itemCondition: "https://schema.org/NewCondition",
            availability:
              stockStatus === "AVAILABLE"
                ? "https://schema.org/InStock"
                : stockStatus === "RESERVED"
                  ? "https://schema.org/LimitedAvailability"
                  : "https://schema.org/SoldOut",
          },
        }
      : {}),
  };
}

/**
 * BreadcrumbList structured data from a page's visible breadcrumb trail
 * (the same items <Breadcrumbs> renders), so results can show the path
 * instead of a bare URL. Links get the store's prefix; the last item is the
 * page itself.
 */
export function breadcrumbJsonLd(items: { label: string; href?: string }[], market: Market, currentUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href ? SITE_URL + withMarket(item.href, market) : currentUrl,
    })),
  };
}

/** A meta description from longer copy: whole words, at most ~155 characters. */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—–-]$/, "") + "…";
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so content can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
