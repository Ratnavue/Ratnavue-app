import Link from "next/link";
import { cn } from "@/lib/utils";
import { LISTING_STATUSES, LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/item-number";

export type StoreFilter = "all" | "intl" | "lk";

export function parseStoreFilter(value: string | string[] | undefined): StoreFilter {
  return value === "lk" ? "lk" : value === "intl" ? "intl" : "all";
}

export function parseListingStatusFilter(value: string | string[] | undefined): ListingStatus | "all" {
  return typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value) ? (value as ListingStatus) : "all";
}

function buildHref(basePath: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function Tabs({ tabs, current }: { tabs: { key: string; label: string; href: string }[]; current: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            current === tab.key ? "border-charcoal bg-night text-cream" : "border-border-subtle text-charcoal/70",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

// All | International | Sri Lanka filter for the admin catalog lists. Plain
// links with a `?market=` query param, so it survives a refresh and the
// lists stay Server Components. Keeps the search and status filters.
export function StoreFilterTabs({ basePath, current, q, status }: { basePath: string; current: StoreFilter; q?: string; status?: string }) {
  const keep = { q: q || undefined, status: status && status !== "all" ? status : undefined };
  const tabs = [
    { key: "all", label: "All stores", href: buildHref(basePath, keep) },
    { key: "intl", label: "International", href: buildHref(basePath, { market: "intl", ...keep }) },
    { key: "lk", label: "Sri Lanka", href: buildHref(basePath, { market: "lk", ...keep }) },
  ];
  return (
    <div className="mt-5">
      <Tabs tabs={tabs} current={current} />
    </div>
  );
}

// All | Draft | Finished | Live filter, same plain-link approach. Keeps the
// search and store filters.
export function ListingStatusFilterTabs({ basePath, current, q, market }: { basePath: string; current: ListingStatus | "all"; q?: string; market?: StoreFilter }) {
  const keep = { q: q || undefined, market: market && market !== "all" ? market : undefined };
  const tabs = [
    { key: "all", label: "Any status", href: buildHref(basePath, keep) },
    ...LISTING_STATUSES.map((s) => ({ key: s, label: LISTING_STATUS_LABELS[s].label, href: buildHref(basePath, { ...keep, status: s }) })),
  ];
  return (
    <div className="mt-2">
      <Tabs tabs={tabs} current={current} />
    </div>
  );
}
