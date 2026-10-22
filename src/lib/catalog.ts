import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import type { Market } from "@/lib/market-shared";
import { priceColumns, priceForMarket, pricesForMarket } from "@/lib/market-pricing";
import { audienceValuesFor, isAudienceSlug, JEWELRY_AUDIENCES, PIECE_TYPE_ORDER, type JewelryAudienceSlug } from "@/lib/jewelry-categories";

// Reference/taxonomy data (minerals, cuts, clarity grades, treatments,
// origins, cert labs) — edited only through src/actions/master-data.ts,
// which calls revalidateTag(MASTER_DATA_TAG, { expire: 0 }) on every
// mutation, so an admin's own edit (e.g. adding a mineral they want to
// pick immediately on a new gemstone form) shows up right away rather
// than waiting out the window below.
export const MASTER_DATA_TAG = "master-data";
// The gem/jewelry category tiles (getGemCategories/getJewelryCategoryData)
// — counts and cover photos derived from the full catalog. Unlike
// MASTER_DATA_TAG above, this is deliberately only time-based (not wired
// into every catalog create/update/publish action — too many mutation
// points for a count/cover photo that's fine a little stale), same
// eventually-consistent trade-off the home page's own
// getFeaturedGemsForMarket/getFeaturedJewelryForMarket already accept for
// everything except their one explicit featured-flag tag.
const CATALOG_CATEGORIES_TAG = "catalog-categories";

const GEMS_PAGE_SIZE = 24;
const JEWELRY_PAGE_SIZE = 24;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// A gem's colour is stored as free-form HSL (colorHue/colorSaturation/
// colorLightness — the same fields GemVisualizer renders from), not a
// discrete category, so "filter by colour" needs a bucketing scheme.
// Approximate by nature (colour is a spectrum), but close enough for
// "show me the green stones" browsing. Brown is the one family that isn't
// a hue range at all — it's a desaturated, darker orange/red rather than
// its own point on the wheel, so it layers saturation/lightness caps on
// top of an orange-ish hue instead.
export const GEM_COLOR_FAMILIES = [
  { key: "red", label: "Red" },
  { key: "orange", label: "Orange" },
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "violet", label: "Violet" },
  { key: "pink", label: "Pink" },
  { key: "brown", label: "Brown" },
] as const;

export type GemColorFamily = (typeof GEM_COLOR_FAMILIES)[number]["key"];

function colorFamilyWhere(family: GemColorFamily): Prisma.GemstoneWhereInput {
  switch (family) {
    case "red":
      return { OR: [{ colorHue: { gte: 350 } }, { colorHue: { lte: 10 } }] };
    case "orange":
      return { colorHue: { gt: 10, lte: 40 } };
    case "yellow":
      return { colorHue: { gt: 40, lte: 65 } };
    case "green":
      return { colorHue: { gt: 65, lte: 170 } };
    case "blue":
      return { colorHue: { gt: 170, lte: 250 } };
    case "violet":
      return { colorHue: { gt: 250, lte: 290 } };
    case "pink":
      return { colorHue: { gt: 290, lte: 350 } };
    case "brown":
      return { colorHue: { gt: 10, lte: 50 }, colorSaturation: { lte: 45 }, colorLightness: { lte: 45 } };
  }
}

export interface GemFilters {
  q?: string;
  mineral?: string[];
  cut?: string[];
  clarity?: string[];
  treatment?: string[];
  origin?: string[];
  color?: GemColorFamily[];
  minCarat?: number;
  maxCarat?: number;
  /** Matches whichever price is actually shown for an item — retailPrice
   * when set, else the quote-reference price when showPrice is on — same
   * precedence CardPrice/ProductPrice use for display. An item with
   * neither never matches a price filter, same as it never shows a price
   * on its card. */
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  /** Only items in the currently *live* promotional collection — see
   * getActivePromotionMaps. Off (or nothing live right now) means no
   * filtering by this at all, same as every other optional filter here. */
  promotionalOnly?: boolean;
  sort?: "newest" | "carat" | "az" | "price-low" | "price-high";
  page?: number;
  /** Which storefront is asking: on "lk" the price filter/sort run against
   * the rupee columns, the live promotion is the Sri Lanka one, and the
   * returned items carry rupee prices in price/retailPrice (see
   * market-pricing.ts). */
  market?: Market;
}

