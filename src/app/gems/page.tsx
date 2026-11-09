import { Suspense } from "react";
import type { Metadata } from "next";
import { getGemstones, getGemCategories, getMasterData, type GemColorFamily } from "@/lib/catalog";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { getWishlistedIds } from "@/lib/wishlist";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import type { Market } from "@/lib/market-shared";
import { getTranslations } from "next-intl/server";
import { GemFilterBar } from "@/components/catalog/GemFilterBar";
import { GemResults } from "@/components/catalog/GemResults";
import { CategoryTile, CategoryGrid } from "@/components/catalog/CategoryTile";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import { gemColorFor } from "@/lib/gem-palette";
import type { StylizedGemShape } from "@/components/gem-visualizer/StylizedGem";

export const metadata: Metadata = { title: "Shop Gemstones" };

type SearchParams = Record<string, string | string[] | undefined>;

// Any of these in the URL means "show me a list", not the category grid. A
// bare /gems (the nav link, the home page buttons) opens on the grid first.
const LISTING_PARAMS = ["q", "mineral", "cut", "clarity", "treatment", "origin", "color", "minCarat", "maxCarat", "minPrice", "maxPrice", "inStockOnly", "promotional", "sort", "page", "view"];

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

function pickAll(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function GemsPage({ searchParams }: PageProps<"/gems">) {
  const [sp, market] = await Promise.all([searchParams, getMarket()]);
  const isLanding = !LISTING_PARAMS.some((key) => sp[key] !== undefined);
  return isLanding ? <GemsLanding market={market} /> : <GemsListing sp={sp} market={market} />;
}

async function GemsLanding({ market }: { market: Market }) {
  const [t, tl, tb, categories, masterData] = await Promise.all([
    getTranslations("catalog.gems"),
    getTranslations("catalog.landing"),
    getTranslations("breadcrumb"),
    getGemCategories(market),
    getMasterData(),
  ]);
  const hueRangeBySlug = new Map(masterData.minerals.map((m) => [m.slug, m]));

  return (
    <div className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Breadcrumbs items={[{ label: tb("home"), href: "/" }, { label: tb("gems") }]} />
      <div className="mb-10 flex flex-col gap-6 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{tl("gems.kicker")}</p>
          <h1 className="mt-3 font-serif text-5xl text-charcoal sm:text-6xl">{tl("gems.title")}</h1>
          <p className="mt-4 text-lg leading-relaxed text-charcoal/75">{tl("gems.intro")}</p>
        </div>
        {categories.total > 0 && (
          <LinkButton href="/gems?view=all" variant="primary" size="lg" className="self-start font-semibold lg:self-auto">
            {tl("gems.viewAllCount", { count: categories.total })}
            <ArrowRight size={18} />
          </LinkButton>
        )}
      </div>

      {categories.tiles.length === 0 ? (
        <p className="py-20 text-center text-charcoal/65">{t("empty")}</p>
      ) : (
        <CategoryGrid>
          {categories.tiles.map((tile) => (
            <CategoryTile
              key={tile.key}
              href={tile.href}
              label={tile.label}
              countLabel={tl("pieces", { count: tile.count })}
              image={tile.image}
              gemColor={gemColorFor(tile.key, hueRangeBySlug.get(tile.key))}
              gemShape={GEM_TILE_SHAPES[tile.key] ?? "oval"}
            />
          ))}
        </CategoryGrid>
      )}

      {/* The way out when the catalog doesn't have it: shape one instead. */}
      <div className="mt-14 flex flex-col gap-6 band-sapphire rounded-3xl px-6 py-10 sm:px-12 sm:py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-serif text-3xl text-charcoal sm:text-4xl">{tl("gems.notSeeingTitle")}</h2>
          <p className="mt-3 text-charcoal/85">{tl("gems.notSeeingBody")}</p>
        </div>
        <LinkButton href="/configurator" variant="primary" size="lg" className="shrink-0 self-start font-semibold md:self-auto">
          {tl("gems.notSeeingCta")}
        </LinkButton>
      </div>
    </div>
  );
}

// A little variety across the grid, the way a tray of real stones reads:
// sapphires as ovals, the brilliants round, spinel as a cushion.
const GEM_TILE_SHAPES: Record<string, StylizedGemShape> = {
  "white-sapphire": "round",
  "pink-sapphire": "round",
  spinel: "cushion",
  garnet: "round",
  topaz: "cushion",
  ruby: "cushion",
};

async function GemsListing({ sp, market }: { sp: SearchParams; market: Market }) {
  const [t, tb, masterData] = await Promise.all([getTranslations("catalog.gems"), getTranslations("breadcrumb"), getMasterData()]);

  const mineralSlugs = pickAll(sp, "mineral");
  const mineral = mineralSlugs.length === 1 ? masterData.minerals.find((m) => m.slug === mineralSlugs[0]) : undefined;

  return (
    <div className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Breadcrumbs
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("gems"), href: "/gems" },
          { label: mineral?.name ?? tb("allGems") },
        ]}
      />
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-gold-deep">{t("kicker")}</p>
        <h1 className="mt-2 font-serif text-4xl text-charcoal">{mineral ? mineral.name : t("title")}</h1>
        <p className="mt-3 max-w-2xl text-charcoal/70">{t("intro")}</p>
      </div>

      <div className="mb-10">
        <GemFilterBar
          minerals={masterData.minerals}
          cuts={masterData.cuts}
          clarityGrades={masterData.clarityGrades}
          treatments={masterData.treatments}
          origins={masterData.origins}
          current={sp}
        />
      </div>

      {/* Keyed on the whole query string so a filter, sort or page change
          shows the skeleton instead of leaving the old results in place. */}
      <Suspense key={JSON.stringify(sp)} fallback={<ProductGridSkeleton />}>
        <GemResultsSection sp={sp} market={market} />
      </Suspense>
    </div>
  );
}

