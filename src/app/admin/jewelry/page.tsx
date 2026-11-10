import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasStaffArea, marketFilterFor } from "@/lib/rbac";
import { toggleJewelryFeatured } from "@/actions/catalog-admin";
import { StockBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { ToggleFeaturedButton } from "@/components/admin/ToggleFeaturedButton";
import { BackLink } from "@/components/admin/BackLink";
import { StoreFilterTabs, ListingStatusFilterTabs, parseStoreFilter, parseListingStatusFilter } from "@/components/admin/StoreFilterTabs";
import { ListingStatusBadge } from "@/components/admin/ListingStatusField";
import { parseItemNumber } from "@/lib/item-number";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { CatalogBulkSelectionProvider, CatalogRowCheckbox, CatalogBulkToolbar } from "@/components/admin/CatalogBulkSelection";
import { formatPrice } from "@/lib/utils";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

export default async function AdminJewelryPage({ searchParams }: PageProps<"/admin/jewelry">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await auth();
  const user = session?.user;
  if (!user || !hasStaffArea(user, "catalog")) notFound();
  const staff = user.role === "STAFF";
  const scopedMarket = marketFilterFor(user);
  const store = scopedMarket ?? parseStoreFilter(sp.market);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = parseListingStatusFilter(sp.status);
  // The search box takes a name or an item number ("J-000123", "j123").
  const searchedNumber = q ? parseItemNumber(q)?.itemNumber : undefined;
  const where = {
    ...(store === "all" ? {} : { market: store }),
    ...(status === "all" ? {} : { listingStatus: status }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { itemNumber: { contains: searchedNumber ?? q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [pieces, total] = await Promise.all([
    prisma.jewelryPiece.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.jewelryPiece.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {!staff && <BackLink href="/admin" label="Back to Dashboard" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-charcoal">Jewelry</h1>
        <div className="flex gap-2">
          {(!scopedMarket || scopedMarket === "intl") && (
            <Link href="/admin/jewelry/new">
              <Button variant="gold">Add International Piece</Button>
            </Link>
          )}
          {(!scopedMarket || scopedMarket === "lk") && (
            <Link href="/admin/jewelry/new?market=lk">
              <Button variant="outline">Add Sri Lanka Piece</Button>
            </Link>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-charcoal/60">
        Each piece belongs to one store — the international and Sri Lanka catalogs are separate and never overlap.
        Click the star to feature a piece on its own store&apos;s home page. Turn the section itself on/off from{" "}
        <Link href="/admin/content/home" className="underline decoration-charcoal/30 underline-offset-2 hover:text-gold">
          Home Page content
        </Link>.
      </p>

      <div className="mt-4">
        <AdminSearchBox placeholder="Name or item number..." />
      </div>

      <StoreFilterTabs basePath="/admin/jewelry" current={store} q={q} status={status} />
      <ListingStatusFilterTabs basePath="/admin/jewelry" current={status} q={q} market={scopedMarket ? undefined : store} />

      <CatalogBulkSelectionProvider>
        <CatalogBulkToolbar kind="jewelry" />
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className={CARD_TABLE}>
            <thead className={CARD_THEAD}>
              <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Featured</span>
                </th>
                <th className="px-4 py-3">Item #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Metal</th>
                <th className="px-4 py-3">Retail price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Listing</th>
              </tr>
            </thead>
            <tbody className={CARD_TBODY}>
              {pieces.map((piece) => (
                <tr key={piece.id} className={CARD_TR}>
                  <td data-label="Select" className={CARD_TD}>
                    <CatalogRowCheckbox id={piece.id} />
                  </td>
                  <td data-label="Featured" className={CARD_TD}>
                    <ToggleFeaturedButton
                      featured={piece.isFeatured}
                      store={piece.market === "lk" ? "Sri Lanka home page" : "homepage"}
                      onToggle={toggleJewelryFeatured.bind(null, piece.id)}
                    />
                  </td>
                  <td data-label="Item #" className={`${CARD_TD} whitespace-nowrap font-mono text-xs text-charcoal/70`}>{piece.itemNumber}</td>
                  <td className={CARD_FIRST}>
                    <Link href={`/admin/jewelry/${piece.id}`} className="text-charcoal hover:text-gold">{piece.name}</Link>
                  </td>
                  <td data-label="Store" className={CARD_TD}>
                    <Badge className={piece.market === "lk" ? "border-gold/40 bg-gold/15 text-charcoal" : "border-border-subtle bg-charcoal/5 text-charcoal/70"}>
                      {piece.market === "lk" ? "Sri Lanka" : "International"}
                    </Badge>
                  </td>
                  <td data-label="Type" className={`${CARD_TD} text-charcoal/70`}>{piece.pieceType}</td>
                  <td data-label="Metal" className={`${CARD_TD} text-charcoal/70`}>{piece.metalType}</td>
                  <td data-label="Retail price" className={`${CARD_TD} text-charcoal/70`}>
                    {piece.market === "lk"
                      ? piece.lkrRetailPrice != null ? formatPrice(piece.lkrRetailPrice, "LKR") : "—"
                      : piece.retailPrice != null ? formatPrice(piece.retailPrice) : "—"}
                  </td>
                  <td data-label="Stock" className={CARD_SECOND}><StockBadge status={piece.stockStatus} /></td>
                  <td data-label="Listing" className={CARD_TD}><ListingStatusBadge status={piece.listingStatus} /></td>
                </tr>
              ))}
              {pieces.length === 0 && (
                <tr className="max-lg:block"><td colSpan={10} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No jewelry pieces yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CatalogBulkSelectionProvider>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
