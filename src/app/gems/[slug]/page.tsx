import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "@/components/ui/MarketLink";
import { ShieldCheck, FileText, ExternalLink, Sparkles } from "lucide-react";
import { getGemstoneBySlug, getRelatedGemstones } from "@/lib/catalog";
import { auth } from "@/lib/auth";
import { getActivePromotion, getActivePromotionMaps } from "@/lib/promotion-items";
import { buildCertVerifyUrl } from "@/lib/utils";
import { StorefrontStockBadge as StockBadge } from "@/components/catalog/StorefrontStockBadge";
import { QuoteRequestPanel } from "@/components/quote/QuoteRequestPanel";
import { MediaGallery } from "@/components/catalog/MediaGallery";
import { ProductPrice } from "@/components/catalog/ProductPrice";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { CompleteTheLookPanel } from "@/components/catalog/CompleteTheLookPanel";
import { getWishlistedIds } from "@/lib/wishlist";
import { getBundlesForItem } from "@/lib/bundles";
import { GemCard } from "@/components/catalog/GemCard";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/layout/Reveal";
import { TrustBar } from "@/components/layout/TrustBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CardSlider } from "@/components/ui/CardSlider";
import { HeritageSideArt } from "@/components/catalog/HeritageSideArt";
import { StickyBuyBar } from "@/components/catalog/StickyBuyBar";
import { getTrustBarMessages } from "@/lib/i18n-messages";
import { getOriginContent } from "@/lib/origin-content";
import { getApprovedReviewsForItem } from "@/lib/reviews";
import { RatingSummaryLine, ReviewsSection } from "@/components/catalog/ReviewsSection";
import { formatPrice } from "@/lib/utils";
import { getMarket } from "@/lib/market";
import { getTranslations } from "next-intl/server";
import { MARKETS } from "@/lib/market-shared";

export async function generateMetadata({ params }: PageProps<"/gems/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const gem = await getGemstoneBySlug(slug, await getMarket());
  if (!gem) return {};
  return {
    title: gem.name,
    description: gem.description ?? `${gem.mineral.name}, ${gem.caratWeight}ct ${gem.cut.name} — Ceylon gemstone by Ratnavue.`,
  };
}

