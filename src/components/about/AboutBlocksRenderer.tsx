import type { ReactNode } from "react";
import Image from "next/image";
import { Reveal } from "@/components/layout/Reveal";
import { useTranslations } from "next-intl";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SPACER_HEIGHT_LABELS, type AboutBlock, type AboutRow, type ColumnSpan, type SpacerHeight } from "@/lib/about-blocks";

// The single source of truth for how About-page rows/blocks render —
// shared by the real /about page (server-rendered from saved content) and
// the admin builder's live-preview pane (client-rendered from in-progress,
// unsaved edits). Keeping one renderer for both means the preview can
// never drift from what actually ships.
//
// A row with one full-width (span 12) column renders its block exactly as
// a standalone section — full-bleed for hero/quote, self-contained boxed
// sections for the rest, same as before rows/columns existed. A row with
// 2+ columns instead renders them side-by-side inside one shared
// contained wrapper, using each block's more compact "boxed" rendering
// (see the Boxed* components) so it fits whatever width its column ends
// up with.
//
// `animate=false` (used by the admin preview pane) swaps Reveal's
// scroll-triggered fade-in for a plain div: the preview pane is a small,
// independently-scrolled box, and whileInView's viewport intersection
// math is tuned for the real full-height page, not a cropped sidebar —
// plain, immediately-visible content reads correctly there instead of
// intermittently stuck at opacity 0.

function Wrap({ animate, className, delay, children }: { animate: boolean; className?: string; delay?: number; children: ReactNode }) {
  if (!animate) return <div className={className}>{children}</div>;
  return <Reveal className={className} delay={delay}>{children}</Reveal>;
}

// Literal class names (not template-interpolated) so Tailwind's static
// scan always finds them regardless of which spans are actually in use.
const SPAN_CLASSES: Record<ColumnSpan, string> = {
  1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4",
  5: "sm:col-span-5", 6: "sm:col-span-6", 7: "sm:col-span-7", 8: "sm:col-span-8",
  9: "sm:col-span-9", 10: "sm:col-span-10", 11: "sm:col-span-11", 12: "sm:col-span-12",
};

// ---------- Full section renderings (solo full-width rows) ----------

// A centred editorial opener on the page itself (the redesign moved the
// photography into the image blocks below, as rounded cards), so the block's
// image is no longer shown here — the admin field stays for the boxed
// (multi-column) rendering, which still uses it.
function HeroSection({ block, animate }: { block: Extract<AboutBlock, { type: "hero" }>; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 pb-8 pt-12 text-center sm:px-8 sm:pt-20 lg:px-12 xl:px-16">
      <Wrap animate={animate}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{block.kicker}</p>
        <h1 className="mx-auto mt-5 max-w-5xl font-serif text-5xl leading-[1.05] text-charcoal sm:text-6xl lg:text-7xl">
          {block.heading}
        </h1>
      </Wrap>
    </section>
  );
}

function TextSection({ block, animate }: { block: Extract<AboutBlock, { type: "text" }>; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
      <Wrap animate={animate} className="grid gap-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{block.label}</p>
          <p className="mt-5 font-serif text-3xl leading-snug text-charcoal sm:text-4xl">{block.lead}</p>
        </div>
        <div className="lg:pt-10">
          <p className="text-lg leading-relaxed text-charcoal/75">{block.body1}</p>
          {block.body2 && <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{block.body2}</p>}
        </div>
      </Wrap>
    </section>
  );
}

function ImageCaptionSection({ block, animate }: { block: Extract<AboutBlock, { type: "imageCaption" }>; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-8 sm:px-8 lg:px-12 xl:px-16">
      <Wrap animate={animate} className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <PhotoFrame src={block.image} alt={block.kicker} sizes="(min-width: 1024px) 50vw, 100vw" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{block.kicker}</p>
          <p className="mt-4 text-lg leading-relaxed text-charcoal/75">{block.body}</p>
        </div>
      </Wrap>
    </section>
  );
}

/** A real photo in the site's rounded, hairline-framed card. */
function PhotoFrame({ src, alt, sizes, className }: { src: string; alt: string; sizes: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[3/2] overflow-hidden rounded-3xl border border-border-subtle bg-night", className)}>
      {src && <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />}
    </div>
  );
}

function ImageBlockSection({ block, animate }: { block: Extract<AboutBlock, { type: "image" }>; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Wrap animate={animate}>
        <PhotoFrame src={block.image} alt={block.caption || "About Ratnavue"} sizes="100vw" className="aspect-[21/9]" />
        {block.caption && <p className="mt-4 text-center text-sm text-charcoal/65">{block.caption}</p>}
      </Wrap>
    </section>
  );
}

