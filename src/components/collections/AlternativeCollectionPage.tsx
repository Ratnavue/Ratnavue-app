import Image from "next/image";
import type { SubcultureDef, SubcultureKey } from "@/lib/subculture-collections";
import type { SubcultureContent } from "@/lib/subculture-content";
import type { CollectionCardData } from "@/lib/subculture-items";
import { Reveal, RevealGroup, RevealItem } from "@/components/layout/Reveal";
import { LinkButton } from "@/components/ui/Button";
import { CollectionDecor } from "@/components/collections/decor/CollectionDecor";
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CrossCollectionFooter } from "@/components/collections/CrossCollectionFooter";
import { CustomJewelryRequestForm } from "@/components/collections/CustomJewelryRequestForm";
import { cn } from "@/lib/utils";

// The reusable shell every /collections/[slug] page renders through (see
// requirement #17 — a config-driven AlternativeCollectionPage rather than
// five independent page implementations). Everything that varies between
// the five subcultures arrives as data: `theme` (art direction, code-level,
// src/lib/subculture-collections.ts), `content` (admin-editable copy/
// images, src/lib/subculture-content.ts), and `items` (admin-curated
// products, SubcultureCollectionItem). Adding a sixth subculture later
// means adding entries to those two registries, not a new page component.
export function AlternativeCollectionPage({
  theme,
  content,
  items,
  liveKeys,
  slugsByKey,
  isSignedIn,
  designStudioEnabled,
}: {
  theme: SubcultureDef;
  content: SubcultureContent;
  items: CollectionCardData[];
  liveKeys: SubcultureKey[];
  /** Every collection's current public slug (admin-editable — see
   * SubcultureContent.urlSlug), for the cross-collection footer's links. */
  slugsByKey: Record<SubcultureKey, string>;
  /** Gates the "Commission a Custom Piece" section's form vs. a sign-in
   * prompt — same convention as /sourcing's SourcingForm, since a
   * submitted request needs an account to review/reply against. */
  isSignedIn: boolean;
  /** Whether an admin has turned the Design Studio (/design-studio) LIVE
   * for customers — see lib/page-visibility.ts's "design-studio" key.
   * Shows an alternative "sketch it yourself" link under this same form. */
  designStudioEnabled: boolean;
}) {
  const hasHero = Boolean(content.heroImage);

  return (
    <div className={cn("relative overflow-hidden", theme.backgroundClass)}>
      {/* ---------- Hero ---------- */}
      <section className="relative flex min-h-dvh items-end overflow-hidden">
        {hasHero && (
          <>
            <Image
              src={content.heroImageMobile || content.heroImage}
              alt={content.heroImageAlt}
              fill
              priority
              sizes="100vw"
              className="object-cover md:hidden"
            />
            <Image src={content.heroImage} alt={content.heroImageAlt} fill priority sizes="100vw" className="hidden object-cover md:block" />
          </>
        )}
        <div className={cn("absolute inset-0", theme.heroOverlayClass)} />
        <CollectionDecor theme={theme} />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-20 pt-40 text-center sm:px-8 sm:pb-28">
          <Reveal>
            <p className={cn("text-xs uppercase tracking-[0.4em]", theme.kickerClass)}>{content.heroKicker}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1
              className={cn("mt-5 font-serif text-4xl leading-[1.1] sm:text-6xl", theme.headingClass)}
              style={theme.headingFontVar ? { fontFamily: `var(${theme.headingFontVar})` } : undefined}
            >
              {content.heroHeading}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className={cn("mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg", theme.bodyClass)}>{content.heroSubtext}</p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9">
              <LinkButton href="#collection" variant={theme.buttonVariant} size="lg">
                {content.heroCtaLabel}
              </LinkButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Intro / story ---------- */}
      <section className="relative mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
        <div className={cn("grid gap-10", content.lifestyleImages[0] ? "sm:grid-cols-2 sm:items-center" : "")}>
          <Reveal>
            <div>
              <p className={cn("text-xs uppercase tracking-[0.35em]", theme.kickerClass)}>{content.introKicker}</p>
              <h2 className={cn("mt-4 font-serif text-3xl leading-tight sm:text-4xl", theme.headingClass)}>{content.introHeading}</h2>
              <p className={cn("mt-5 leading-relaxed", theme.bodyClass)}>{content.introBody}</p>
            </div>
          </Reveal>
          {content.lifestyleImages[0] && (
            <Reveal delay={0.1} y={20}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                <Image src={content.lifestyleImages[0].src} alt={content.lifestyleImages[0].alt} fill sizes="(min-width: 640px) 45vw, 90vw" className="object-cover" />
              </div>
            </Reveal>
          )}
        </div>

        {/* Editorial "gemstones we love for this look" strip — copy only,
            not a filter; the grid's own filter derives its options from
            what's actually assigned (see CollectionGrid). */}
        <Reveal delay={0.1} className="mt-14">
          <p className={cn("text-xs uppercase tracking-[0.3em] opacity-60", theme.bodyClass)}>Gemstones We Love For This Look</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {theme.preferredGemstones.map((g) => (
              <span key={g} className={cn("rounded-full border px-3.5 py-1.5 text-xs", theme.cardBorderClass, theme.bodyClass)}>
                {g}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- Banner images ---------- */}
      {content.bannerImages.length > 0 && (
        <RevealGroup className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 pb-4 sm:grid-cols-2 sm:px-8">
          {content.bannerImages.map((img, i) => (
            <RevealItem key={i} className="relative aspect-[16/9] overflow-hidden rounded-2xl">
              <Image src={img.src} alt={img.alt} fill sizes="(min-width: 640px) 45vw, 90vw" className="object-cover" />
            </RevealItem>
          ))}
        </RevealGroup>
      )}

      {/* ---------- Product grid ---------- */}
      <section id="collection" className="relative mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-8">
        <Reveal>
          <p className={cn("text-xs uppercase tracking-[0.35em]", theme.kickerClass)}>{theme.label}</p>
        </Reveal>
        <CollectionGrid items={items} theme={theme} />
      </section>

      {/* ---------- Lifestyle gallery ---------- */}
      {content.lifestyleImages.length > 1 && (
        <RevealGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 pb-20 sm:grid-cols-3 sm:px-8">
          {content.lifestyleImages.slice(1).map((img, i) => (
            <RevealItem key={i} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={img.src} alt={img.alt} fill sizes="(min-width: 640px) 30vw, 45vw" className="object-cover" />
            </RevealItem>
          ))}
        </RevealGroup>
      )}

      {/* ---------- Custom design submission ---------- */}
      <section className="relative mx-auto max-w-2xl px-5 pb-20 sm:px-8 sm:pb-28">
        <Reveal>
          <p className={cn("text-xs uppercase tracking-[0.35em]", theme.kickerClass)}>Bespoke</p>
          <h2 className={cn("mt-4 font-serif text-3xl leading-tight sm:text-4xl", theme.headingClass)}>Commission a Custom Piece</h2>
          <p className={cn("mt-4 leading-relaxed", theme.bodyClass)}>
            Have something specific in mind for this look? Describe it — attach reference images if you have them —
            and our design team will follow up with a quote.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          {isSignedIn ? (
            <CustomJewelryRequestForm theme={theme} collectionLabel={theme.label} />
          ) : (
            <div className={cn("rounded-2xl border p-6", theme.cardBorderClass)}>
              <p className={theme.bodyClass}>Sign in to submit a custom design request.</p>
              <LinkButton
                href={`/account/login?callbackUrl=%2Fcollections%2F${encodeURIComponent(content.urlSlug)}`}
                variant={theme.buttonVariant}
                className="mt-4"
              >
                Sign in
              </LinkButton>
            </div>
          )}
        </Reveal>
        {designStudioEnabled && (
          <Reveal delay={0.15} className="mt-4">
            <a href="/design-studio" className={cn("text-sm underline decoration-current/40 underline-offset-4 hover:decoration-current", theme.bodyClass)}>
              Or sketch it yourself in the Design Studio →
            </a>
          </Reveal>
        )}
      </section>

      {/* ---------- Cross-collection discovery ---------- */}
      <CrossCollectionFooter currentKey={theme.key} blurb={content.crossLinkBlurb} liveKeys={liveKeys} slugsByKey={slugsByKey} />
    </div>
  );
}
