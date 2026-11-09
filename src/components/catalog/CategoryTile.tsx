import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "@/components/ui/MarketLink";
import { LinkButton } from "@/components/ui/Button";
import { GemStage, StylizedGem, type StylizedGemShape } from "@/components/gem-visualizer/StylizedGem";
import { cn } from "@/lib/utils";

// Fallback art for a category with no photo yet (a fresh catalog, a new type).
const FALLBACK_GEM_COLOR = "#5b7cc9";

/**
 * One card in a "browse by category" grid (gems and jewelry alike): the
 * category's real cover photo on top, then its name, how many pieces are in
 * it, and a round arrow. Server-rendered, plain link.
 *
 * The photo is the newest imaged listing in the category (see
 * getGemCategories / getJewelryCategoryData). Only when a category has no
 * photo at all does the stage fall back to the stylised gem art, tinted with
 * the stone's own colour when one is given.
 */
export function CategoryTile({
  href,
  label,
  countLabel,
  description,
  image,
  gemColor,
  gemShape = "oval",
}: {
  href: string;
  label: string;
  countLabel?: string;
  description?: string;
  image: string | null;
  /** Colour for the fallback gem art (the mineral's own colour on /gems). */
  gemColor?: string;
  gemShape?: StylizedGemShape;
}) {
  const fallbackColor = gemColor ?? FALLBACK_GEM_COLOR;
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-xl hover:shadow-night/20"
    >
      <div className="relative aspect-[5/4.4] overflow-hidden bg-ivory-soft">
        {image ? (
          <Image
            src={image}
            alt={label}
            fill
            sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 32vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <GemStage color={fallbackColor} className="absolute inset-0 flex items-center justify-center">
            <StylizedGem color={fallbackColor} shape={gemShape} className="w-[54%] translate-y-[4%] transition-transform duration-500 group-hover:scale-105" />
          </GemStage>
        )}
      </div>
      <div className="flex flex-1 items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="truncate font-serif text-xl text-charcoal sm:text-[1.75rem] sm:leading-tight">{label}</p>
          {countLabel && <p className="mt-0.5 text-sm text-charcoal/65">{countLabel}</p>}
          {description && <p className="mt-1 line-clamp-2 text-xs text-charcoal/65">{description}</p>}
        </div>
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-subtle text-charcoal transition-colors group-hover:border-gold group-hover:text-gold-deep sm:flex">
          <ArrowUpRight size={17} />
        </span>
      </div>
    </Link>
  );
}

export function CategoryGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

/** The landing pages' header: kicker, title and intro, with the gold
 * "view everything" button on the right (shared by /gems and /jewelry). */
export function CategoryLandingHeader({
  kicker,
  title,
  intro,
  viewAllHref,
  viewAllLabel,
}: {
  kicker: string;
  title: string;
  intro: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="mb-10 flex flex-col gap-6 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{kicker}</p>
        <h1 className="mt-3 font-serif text-5xl text-charcoal sm:text-6xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-charcoal/75">{intro}</p>
      </div>
      {viewAllHref && viewAllLabel && (
        <LinkButton href={viewAllHref} size="lg" className="shrink-0 self-start lg:self-auto">
          {viewAllLabel}
          <ArrowRight size={18} />
        </LinkButton>
      )}
    </div>
  );
}

/** The sapphire band under a landing grid — the way out when the catalog
 * doesn't have it. */
export function CategoryLandingBanner({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className={cn("band-sapphire mt-14 flex flex-col gap-6 rounded-3xl px-6 py-10 sm:px-12 sm:py-12 md:flex-row md:items-center md:justify-between")}>
      <div>
        <h2 className="font-serif text-3xl text-charcoal sm:text-4xl">{title}</h2>
        <p className="mt-3 text-charcoal/85">{body}</p>
      </div>
      <LinkButton href={href} size="lg" className="shrink-0 self-start md:self-auto">
        {cta}
      </LinkButton>
    </div>
  );
}
