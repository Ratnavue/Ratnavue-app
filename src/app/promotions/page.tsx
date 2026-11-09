import type { Metadata } from "next";
import { MAX_PAGE_DESCRIPTION_LENGTH, metaDescription, pageMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo-copy";
import { notFound } from "next/navigation";
import Link from "@/components/ui/MarketLink";
import { getPageVisibility, marketVisibilityKey } from "@/lib/page-visibility";
import { getMarket } from "@/lib/market";
import { getSeasonalContent } from "@/lib/page-content";
import { countPromotionItems } from "@/lib/promotion-items";
import { SEASONAL_THEMES } from "@/lib/seasonal-themes";
import { FallingParticles } from "@/components/seasonal/FallingParticles";
import { WindBlownLeaves } from "@/components/seasonal/WindBlownLeaves";
import { SantaFlyby } from "@/components/seasonal/SantaFlyby";
import { LinkButton } from "@/components/ui/Button";

export async function generateMetadata(): Promise<Metadata> {
  const market = await getMarket();
  const visibility = await getPageVisibility(marketVisibilityKey("seasonal", market));
  if (visibility === "HIDDEN") return {};
  const content = await getSeasonalContent(market);
  const copy = content.themes[content.activeTheme];
  if (visibility === "COMING_SOON") return pageMetadata(PAGE_SEO.promotionsComingSoon);
  return pageMetadata({ title: copy.heading, description: metaDescription(copy.body, MAX_PAGE_DESCRIPTION_LENGTH) });
}

export default async function PromotionsPage() {
  const market = await getMarket();
  const visibility = await getPageVisibility(marketVisibilityKey("seasonal", market));
  // HIDDEN reads as though the route doesn't exist at all — no teaser,
  // no hint of what's coming, matching a page an admin hasn't touched yet.
  if (visibility === "HIDDEN") notFound();

  const content = await getSeasonalContent(market);
  const copy = content.themes[content.activeTheme];
  const theme = SEASONAL_THEMES[content.activeTheme] ?? SEASONAL_THEMES.autumn;
  const isComingSoon = visibility === "COMING_SOON";
  // Scoped to whichever theme is currently active — the same item can
  // sit in more than one theme's collection at once (see PromotionItem),
  // but a visitor only ever sees the one collection that matches what's
  // live right now. Just a count here — the full collection (with photos
  // and pricing) lives on its own page, /promotions/collection.
  const itemCount = isComingSoon ? 0 : await countPromotionItems(content.activeTheme, market);

  return (
    // min-h-dvh (not a fixed height) — fills exactly one screen on both
    // desktop and mobile with the fixed Navbar overlapping its top edge,
    // same full-bleed treatment as the homepage hero, but grows instead
    // of clipping if an admin's own copy ever runs long on a short
    // viewport.
    <div className={`relative flex min-h-dvh items-center justify-center overflow-hidden ${theme.backgroundClass}`}>
      {/* Autumn's leaves get their own bespoke blow-then-drop motion
          instead of the generic straight fall every other season uses —
          see WindBlownLeaves' own comment. */}
      {theme.key === "autumn" ? <WindBlownLeaves seed={theme.key.length} /> : <FallingParticles theme={theme} seed={theme.key.length} />}
      {theme.key === "winter" && <SantaFlyby />}

      {/* Halloween's "other stuff" — a static row of jack-o'-lanterns
          anchored along the bottom, distinct from the falling bats above:
          pumpkins don't fall, they sit and grin. */}
      {theme.key === "halloween" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-6 pb-4 text-4xl sm:gap-10 sm:text-6xl" aria-hidden>
          <span className="rotate-[-6deg]">🎃</span>
          <span className="translate-y-2">🎃</span>
          <span className="rotate-[8deg]">🎃</span>
          <span className="translate-y-1">🎃</span>
          <span className="rotate-[-4deg]">🎃</span>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <p className={`text-xs uppercase tracking-[0.35em] ${theme.kickerClass}`}>
          {isComingSoon ? "Coming Soon" : copy.kicker}
        </p>
        <h1 className={`mt-4 font-serif text-4xl leading-tight sm:text-5xl ${theme.headingClass}`}>
          {isComingSoon ? "Something seasonal is on its way." : copy.heading}
        </h1>
        <p className={`mt-5 ${theme.bodyClass}`}>
          {isComingSoon ? "Check back soon for a limited-time collection." : copy.body}
        </p>
        {/* Its own dedicated, still-animated page — never a link an
            admin typed by hand — and only shown at all once there's
            actually something in this theme's collection to send
            someone to. */}
        {!isComingSoon && itemCount > 0 && (
          <div className="mt-8">
            <LinkButton href="/promotions/collection" variant="gold" size="lg">
              {copy.ctaLabel}
            </LinkButton>
          </div>
        )}
        {isComingSoon && (
          <div className="mt-8">
            <Link href="/" className={`text-sm underline underline-offset-4 ${theme.bodyClass}`}>
              Back to Ratnavue
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
