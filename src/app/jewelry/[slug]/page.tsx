import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/MarketLink";
import { Sparkles } from "lucide-react";
import { getJewelryBySlug, getRelatedJewelry } from "@/lib/catalog";
import { auth } from "@/lib/auth";
import { getActivePromotion, getActivePromotionMaps } from "@/lib/promotion-items";
import { StorefrontStockBadge as StockBadge } from "@/components/catalog/StorefrontStockBadge";
import { QuoteRequestPanel } from "@/components/quote/QuoteRequestPanel";
import { MediaGallery } from "@/components/catalog/MediaGallery";
import { ArTryOnButton } from "@/components/ar/ArTryOnButton";
import { ProductPrice } from "@/components/catalog/ProductPrice";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { CompleteTheLookPanel } from "@/components/catalog/CompleteTheLookPanel";
import { getWishlistedIds } from "@/lib/wishlist";
import { getBundlesForItem } from "@/lib/bundles";
import { JewelryVariantPicker } from "@/components/catalog/JewelryVariantPicker";
import { JewelryCard } from "@/components/catalog/JewelryCard";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/layout/Reveal";
import { TrustBar } from "@/components/layout/TrustBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AUDIENCE_LABELS, pieceTypeLabel as pieceTypeText, type JewelryAudienceSlug } from "@/lib/jewelry-categories";
import { CardSlider } from "@/components/ui/CardSlider";
import { HeritageSideArt } from "@/components/catalog/HeritageSideArt";
import { StickyBuyBar } from "@/components/catalog/StickyBuyBar";
import { getTrustBarMessages } from "@/lib/i18n-messages";
import { getApprovedReviewsForItem } from "@/lib/reviews";
import { RatingSummaryLine, ReviewsSection } from "@/components/catalog/ReviewsSection";
import { formatPrice } from "@/lib/utils";
import { getMarket } from "@/lib/market";
import { getTranslations } from "next-intl/server";
import { MARKETS } from "@/lib/market-shared";

const METAL_LABELS: Record<string, string> = {
  GOLD: "Gold",
  WHITE_GOLD: "White Gold",
  ROSE_GOLD: "Rose Gold",
  PLATINUM: "Platinum",
  SILVER: "Silver",
};

export async function generateMetadata({ params }: PageProps<"/jewelry/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const piece = await getJewelryBySlug(slug, await getMarket());
  if (!piece) return {};
  return { title: piece.name, description: piece.description ?? undefined };
}

