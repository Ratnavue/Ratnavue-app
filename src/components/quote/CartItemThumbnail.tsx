import Link from "@/components/ui/MarketLink";
import Image from "next/image";
import { Video, Gem } from "lucide-react";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import type { QuoteGemVisual } from "@/lib/quote-visual";

interface MediaItem {
  id: string;
  url: string;
  type: string;
}

/**
 * A cart item today only ever carries a text label and a price — no
 * picture of what's actually being bought. This shows the real product's
 * photos/videos (already multi-photo/video capable via MediaAsset) when
 * the item traces back to a catalog Gemstone or JewelryPiece, falls back
 * to the same procedural gem preview product pages use when there's no
 * catalog photo yet (a configured, not-yet-cataloged gem), and shows
 * nothing for a sourcing request — there's no product yet to picture.
 */
export function CartItemThumbnail({
  media,
  gemVisual,
  seedKey,
  href,
}: {
  media: MediaItem[];
  gemVisual: QuoteGemVisual | null;
  seedKey: string;
  href: string | null;
}) {
  const primary = media[0];
  const extraCount = media.length - 1;

  const content = primary ? (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ivory-soft ring-1 ring-inset ring-charcoal/5">
      {primary.type === "VIDEO" ? (
        <div className="flex h-full w-full items-center justify-center bg-charcoal/5">
          <Video size={20} className="text-charcoal/65" />
        </div>
      ) : (
        <Image src={primary.url} alt="" fill sizes="64px" className="object-cover" />
      )}
      {extraCount > 0 && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-night/80 px-1 text-[10px] font-medium text-cream">
          +{extraCount}
        </span>
      )}
    </div>
  ) : gemVisual ? (
    <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-b from-ivory-soft to-ivory p-2 ring-1 ring-inset ring-charcoal/5">
      <GemVisualizer
        cutSlug={gemVisual.cutSlug}
        hue={gemVisual.hue}
        darkness={gemVisual.darkness}
        claritySlug={gemVisual.claritySlug}
        caratWeight={gemVisual.caratWeight}
        seedKey={seedKey}
        className="h-full w-full"
      />
    </div>
  ) : (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-ivory-soft text-charcoal/25 ring-1 ring-inset ring-charcoal/5">
      <Gem size={22} strokeWidth={1} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 transition-opacity hover:opacity-80" title="View full gallery">
        {content}
      </Link>
    );
  }
  return content;
}