async function GemResultsSection({ sp, market }: { sp: SearchParams; market: Market }) {
  const t = await getTranslations("catalog.gems");
  const filters = {
    q: pick(sp, "q"),
    mineral: pickAll(sp, "mineral"),
    cut: pickAll(sp, "cut"),
    clarity: pickAll(sp, "clarity"),
    treatment: pickAll(sp, "treatment"),
    origin: pickAll(sp, "origin"),
    color: pickAll(sp, "color") as GemColorFamily[],
    minCarat: pick(sp, "minCarat") ? Number(pick(sp, "minCarat")) : undefined,
    maxCarat: pick(sp, "maxCarat") ? Number(pick(sp, "maxCarat")) : undefined,
    minPrice: pick(sp, "minPrice") ? Number(pick(sp, "minPrice")) : undefined,
    maxPrice: pick(sp, "maxPrice") ? Number(pick(sp, "maxPrice")) : undefined,
    inStockOnly: pick(sp, "inStockOnly") === "1",
    promotionalOnly: pick(sp, "promotional") === "1",
    sort: (pick(sp, "sort") as "newest" | "carat" | "az" | "price-low" | "price-high" | undefined) ?? "newest",
    page: pick(sp, "page") ? Number(pick(sp, "page")) : undefined,
    market,
  };

  const session = await auth();
  const [{ items: gems, page, totalPages }, promotions, wishlistedIds] = await Promise.all([
    getGemstones(filters),
    // Fetched regardless of the filter above — every card needs to know
    // whether *it* is on promotion to show its badge/discounted price,
    // not just the subset a customer happens to have filtered down to.
    getActivePromotionMaps(market),
    getWishlistedIds(session?.user?.id),
  ]);

  return (
    <>
      {gems.length === 0 ? (
        <p className="py-20 text-center text-charcoal/65">{t("empty")}</p>
      ) : (
        <GemResults
          gems={gems.map((gem) => ({ ...gem, promoPrice: promotions.gemstonePrices.get(gem.id) ?? null }))}
          wishlistedIds={wishlistedIds}
          isAuthenticated={!!session?.user}
        />
      )}
      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </>
  );
}
