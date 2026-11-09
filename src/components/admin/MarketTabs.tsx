import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/market-shared";

// "International | Sri Lanka" switch for admin pages that keep a separate
// copy per storefront (Home Page content, Seasonal Promotions). Plain links
// with a `?market=` query param, so the choice survives a refresh and the
// pages stay Server Components.
export function MarketTabs({ basePath, current }: { basePath: string; current: Market }) {
  const tabs: { market: Market; label: string; href: string }[] = [
    { market: "intl", label: "International", href: basePath },
    { market: "lk", label: "Sri Lanka", href: `${basePath}?market=lk` },
  ];
  return (
    <div className="mt-6 inline-flex rounded-full border border-border-subtle bg-surface p-1 text-sm" role="tablist" aria-label="Storefront">
      {tabs.map((tab) => (
        <Link
          key={tab.market}
          href={tab.href}
          role="tab"
          aria-selected={current === tab.market}
          className={cn(
            "rounded-full px-4 py-1.5 transition-colors",
            current === tab.market ? "bg-night text-cream" : "text-charcoal/70 hover:text-charcoal",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function parseAdminMarket(value: string | string[] | undefined): Market {
  return value === "lk" ? "lk" : "intl";
}
