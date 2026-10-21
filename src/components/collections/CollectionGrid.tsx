"use client";

import { useMemo, useState } from "react";
import type { SubcultureDef } from "@/lib/subculture-collections";
import type { CollectionCardData } from "@/lib/subculture-items";
import { CollectionProductCard } from "@/components/collections/CollectionProductCard";
import { Select } from "@/components/ui/Field";
import { cn, formatPrice } from "@/lib/utils";
import { useCurrency } from "@/components/providers/MarketProvider";

// Rough price ceilings for the "Up to" filter, in each storefront's own currency.
const PRICE_CEILINGS = { USD: [500, 1000, 2500, 5000], LKR: [100000, 250000, 500000, 1000000] } as const;

const controlClass =
  "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-white/30";

// <option> elements render in the browser's own native dropdown popup, not
// this component's dark-themed box — Chrome/Firefox/Edge do honor `color`/
// `background-color` set directly on <option>, but the select's inherited
// text-white/80 was leaking into that popup with no matching dark
// background, so every option rendered as near-invisible light text on the
// popup's default white background. Setting both explicitly on each
// <option> fixes that without touching the (correctly dark-on-dark)
// trigger itself.
const optionClass = "bg-neutral-900 text-white";

// Same dark theme, for the searchable combobox's own popup/option styling
// (see SearchableSelect's listClassName/optionClassName) — its defaults
// are the light storefront theme, which this page's dark pills don't use.
const darkListClass = "border-white/15 bg-neutral-900";
const darkOptionClass = "text-white/80 hover:bg-white/10";

function matchesSection(item: CollectionCardData, hints: string[]): boolean {
  const mineral = item.mineralName?.toLowerCase() ?? "";
  return hints.some((hint) => mineral.includes(hint));
}

/** Client-side filter bar + product grid over an already-fetched,
 * curated collection — no server pagination, the same "small collection,
 * filter in memory" reasoning /promotions/collection uses (see the plan:
 * these stay curated, not full-catalog scale). Renders either one flat
 * grid (theme.collectionGridLabel) or the theme's named thematic
 * sections (Vampire's Blood Red/Midnight/Twilight, Witchy's
 * Moon/Shadow/Mystic/Ember), each independently filtered. */
export function CollectionGrid({ items, theme }: { items: CollectionCardData[]; theme: SubcultureDef }) {
  const [gemstone, setGemstone] = useState("");
  const [type, setType] = useState<"" | "gemstone" | "jewelry">("");
  const currency = useCurrency();
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const gemstoneOptions = useMemo(() => Array.from(new Set(items.map((i) => i.mineralName).filter(Boolean))).sort() as string[], [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (gemstone && item.mineralName !== gemstone) return false;
      if (type === "gemstone" && item.pieceTypeLabel) return false;
      if (type === "jewelry" && !item.pieceTypeLabel) return false;
      if (inStockOnly && item.stockStatus !== "AVAILABLE") return false;
      if (maxPrice) {
        const price = item.retailPrice ?? (item.showPrice ? item.price : null);
        if (price == null || price > Number(maxPrice)) return false;
      }
      return true;
    });
  }, [items, gemstone, type, maxPrice, inStockOnly]);

  const groups = theme.sections
    ? theme.sections.map((section) => ({ section, items: filtered.filter((item) => matchesSection(item, section.mineralHints)) }))
    : [{ section: null, items: filtered }];

  return (
    <div>
      {/* mt-5: the theme-label kicker just above this (in
          AlternativeCollectionPage) had no spacing of its own before this
          row, so the two sat nearly flush — close enough to read as an
          accident rather than a deliberate "label, then its filters"
          grouping. gap-2 (down from 2.5) and the pills' own tighter
          padding (see controlClass) make the row itself read as one
          cohesive toolbar instead of four loosely related buttons. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Select
          value={gemstone}
          onChange={(e) => setGemstone(e.target.value)}
          className={controlClass}
          listClassName={darkListClass}
          optionClassName={darkOptionClass}
        >
          <option className={optionClass} value="">All Gemstones</option>
          {gemstoneOptions.map((g) => (
            <option key={g} className={optionClass} value={g}>{g}</option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className={controlClass}
          listClassName={darkListClass}
          optionClassName={darkOptionClass}
        >
          <option className={optionClass} value="">All Types</option>
          <option className={optionClass} value="gemstone">Loose Gemstones</option>
          <option className={optionClass} value="jewelry">Jewelry</option>
        </Select>
        <Select
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className={controlClass}
          listClassName={darkListClass}
          optionClassName={darkOptionClass}
        >
          <option className={optionClass} value="">Any Price</option>
          {PRICE_CEILINGS[currency].map((ceiling) => (
            <option key={ceiling} className={optionClass} value={ceiling}>Up to {formatPrice(ceiling, currency)}</option>
          ))}
        </Select>
        <label className={cn(controlClass, "flex cursor-pointer items-center gap-2")}>
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-current" />
          In Stock Only
        </label>
      </div>

      {filtered.length === 0 && (
        <p className={cn("mt-12 text-center text-sm opacity-60", theme.bodyClass)}>No pieces match those filters right now.</p>
      )}

      {groups.map(({ section, items: groupItems }) => {
        if (groupItems.length === 0) return null;
        return (
          <div key={section?.key ?? "all"} className="mt-10">
            <h2 className={cn("font-serif text-2xl", theme.headingClass)}>{section?.label ?? theme.collectionGridLabel}</h2>
            {section && <p className={cn("mt-1.5 max-w-md text-sm opacity-70", theme.bodyClass)}>{section.description}</p>}
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {groupItems.map((item, i) => (
                <CollectionProductCard key={item.id} item={item} theme={theme} priority={i < 4} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
