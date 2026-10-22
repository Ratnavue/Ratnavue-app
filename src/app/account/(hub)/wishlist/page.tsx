import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarket } from "@/lib/market";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { GemResults } from "@/components/catalog/GemResults";
import { JewelryResults } from "@/components/catalog/JewelryResults";
import { LinkButton } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "My Wishlist" };

// Same page size as /gems and /jewelry (see lib/catalog.ts's own
// GEMS_PAGE_SIZE/JEWELRY_PAGE_SIZE) — no reason for a saved list to paginate
// at a different rhythm than the catalog it's drawn from.
const PAGE_SIZE = 24;

export default async function WishlistPage({ searchParams }: PageProps<"/account/wishlist">) {
  const session = await auth();
  if (!session?.user) return null; // middleware guards this route

  const sp = await searchParams;
  const gemPage = Math.max(1, Number(sp.gemPage) || 1);
  const jewelryPage = Math.max(1, Number(sp.jewelryPage) || 1);
  const market = await getMarket();

  // A saved item can later be unpublished or belong to the *other* store —
  // filtered out in the query itself (not shown broken) rather than
  // fetched and discarded; a hard-deleted item's own row is gone too,
  // cascaded by WishlistItem.gemstone/jewelry's onDelete: Cascade. The row
  // isn't otherwise cleaned up when just unpublished, so it simply
  // reappears here if the item comes back.
  const [gemRows, gemTotal, pieceRows, jewelryTotal, promotions] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId: session.user.id, gemstoneId: { not: null }, gemstone: { isPublished: true, market } },
      orderBy: { createdAt: "desc" },
      skip: (gemPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { gemstone: { include: { mineral: true, cut: true, clarityGrade: true, treatment: true, origin: true, media: true } } },
    }),
    prisma.wishlistItem.count({ where: { userId: session.user.id, gemstoneId: { not: null }, gemstone: { isPublished: true, market } } }),
    prisma.wishlistItem.findMany({
      where: { userId: session.user.id, jewelryId: { not: null }, jewelry: { isPublished: true, market } },
      orderBy: { createdAt: "desc" },
      skip: (jewelryPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { jewelry: { include: { media: { orderBy: { sortOrder: "asc" } } } } },
    }),
    prisma.wishlistItem.count({ where: { userId: session.user.id, jewelryId: { not: null }, jewelry: { isPublished: true, market } } }),
    getActivePromotionMaps(market),
  ]);

  const gems = gemRows.map((i) => i.gemstone!);
  const pieces = pieceRows.map((i) => i.jewelry!);
  const gemTotalPages = Math.max(1, Math.ceil(gemTotal / PAGE_SIZE));
  const jewelryTotalPages = Math.max(1, Math.ceil(jewelryTotal / PAGE_SIZE));

  const wishlistedIds = new Set([...gems.map((g) => g.id), ...pieces.map((p) => p.id)]);

  return (
    <div className="w-full">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">My Wishlist</h1>

      {gemTotal === 0 && jewelryTotal === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface p-8 text-center">
          <p className="text-charcoal/60">Nothing saved yet — tap the heart on any gemstone or piece to keep it here.</p>
          <LinkButton href="/gems" variant="primary" className="mt-4">Browse Gemstones</LinkButton>
        </div>
      ) : (
        <div className="mt-8 space-y-16">
          {gemTotal > 0 && (
            <section>
              <h2 className="mb-6 font-serif text-2xl text-charcoal">Gemstones</h2>
              <GemResults
                gems={gems.map((gem) => ({ ...gem, promoPrice: promotions.gemstonePrices.get(gem.id) ?? null }))}
                wishlistedIds={wishlistedIds}
                isAuthenticated
              />
              <Pagination currentPage={gemPage} totalPages={gemTotalPages} searchParams={sp} paramName="gemPage" />
            </section>
          )}
          {jewelryTotal > 0 && (
            <section>
              <h2 className="mb-6 font-serif text-2xl text-charcoal">Jewelry</h2>
              <JewelryResults
                pieces={pieces.map((piece) => ({ ...piece, promoPrice: promotions.jewelryPrices.get(piece.id) ?? null }))}
                wishlistedIds={wishlistedIds}
                isAuthenticated
              />
              <Pagination currentPage={jewelryPage} totalPages={jewelryTotalPages} searchParams={sp} paramName="jewelryPage" />
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-sm text-charcoal/65">
        <Link href="/account" className="underline hover:text-charcoal">Back to My Account</Link>
      </p>
    </div>
  );
}
