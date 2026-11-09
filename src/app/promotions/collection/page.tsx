import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PAGE_SEO, fill } from "@/lib/seo-copy";
import { notFound } from "next/navigation";
import { getMarket, redirectInMarket } from "@/lib/market";
import Link from "@/components/ui/MarketLink";
import { ArrowLeft } from "lucide-react";
import { getPageVisibility, marketVisibilityKey } from "@/lib/page-visibility";
import { getSeasonalContent } from "@/lib/page-content";
import { getPromotionItems, promotionItemLabel } from "@/lib/promotion-items";
import { SEASONAL_THEMES } from "@/lib/seasonal-themes";
import { FallingParticles } from "@/components/seasonal/FallingParticles";
import { WindBlownLeaves } from "@/components/seasonal/WindBlownLeaves";
import { SantaFlyby } from "@/components/seasonal/SantaFlyby";
import { PromotionItemCard } from "@/components/promotions/PromotionItemCard";

export async function generateMetadata(): Promise<Metadata> {
  const market = await getMarket();
  const visibility = await getPageVisibility(marketVisibilityKey("seasonal", market));
  if (visibility !== "LIVE") return {};
  const content = await getSeasonalContent(market);
  // An empty collection redirects to /promotions (see the page below) — and
  // because the page streams, that redirect happens client-side after a 200.
  // Keep it out of the index so the empty URL never ranks on its own.
  if ((await getPromotionItems(content.activeTheme, market)).length === 0) return { robots: { index: false, follow: true } };
  const label = SEASONAL_THEMES[content.activeTheme]?.label ?? "Promotional";
  return pageMetadata({
    title: fill(PAGE_SEO.promotionsCollection.title, { label }),
    description: fill(PAGE_SEO.promotionsCollection.description, { label }),
  });
}

export default async function PromotionsCollectionPage() {
  const market = await getMarket();
  const visibility = await getPageVisibility(marketVisibilityKey("seasonal", market));
  // Hidden reads as though this route doesn't exist either — same rule
  // as /promotions itself.
  if (visibility === "HIDDEN") notFound();
  // Coming Soon means there's genuinely nothing to browse yet — send
  // back to the hero's own teaser rather than an empty animated page.
  if (visibility === "COMING_SOON") await redirectInMarket("/promotions");

  const content = await getSeasonalContent(market);
  const theme = SEASONAL_THEMES[content.activeTheme] ?? SEASONAL_THEMES.autumn;
  const items = await getPromotionItems(content.activeTheme, market);
  // Reachable directly (a bookmarked link, back-button after an admin
  // clears the collection) even when /promotions' own button wouldn't
  // currently show — same "nothing here to show" redirect as Coming Soon.
  if (items.length === 0) await redirectInMarket("/promotions");

  return (
    // No forced min-h-dvh here — this is a content page, not a hero, so
    // its height follows the actual collection (a min-h-dvh with two
    // cards left the animated background stretching across a mostly
    // empty screen, which read as broken rather than intentional). The
    // background still covers however tall that content turns out to be.
    <div className={`relative overflow-hidden ${theme.backgroundClass}`}>
      {theme.key === "autumn" ? <WindBlownLeaves seed={theme.key.length} /> : <FallingParticles theme={theme} seed={theme.key.length} />}
      {theme.key === "winter" && <SantaFlyby />}

      {/* Anchored to the bottom of the actual content (not a fixed pixel
          offset from the top) — same placement /promotions' own hero
          uses, so it can't end up crowding the heading on a short
          collection the way a `top-*` offset did. */}
      {theme.key === "halloween" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-6 pb-6 text-4xl sm:gap-10 sm:text-6xl" aria-hidden>
          <span className="rotate-[-6deg]">🎃</span>
          <span className="translate-y-2">🎃</span>
          <span className="rotate-[8deg]">🎃</span>
          <span className="translate-y-1">🎃</span>
          <span className="rotate-[-4deg]">🎃</span>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-28 pt-28 sm:px-8 sm:pt-32">
        <Link
          href="/promotions"
          className={`inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline ${theme.bodyClass}`}
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="mt-6 text-center">
          <p className={`text-xs uppercase tracking-[0.35em] ${theme.kickerClass}`}>{theme.label} Collection</p>
          <h1 className={`mt-3 font-serif text-4xl leading-tight sm:text-5xl ${theme.headingClass}`}>
            Featured at a Special Price
          </h1>
        </div>

        {/* Centered flex-wrap with fixed-ish card widths, not a strict
            grid — a strict grid left two or three cards stranded in the
            first column(s) with a wide empty track beside them. This
            centers whatever number of cards there are as its own group,
            and still wraps into tidy rows once there are enough to fill
            them. */}
        <div className="mt-12 flex flex-wrap justify-center gap-6">
          {items.map((item) => {
            const media = item.gemstone?.media ?? item.jewelry?.media ?? [];
            const product = item.gemstone ?? item.jewelry;
            const href = item.gemstone ? `/gems/${item.gemstone.slug}` : `/jewelry/${item.jewelry!.slug}`;
            const regularPrice = product?.showPrice ? (market === "lk" ? product.lkrPrice : product.price) : null;
            return (
              <div key={item.id} className="w-[46%] min-w-[150px] sm:w-56 lg:w-64">
                <PromotionItemCard
                  name={promotionItemLabel(item)}
                  href={href}
                  imageUrl={media[0]?.url}
                  promoPrice={item.promoPrice}
                  regularPrice={regularPrice}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
