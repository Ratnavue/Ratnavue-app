// The proxy side of the product-page 404 check (see
// app/api/catalog/listing-exists/route.ts). Kept free of Prisma on purpose,
// like the rest of proxy.ts: it only asks the route above.

export type ProductPath = { kind: "gemstone" | "jewelry"; slug: string };

/** "/gems/<slug>" or "/jewelry/<slug>" (market prefix already stripped), else null. */
export function productPathOf(pathname: string): ProductPath | null {
  const match = /^\/(gems|jewelry)\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  return { kind: match[1] === "gems" ? "gemstone" : "jewelry", slug };
}

/**
 * true/false from the existence route, or null when it can't say (timeout,
 * error, odd response) — the caller then serves the page as usual, so a
 * hiccup here can never take a product page down; worst case it falls back
 * to the page's own notFound().
 */
export async function listingExists(origin: string, product: ProductPath, market: string, fetchImpl: typeof fetch = fetch): Promise<boolean | null> {
  try {
    const url = new URL("/api/catalog/listing-exists", origin);
    url.searchParams.set("kind", product.kind);
    url.searchParams.set("slug", product.slug);
    url.searchParams.set("market", market);
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { exists?: unknown };
    return typeof body.exists === "boolean" ? body.exists : null;
  } catch {
    return null;
  }
}

/** Where a missing product is rewritten to: matches no route, so Next renders app/not-found.tsx with a 404 status. */
export const MISSING_LISTING_PATH = "/_missing-listing";
