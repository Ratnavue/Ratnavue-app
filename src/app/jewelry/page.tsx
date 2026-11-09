import { Suspense } from "react";
import { AUDIENCE_SEO_LABELS, PAGE_SEO, fill } from "@/lib/seo-copy";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getJewelry, getJewelryCategoryData } from "@/lib/catalog";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { getWishlistedIds } from "@/lib/wishlist";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import type { Market } from "@/lib/market-shared";
import { AUDIENCE_LABELS, isAudienceSlug, pieceTypeLabel, type JewelryAudienceSlug } from "@/lib/jewelry-categories";
import { getTranslations } from "next-intl/server";
import { JewelryFilterBar } from "@/components/catalog/JewelryFilterBar";
import { JewelryResults } from "@/components/catalog/JewelryResults";
import { CategoryTile, CategoryGrid, CategoryLandingHeader, CategoryLandingBanner } from "@/components/catalog/CategoryTile";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";

export async function generateMetadata({ searchParams }: PageProps<"/jewelry">): Promise<Metadata> {
  const sp = await searchParams;
  const audiences = pickAll(sp, "audience").filter(isAudienceSlug);
  const isList = LISTING_PARAMS.some((key) => sp[key] !== undefined) || audiences.length > 1;
  if (isList) return pageMetadata(PAGE_SEO.jewelryAll);
  if (audiences.length === 1) {
    const audience = AUDIENCE_SEO_LABELS[audiences[0]];
    return pageMetadata({
      title: fill(PAGE_SEO.jewelryAudience.title, { audience }),
      description: fill(PAGE_SEO.jewelryAudience.description, { audience: audience.toLowerCase() }),
    });
  }
  return pageMetadata(PAGE_SEO.jewelry);
}

type SearchParams = Record<string, string | string[] | undefined>;

// Anything besides `audience` (and the harmless tracking noise) means "show
// me a list". A bare /jewelry opens on the who-is-it-for grid; /jewelry?audience=women
// on that audience's piece-type grid; everything else is the filtered list.
const LISTING_PARAMS = ["q", "pieceType", "metalType", "minPrice", "maxPrice", "inStockOnly", "promotional", "sort", "page", "view"];

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

