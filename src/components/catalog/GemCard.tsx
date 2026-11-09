import Link from "@/components/ui/MarketLink";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { StorefrontStockBadge as StockBadge } from "@/components/catalog/StorefrontStockBadge";
import { CardPrice, PromotionBadge } from "@/components/catalog/CardPrice";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { SpecialtyBadges } from "@/components/catalog/SpecialtyBadges";
import { cn } from "@/lib/utils";

interface GemCardProps {
  /** Needed only for the wishlist heart button — omit it (or leave
   * isAuthenticated false) to render the card without one, e.g. a context
   * where the caller hasn't fetched wishlist state. */
  id?: string;
  isWishlisted?: boolean;
  isAuthenticated?: boolean;
  slug: string;
  name: string;
  mineralName: string;
  cutSlug: string;
  cutName: string;
  caratWeight: number;
  colorHue: number;
  colorLightness: number;
  claritySlug: string;
  clarityName: string;
  treatmentName: string;
  isCeylon: boolean;
  /** Speciality tags (GemSpecialty) — colour change, star, etc. Usually empty. */
  specialties?: readonly string[];
  stockStatus: string;
  /** Real product photo, when one has been uploaded. Falls back to the illustrative SVG preview. */
  primaryImageUrl?: string;
  /** Only rendered when the admin has opted this item into public pricing. */
  price?: number | null;
  showPrice?: boolean;
  /** The retail direct-purchase price — see CardPrice's own doc comment. */
  retailPrice?: number | null;
  /** Set only when this gem is in the currently *live* promotional
   * collection — see getActivePromotionMaps. */
  promoPrice?: number | null;
  /** "grid" (default): today's vertical card. "list": a compact row —
   * small thumbnail, details and price in one line — for scanning many
   * items at once rather than browsing by photo. */
  view?: "grid" | "list";
  /** True for the first row or so of a grid — skips native lazy-loading
   * for whichever of these ends up being the page's Largest Contentful
   * Paint element. Default false: everything below the fold should stay
   * lazy. */
  priority?: boolean;
}