export default async function GemDetailPage({ params }: PageProps<"/gems/[slug]">) {
  const { slug } = await params;
  const market = await getMarket();
  const [gem, session, t] = await Promise.all([getGemstoneBySlug(slug, market), auth(), getTranslations("product")]);

  if (!gem || !gem.isPublished) notFound();

  const [promotion, relatedGems, { gemstonePrices }, trustBarMessages, wishlistedIds, originContent, bundles, reviewSummary] = await Promise.all([
    getActivePromotion({ gemstoneId: gem.id }, market),
    getRelatedGemstones(gem, 4, market),
    getActivePromotionMaps(market),
    getTrustBarMessages(),
    getWishlistedIds(session?.user?.id),
    getOriginContent(gem.originId),
    getBundlesForItem(gem.id, market),
    getApprovedReviewsForItem({ gemstoneId: gem.id }),
  ]);

  const dimensions = [gem.lengthMm, gem.widthMm, gem.depthMm].filter(Boolean).join(" x ");
  const verifyUrl = buildCertVerifyUrl(gem.certLab?.verifyUrlTemplate, gem.certReportNumber);
  // Same price precedence CardPrice/ProductPrice use for display — see
  // StickyBuyBar's own comment for why this is a plain label rather than
  // reusing ProductPrice itself (that component isn't meant for a compact bar).
  const displayPrice = promotion?.promoPrice ?? gem.retailPrice ?? (gem.showPrice ? gem.price : null);
  const stickyPriceLabel = displayPrice != null ? formatPrice(displayPrice, MARKETS[market].currency) : t("requestQuote");

  return (
    <div className="relative overflow-hidden">
      {/* On a wide desktop viewport, the max-w-6xl content column leaves a
          lot of bare ivory in the side gutters — filled with Sri Lankan
          heritage linework rather than a plain colour wash (see
          HeritageSideArt's own comment for the motif). */}
      <HeritageSideArt side="left" className="absolute left-0 top-0 h-full w-48" />
      <HeritageSideArt side="right" className="absolute right-0 top-0 h-full w-48" />
      <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("gems"), href: "/gems" },
          { label: gem.mineral.name, href: `/gems?mineral=${gem.mineral.slug}` },
          { label: gem.name },
        ]}
      />
      <div className="grid gap-12 lg:grid-cols-2">
        <Reveal y={16}>
          <MediaGallery media={gem.media} fallbackLabel={gem.name} />
        </Reveal>

        <Reveal delay={0.1} y={16}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-gold-deep">{gem.mineral.name}</p>
            <StockBadge status={gem.stockStatus} />
            {gem.origin.isCeylon && (
              <span className="rounded-full bg-charcoal/85 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-ivory">
                {t("ceylonOrigin")}
              </span>
            )}
            {gem.certLab && <CertifiedBadge lab={gem.certLab} />}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="font-serif text-4xl text-charcoal">{gem.name}</h1>
            <WishlistButton gemstoneId={gem.id} initialSaved={wishlistedIds.has(gem.id)} isAuthenticated={!!session?.user} className="mt-1 shrink-0 bg-ivory-soft" />
          </div>
          <div className="mt-1"><RatingSummaryLine summary={reviewSummary} /></div>
          <ProductPrice price={gem.price} showPrice={gem.showPrice} retailPrice={gem.retailPrice} promotion={promotion} />
          {gem.description && <p className="mt-4 leading-relaxed text-charcoal/70">{gem.description}</p>}

          {/* Honest urgency, not a manufactured countdown: Gemstone rows
              carry no quantity field (see schema.prisma), so this really is
              the one and only piece — once it sells, the listing is gone
              for good, not restocked. */}
          {gem.stockStatus === "AVAILABLE" && (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gold-deep">
              <Sparkles size={13} /> {t("onlyOne")}
            </p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border-subtle py-6">
            <Spec label={t("spec.cut")} value={gem.cut.name} />
            <Spec label={t("spec.caratWeight")} value={`${gem.caratWeight} ct`} />
            {dimensions && <Spec label={t("spec.dimensions")} value={`${dimensions} mm`} />}
            <Spec label={t("spec.colour")} value={gem.colorLabel ?? "—"} />
            <Spec label={t("spec.clarity")} value={gem.clarityGrade.name} hint={gem.clarityGrade.description} />
            <Spec label={t("spec.treatment")} value={gem.treatment.name} />
            <Spec label={t("spec.origin")} value={gem.origin.name} />
            {gem.variety && <Spec label={t("spec.variety")} value={gem.variety} />}
            {gem.symmetryNotes && <Spec label={t("spec.symmetry")} value={gem.symmetryNotes} />}
            {(gem.certLab || gem.certReportNumber) && (
              <Spec label={t("spec.certification")} value={[gem.certLab?.name, gem.certReportNumber].filter(Boolean).join(" · ")} />
            )}
          </dl>

          {(verifyUrl || gem.certFileUrl) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {verifyUrl && (
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-4 py-2 text-xs font-medium text-charcoal/80 transition-colors hover:border-gold hover:text-charcoal"
                >
                  <ShieldCheck size={14} /> {t("verifyCertificate")} <ExternalLink size={12} />
                </a>
              )}
              {gem.certFileUrl && (
                <a
                  href={gem.certFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-4 py-2 text-xs font-medium text-charcoal/80 transition-colors hover:border-gold hover:text-charcoal"
                >
                  <FileText size={14} /> {t("viewCertificate")}
                </a>
              )}
            </div>
          )}

          <div id="buy-box">
            {gem.retailPrice != null && (
              <div className="mt-8">
                {session?.user ? (
                  <AddToCartButton gemstoneId={gem.id} />
                ) : (
                  <div>
                    <p className="text-sm text-charcoal/75">{t("signInToAddPrompt", { name: gem.name })}</p>
                    <Link href={`/account/login?callbackUrl=${encodeURIComponent(`/gems/${gem.slug}`)}`}>
                      <Button variant="primary" className="mt-3">{t("signInToAdd")}</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8">
              <QuoteRequestPanel
                isAuthenticated={!!session?.user}
                gemstoneId={gem.id}
                productLabel={gem.name}
              />
            </div>
          </div>

          {bundles.map((bundle) => (
            <CompleteTheLookPanel key={bundle.id} bundle={bundle} currency={MARKETS[market].currency} isAuthenticated={!!session?.user} />
          ))}

          <ReviewsSection summary={reviewSummary} />

          <TrustBar messages={trustBarMessages} variant="compact" className="mt-8 border-t border-border-subtle pt-6" />
        </Reveal>
      </div>

      {originContent.headline && (
        <Reveal className="mt-20 border-t border-border-subtle pt-14 sm:mt-28 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
            {originContent.image && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src={originContent.image} alt={originContent.imageAlt} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">{t("spec.origin")}</p>
              <h2 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">{originContent.headline}</h2>
              {originContent.body && <p className="mt-4 max-w-2xl leading-relaxed text-charcoal/70">{originContent.body}</p>}
            </div>
          </div>
        </Reveal>
      )}

      {relatedGems.length > 0 && (
        <Reveal className="mt-20 border-t border-border-subtle pt-14 sm:mt-28 sm:pt-16">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">{t("moreFrom")}</p>
          <h2 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">{t("youMayLove")}</h2>
          <div className="mt-8">
            <CardSlider>
              {relatedGems.map((related) => (
                <div key={related.id} className="w-[calc(50%-12px)] shrink-0 snap-start sm:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]">
                  <GemCard
                    id={related.id}
                    isWishlisted={wishlistedIds.has(related.id)}
                    isAuthenticated={!!session?.user}
                    slug={related.slug}
                    name={related.name}
                    mineralName={related.mineral.name}
                    cutSlug={related.cut.slug}
                    cutName={related.cut.name}
                    caratWeight={related.caratWeight}
                    colorHue={related.colorHue}
                    colorLightness={related.colorLightness}
                    claritySlug={related.clarityGrade.slug}
                    clarityName={related.clarityGrade.name}
                    treatmentName={related.treatment.name}
                    isCeylon={related.origin.isCeylon}
                    stockStatus={related.stockStatus}
                    primaryImageUrl={related.media.find((m) => m.isPrimary)?.url ?? related.media[0]?.url}
                    price={related.price}
                    showPrice={related.showPrice}
                    retailPrice={related.retailPrice}
                    promoPrice={gemstonePrices.get(related.id)}
                  />
                </div>
              ))}
            </CardSlider>
          </div>
        </Reveal>
      )}
      </div>
      <StickyBuyBar name={gem.name} priceLabel={stickyPriceLabel} />
    </div>
  );
}

function Spec({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-charcoal/65">{label}</dt>
      <dd className="mt-0.5 text-sm text-charcoal">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-charcoal/65">{hint}</p>}
    </div>
  );
}

// Trust badge shown whenever a gem has a certification lab attached — the
// lab's own logo if one's been uploaded (Certification Labs admin page),
// falling back to a generic shield icon so the badge still reads correctly
// for labs nobody's gotten around to adding a logo for yet. Clickable
// through to the lab's website when one is on file.
function CertifiedBadge({ lab }: { lab: { name: string; logoUrl: string | null; websiteUrl: string | null } }) {
  const content = (
    <>
      {lab.logoUrl ? (
        <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm bg-white">
          <Image src={lab.logoUrl} alt="" fill className="object-contain" sizes="16px" />
        </span>
      ) : (
        <ShieldCheck size={13} />
      )}
      Certified by {lab.name}
    </>
  );
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-charcoal/80 transition-colors hover:border-gold";

  if (lab.websiteUrl) {
    return (
      <a href={lab.websiteUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return <span className={className}>{content}</span>;
}