// A centred serif statement on the page (it used to be a full-width dark
// band) — the highlighted tail in gold.
function QuoteSection({ block, animate }: { block: Extract<AboutBlock, { type: "quote" }>; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 pb-4 pt-16 text-center sm:px-8 sm:pt-24 lg:px-12 xl:px-16">
      <Wrap animate={animate}>
        <p className="mx-auto max-w-4xl font-serif text-4xl leading-snug text-charcoal sm:text-5xl">
          {block.text} <span className="text-gold-deep">{block.highlight}</span>
        </p>
      </Wrap>
    </section>
  );
}

// Two layouts by count: an even list of four or more reads as steps (gold
// serif numerals over hairlines, two columns); anything else as cards.
function PrinciplesSection({ block, animate }: { block: Extract<AboutBlock, { type: "principles" }>; animate: boolean }) {
  const asSteps = block.items.length >= 4 && block.items.length % 2 === 0;
  if (asSteps) {
    return (
      <section className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-x-16 sm:grid-cols-2">
          {block.items.map((item, i) => (
            <Wrap animate={animate} delay={i * 0.06} key={`${block.id}-${i}`} className="border-t border-border-subtle py-8">
              <div className="flex gap-6">
                <span className="w-12 shrink-0 font-serif text-4xl leading-none text-gold-deep">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-serif text-2xl text-charcoal">{item.title}</h2>
                  <p className="mt-2 leading-relaxed text-charcoal/70">{item.body}</p>
                </div>
              </div>
            </Wrap>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {block.items.map((item, i) => (
          <Wrap animate={animate} delay={i * 0.08} key={`${block.id}-${i}`} className="rounded-2xl border border-border-subtle bg-surface p-7">
            <h2 className="font-serif text-2xl text-charcoal">{item.title}</h2>
            <p className="mt-3 leading-relaxed text-charcoal/70">{item.body}</p>
          </Wrap>
        ))}
      </div>
    </section>
  );
}

function CtaSection({ block, animate }: { block: Extract<AboutBlock, { type: "cta" }>; animate: boolean }) {
  const t = useTranslations("home");
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
      <Wrap animate={animate} className="band-sapphire rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20">
        <h2 className="font-serif text-4xl text-charcoal sm:text-5xl">{block.heading}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-charcoal/80">{block.body}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <LinkButton href="/gems" size="lg">{t("shopGemstones")}</LinkButton>
          <LinkButton href="/sourcing" variant="outline" size="lg">{t("submitSourcing")}</LinkButton>
        </div>
      </Wrap>
    </section>
  );
}

const SPACER_HEIGHTS: Record<SpacerHeight, string> = {
  sm: "h-8 sm:h-12",
  md: "h-16 sm:h-24",
  lg: "h-24 sm:h-36",
  xl: "h-32 sm:h-48",
};

function SpacerSection({ block, animate }: { block: Extract<AboutBlock, { type: "spacer" }>; animate: boolean }) {
  return (
    <div className={cn("relative w-full", SPACER_HEIGHTS[block.height])} style={{ backgroundColor: PAGE_COLOURED_SPACERS.has(block.color.toLowerCase()) ? "transparent" : block.color }}>
      {/* Admin preview only (animate=false uniquely identifies that
          context — see AboutBlocksRenderer's animate prop). A Spacer set
          to its default colour is deliberately invisible on the real
          page — that's the whole feature — but that leaves the admin with
          no way to confirm one is actually there while editing, which
          reads as "the spacer isn't appearing." A quiet dashed outline +
          label, admin-only, fixes that without touching what visitors
          ever see. */}
      {!animate && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border border-dashed border-charcoal/20">
          <span className="rounded bg-night/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cream">
            Spacer · {SPACER_HEIGHT_LABELS[block.height]}
          </span>
        </div>
      )}
    </div>
  );
}

function FullSection({ block, animate }: { block: AboutBlock; animate: boolean }) {
  switch (block.type) {
    case "hero":
      return <HeroSection block={block} animate={animate} />;
    case "text":
      return <TextSection block={block} animate={animate} />;
    case "imageCaption":
      return <ImageCaptionSection block={block} animate={animate} />;
    case "image":
      return <ImageBlockSection block={block} animate={animate} />;
    case "quote":
      return <QuoteSection block={block} animate={animate} />;
    case "principles":
      return <PrinciplesSection block={block} animate={animate} />;
    case "cta":
      return <CtaSection block={block} animate={animate} />;
    case "spacer":
      return <SpacerSection block={block} animate={animate} />;
    default:
      return null;
  }
}

// ---------- Boxed renderings (fit inside a fractional-width column) ----------
//
// Image, Principles, and CTA already adapt to any container width (they
// don't rely on the page's own edge-to-edge bleed or a nested internal
// grid split), so they're reused as-is. Hero, Text, ImageCaption, and
// Quote each get a compact variant here instead — full-viewport-height and
// side-by-side internal splits don't work once squeezed into, say, a
// quarter-width column.

function BoxedHero({ block }: { block: Extract<AboutBlock, { type: "hero" }> }) {
  return (
    <div className="relative flex aspect-[4/3] w-full items-end overflow-hidden rounded-3xl bg-night border border-border-subtle">
      {block.image && <Image src={block.image} alt={block.heading} fill sizes="100vw" className="object-cover" />}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 40%, rgba(33,29,26,0.85) 100%)" }}
      />
      <div className="relative p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{block.kicker}</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-cream sm:text-3xl">{block.heading}</h2>
      </div>
    </div>
  );
}

function BoxedText({ block }: { block: Extract<AboutBlock, { type: "text" }> }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gold-deep">{block.label}</p>
      <div className="mt-3 h-px w-10 bg-gold" />
      <p className="mt-5 font-serif text-xl leading-relaxed text-charcoal sm:text-2xl">{block.lead}</p>
      <p className="mt-5 leading-relaxed text-charcoal/70">{block.body1}</p>
      <p className="mt-4 leading-relaxed text-charcoal/70">{block.body2}</p>
    </div>
  );
}