export default async function JewelryDetailPage({ params }: PageProps<"/jewelry/[slug]">) {
  const { slug } = await params;
  const market = await getMarket();
  const [piece, session, t] = await Promise.all([getJewelryBySlug(slug, market), auth(), getTranslations("product")]);

  if (!piece || !piece.isPublished) notFound();

  const [promotion, relatedJewelry, { jewelryPrices }, trustBarMessages, wishlistedIds, bundles, reviewSummary] = await Promise.all([
    getActivePromotion({ jewelryId: piece.id }, market),
    getRelatedJewelry(piece, 4, market),
    getActivePromotionMaps(market),
    getTrustBarMessages(),
    getWishlistedIds(session?.user?.id),
    getBundlesForItem(piece.id, market),
    getApprovedReviewsForItem({ jewelryId: piece.id }),
  ]);

  const pieceTypeLabel = pieceTypeText(piece.pieceType);
  const audienceSlug = piece.audience.toLowerCase() as JewelryAudienceSlug;
  // Same price precedence CardPrice/ProductPrice use for display — see
  // StickyBuyBar's own comment for why this is a plain label. basePrice
  // (no promotion layer) is the buy-box's own "is there actually a price
  // to buy at" gate and the variant picker's per-variant fallback —
  // using displayPrice there would silently pass a promo price down as
  // if it were every un-priced variant's own base price.
  const basePrice = piece.retailPrice ?? (piece.showPrice ? piece.price : null);
  const displayPrice = promotion?.promoPrice ?? basePrice;
  const stickyPriceLabel = displayPrice != null ? formatPrice(displayPrice, MARKETS[market].currency) : t("requestQuote");

  return (
    <div className="relative overflow-hidden">
      <HeritageSideArt side="left" className="absolute left-0 top-0 h-full w-48" />
      <HeritageSideArt side="right" className="absolute right-0 top-0 h-full w-48" />
      <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("jewelry"), href: "/jewelry" },
          { label: AUDIENCE_LABELS[audienceSlug], href: `/jewelry?audience=${audienceSlug}` },
          { label: pieceTypeLabel, href: `/jewelry?audience=${audienceSlug}&pieceType=${piece.pieceType}` },
          { label: piece.name },
        ]}
      />
      <div className="grid gap-12 lg:grid-cols-2">
        <Reveal y={16}>
          <MediaGallery media={piece.media} fallbackLabel={piece.name} />
          {(piece.pieceType === "NECKLACE" || piece.pieceType === "PENDANT") && <ArTryOnButton modelUrl={piece.arModelUrl} pieceName={piece.name} />}
        </Reveal>

        <Reveal delay={0.1} y={16}>
          <div className="flex items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-gold-deep">{pieceTypeLabel}</p>
            <StockBadge status={piece.stockStatus} />
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="font-serif text-4xl text-charcoal">{piece.name}</h1>
            <WishlistButton jewelryId={piece.id} initialSaved={wishlistedIds.has(piece.id)} isAuthenticated={!!session?.user} className="mt-1 shrink-0 bg-ivory-soft" />
          </div>
          <div className="mt-1"><RatingSummaryLine summary={reviewSummary} /></div>
          <ProductPrice price={piece.price} showPrice={piece.showPrice} retailPrice={piece.retailPrice} promotion={promotion} />
          {piece.description && <p className="mt-4 leading-relaxed text-charcoal/70">{piece.description}</p>}

          {/* Same honest "won't be restocked" reasoning as the gem detail
              page — JewelryPiece rows have no quantity field either. Not
              shown for a piece with variants: several of those can be
              available at once, so "the only one" wouldn't be true. */}
          {piece.stockStatus === "AVAILABLE" && piece.variants.length === 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gold-deep">
              <Sparkles size={13} /> {t("onlyOneJewelry")}
            </p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border-subtle py-6">
            <Spec label={t("spec.metal")} value={METAL_LABELS[piece.metalType]} />
            {piece.metalPurity && <Spec label={t("spec.purity")} value={piece.metalPurity} />}
            {piece.metalWeightG && <Spec label={t("spec.metalWeight")} value={`${piece.metalWeightG} g`} />}
            {piece.ringSize && <Spec label={t("spec.ringSize")} value={piece.ringSize} />}
            {piece.styleTags.length > 0 && <Spec label={t("spec.style")} value={piece.styleTags.join(", ")} />}
          </dl>

          <Link href={`/size-guide${sizeGuideAnchor(piece.pieceType)}`} className="mt-3 inline-block text-xs text-charcoal/65 underline-offset-2 hover:text-charcoal hover:underline">
            {t("sizeGuide")} →
          </Link>

          {piece.gemstones.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-charcoal/65">{t("gemstonesSet")}</p>
              <ul className="mt-2 space-y-1">
                {piece.gemstones.map((link) => (
                  <li key={link.id} className="text-sm text-charcoal/75">
                    {link.gemstone ? (
                      <Link href={`/gems/${link.gemstone.slug}`} className="underline hover:text-charcoal">
                        {link.gemstone.name}
                      </Link>
                    ) : (
                      link.freeformDesc
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div id="buy-box">
            {basePrice != null && (
              <div className="mt-8">
                {session?.user ? (
                  piece.variants.length > 0 ? (
                    <JewelryVariantPicker jewelryId={piece.id} variants={piece.variants} basePrice={basePrice} />
                  ) : (
                    <AddToCartButton jewelryId={piece.id} />
                  )
                ) : (
                  <div>
                    <p className="text-sm text-charcoal/75">{t("signInToAddPrompt", { name: piece.name })}</p>
                    <Link href={`/account/login?callbackUrl=${encodeURIComponent(`/jewelry/${piece.slug}`)}`}>
                      <Button variant="primary" className="mt-3">{t("signInToAdd")}</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8">
              <QuoteRequestPanel isAuthenticated={!!session?.user} jewelryId={piece.id} productLabel={piece.name} />
            </div>
          </div>

          {bundles.map((bundle) => (
            <CompleteTheLookPanel key={bundle.id} bundle={bundle} currency={MARKETS[market].currency} isAuthenticated={!!session?.user} />
          ))}

          <ReviewsSection summary={reviewSummary} />

          <TrustBar messages={trustBarMessages} variant="compact" className="mt-8 border-t border-border-subtle pt-6" />
        </Reveal>
      </div>

      {relatedJewelry.length > 0 && (
        <Reveal className="mt-20 border-t border-border-subtle pt-14 sm:mt-28 sm:pt-16">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">{t("moreFrom")}</p>
          <h2 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">{t("youMayLove")}</h2>
          <div className="mt-8">
            <CardSlider>
              {relatedJewelry.map((related) => (
                <div key={related.id} className="w-[calc(50%-12px)] shrink-0 snap-start sm:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]">
                  <JewelryCard
                    id={related.id}
                    isWishlisted={wishlistedIds.has(related.id)}
                    isAuthenticated={!!session?.user}
                    slug={related.slug}
                    name={related.name}
                    pieceType={related.pieceType}
                    metalType={related.metalType}
                    stockStatus={related.stockStatus}
                    primaryImageUrl={related.media.find((m) => m.isPrimary)?.url ?? related.media[0]?.url}
                    price={related.price}
                    showPrice={related.showPrice}
                    retailPrice={related.retailPrice}
                    promoPrice={jewelryPrices.get(related.id)}
                  />
                </div>
              ))}
            </CardSlider>
          </div>
        </Reveal>
      )}
      </div>
      <StickyBuyBar name={piece.name} priceLabel={stickyPriceLabel} />
    </div>
  );
}

function sizeGuideAnchor(pieceType: string): string {
  if (pieceType === "RING") return "#rings";
  if (pieceType === "NECKLACE" || pieceType === "PENDANT") return "#necklaces";
  if (pieceType === "BRACELET") return "#bracelets";
  return "";
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-charcoal/65">{label}</dt>
      <dd className="mt-0.5 text-sm text-charcoal">{value}</dd>
    </div>
  );
}
