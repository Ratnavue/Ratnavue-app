import { Input, Label, Select } from "@/components/ui/Field";
import { Button, HardLinkButton } from "@/components/ui/Button";
import { FilterCollapse } from "@/components/catalog/FilterCollapse";
import { PIECE_TYPES, METAL_TYPES } from "@/lib/gem-constants";
import { JEWELRY_AUDIENCES, AUDIENCE_LABELS, pieceTypeLabel } from "@/lib/jewelry-categories";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/ui/CurrencySymbol";
import { getTranslations } from "next-intl/server";

interface JewelryFilterBarProps {
  current: Record<string, string | string[] | undefined>;
}

function toSet(value: string | string[] | undefined): Set<string> {
  if (value === undefined) return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Same collapsible, no-JS-needed checkbox group as GemFilterBar — see its
// own comment for why <details>/<summary> rather than a client component.
function CheckboxGroup({
  label,
  name,
  options,
  active,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  active: Set<string>;
}) {
  return (
    <details className="group rounded-lg border border-border-subtle p-3" open={active.size > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wide text-charcoal/70">
        {label}
        {active.size > 0 && <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] text-charcoal">{active.size}</span>}
        <span className="ml-auto text-charcoal/65 group-open:hidden">+</span>
        <span className="hidden text-charcoal/65 group-open:inline">−</span>
      </summary>
      <div className="mt-3 flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name={name} value={opt.value} defaultChecked={active.has(opt.value)} className="accent-gold" />
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export async function JewelryFilterBar({ current }: JewelryFilterBarProps) {
  const t = await getTranslations("catalog.filters");
  // `page` alone (no real filter set) shouldn't count as "something to
  // clear" — it'd make the button appear just from paging through an
  // unfiltered catalog, which has nothing to do with what it's for.
  const hasActiveFilters = Object.entries(current).some(([key, value]) => {
    if (key === "page") return false;
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  // See GemFilterBar — what the mobile "Filters" button's badge counts.
  const activeCount = Object.entries(current).reduce((n, [key, value]) => {
    if (key === "q" || key === "sort" || key === "page" || !value) return n;
    return n + (Array.isArray(value) ? value.length : 1);
  }, 0);

  return (
    <form method="get" className="rounded-xl border border-border-subtle bg-surface p-5">
      <div className="mb-4">
        <Label htmlFor="q">{t("search")}</Label>
        <Input id="q" name="q" defaultValue={first(current.q)} placeholder={t("jewelryPlaceholder")} />
      </div>

      <FilterCollapse activeCount={activeCount}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CheckboxGroup
          label={t("audience")}
          name="audience"
          active={toSet(current.audience)}
          options={JEWELRY_AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }))}
        />
        <CheckboxGroup
          label={t("pieceType")}
          name="pieceType"
          active={toSet(current.pieceType)}
          options={PIECE_TYPES.map((p) => ({ value: p, label: pieceTypeLabel(p, "plural") }))}
        />
        <CheckboxGroup label={t("metal")} name="metalType" active={toSet(current.metalType)} options={METAL_TYPES.map((m) => ({ value: m.value, label: m.label }))} />

        <div className="rounded-lg border border-border-subtle p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/70">{t("price")} (<CurrencySymbol />)</p>
          <div className="mt-3 flex items-center gap-2">
            <Input name="minPrice" type="number" min={0} step="1" placeholder={t("min")} defaultValue={first(current.minPrice)} className="text-sm" />
            <span className="text-charcoal/65">–</span>
            <Input name="maxPrice" type="number" min={0} step="1" placeholder={t("max")} defaultValue={first(current.maxPrice)} className="text-sm" />
          </div>
        </div>

        <div>
          <Label htmlFor="sort">{t("sortBy")}</Label>
          <Select id="sort" name="sort" defaultValue={first(current.sort) ?? "newest"}>
            <option value="newest">{t("newest")}</option>
            <option value="az">{t("alphabetical")}</option>
            <option value="price-low">{t("priceLow")}</option>
            <option value="price-high">{t("priceHigh")}</option>
          </Select>
        </div>

        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name="inStockOnly" value="1" defaultChecked={first(current.inStockOnly) === "1"} className="accent-gold" />
            {t("inStockOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name="promotional" value="1" defaultChecked={first(current.promotional) === "1"} className="accent-gold" />
            {t("onPromotion")}
          </label>
        </div>
      </div>
      </FilterCollapse>

      <div className={cn("mt-5 flex gap-3", hasActiveFilters ? "" : "sm:w-56")}>
        <Button type="submit" variant="primary" className="flex-1 sm:flex-none sm:px-10">{t("filter")}</Button>
        {hasActiveFilters && (
          <HardLinkButton href="/jewelry" variant="outline" className="flex-1 sm:flex-none sm:px-10">{t("clear")}</HardLinkButton>
        )}
      </div>
    </form>
  );
}
