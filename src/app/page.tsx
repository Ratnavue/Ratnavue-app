import Link from "@/components/ui/MarketLink";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCachedHomeContent } from "@/lib/site-config-cache";
import { getMasterData } from "@/lib/catalog";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { getWishlistedIds } from "@/lib/wishlist";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import { pricesForMarket } from "@/lib/market-pricing";
import { LinkButton } from "@/components/ui/Button";
import { GemCard } from "@/components/catalog/GemCard";
import { JewelryCard } from "@/components/catalog/JewelryCard";
import { GemStage, StylizedGem } from "@/components/gem-visualizer/StylizedGem";
import { gemColorFor } from "@/lib/gem-palette";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";
import { HeroSlideshow } from "@/components/layout/HeroSlideshow";
import { CardSlider } from "@/components/ui/CardSlider";
import { TrustBar } from "@/components/layout/TrustBar";
import { getTrustBarMessages } from "@/lib/i18n-messages";
import { getTranslations } from "next-intl/server";
import { LkStrip } from "@/components/layout/LkStrip";

// The home page's two heaviest queries (each a multi-table join over the
// full catalog) — cached per market for 60s, with an on-demand
// revalidateTag("home-featured") wherever a gem/jewelry piece's featured
// flag changes (see toggleGemstoneFeatured/toggleJewelryFeatured), so an
// admin's change still shows up immediately rather than waiting out the
// window. This is what was making a slow DB round-trip (this environment's
// known multi-second latency to Supabase) show up as a visible layout
// jump on every single home page load — the loading skeleton is far
// shorter than the real page, so a slow load meant a jarring swap once
// the real content finally arrived. See lib/orders.ts and friends for the
// same latency being the root cause of several other reports this pass.
const getFeaturedGemsForMarket = unstable_cache(
  (market: string) =>
    prisma.gemstone.findMany({
      where: { isPublished: true, isFeatured: true, market },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { mineral: true, cut: true, clarityGrade: true, treatment: true, origin: true, media: true },
    }),
  ["home-featured-gems"],
  { revalidate: 60, tags: ["home-featured"] },
);

const getFeaturedJewelryForMarket = unstable_cache(
  (market: string) =>
    prisma.jewelryPiece.findMany({
      where: { isPublished: true, isFeatured: true, market },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { media: { orderBy: { sortOrder: "asc" } } },
    }),
  ["home-featured-jewelry"],
  { revalidate: 60, tags: ["home-featured"] },
);

