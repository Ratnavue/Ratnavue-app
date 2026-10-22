import Link from "@/components/ui/MarketLink";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCachedHomeContent } from "@/lib/site-config-cache";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { getWishlistedIds } from "@/lib/wishlist";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import { pricesForMarket } from "@/lib/market-pricing";
import { LinkButton } from "@/components/ui/Button";
import { GemCard } from "@/components/catalog/GemCard";
import { JewelryCard } from "@/components/catalog/JewelryCard";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { Marquee } from "@/components/layout/Marquee";
import { Reveal } from "@/components/layout/Reveal";
import { HeroSlideshow } from "@/components/layout/HeroSlideshow";
import { HeroScrollCue } from "@/components/layout/HeroScrollCue";
import { CardSlider } from "@/components/ui/CardSlider";
import { TrustBar } from "@/components/layout/TrustBar";
import { getTrustBarMessages } from "@/lib/i18n-messages";
import { LkStrip } from "@/components/layout/LkStrip";

const MINERAL_MARQUEE = [
  { label: "Blue Sapphire", color: "#3a5f9e" },
  { label: "Padparadscha", color: "#e08a5c" },
  { label: "Ruby", color: "#a4283f" },
  { label: "Alexandrite", color: "#4a7c5d" },
  { label: "Cat's Eye Chrysoberyl", color: "#b8934a" },
  { label: "Spinel", color: "#c05a82" },
  { label: "Moonstone", color: "#9fb8cc" },
  { label: "Zircon", color: "#5a9bc4" },
];

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
  const session = await auth();
  // Each storefront features its own listings only (a listing belongs to one
  // storefront) and has its own home copy (see getHomeContent).
  const [rawFeaturedGems, rawFeaturedJewelry, content, { gemstonePrices, jewelryPrices }, trustBarMessages, wishlistedIds] = await Promise.all([
    getFeaturedGemsForMarket(market),
    getFeaturedJewelryForMarket(market),
    getCachedHomeContent(market),
    getActivePromotionMaps(market),
    getTrustBarMessages(),
    getWishlistedIds(session?.user?.id),
  ]);
  const featuredGems = pricesForMarket(rawFeaturedGems, market);
  const featuredJewelry = pricesForMarket(rawFeaturedJewelry, market);

  // Each of these two sections is curated by admins (feature specific items
  // from their list pages) and independently switched on/off from Home Page
  // content — either can be absent, so the hero's scroll cue can't hardcode
  // which section comes next. It targets the first one that actually rendered.
  const showFeaturedGems = content.showFeaturedGems && featuredGems.length > 0;
  const showFeaturedJewelry = content.showFeaturedJewelry && featuredJewelry.length > 0;
  const heroNextSection = showFeaturedGems ? "featured" : showFeaturedJewelry ? "featured-jewelry" : "editorial";

  return (
    <div>
      {/* ---------- Hero ---------- */}
      {/*
        `h-dvh`, not `h-screen`: on iOS/Android, 100vh is sized against the
        largest possible viewport (as if browser chrome were hidden), not
        the viewport actually visible on load — so a `100vh` hero either
        shows a sliver of the next section under the address bar, or looks
        short once the chrome collapses. `dvh` tracks the real, current
        viewport instead. The `lg:max-h` cap only kicks in at `lg`+ (desktop)
        and only for genuinely oversized monitors — it exists purely to stop
        the hero ballooning on ultra-tall displays, not to clip it on
        ordinary ~900-1100px desktop viewport heights, which a lower cap
        here was doing.

        `min-h-[720px]` is scoped to `sm:` and up, not applied on narrow
        phones: it exists to keep the hero from looking cramped on a short
        landscape/small-window viewport, but on an actual portrait phone
        (an iPhone SE's 375×667 dvh, say) it does the opposite — 720 is
        taller than the real viewport, so `items-center` centers the
        content around the section's own midpoint rather than the
        viewport's, and the second CTA button ends up partly below the
        fold. The hero's own content (~520px stacked) already fits a
        667px dvh comfortably on its own; the floor just isn't needed
        there.
      */}
      <section id="hero" className="relative flex h-dvh w-full items-center overflow-hidden bg-charcoal sm:min-h-[720px] lg:max-h-[1100px]">
        <HeroSlideshow images={content.heroSlides} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(33,29,26,0.97) 0%, rgba(33,29,26,0.88) 32%, rgba(33,29,26,0.55) 58%, rgba(33,29,26,0.25) 100%)",
          }}
        />

        {/* Mobile sizing (pt-10/text-4xl/mt-4/mt-6, and the two CTA
            buttons' own shrunk padding/text below, all overridden back to
            the original values at sm: and up) isn't just cosmetic — a real
            phone's dvh on first load is smaller than its "full" size (the
            browser's address bar is visible until the user scrolls), so
            the full-size stack below could still run into the CTA row on
            an actual device even once the hero's own min-height stopped
            forcing it past the viewport (see the sm:min-h-[720px] note
            above). Measured against a 600px dvh — a realistic small-state
            height, not just the 667px "full" one — with real headroom to
            spare, not just barely fitting. The buttons specifically: at
            their default `lg` size, "Design Your Gem" and "Shop
            Gemstones" together don't fit a ~375px phone's width side by
            side, so flex-wrap drops the second one to its own line —
            harmless on its own, but that's ~75px of extra height the
            short-viewport math above doesn't have to spare. */}
        <div className="relative mx-auto w-full max-w-[120rem] px-5 pt-10 sm:px-8 sm:pt-16 lg:px-12 xl:px-16">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-gold-soft">{content.heroKicker}</p>
            <h1 className="mt-4 font-serif text-4xl leading-[1.05] text-ivory sm:mt-5 sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              {content.heroHeadingLine1}
              <br />
              {content.heroHeadingLine2}
              <br />
              <span className="text-gold-soft">{content.heroHeadingHighlight}</span>
            </h1>
            <p className="mt-4 max-w-md text-ivory/60 sm:mt-7">{content.heroSubtext}</p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
              <LinkButton href="/configurator" variant="gold" size="lg" className="px-5 py-2.5 text-sm sm:px-8 sm:py-4 sm:text-base">
                Design Your Gem
              </LinkButton>
              <LinkButton href="/gems" variant="outline-light" size="lg" className="px-5 py-2.5 text-sm sm:px-8 sm:py-4 sm:text-base">
                Shop Gemstones
              </LinkButton>
            </div>
          </div>
        </div>

        <HeroScrollCue target={heroNextSection} />
      </section>

      {/* ---------- Marquee ---------- */}
      <div className="py-5 text-charcoal">
        <Marquee items={MINERAL_MARQUEE} />
      </div>

      {market === "lk" && <LkStrip />}

      {/* ---------- Featured Gemstones ---------- */}
      {/* Curated, not automatic: admins mark items Gemstone.isFeatured from
          /admin/gems (star on each row), and the whole section can be
          switched off from Home Page content regardless of how many items
          are marked — see showFeaturedGems above. */}
      {showFeaturedGems && (
        <section id="featured" className="relative mx-auto flex w-full max-w-[120rem] flex-col justify-center px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal className="mb-8 flex items-end justify-between sm:mb-14">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">Hand-Selected</p>
              <h2 className="mt-3 font-serif text-4xl text-charcoal sm:text-5xl">Featured Gemstones</h2>
            </div>
            <Link href="/gems" className="hidden text-sm text-charcoal/70 underline decoration-charcoal/30 underline-offset-4 hover:text-charcoal sm:block">
              View all
            </Link>
          </Reveal>
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
        <section id="featured-jewelry" className="relative mx-auto flex w-full max-w-[120rem] flex-col justify-center px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal className="mb-8 flex items-end justify-between sm:mb-14">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">Hand-Selected</p>
              <h2 className="mt-3 font-serif text-4xl text-charcoal sm:text-5xl">Featured Jewelry</h2>
            </div>
            <Link href="/jewelry" className="hidden text-sm text-charcoal/70 underline decoration-charcoal/30 underline-offset-4 hover:text-charcoal sm:block">
              View all
            </Link>
          </Reveal>
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

      {/* ---------- Editorial statement ---------- */}
      <section id="editorial" className="relative flex items-center bg-gradient-to-b from-midnight via-charcoal to-midnight py-20 sm:py-32">
        <Reveal className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <p className="font-serif text-3xl leading-snug text-ivory sm:text-5xl">
            &ldquo;{content.editorialQuote} <span className="text-gold-soft">{content.editorialQuoteHighlight}</span>&rdquo;
          </p>
          <div className="mx-auto mt-8 h-px w-16 bg-gold" />
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-ivory/45">{content.editorialAttribution}</p>
        </Reveal>
      </section>

      {/* ---------- Heritage / Sourcing ---------- */}
      {/* Edge-to-edge split — no gap, no rounded corners, no card shadow —
          and text anchored at the bottom with an upward dark-to-clear
          scrim, rather than the earlier rounded-card / left-anchored
          treatment. Side by side at lg+ (one row, so both panels share the
          same full-viewport height); stacked below that. Each panel is
          h-dvh at sm+ (not a fixed rem height). */}
      <section id="heritage-sourcing" className="relative lg:grid lg:grid-cols-2">
        <Reveal className="relative h-[80dvh] min-h-[460px] w-full overflow-hidden bg-charcoal sm:h-dvh sm:min-h-[520px] lg:max-h-[1100px]">
          <Image src={content.heritageImage} alt={content.heritageHeading} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(0deg, rgba(20,17,14,0.92) 10%, rgba(20,17,14,0.15) 65%, transparent 100%)" }}
          />
          <div className="relative flex h-full flex-col justify-end px-8 pb-12 sm:px-12 lg:px-14">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{content.heritageKicker}</p>
            <h2 className="mt-3 max-w-md font-serif text-3xl text-ivory sm:text-4xl">{content.heritageHeading}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-ivory/70">{content.heritageBody}</p>
            <Link
              href="/about"
              className="mt-6 inline-flex w-fit items-center text-xs font-bold uppercase tracking-wide text-gold-soft transition-colors hover:text-ivory"
            >
              Read Our Story →
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="relative h-[80dvh] min-h-[460px] w-full overflow-hidden bg-charcoal sm:h-dvh sm:min-h-[520px] lg:max-h-[1100px]">
          <Image src={content.sourcingImage} alt={content.sourcingHeading} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(0deg, rgba(20,17,14,0.92) 10%, rgba(20,17,14,0.15) 65%, transparent 100%)" }}
          />
          <div className="relative flex h-full flex-col justify-end px-8 pb-12 sm:px-12 lg:px-14">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{content.sourcingKicker}</p>
            <h2 className="mt-3 max-w-md font-serif text-3xl text-ivory sm:text-4xl">{content.sourcingHeading}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-ivory/70">{content.sourcingBody}</p>
            <Link
              href="/sourcing"
              className="mt-6 inline-flex w-fit items-center text-xs font-bold uppercase tracking-wide text-gold-soft transition-colors hover:text-ivory"
            >
              Submit a Sourcing Request →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---------- The Ratnavue Promise ---------- */}
      {/* A dedicated beat for the site's trust signals, right where a
          shopper who's just read the heritage story and is warming up to
          the closing CTA still has one real question left: "but is it
          genuine, and what if it isn't right for me?" Answers it before
          they ever have to ask. */}
      <section id="promise" className="relative flex w-full flex-col justify-center px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <Reveal className="mx-auto max-w-5xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">The Ratnavue Promise</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-serif text-4xl text-charcoal sm:text-5xl">
            Buy with complete confidence.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-charcoal/65">
            A gemstone is a once-in-a-lifetime purchase for most people who make one — every stone and setting we
            sell is backed by the same four commitments, no exceptions.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mx-auto mt-10 w-full max-w-5xl sm:mt-14">
          <TrustBar messages={trustBarMessages} />
        </Reveal>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section id="closing-cta" className="relative flex items-center overflow-hidden bg-gradient-to-br from-midnight via-charcoal to-charcoal py-20 sm:py-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(50% 60% at 50% 100%, rgba(179,145,90,0.18), transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-4xl items-center gap-10 px-5 text-center sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-16 lg:text-left">
          <Reveal className="order-2 lg:order-1">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{content.closingKicker}</p>
            <h2 className="mt-4 font-serif text-4xl text-ivory sm:text-5xl">{content.closingHeading}</h2>
            <p className="mt-5 text-ivory/60">{content.closingBody}</p>
            <div className="mt-9">
              <LinkButton href="/configurator" variant="gold" size="lg">Open the Configurator</LinkButton>
            </div>
          </Reveal>
          {/* A small showcase of the visualizer itself — the same procedural
              renderer used across the catalog and configurator, now with
              real per-facet shading (see gem-visualizer commit) rather than
              the flat "flower" look it used to have. */}
          <Reveal delay={0.1} className="animate-gem-color-wave order-1 mx-auto w-44 sm:w-56 lg:order-2 lg:w-64">
            <GemVisualizer
              cutSlug="round-brilliant"
              hue={221}
              darkness={42}
              claritySlug="loupe-clean"
              caratWeight={2.5}
              seedKey="closing-cta-showcase"
              className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
            />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
