import Link from "@/components/ui/MarketLink";
import Image from "next/image";
import { Gem } from "lucide-react";
import { PUBLIC_AUCTION_STATE_LABELS, type AuctionDisplayState } from "@/lib/auctions";
import { formatPrice } from "@/lib/utils";

interface AuctionCardProps {
  id: string;
  name: string;
  href: string;
  imageUrl?: string;
  state: AuctionDisplayState;
  startingPrice: number;
  highBid: number | null;
  startsAt: Date;
  endsAt: Date;
}

// Reserve price never appears here or anywhere public-facing — see the
// schema comment on Auction. What a customer sees is the starting price
// (before any bids) or the current high bid (once there are any).
export function AuctionCard({ name, href, imageUrl, state, startingPrice, highBid, startsAt, endsAt }: AuctionCardProps) {
  const dateToShow = state === "SCHEDULED" ? startsAt : endsAt;
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-border-subtle bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-square bg-ivory-soft">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, 50vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-charcoal/25">
            <Gem size={48} strokeWidth={1} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-night/80 px-2.5 py-1 text-[11px] uppercase tracking-wide text-cream">
          {PUBLIC_AUCTION_STATE_LABELS[state]}
        </span>
      </div>
      <div className="p-4">
        <p className="truncate font-serif text-lg text-charcoal">{name}</p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-charcoal/65">{highBid != null ? "Current Bid" : "Starting At"}</p>
            <p className="text-charcoal">{formatPrice(highBid ?? startingPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-charcoal/65">{state === "SCHEDULED" ? "Starts" : "Ends"}</p>
            <p className="text-charcoal/70">{dateToShow.toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