function BoxedImageCaption({ block }: { block: Extract<AboutBlock, { type: "imageCaption" }> }) {
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-night border border-border-subtle">
        {block.image && <Image src={block.image} alt={block.kicker} fill sizes="100vw" className="object-cover" />}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.25em] text-gold-deep">{block.kicker}</p>
      <p className="mt-2 leading-relaxed text-charcoal/70">{block.body}</p>
    </div>
  );
}

function BoxedQuote({ block }: { block: Extract<AboutBlock, { type: "quote" }> }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-3xl bg-night p-8 border border-border-subtle sm:p-10">
      <p className="font-serif text-2xl leading-snug text-cream sm:text-3xl">
        {block.text} <span className="text-gold-soft">{block.highlight}</span>
      </p>
    </div>
  );
}

function BoxedBlock({ block, animate }: { block: AboutBlock; animate: boolean }) {
  switch (block.type) {
    case "hero":
      return <BoxedHero block={block} />;
    case "text":
      return <BoxedText block={block} />;
    case "imageCaption":
      return <BoxedImageCaption block={block} />;
    case "quote":
      return <BoxedQuote block={block} />;
    case "image":
      return <ImageBlockSection block={block} animate={false} />;
    case "principles":
      return <PrinciplesSection block={block} animate={false} />;
    case "cta":
      return <CtaSection block={block} animate={false} />;
    case "spacer":
      // The real `animate` (not the hardcoded false above) — a boxed
      // spacer still needs to tell an admin-preview render from a real
      // one, same as FullSection's.
      return <SpacerSection block={block} animate={animate} />;
    default:
      return null;
  }
}

function MultiColumnRow({ row, animate }: { row: AboutRow; animate: boolean }) {
  return (
    <section className="mx-auto max-w-[120rem] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-12 sm:gap-10 lg:gap-14">
        {row.columns.map((col, i) => (
          <Wrap animate={animate} delay={i * 0.06} key={col.id} className={cn("col-span-1", SPAN_CLASSES[col.span])}>
            <BoxedBlock block={col.block} animate={animate} />
          </Wrap>
        ))}
      </div>
    </section>
  );
}

// Spacer colours that just meant "the page background" when they were saved —
// the default (#ffffff), the old cream page (#faf7f1) and the old ivory page
// (#fbf8f2). Rendered transparent so they follow the current theme instead
// of painting light bands across the dark one.
const PAGE_COLOURED_SPACERS = new Set(["#ffffff", "#fff", "#faf7f1", "#fbf8f2"]);

export function AboutBlocksRenderer({ rows, animate = true }: { rows: AboutRow[]; animate?: boolean }) {
  return (
    <div>
      {rows.map((row) => (
        // data-row-id lets the admin preview pane (which scrolls
        // independently of the page around it, in its own fixed-height
        // box) scroll a specific row into view when it's being edited —
        // without this, an added or edited block below the pane's current
        // scroll position is invisible there even though it's correct on
        // the real page, which reads as "the preview doesn't match."
        <div key={row.id} data-row-id={row.id}>
          {row.columns.length === 1 && row.columns[0].span === 12 ? (
            <FullSection block={row.columns[0].block} animate={animate} />
          ) : (
            <MultiColumnRow row={row} animate={animate} />
          )}
        </div>
      ))}
    </div>
  );
}
