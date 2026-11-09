import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/MarketLink";
import { Gavel } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPageVisibility, marketVisibilityKey } from "@/lib/page-visibility";
import { getMarket } from "@/lib/market";
import { getAuctionDisplayState, auctionItemLabel, highestBid, minimumNextBid, PUBLIC_AUCTION_STATE_LABELS } from "@/lib/auctions";
import { MediaGallery } from "@/components/catalog/MediaGallery";
import { BidForm } from "@/components/auction/BidForm";
import { AuctionCountdown } from "@/components/auction/AuctionCountdown";
import { Reveal } from "@/components/layout/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatPrice } from "@/lib/utils";

async function loadAuction(id: string) {
  return prisma.auction.findUnique({
    where: { id },
    include: {
      gemstone: { include: { media: true } },
      jewelry: { include: { media: true } },
      bids: { orderBy: { amount: "desc" } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/auction/[id]">): Promise<Metadata> {
  const visibility = await getPageVisibility(marketVisibilityKey("auction", await getMarket()));
  if (visibility === "HIDDEN") return {};
  const { id } = await params;
  const auction = await loadAuction(id);
  if (!auction) return {};
  return { title: auctionItemLabel(auction) };
}

export default async function AuctionDetailPage({ params }: PageProps<"/auction/[id]">) {
  const visibility = await getPageVisibility(marketVisibilityKey("auction", await getMarket()));
  if (visibility === "HIDDEN") notFound();

  if (visibility === "COMING_SOON") {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-5 text-center">
        <Gavel size={40} strokeWidth={1} className="text-gold-deep" />
        <p className="mt-4 text-xs uppercase tracking-[0.35em] text-charcoal/65">Coming Soon</p>
        <h1 className="mt-3 font-serif text-4xl text-charcoal">Live Auctions</h1>
        <Link href="/" className="mt-8 text-sm text-charcoal/60 underline underline-offset-4 hover:text-charcoal">
          Back to Ratnavue
        </Link>
      </div>
    );
  }

  const { id } = await params;
  const [auction, session] = await Promise.all([loadAuction(id), auth()]);
  // A Draft or Cancelled auction never appears in a listing, but the id
  // is still guessable — treat it the same as not existing rather than
  // leaking an admin's unpublished draft.
  if (!auction || auction.status === "DRAFT" || auction.status === "CANCELLED") notFound();

  const state = getAuctionDisplayState(auction);
  const label = auctionItemLabel(auction);
  const media = auction.gemstone?.media ?? auction.jewelry?.media ?? [];
  const top = highestBid(auction.bids);
  const catalogHref = auction.gemstone ? `/gems/${auction.gemstone.slug}` : auction.jewelry ? `/jewelry/${auction.jewelry.slug}` : null;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Auctions", href: "/auction" }, { label }]} />
      <div className="grid gap-12 lg:grid-cols-2">
        <Reveal y={16}>
          <MediaGallery media={media} fallbackLabel={label} />
        </Reveal>

        <Reveal delay={0.1} y={16}>
          <span className="inline-block rounded-full bg-charcoal/5 px-3 py-1 text-xs uppercase tracking-wide text-charcoal/60">
            {PUBLIC_AUCTION_STATE_LABELS[state]}
          </span>
          <h1 className="mt-3 font-serif text-4xl text-charcoal">{label}</h1>
          {catalogHref && (
            <Link href={catalogHref} className="mt-1 inline-block text-sm text-gold-deep underline">
              View full details in the catalog
            </Link>
          )}

          <div className="mt-6 flex items-center gap-8 border-y border-border-subtle py-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal/65">{top != null ? "Current Bid" : "Starting Price"}</p>
              <p className="mt-1 font-serif text-2xl text-gold-deep">{formatPrice(top ?? auction.startingPrice)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal/65">{auction.bids.length} bid{auction.bids.length === 1 ? "" : "s"}</p>
              <p className="mt-1 text-sm text-charcoal/70">
                {state === "SCHEDULED" ? `Starts ${auction.startsAt.toLocaleString()}` : `Ends ${auction.endsAt.toLocaleString()}`}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {state === "OPEN" ? (
              <BidForm auctionId={auction.id} minimumBid={minimumNextBid(auction, auction.bids)} isSignedIn={!!session?.user} />
            ) : state === "SCHEDULED" ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal/65">Bidding opens in</p>
                <div className="mt-1">
                  <AuctionCountdown targetDate={auction.startsAt.toISOString()} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-charcoal/60">
                {(state === "RESERVE_NOT_MET" || state === "AWAITING_CONFIRMATION") && "Bidding has closed on this item."}
                {state === "WON" && "This item has been sold."}
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
