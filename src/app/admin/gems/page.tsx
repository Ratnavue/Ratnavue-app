import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasStaffArea, marketFilterFor } from "@/lib/rbac";
import { toggleGemstoneFeatured } from "@/actions/catalog-admin";
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
import { SpecialtyBadges } from "@/components/catalog/SpecialtyBadges";
import { SPECIALTY_TAGS_INCLUDE } from "@/lib/gem-constants";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

export default async function AdminGemsPage({ searchParams }: PageProps<"/admin/gems">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await auth();
  const user = session?.user;
  if (!user || !hasStaffArea(user, "catalog")) notFound();
  const staff = user.role === "STAFF";
  // A STAFF member scoped to one store only ever sees that store's items,
  // whatever the query string asks for.
  const scopedMarket = marketFilterFor(user);
  const store = scopedMarket ?? parseStoreFilter(sp.market);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = parseListingStatusFilter(sp.status);
  // The search box takes a name or an item number ("G-000123", "g123").
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

  const [gems, total] = await Promise.all([
    prisma.gemstone.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { mineral: true, cut: true, certLab: { select: { name: true } }, specialtyTags: SPECIALTY_TAGS_INCLUDE },
    }),
    prisma.gemstone.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {!staff && <BackLink href="/admin" label="Back to Dashboard" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-charcoal">Gemstones</h1>
        <div className="flex gap-2">
          {(!scopedMarket || scopedMarket === "intl") && (
            <Link href="/admin/gems/new">
              <Button variant="gold">Add International Gemstone</Button>
            </Link>
          )}
          {(!scopedMarket || scopedMarket === "lk") && (
            <Link href="/admin/gems/new?market=lk">
              <Button variant="outline">Add Sri Lanka Gemstone</Button>
            </Link>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-charcoal/60">
        Each gemstone belongs to one store — the international and Sri Lanka catalogs are separate and never overlap.
        Click the star to feature a gem on its own store&apos;s home page. Turn the section itself on/off from{" "}
        <Link href="/admin/content/home" className="underline decoration-charcoal/30 underline-offset-2 hover:text-gold">
          Home Page content
        </Link>.
      </p>

      <div className="mt-4">
        <AdminSearchBox placeholder="Name or item number..." />
      </div>

      {!scopedMarket && <StoreFilterTabs basePath="/admin/gems" current={store} q={q} status={status} />}
      <ListingStatusFilterTabs basePath="/admin/gems" current={status} q={q} market={scopedMarket ? undefined : store} />

      <CatalogBulkSelectionProvider>
        <CatalogBulkToolbar kind="gemstone" />
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
                <th className="px-4 py-3">Mineral</th>
                <th className="px-4 py-3">Cut</th>
                <th className="px-4 py-3">Carat</th>
                <th className="px-4 py-3">Certification</th>
                <th className="px-4 py-3">Retail price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Listing</th>
              </tr>
            </thead>
            <tbody className={CARD_TBODY}>
              {gems.map((gem) => (
                <tr key={gem.id} className={CARD_TR}>
                  <td data-label="Select" className={CARD_TD}>
                    <CatalogRowCheckbox id={gem.id} />
                  </td>
                  <td data-label="Featured" className={CARD_TD}>
                    {!staff && (
                      <ToggleFeaturedButton
                        featured={gem.isFeatured}
                        store={gem.market === "lk" ? "Sri Lanka home page" : "homepage"}
                        onToggle={toggleGemstoneFeatured.bind(null, gem.id)}
                      />
                    )}
                  </td>
                  <td data-label="Item #" className={`${CARD_TD} whitespace-nowrap font-mono text-xs text-charcoal/70`}>{gem.itemNumber}</td>
                  <td className={CARD_FIRST}>
                    <Link href={`/admin/gems/${gem.id}`} className="text-charcoal hover:text-gold">{gem.name}</Link>
                    <SpecialtyBadges specialties={gem.specialtyTags} className="mt-1" />
                  </td>
                  <td data-label="Store" className={CARD_TD}>
                    <Badge className={gem.market === "lk" ? "border-gold/40 bg-gold/15 text-charcoal" : "border-border-subtle bg-charcoal/5 text-charcoal/70"}>
                      {gem.market === "lk" ? "Sri Lanka" : "International"}
                    </Badge>
                  </td>
                  <td data-label="Mineral" className={`${CARD_TD} text-charcoal/70`}>{gem.mineral.name}</td>
                  <td data-label="Cut" className={`${CARD_TD} text-charcoal/70`}>{gem.cut.name}</td>
                  <td data-label="Carat" className={`${CARD_TD} text-charcoal/70`}>{gem.caratWeight} ct</td>
                  <td data-label="Certification" className={CARD_TD}>
                    {/* Certified = a lab is set; the report number (if any) beneath it. */}
                    {gem.certLab ? (
                      <div className="flex flex-col items-end gap-0.5 lg:items-start">
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Certified</Badge>
                        <span className="text-xs text-charcoal/75">{gem.certLab.name}</span>
                        {gem.certReportNumber && <span className="font-mono text-[11px] text-charcoal/55">{gem.certReportNumber}</span>}
                      </div>
                    ) : gem.certFileUrl || gem.certReportNumber ? (
                      // Certificate details without a lab picked — worth fixing,
                      // since the storefront's certified badge needs the lab.
                      <div className="flex flex-col items-end gap-0.5 lg:items-start">
                        <span className="text-xs text-charcoal/70">Certificate on file</span>
                        {gem.certReportNumber && <span className="font-mono text-[11px] text-charcoal/55">{gem.certReportNumber}</span>}
                        <span className="text-[11px] text-amber-700">No lab set</span>
                      </div>
                    ) : (
                      <span className="text-xs text-charcoal/45">Not certified</span>
                    )}
                  </td>
                  <td data-label="Retail price" className={`${CARD_TD} text-charcoal/70`}>
                    {gem.market === "lk"
                      ? gem.lkrRetailPrice != null ? formatPrice(gem.lkrRetailPrice, "LKR") : "—"
                      : gem.retailPrice != null ? formatPrice(gem.retailPrice) : "—"}
                  </td>
                  <td data-label="Stock" className={CARD_SECOND}><StockBadge status={gem.stockStatus} /></td>
                  <td data-label="Listing" className={CARD_TD}><ListingStatusBadge status={gem.listingStatus} /></td>
                </tr>
              ))}
              {gems.length === 0 && (
                <tr className="max-lg:block"><td colSpan={12} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No gemstones yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CatalogBulkSelectionProvider>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