export async function getGemstones(filters: GemFilters) {
  const market = filters.market ?? "intl";
  const cols = priceColumns(market);
  // Each storefront lists only its own items — the international and Sri Lanka
  // catalogs never overlap (see Gemstone.market).
  const where: Prisma.GemstoneWhereInput = { isPublished: true, market };
  // Separate from `where`'s own top-level fields: several of these filters
  // (search, colour, price) are themselves OR-blocks, and Prisma ANDs a
  // where object's own keys together with its `AND` array rather than
  // merging OR blocks into one, so each has to stay its own array entry
  // instead of overwriting a single `where.OR`.
  const andConditions: Prisma.GemstoneWhereInput[] = [];

  if (filters.q) {
    andConditions.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { variety: { contains: filters.q, mode: "insensitive" } },
        { mineral: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.mineral?.length) where.mineral = { slug: { in: filters.mineral } };
  if (filters.cut?.length) where.cut = { slug: { in: filters.cut } };
  if (filters.clarity?.length) where.clarityGrade = { slug: { in: filters.clarity } };
  if (filters.treatment?.length) where.treatment = { slug: { in: filters.treatment } };
  if (filters.origin?.length) where.origin = { slug: { in: filters.origin } };
  if (filters.color?.length) andConditions.push({ OR: filters.color.map(colorFamilyWhere) });
  if (filters.minCarat || filters.maxCarat) {
    where.caratWeight = {
      gte: filters.minCarat ?? undefined,
      lte: filters.maxCarat ?? undefined,
    };
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    const range = { gte: filters.minPrice ?? undefined, lte: filters.maxPrice ?? undefined };
    andConditions.push({
      OR: [{ [cols.retail]: range }, { AND: [{ [cols.retail]: null }, { showPrice: true }, { [cols.quote]: range }] }],
    } as Prisma.GemstoneWhereInput);
  }
  if (filters.inStockOnly) where.stockStatus = "AVAILABLE";
  if (filters.promotionalOnly) {
    const { gemstonePrices } = await getActivePromotionMaps(market);
    // `in: []` correctly matches nothing rather than being ignored, so
    // this still filters down to zero results when nothing's live —
    // same as any other filter that happens to match nothing.
    where.id = { in: [...gemstonePrices.keys()] };
  }
  if (andConditions.length) where.AND = andConditions;

  const orderBy: Prisma.GemstoneOrderByWithRelationInput =
    filters.sort === "carat" ? { caratWeight: "desc" }
    : filters.sort === "az" ? { name: "asc" }
    : filters.sort === "price-low" ? { [cols.retail]: "asc" }
    : filters.sort === "price-high" ? { [cols.retail]: "desc" }
    : { createdAt: "desc" };

  const page = Math.max(1, filters.page ?? 1);

  const [items, total] = await Promise.all([
    prisma.gemstone.findMany({
      where,
      orderBy,
      skip: (page - 1) * GEMS_PAGE_SIZE,
      take: GEMS_PAGE_SIZE,
      include: {
        mineral: true,
        cut: true,
        clarityGrade: true,
        treatment: true,
        origin: true,
        // Cards show one image: the primary if flagged, otherwise the first.
        // Loading every photo of every listed item was pure waste.
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      },
    }),
    prisma.gemstone.count({ where }),
  ]);

  return { items: pricesForMarket(items, market), page, pageSize: GEMS_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / GEMS_PAGE_SIZE)) };
}