function Thumbnail({
  props,
  className,
  sizes,
  children,
}: {
  props: GemCardProps;
  className: string;
  /** How wide this thumbnail actually renders at each breakpoint — grid
   * and list callers pass very different values (a multi-column card vs a
   * small fixed-size row thumbnail), so this can't be one shared default. */
  sizes: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-ivory-soft", className)}>
      {props.primaryImageUrl ? (
        <Image
          src={props.primaryImageUrl}
          alt={props.name}
          fill
          sizes={sizes}
          priority={props.priority}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-ivory-soft to-ivory p-3">
          <GemVisualizer
            cutSlug={props.cutSlug}
            hue={props.colorHue}
            darkness={props.colorLightness}
            claritySlug={props.claritySlug}
            caratWeight={props.caratWeight}
            seedKey={props.slug}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function SpecTags({ props }: { props: GemCardProps }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-charcoal/60">
      <span>{props.caratWeight} ct</span>
      <span>{props.clarityName}</span>
      <span>{props.treatmentName}</span>
    </div>
  );
}

function GemCardList(props: GemCardProps) {
  return (
    <Link
      href={`/gems/${props.slug}`}
      className="group flex items-center gap-5 rounded-xl border border-border-subtle bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-ivory-soft/40 hover:shadow-lg hover:shadow-charcoal/5 sm:p-5"
    >
      <Thumbnail props={props} className="h-24 w-24 rounded-lg ring-1 ring-inset ring-charcoal/5 sm:h-28 sm:w-28" sizes="(min-width: 640px) 112px, 96px">
        {props.id && (
          <div className="absolute bottom-1 right-1">
            <WishlistButton
              gemstoneId={props.id}
              initialSaved={!!props.isWishlisted}
              isAuthenticated={!!props.isAuthenticated}
              className="h-6 w-6"
            />
          </div>
        )}
      </Thumbnail>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg text-charcoal sm:text-xl">{props.name}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-charcoal/65">
          {props.mineralName} · {props.cutName}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {props.promoPrice != null && <PromotionBadge />}
          {props.isCeylon && (
            <span className="rounded-full bg-night/85 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-cream">
              Ceylon
            </span>
          )}
          <SpecialtyBadges specialties={props.specialties} />
          <StockBadge status={props.stockStatus} />
        </div>
        <div className="mt-2.5 hidden sm:flex"><SpecTags props={props} /></div>
      </div>

      {/* Echoes the gold divider rule used elsewhere on the site (e.g. the
          About page's section kickers) — a quiet way to separate the
          details from the price rather than just relying on gap spacing. */}
      <div className="hidden h-14 w-px shrink-0 bg-border-subtle sm:block" />

      {/* Fixed width (not just shrink-0, which sizes to whatever this
          card's own content needs): "Request a Quote →" and a short price
          like "$5,400" are very different lengths, so without a shared
          width each card's divider — positioned immediately before this
          box — ends up at a different x position from one row to the
          next. sm:justify-end keeps the (shorter) price flush against the
          chevron/right edge instead of just left-aligned in the extra
          space. 208px (not the plain price's 176px) leaves room for a
          promo price plus its struck-through regular price side by side
          without wrapping in the common case; CardPrice itself still
          wraps gracefully if a wider one ever doesn't fit. */}
      <div className="flex shrink-0 items-center gap-3 pl-1 sm:w-[208px] sm:justify-end">
        <CardPrice
          price={props.price}
          showPrice={props.showPrice}
          retailPrice={props.retailPrice}
          promoPrice={props.promoPrice}
          priceClassName="justify-end text-right text-base sm:text-lg"
          quoteClassName="whitespace-nowrap text-right text-xs sm:text-sm"
        />
        <ChevronRight size={18} className="hidden shrink-0 text-charcoal/25 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-gold sm:block" />
      </div>
    </Link>
  );
}

function GemCardGrid(props: GemCardProps) {
  return (
    <Link
      href={`/gems/${props.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface transition-shadow hover:shadow-lg hover:shadow-charcoal/5"
    >
      <Thumbnail props={props} className="aspect-square" sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 30vw, 45vw">
        {/* Tighter inset and smaller pills on phones: in the 2-column
            mobile grid a card is only ~130-160px wide, where the stock
            pill (right) and Ceylon pill (left) at full size overlapped. */}
        <div className="absolute right-2 top-2 max-sm:bottom-2 max-sm:top-auto max-sm:[&>span]:px-2 max-sm:[&>span]:text-[10px] sm:right-3 sm:top-3">
          <StockBadge status={props.stockStatus} />
        </div>
        {/* Stacked, not side-by-side — Promotion and Ceylon can both apply
            to the same gem at once, and this corner isn't wide enough for
            two pills next to each other without crowding the photo. */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">
          {props.promoPrice != null && <PromotionBadge />}
          {props.isCeylon && (
            <span className="rounded-full bg-night/85 px-2 py-0.5 text-[10px] font-medium tracking-wide text-cream sm:px-2.5 sm:text-[11px]">
              Ceylon
            </span>
          )}
          <SpecialtyBadges specialties={props.specialties} className="flex-col items-start" />
        </div>
        {/* Bottom-left, not bottom-right: the stock badge above moves to
            bottom-right on mobile (see its own comment), which would
            otherwise collide with this. Bottom-left stays free at every
            breakpoint since the promo/Ceylon pills are pinned to the top. */}
        {props.id && (
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
            <WishlistButton gemstoneId={props.id} initialSaved={!!props.isWishlisted} isAuthenticated={!!props.isAuthenticated} />
          </div>
        )}
      </Thumbnail>
      <div className="flex flex-1 flex-col p-4">
        {/* Each block below reserves its two-line height even when the text
            only needs one, so the name, type line, specs and price start at
            the same y in every card of a row — otherwise a long name or a
            wrapping "CAT'S EYE CHRYSOBERYL · ROUND CABOCHON" pushes only its
            own card's details down and the row reads as misaligned. */}
        <p className="line-clamp-2 min-h-[3.1rem] font-serif text-lg leading-snug text-charcoal">{props.name}</p>
        <p className="mt-1 line-clamp-2 min-h-8 text-xs uppercase leading-4 tracking-wide text-charcoal/65">
          {props.mineralName} · {props.cutName}
        </p>
        <div className="mt-3 min-h-9"><SpecTags props={props} /></div>
        {/* mt-auto pins price/CTA to the card's bottom edge regardless of how
            many lines the name or spec tags above wrapped to — combined with
            the root Link's h-full, this is what keeps every card in a row
            the same height with its bottom line aligned, not just its top. */}
        <CardPrice
          price={props.price}
          showPrice={props.showPrice}
          retailPrice={props.retailPrice}
          promoPrice={props.promoPrice}
          priceClassName="mt-auto pt-2 text-base"
          quoteClassName="mt-auto pt-3 text-xs"
        />
      </div>
    </Link>
  );
}

export function GemCard(props: GemCardProps) {
  return props.view === "list" ? <GemCardList {...props} /> : <GemCardGrid {...props} />;
}
