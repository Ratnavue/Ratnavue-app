import Image from "next/image";
import { ArrowUpRight, Gem } from "lucide-react";
import Link from "@/components/ui/MarketLink";
import { GemStage, StylizedGem, type StylizedGemShape } from "@/components/gem-visualizer/StylizedGem";
import { cn } from "@/lib/utils";

/**
 * One card in a "browse by category" grid: a stage on top, then the category
 * name, how many pieces are in it, and a round arrow. Server-rendered, plain
 * link.
 *
 * Two kinds of stage:
 *  - `gemColor` set (the gemstone categories): the stylised gem art on a
 *    stage tinted with the stone's colour. If the category also has a real
 *    cover photo, it fades in over the art on hover, so the actual stones
 *    are still a hover away.
 *  - no `gemColor` (jewelry): the cover photo itself, or a gem icon when
 *    there's none yet.
 */
export function CategoryTile({
  href,
  label,
  countLabel,
  description,
  image,
  gemColor,
  gemShape = "oval",
  emphasis = false,
}: {
  href: string;
  label: string;
  countLabel?: string;
  description?: string;
  image: string | null;
  gemColor?: string;
  gemShape?: StylizedGemShape;
  /** The "view everything" tile — set apart with a gold frame. */
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-surface transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-night/20",
        emphasis ? "border-gold/60" : "border-border-subtle hover:border-gold/40",
      )}
    >
      <div className="relative aspect-[5/4.4] overflow-hidden">
        {gemColor ? (
          <GemStage color={gemColor} className="absolute inset-0 flex items-center justify-center">
            <StylizedGem color={gemColor} shape={gemShape} className="w-[54%] translate-y-[4%] transition-transform duration-500 group-hover:scale-105" />
          </GemStage>
        ) : !image ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ivory-soft text-gold/50">
            <Gem size={56} strokeWidth={1} />
          </div>
        ) : null}
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
            className={cn(
              "object-cover transition-[opacity,transform] duration-700 ease-out",
              gemColor ? "opacity-0 group-hover:opacity-100" : "group-hover:scale-105",
            )}
          />
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