function pickAll(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function JewelryPage({ searchParams }: PageProps<"/jewelry">) {
  const [sp, market] = await Promise.all([searchParams, getMarket()]);
  const audiences = pickAll(sp, "audience").filter(isAudienceSlug);
  const hasListingParam = LISTING_PARAMS.some((key) => sp[key] !== undefined) || audiences.length > 1;

  if (hasListingParam) return <JewelryListing sp={sp} market={market} />;
  if (audiences.length === 1) return <JewelryTypeLanding audience={audiences[0]} market={market} />;
  return <JewelryAudienceLanding market={market} />;
}

async function JewelryAudienceLanding({ market }: { market: Market }) {
  const [t, tl, tb, data] = await Promise.all([
    getTranslations("catalog.jewelry"),
    getTranslations("catalog.landing"),
    getTranslations("breadcrumb"),
    getJewelryCategoryData(market),
  ]);

  return (
    <div className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Breadcrumbs items={[{ label: tb("home"), href: "/" }, { label: tb("jewelry") }]} />
      <CategoryLandingHeader
        kicker={tl("jewelry.kicker")}
        title={tl("jewelry.title")}
        intro={tl("jewelry.intro")}
        viewAllHref={data.total > 0 ? "/jewelry?view=all" : undefined}
        viewAllLabel={tl("jewelry.viewAllCount", { count: data.total })}
      />

      {data.total === 0 ? (
        <p className="py-20 text-center text-charcoal/65">{t("empty")}</p>
      ) : (
        <CategoryGrid>
          {data.audiences.map((a) => (
            <CategoryTile
              key={a.slug}
              href={`/jewelry?audience=${a.slug}`}
              label={AUDIENCE_LABELS[a.slug]}
              countLabel={tl("pieces", { count: a.count })}
              description={tl(`jewelry.audience.${a.slug}`)}
              image={a.image}
            />
          ))}
        </CategoryGrid>
      )}

      <JewelryBanner tl={tl} />
    </div>
  );
}

async function JewelryTypeLanding({ audience, market }: { audience: JewelryAudienceSlug; market: Market }) {
  const [t, tl, tb, data] = await Promise.all([
    getTranslations("catalog.jewelry"),
    getTranslations("catalog.landing"),
    getTranslations("breadcrumb"),
    getJewelryCategoryData(market),
  ]);
  const types = await data.typesFor(audience);
  const label = AUDIENCE_LABELS[audience];
  const total = data.totalFor(audience);

  return (
    <div className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Breadcrumbs items={[{ label: tb("home"), href: "/" }, { label: tb("jewelry"), href: "/jewelry" }, { label }]} />
      <CategoryLandingHeader
        kicker={tl("jewelry.typeKicker")}
        title={label}
        intro={tl("jewelry.typeIntro")}
        viewAllHref={total > 0 ? `/jewelry?audience=${audience}&view=all` : undefined}
        viewAllLabel={tl("jewelry.viewAllFor", { audience: label.toLowerCase() })}
      />

      {total === 0 ? (
        <p className="py-20 text-center text-charcoal/65">{t("empty")}</p>
      ) : (
        <CategoryGrid>
          {types.map((type) => (
            <CategoryTile
              key={type.type}
              href={`/jewelry?audience=${audience}&pieceType=${type.type}`}
              label={pieceTypeLabel(type.type, "plural")}
              countLabel={tl("pieces", { count: type.count })}
              image={type.image}
            />
          ))}
        </CategoryGrid>
      )}

      <JewelryBanner tl={tl} />
    </div>
  );
}

/** Jewelry's way out when nothing fits: a bespoke sourcing request. */
function JewelryBanner({ tl }: { tl: Awaited<ReturnType<typeof getTranslations<"catalog.landing">>> }) {
  return (
    <CategoryLandingBanner
      title={tl("jewelry.notSeeingTitle")}
      body={tl("jewelry.notSeeingBody")}
      href="/sourcing"
      cta={tl("jewelry.notSeeingCta")}
    />
  );
}

async function JewelryListing({ sp, market }: { sp: SearchParams; market: Market }) {
  const [t, tb] = await Promise.all([getTranslations("catalog.jewelry"), getTranslations("breadcrumb")]);

  const audiences = pickAll(sp, "audience").filter(isAudienceSlug);
  const types = pickAll(sp, "pieceType");
  const audience = audiences.length === 1 ? audiences[0] : undefined;
  const type = types.length === 1 ? types[0] : undefined;

  const crumbs: BreadcrumbItem[] = [{ label: tb("home"), href: "/" }, { label: tb("jewelry"), href: "/jewelry" }];
  if (audience) crumbs.push({ label: AUDIENCE_LABELS[audience], href: `/jewelry?audience=${audience}` });
  crumbs.push({ label: type ? pieceTypeLabel(type, "plural") : audience ? tb("results") : tb("allJewelry") });

  const heading = type ? `${audience ? AUDIENCE_LABELS[audience] + " · " : ""}${pieceTypeLabel(type, "plural")}` : audience ? `${AUDIENCE_LABELS[audience]} jewelry` : t("title");

  return (
    <div className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Breadcrumbs items={crumbs} />
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-gold-deep">{t("kicker")}</p>
        <h1 className="mt-2 font-serif text-4xl text-charcoal">{heading}</h1>
        <p className="mt-3 max-w-2xl text-charcoal/70">{t("intro")}</p>
      </div>

      <div className="mb-10">
        <JewelryFilterBar current={sp} />
      </div>

      <Suspense key={JSON.stringify(sp)} fallback={<ProductGridSkeleton />}>
        <JewelryResultsSection sp={sp} market={market} />
      </Suspense>
    </div>
  );
}

async function JewelryResultsSection({ sp, market }: { sp: SearchParams; market: Market }) {
  const t = await getTranslations("catalog.jewelry");
  const filters = {
    q: pick(sp, "q"),
    audience: pickAll(sp, "audience"),
    pieceType: pickAll(sp, "pieceType"),
    metalType: pickAll(sp, "metalType"),
    minPrice: pick(sp, "minPrice") ? Number(pick(sp, "minPrice")) : undefined,
    maxPrice: pick(sp, "maxPrice") ? Number(pick(sp, "maxPrice")) : undefined,
    inStockOnly: pick(sp, "inStockOnly") === "1",
    promotionalOnly: pick(sp, "promotional") === "1",
    sort: (pick(sp, "sort") as "newest" | "az" | "price-low" | "price-high" | undefined) ?? "newest",
    page: pick(sp, "page") ? Number(pick(sp, "page")) : undefined,
    market,
  };

  const session = await auth();
  const [{ items: pieces, page, totalPages }, promotions, wishlistedIds] = await Promise.all([
    getJewelry(filters),
    // Fetched regardless of the filter above — every card needs to know
    // whether *it* is on promotion to show its badge/discounted price,
    // not just the subset a customer happens to have filtered down to.
    getActivePromotionMaps(market),
    getWishlistedIds(session?.user?.id),
  ]);

  return (
    <>
      {pieces.length === 0 ? (
        <p className="py-20 text-center text-charcoal/65">{t("empty")}</p>
      ) : (
        <JewelryResults
          pieces={pieces.map((piece) => ({ ...piece, promoPrice: promotions.jewelryPrices.get(piece.id) ?? null }))}
          wishlistedIds={wishlistedIds}
          isAuthenticated={!!session?.user}
        />
      )}
      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </>
  );
}
