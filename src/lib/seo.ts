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
}: {
  /** A plain string gets the store's suffix ("· Ratnavue" / "· Ratnavue
   * Sri Lanka"); { absolute } is used as-is (the home page). */
  title: string | { absolute: string };
  description: string;
  /** e.g. search results: crawlable for links, but not a page to rank. */
  noindex?: boolean;
  /** A page-specific share image (a product's photo); defaults to the brand image. */
  image?: string | null;
}): Promise<Metadata> {
  const { url, market } = await currentCanonicalUrl();
  // The Sri Lanka store's copy of a page says so, in both title and
  // description, so it isn't a duplicate of the international one.
  const fullDescription = market === "lk" && !description.includes("Sri Lanka") ? metaDescription(`${description} Priced in rupees for Sri Lanka.`, 160) : description;
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
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
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
}) {
  const absolute = (src: string) => (src.startsWith("http") ? src : SITE_URL + src);
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