export async function getGemstoneBySlug(slug: string, market: Market = "intl") {
  const gem = await prisma.gemstone.findUnique({
    where: { slug },
    include: {
      mineral: true,
      cut: true,
      clarityGrade: true,
      treatment: true,
      origin: true,
      certLab: true,
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
  // An item from the other storefront doesn't exist here: /lk/gems/<intl item>
  // and /gems/<lk item> are plain 404s.
  return gem && gem.market === market ? priceForMarket(gem, market) : null;
}

// "You May Also Like" on a gem's own detail page — same mineral first
// (a shopper looking at a sapphire is shown other sapphires, not a
// disconnected ruby), topped up with other recent published gems if that
// mineral alone doesn't have enough in stock to fill the row. Excludes the
// gem itself either way.
export async function getRelatedGemstones(gem: { id: string; mineralId: string }, take = 4, market: Market = "intl") {
  const sameVariety = await prisma.gemstone.findMany({
    where: { isPublished: true, market, id: { not: gem.id }, mineralId: gem.mineralId },
    orderBy: { createdAt: "desc" },
    take,
    include: { mineral: true, cut: true, clarityGrade: true, treatment: true, origin: true, media: { orderBy: { sortOrder: "asc" } } },
  });
  if (sameVariety.length >= take) return pricesForMarket(sameVariety, market);

  const fallback = await prisma.gemstone.findMany({
    where: { isPublished: true, market, id: { notIn: [gem.id, ...sameVariety.map((g) => g.id)] } },
    orderBy: { createdAt: "desc" },
    take: take - sameVariety.length,
    include: { mineral: true, cut: true, clarityGrade: true, treatment: true, origin: true, media: { orderBy: { sortOrder: "asc" } } },
  });
  return pricesForMarket([...sameVariety, ...fallback], market);
}

export interface JewelryFilters {
  q?: string;
  /** Audience slugs ("women" | "men" | "couple" | "unisex"). Men and Women
   * also include Unisex pieces — see audienceValuesFor. */
  audience?: string[];
  pieceType?: string[];
  metalType?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  /** See GemFilters.promotionalOnly — same rule, the jewelry side. */
  promotionalOnly?: boolean;
  sort?: "newest" | "az" | "price-low" | "price-high";
  page?: number;
  /** See GemFilters.market. */
  market?: Market;
}

export async function getJewelry(filters: JewelryFilters) {
  const market = filters.market ?? "intl";
  const cols = priceColumns(market);
  const where: Prisma.JewelryPieceWhereInput = { isPublished: true, market };
  // See GemFilters' own getGemstones for why search/price live in their
  // own AND entries rather than directly on `where`.
  const andConditions: Prisma.JewelryPieceWhereInput[] = [];

  if (filters.q) {
    andConditions.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.audience?.length) {
    const values = [...new Set(filters.audience.filter(isAudienceSlug).flatMap(audienceValuesFor))];
    if (values.length) where.audience = { in: values };
  }
  if (filters.pieceType?.length) where.pieceType = { in: filters.pieceType as never[] };
  if (filters.metalType?.length) where.metalType = { in: filters.metalType as never[] };
  if (filters.minPrice != null || filters.maxPrice != null) {
    const range = { gte: filters.minPrice ?? undefined, lte: filters.maxPrice ?? undefined };
    andConditions.push({
      OR: [{ [cols.retail]: range }, { AND: [{ [cols.retail]: null }, { showPrice: true }, { [cols.quote]: range }] }],
    } as Prisma.JewelryPieceWhereInput);
  }
  if (filters.inStockOnly) where.stockStatus = "AVAILABLE";
  if (filters.promotionalOnly) {
    const { jewelryPrices } = await getActivePromotionMaps(market);
    where.id = { in: [...jewelryPrices.keys()] };
  }
  if (andConditions.length) where.AND = andConditions;

  const orderBy: Prisma.JewelryPieceOrderByWithRelationInput =
    filters.sort === "az" ? { name: "asc" }
    : filters.sort === "price-low" ? { [cols.retail]: "asc" }
    : filters.sort === "price-high" ? { [cols.retail]: "desc" }
    : { createdAt: "desc" };

  const page = Math.max(1, filters.page ?? 1);

  const [items, total] = await Promise.all([
    prisma.jewelryPiece.findMany({
      where,
      orderBy,
      skip: (page - 1) * JEWELRY_PAGE_SIZE,
      take: JEWELRY_PAGE_SIZE,
      include: {
        media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        gemstones: { include: { gemstone: true } },
      },
    }),
    prisma.jewelryPiece.count({ where }),
  ]);

  return { items: pricesForMarket(items, market), page, pageSize: JEWELRY_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / JEWELRY_PAGE_SIZE)) };
}

// ---------- Category landing pages ----------
//
// The gems page opens on a "browse by material" grid and the jewelry page on
// "who is it for" then "what is it" grids, before the full filterable list.
// These build those tiles: a name, how many published pieces are in it, and a
// cover photo taken from the newest piece that has one.

export interface CategoryTileData {
  key: string;
  label: string;
  href: string;
  count: number;
  image: string | null;
}

const FIRST_IMAGE = {
  where: { type: "IMAGE" as const },
  orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
  take: 1,
  select: { url: true },
};

/** One tile per mineral that has at least one published gem in this store.
 * Three queries however many minerals there are: the counts, the mineral
 * list, and the newest imaged gem per mineral (a DISTINCT, not a query per
 * tile). */
export const getGemCategories = unstable_cache(
  async (market: Market = "intl"): Promise<{ total: number; tiles: CategoryTileData[]; cover: string | null }> => {
    const base: Prisma.GemstoneWhereInput = { isPublished: true, market };
    const [counts, minerals, covers] = await Promise.all([
      prisma.gemstone.groupBy({ by: ["mineralId"], where: base, _count: { _all: true } }),
      prisma.mineral.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.gemstone.findMany({
        where: { ...base, media: { some: { type: "IMAGE" } } },
        orderBy: { createdAt: "desc" },
        distinct: ["mineralId"],
        select: { mineralId: true, media: FIRST_IMAGE },
      }),
    ]);
    const countById = new Map(counts.map((c) => [c.mineralId, c._count._all]));
    const coverById = new Map(covers.map((c) => [c.mineralId, c.media[0]?.url ?? null]));
    const tiles = minerals
      .filter((m) => (countById.get(m.id) ?? 0) > 0)
      .map((m) => ({ key: m.slug, label: m.name, href: `/gems?mineral=${m.slug}`, count: countById.get(m.id) ?? 0, image: coverById.get(m.id) ?? null }));
    return { total: counts.reduce((n, c) => n + c._count._all, 0), tiles, cover: covers[0]?.media[0]?.url ?? null };
  },
  ["catalog-gem-categories"],
  { revalidate: 60, tags: [CATALOG_CATEGORIES_TAG] },
);

/** Counts of published jewelry per audience and per (audience, piece type),
 * with cover images, for the two jewelry landing levels. Two queries in all:
 * one grouped count, and the newest imaged piece for each audience/type
 * combination (a DISTINCT) — every tile's cover is then picked from those. */
// Only the raw query is cached, not the whole function — the function
// returns a closure (typesFor below) over that data, and unstable_cache's
// return value has to be plain, serializable data.
const getJewelryCategoryRaw = unstable_cache(
  async (market: Market) => {
    const base: Prisma.JewelryPieceWhereInput = { isPublished: true, market };
    const [groups, covers] = await Promise.all([
      prisma.jewelryPiece.groupBy({ by: ["audience", "pieceType"], where: base, _count: { _all: true } }),
      prisma.jewelryPiece.findMany({
        where: { ...base, media: { some: { type: "IMAGE" } } },
        orderBy: { createdAt: "desc" },
        distinct: ["audience", "pieceType"],
        select: { audience: true, pieceType: true, createdAt: true, media: FIRST_IMAGE },
      }),
    ]);
    return { groups, covers };
  },
  ["catalog-jewelry-category-raw"],
  { revalidate: 60, tags: [CATALOG_CATEGORIES_TAG] },
);

export async function getJewelryCategoryData(market: Market = "intl") {
  const { groups, covers } = await getJewelryCategoryRaw(market);

  const matches = (audience: string, slug: JewelryAudienceSlug | null) => !slug || (audienceValuesFor(slug) as string[]).includes(audience);
  const countFor = (slug: JewelryAudienceSlug | null, pieceType?: string) =>
    groups.filter((g) => matches(g.audience, slug) && (!pieceType || g.pieceType === pieceType)).reduce((n, g) => n + g._count._all, 0);
  // covers are already newest-first, so the first match is the newest overall
  const coverFor = (slug: JewelryAudienceSlug | null, pieceType?: string) =>
    covers.find((c) => matches(c.audience, slug) && (!pieceType || c.pieceType === pieceType))?.media[0]?.url ?? null;

  const audiences = JEWELRY_AUDIENCES.map((slug) => ({ slug, count: countFor(slug), image: coverFor(slug) })).filter((a) => a.count > 0);

  return {
    total: countFor(null),
    cover: coverFor(null),
    audiences,
    /** Type tiles for one audience (or all jewelry when null). */
    async typesFor(slug: JewelryAudienceSlug | null) {
      return PIECE_TYPE_ORDER.map((type) => ({ type, count: countFor(slug, type), image: coverFor(slug, type) })).filter((t) => t.count > 0);
    },
    totalFor: countFor,
  };
}

export async function getJewelryBySlug(slug: string, market: Market = "intl") {
  const piece = await prisma.jewelryPiece.findUnique({
    where: { slug },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      gemstones: { include: { gemstone: true } },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });
  return piece && piece.market === market ? priceForMarket(piece, market) : null;
}

// Same idea as getRelatedGemstones, for a jewelry piece's own detail page —
// same piece type first (a shopper looking at a ring is shown other rings),
// topped up with other recent published pieces if needed.
export async function getRelatedJewelry(piece: { id: string; pieceType: string }, take = 4, market: Market = "intl") {
  const samePieceType = await prisma.jewelryPiece.findMany({
    where: { isPublished: true, market, id: { not: piece.id }, pieceType: piece.pieceType as never },
    orderBy: { createdAt: "desc" },
    take,
    include: { media: { orderBy: { sortOrder: "asc" } } },
  });
  if (samePieceType.length >= take) return pricesForMarket(samePieceType, market);

  const fallback = await prisma.jewelryPiece.findMany({
    where: { isPublished: true, market, id: { notIn: [piece.id, ...samePieceType.map((p) => p.id)] } },
    orderBy: { createdAt: "desc" },
    take: take - samePieceType.length,
    include: { media: { orderBy: { sortOrder: "asc" } } },
  });
  return pricesForMarket([...samePieceType, ...fallback], market);
}

// Queried on every /gems view, /configurator view, and several admin
// gem/sourcing forms — six small tables that only change when an admin
// edits master data, so this was a wasted DB round-trip (and this
// environment's known multi-second Supabase latency — see home page's own
// getFeaturedGemsForMarket) on every single one of those loads.
export const getMasterData = unstable_cache(
  async () => {
    const [minerals, cuts, clarityGrades, treatments, origins, certificationLabs] = await Promise.all([
      prisma.mineral.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.cut.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.clarityGrade.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.treatment.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.origin.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.certificationLab.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    return { minerals, cuts, clarityGrades, treatments, origins, certificationLabs };
  },
  ["catalog-master-data"],
  { revalidate: 60, tags: [MASTER_DATA_TAG] },
);
