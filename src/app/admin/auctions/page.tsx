import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPageVisibility } from "@/lib/page-visibility";
import { getAuctionDisplayState, auctionItemLabel, highestBid } from "@/lib/auctions";
import { AuctionStateBadge } from "@/components/ui/Badge";
import { PageVisibilityControl } from "@/components/admin/PageVisibilityControl";
import { BackLink } from "@/components/admin/BackLink";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { formatPrice } from "@/lib/utils";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 30;

export default async function AdminAuctionsPage({ searchParams }: PageProps<"/admin/auctions">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const where = q
    ? { OR: [{ gemstone: { name: { contains: q, mode: "insensitive" as const } } }, { jewelry: { name: { contains: q, mode: "insensitive" as const } } }] }
    : {};

  const [auctions, total, visibility] = await Promise.all([
    prisma.auction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { gemstone: true, jewelry: true, bids: true },
    }),
    prisma.auction.count({ where }),
    getPageVisibility("auction"),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Auctions</h1>
        <div className="flex items-center gap-3">
          <Link href="/auction" target="_blank" className="text-sm text-gold underline">
            View live page ↗
          </Link>
          <Link href="/admin/auctions/new">
            <Button type="button" variant="gold" size="sm">New Auction</Button>
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-charcoal/60">
        Highest bid wins a hidden reserve price — bidding is provisional, confirm a winner from an auction&apos;s detail
        page once it closes.
      </p>

      <div className="mt-8 rounded-xl border border-border-subtle bg-surface p-5">
        <PageVisibilityControl pageKey="auction" currentState={visibility} />
      </div>

      <div className="mt-6">
        <AdminSearchBox placeholder="Search by item name..." />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Reserve</th>
              <th className="px-4 py-3">High Bid</th>
              <th className="px-4 py-3">Ends</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {auctions.map((auction) => {
              const state = getAuctionDisplayState(auction);
              const top = highestBid(auction.bids);
              return (
                <tr key={auction.id} className={CARD_TR}>
                  <td className={CARD_FIRST}>
                    <Link href={`/admin/auctions/${auction.id}`} className="text-charcoal hover:text-gold hover:underline">
                      {auctionItemLabel(auction)}
                    </Link>
                  </td>
                  <td data-label="Reserve" className={`${CARD_TD} text-charcoal/70`}>{formatPrice(auction.reservePrice)}</td>
                  <td data-label="High bid" className={`${CARD_TD} text-charcoal/70`}>{top != null ? formatPrice(top) : "No bids"}</td>
                  <td data-label="Ends" className={`${CARD_TD} text-charcoal/70`}>{auction.endsAt.toLocaleString()}</td>
                  <td data-label="State" className={CARD_SECOND}><AuctionStateBadge state={state} /></td>
                </tr>
              );
            })}
            {auctions.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No auctions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
