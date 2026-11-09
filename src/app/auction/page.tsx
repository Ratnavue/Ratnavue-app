import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo-copy";
import { notFound } from "next/navigation";
import Link from "@/components/ui/MarketLink";
import { Gavel } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPageVisibility, marketVisibilityKey } from "@/lib/page-visibility";
import { getMarket } from "@/lib/market";
import { getAuctionDisplayState, auctionItemLabel, highestBid } from "@/lib/auctions";
import { AuctionCard } from "@/components/auction/AuctionCard";
import { Reveal } from "@/components/layout/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const visibility = await getPageVisibility(marketVisibilityKey("auction", await getMarket()));
  if (visibility === "HIDDEN") return {};
  return pageMetadata(visibility === "COMING_SOON" ? PAGE_SEO.auctionsComingSoon : PAGE_SEO.auctions);
}

export default async function AuctionListPage() {
  const visibility = await getPageVisibility(marketVisibilityKey("auction", await getMarket()));
  // Same "reads as though the route doesn't exist" behavior as
  // /promotions when Hidden — see that page for the reasoning.
  if (visibility === "HIDDEN") notFound();

  if (visibility === "COMING_SOON") {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-5 text-center">
        <Gavel size={40} strokeWidth={1} className="text-gold-deep" />
        <p className="mt-4 text-xs uppercase tracking-[0.35em] text-charcoal/65">Coming Soon</p>
        <h1 className="mt-3 font-serif text-4xl text-charcoal">Live Auctions</h1>
        <p className="mt-4 max-w-md text-charcoal/60">
          A rotating selection of exceptional pieces, sold to the highest bidder. Check back soon.
        </p>
        <Link href="/" className="mt-8 text-sm text-charcoal/60 underline underline-offset-4 hover:text-charcoal">
          Back to Ratnavue
        </Link>
      </div>
    );
  }

  const auctions = await prisma.auction.findMany({
    where: { status: { in: ["ACTIVE", "WON"] } },
    include: { gemstone: { include: { media: true } }, jewelry: { include: { media: true } }, bids: true },
    orderBy: { endsAt: "asc" },
  });

  const withState = auctions
    .map((a) => ({ auction: a, state: getAuctionDisplayState(a) }))
    // A won auction still worth showing (as "Sold," proof the site does
    // real business) but a cancelled or draft one never reaches here at
    // all — filtered at the query level above.
    .sort((a, b) => {
      const rank: Record<string, number> = { OPEN: 0, SCHEDULED: 1, AWAITING_CONFIRMATION: 2, WON: 3, RESERVE_NOT_MET: 4 };
      return (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
    });

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Auctions" }]} />
      <Reveal y={16}>
        <p className="text-xs uppercase tracking-[0.35em] text-charcoal/65">Live Auctions</p>
        <h1 className="mt-3 font-serif text-4xl text-charcoal sm:text-5xl">Bid on Exceptional Pieces</h1>
        <p className="mt-4 max-w-2xl text-charcoal/60">
          Highest bid wins, subject to a reserve. Sign in to place a bid — the winner is confirmed by our team once
          bidding closes, then billed the same way as any other order, by wire transfer.
        </p>
      </Reveal>

      {withState.length === 0 ? (
        <p className="mt-12 text-charcoal/65">No auctions are running right now — check back soon.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {withState.map(({ auction, state }, i) => {
            const media = auction.gemstone?.media ?? auction.jewelry?.media ?? [];
            return (
              <Reveal key={auction.id} y={16} delay={Math.min(i, 4) * 0.05}>
                <AuctionCard
                  id={auction.id}
                  name={auctionItemLabel(auction)}
                  href={`/auction/${auction.id}`}
                  imageUrl={media[0]?.url}
                  state={state}
                  startingPrice={auction.startingPrice}
                  highBid={highestBid(auction.bids)}
                  startsAt={auction.startsAt}
                  endsAt={auction.endsAt}
                />
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
