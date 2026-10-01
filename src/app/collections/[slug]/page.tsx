import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import { priceForMarket } from "@/lib/market-pricing";
import { getPageVisibility, getPageVisibilities } from "@/lib/page-visibility";
import { getAllSubcultureContent } from "@/lib/subculture-content";
import { getCollectionItems, getCollectionKeysWithItems, toCollectionCardData } from "@/lib/subculture-items";
import { SUBCULTURE_KEYS, SUBCULTURE_COLLECTIONS, type SubcultureKey } from "@/lib/subculture-collections";
import { AlternativeCollectionPage } from "@/components/collections/AlternativeCollectionPage";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

// Resolves the URL's slug segment to a collection's stable internal key —
// admin-editable (SubcultureContent.urlSlug), so this scans whatever's
// currently saved rather than assuming slug === key. Only five (soon
// more) rows, so "fetch all, scan" is simpler than a dedicated index.
async function resolveBySlug(slug: string): Promise<{ key: SubcultureKey; all: Awaited<ReturnType<typeof getAllSubcultureContent>> } | null> {
  const all = await getAllSubcultureContent();
  const key = SUBCULTURE_KEYS.find((k) => all[k].urlSlug === slug);
  return key ? { key, all } : null;
}

export function generateStaticParams() {
  // A build-time hint only — dynamicParams stays enabled (the default),
  // so a slug renamed after this build still resolves on-demand rather
  // than 404ing until the next deploy. See resolveBySlug.
  return SUBCULTURE_KEYS.map((key) => ({ slug: key }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveBySlug(slug);
  if (!resolved) return {};
  const { key, all } = resolved;

  const visibility = await getPageVisibility(key);
  // Deliberately not indexed while Hidden — a direct visit still 404s
  // below, but this also keeps a stale cached metadata entry from ever
  // pointing search engines at a page that isn't there.
  if (visibility === "HIDDEN") return { robots: { index: false, follow: false } };

  const content = all[key];
  const url = `${BASE_URL}/collections/${content.urlSlug}`;
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      title: content.seoTitle,
      description: content.seoDescription,
      url,
      images: content.ogImage ? [{ url: content.ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: content.seoTitle,
      description: content.seoDescription,
      images: content.ogImage ? [content.ogImage] : undefined,
    },
  };
}

export default async function SubcultureCollectionPage({ params }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const resolved = await resolveBySlug(slug);
  // No collection currently owns this slug — a plain 404, same as any
  // other unknown route (covers both a typo'd URL and a slug that was
  // renamed away from).
  if (!resolved) notFound();
  const { key, all } = resolved;

  const visibility = await getPageVisibility(key);
  // Hidden reads as though the route doesn't exist — same convention
  // /promotions and /auction already use (see getPageVisibility's own
  // doc comment: defaults to HIDDEN until an admin turns a page on).
  if (visibility === "HIDDEN") notFound();

  const [allRows, visibilities, session, market, designStudioVisibility] = await Promise.all([
    getCollectionItems(key),
    getPageVisibilities([...SUBCULTURE_KEYS]),
    auth(),
    getMarket(),
    getPageVisibility("design-studio"),
  ]);
  // The international and Sri Lanka catalogs never overlap, so a collection
  // shows only the items that belong to the visitor's own storefront — with
  // that storefront's prices (rupees on /lk).
  const rawRows = allRows.filter((row) => (row.gemstone ?? row.jewelry)?.market === market);
  // A collection nobody has stocked on the Sri Lanka store doesn't exist
  // there (a plain 404), rather than showing an empty themed page.
  if (market === "lk" && rawRows.length === 0) notFound();
  const withItems = market === "lk" ? await getCollectionKeysWithItems(market) : null;
  const rows = rawRows.map((row) => ({
    ...row,
    gemstone: row.gemstone && priceForMarket(row.gemstone, market),
    jewelry: row.jewelry && priceForMarket(row.jewelry, market),
  }));

  const content = all[key];
  const items = rows.map(toCollectionCardData).filter((item) => item !== null);
  const liveKeys = SUBCULTURE_KEYS.filter((k) => visibilities[k] === "LIVE" && (!withItems || withItems.has(k))) as SubcultureKey[];
  // Every collection's current public slug, for the cross-collection
  // footer's links — must read from `all` (this request's live content),
  // never a collection's fixed code-level `slug` field, which won't
  // reflect an admin rename.
  const slugsByKey = Object.fromEntries(SUBCULTURE_KEYS.map((k) => [k, all[k].urlSlug])) as Record<SubcultureKey, string>;
  const theme = SUBCULTURE_COLLECTIONS[key];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: content.seoTitle,
    description: content.seoDescription,
    url: `${BASE_URL}/collections/${content.urlSlug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.slice(0, 24).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}${item.href}`,
        name: item.name,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AlternativeCollectionPage
        theme={theme}
        content={content}
        items={items}
        liveKeys={liveKeys}
        slugsByKey={slugsByKey}
        isSignedIn={!!session?.user}
        designStudioEnabled={designStudioVisibility === "LIVE"}
      />
    </>
  );
}