export default async function HomePage() {
  const market = await getMarket();
  const [session, t] = await Promise.all([auth(), getTranslations("home")]);
  // Each storefront features its own listings only (a listing belongs to one
  // storefront) and has its own home copy (see getHomeContent).
  const [rawFeaturedGems, rawFeaturedJewelry, content, { gemstonePrices, jewelryPrices }, trustBarMessages, wishlistedIds, { minerals }] = await Promise.all([
    getFeaturedGemsForMarket(market),
    getFeaturedJewelryForMarket(market),
    getCachedHomeContent(market),
    getActivePromotionMaps(market),
    getTrustBarMessages(),
    getWishlistedIds(session?.user?.id),
    getMasterData(),
  ]);
  const featuredGems = pricesForMarket(rawFeaturedGems, market);
  const featuredJewelry = pricesForMarket(rawFeaturedJewelry, market);

  // Each of these two sections is curated by admins (feature specific items
  // from their list pages) and independently switched on/off from Home Page
  // content — either can be absent.
  const showFeaturedGems = content.showFeaturedGems && featuredGems.length > 0;
  const showFeaturedJewelry = content.showFeaturedJewelry && featuredJewelry.length > 0;

  return (
    <div className="pb-20 sm:pb-28">
      {/* ---------- Hero ---------- */}
      {/* Two columns (stacked on phones): the copy, and the admin-managed
          hero photos (Home Page content) in a rounded card on a soft
          sapphire glow — or the stylised gem when no slides are set. */}
      <section id="hero" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(55% 70% at 78% 30%, var(--hero-glow), transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-[120rem] items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-12 lg:pb-24 xl:px-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{content.heroKicker}</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.04] text-charcoal sm:text-6xl xl:text-7xl">
              {content.heroHeadingLine1} {content.heroHeadingLine2}{" "}
              <span className="text-gold-deep">{content.heroHeadingHighlight}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal/75">{content.heroSubtext}</p>
            <div className="mt-9 flex flex-wrap gap-3 sm:gap-4">
              <LinkButton href="/gems" size="lg">
                {t("shopGemstones")} <ArrowRight size={18} />
              </LinkButton>
              <LinkButton href="/configurator" variant="outline" size="lg">
                {t("designYourGem")}
              </LinkButton>
            </div>
          </div>
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-border-subtle bg-night shadow-2xl shadow-night/30">
            {content.heroSlides.length > 0 ? (
              <HeroSlideshow images={content.heroSlides} />
            ) : (
              <GemStage color={gemColorFor("blue-sapphire")} className="absolute inset-0 flex items-center justify-center">
                <StylizedGem color={gemColorFor("blue-sapphire")} className="w-1/2" />
              </GemStage>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Explore by stone ---------- */}
      {minerals.length > 0 && (
        <section className="mx-auto max-w-[120rem] px-5 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-sm text-charcoal/65">{t("exploreByStone")}</p>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {minerals.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/gems?mineral=${m.slug}`}
                  className="flex items-center gap-2.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-charcoal transition-colors hover:border-gold/60"
                >
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: gemColorFor(m.slug, m) }} />
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Featured Gemstones ---------- */}
      {/* Curated, not automatic: admins mark items Gemstone.isFeatured from
          /admin/gems (star on each row), and the whole section can be
          switched off from Home Page content regardless of how many items
          are marked — see showFeaturedGems above. */}
      {showFeaturedGems && (
        <section id="featured" className="mx-auto max-w-[120rem] px-5 pt-20 sm:px-8 sm:pt-28 lg:px-12 xl:px-16">
          <SectionHeading kicker={t("handSelected")} title={t("featuredGems")} viewAll={t("viewAll")} href="/gems" />
          <Reveal>
            <CardSlider>
              {featuredGems.map((gem) => (
                <div key={gem.id} className="w-[calc(50%-12px)] shrink-0 snap-start sm:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]">
                  <GemCard
                    id={gem.id}
                    isWishlisted={wishlistedIds.has(gem.id)}
                    isAuthenticated={!!session?.user}
                    slug={gem.slug}
                    name={gem.name}
                    mineralName={gem.mineral.name}
                    cutSlug={gem.cut.slug}
                    cutName={gem.cut.name}
                    caratWeight={gem.caratWeight}
                    colorHue={gem.colorHue}
                    colorLightness={gem.colorLightness}
                    claritySlug={gem.clarityGrade.slug}
                    clarityName={gem.clarityGrade.name}
                    treatmentName={gem.treatment.name}
                    isCeylon={gem.origin.isCeylon}
                    specialties={gem.specialties}
                    stockStatus={gem.stockStatus}
                    primaryImageUrl={gem.media.find((m) => m.isPrimary)?.url ?? gem.media[0]?.url}
                    price={gem.price}
                    showPrice={gem.showPrice}
                    retailPrice={gem.retailPrice}
                    promoPrice={gemstonePrices.get(gem.id)}
                  />
                </div>
              ))}
            </CardSlider>
          </Reveal>
        </section>
      )}

      {/* ---------- Featured Jewelry ---------- */}
      {/* Same curation pattern as Featured Gemstones, independently toggled
          (JewelryPiece.isFeatured + showFeaturedJewelry). */}
      {showFeaturedJewelry && (
        <section id="featured-jewelry" className="mx-auto max-w-[120rem] px-5 pt-20 sm:px-8 sm:pt-28 lg:px-12 xl:px-16">
          <SectionHeading kicker={t("handSelected")} title={t("featuredJewelry")} viewAll={t("viewAll")} href="/jewelry" />
          <Reveal>
            <CardSlider>
              {featuredJewelry.map((piece) => (
                <div key={piece.id} className="w-[calc(50%-12px)] shrink-0 snap-start sm:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]">
                  <JewelryCard
                    id={piece.id}
                    isWishlisted={wishlistedIds.has(piece.id)}
                    isAuthenticated={!!session?.user}
                    slug={piece.slug}
                    name={piece.name}
                    pieceType={piece.pieceType}
                    metalType={piece.metalType}
                    stockStatus={piece.stockStatus}
                    primaryImageUrl={piece.media.find((m) => m.isPrimary)?.url ?? piece.media[0]?.url}
                    price={piece.price}
                    showPrice={piece.showPrice}
                    retailPrice={piece.retailPrice}
                    promoPrice={jewelryPrices.get(piece.id)}
                  />
                </div>
              ))}
            </CardSlider>
          </Reveal>
        </section>
      )}

      {/* ---------- Heritage ---------- */}
      {/* Photo card left, story right — with the editorial quote (it used to
          be its own full-width dark band) set as a gold-ruled pull quote. */}
      <section id="heritage" className="mx-auto grid max-w-[120rem] items-center gap-10 px-5 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-2 lg:gap-16 lg:px-12 xl:px-16">
        <Reveal>
          <PhotoCard src={content.heritageImage} alt={content.heritageHeading} />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{content.heritageKicker}</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-charcoal sm:text-5xl">{content.heritageHeading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{content.heritageBody}</p>
          <blockquote className="mt-7 border-l-2 border-gold pl-5 font-serif text-2xl leading-snug text-charcoal">
            {content.editorialQuote} {content.editorialQuoteHighlight}
          </blockquote>
          <LinkButton href="/about" variant="outline" className="mt-8">
            {t("readOurStory")} <ArrowRight size={16} />
          </LinkButton>
        </Reveal>
      </section>

      {/* ---------- The Ratnavue Promise ---------- */}
      {/* The site's trust signals, right where a shopper who's just read the
          heritage story still has one real question left: "but is it
          genuine, and what if it isn't right for me?" */}
      <section id="promise" className="mx-auto max-w-[120rem] px-5 pt-20 sm:px-8 sm:pt-28 lg:px-12 xl:px-16">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{t("promiseKicker")}</p>
          <h2 className="mt-4 font-serif text-4xl text-charcoal sm:text-5xl">{t("promiseTitle")}</h2>
          <p className="mt-4 text-lg leading-relaxed text-charcoal/70">
            {t("promiseBody")}
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <TrustBar messages={trustBarMessages} variant="cards" />
        </Reveal>
      </section>

      {/* ---------- Sourcing ---------- */}
      <section id="sourcing" className="mx-auto grid max-w-[120rem] items-center gap-10 px-5 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-2 lg:gap-16 lg:px-12 xl:px-16">
        <Reveal className="order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{content.sourcingKicker}</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-charcoal sm:text-5xl">{content.sourcingHeading}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-charcoal/75">{content.sourcingBody}</p>
          <LinkButton href="/sourcing" className="mt-8">
            {t("submitSourcing")} <ArrowRight size={16} />
          </LinkButton>
        </Reveal>
        <Reveal delay={0.1} className="order-1 lg:order-2">
          <PhotoCard src={content.sourcingImage} alt={content.sourcingHeading} />
        </Reveal>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section id="closing-cta" className="mx-auto max-w-[120rem] px-5 pt-20 sm:px-8 sm:pt-28 lg:px-12 xl:px-16">
        <Reveal className="band-sapphire rounded-3xl px-6 py-10 sm:px-12 sm:py-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{content.closingKicker}</p>
              <h2 className="mt-4 font-serif text-4xl text-charcoal sm:text-5xl">{content.closingHeading}</h2>
              <p className="mt-4 text-lg text-charcoal/80">{content.closingBody}</p>
            </div>
            <LinkButton href="/configurator" size="lg" className="shrink-0 self-start md:self-auto">
              {t("openConfigurator")}
            </LinkButton>
          </div>
          {market === "lk" && <LkStrip className="mt-10 border-t border-charcoal/15 pt-8" />}
        </Reveal>
      </section>
    </div>
  );
}

function SectionHeading({ kicker, title, viewAll, href }: { kicker: string; title: string; viewAll: string; href: string }) {
  return (
    <Reveal className="mb-8 flex items-end justify-between gap-4 sm:mb-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{kicker}</p>
        <h2 className="mt-3 font-serif text-4xl text-charcoal sm:text-5xl">{title}</h2>
      </div>
      <Link href={href} className="hidden items-center gap-1.5 text-sm font-medium text-charcoal/80 transition-colors hover:text-gold-deep sm:flex">
        {viewAll} <ArrowRight size={15} />
      </Link>
    </Reveal>
  );
}

/** A real photograph in the site's rounded, hairline-framed card. */
function PhotoCard({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border-subtle bg-night">
      <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/35 to-transparent" />
    </div>
  );
}
