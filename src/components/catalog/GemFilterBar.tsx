import { Input, Label, Select } from "@/components/ui/Field";
import { Button, HardLinkButton } from "@/components/ui/Button";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { FilterCollapse } from "@/components/catalog/FilterCollapse";
import { GEM_COLOR_FAMILIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/ui/CurrencySymbol";
import { getTranslations } from "next-intl/server";

interface GemFilterBarProps {
  minerals: { slug: string; name: string }[];
  cuts: { slug: string; name: string }[];
  clarityGrades: { slug: string; name: string }[];
  treatments: { slug: string; name: string }[];
  origins: { slug: string; name: string }[];
  current: Record<string, string | string[] | undefined>;
}

function toSet(value: string | string[] | undefined): Set<string> {
  if (value === undefined) return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// One collapsible checkbox group — <details>/<summary> rather than a client
// component with useState, so every group works (and submits normally)
// without any JS at all, matching the rest of this form. Open by default
// when it already has an active selection, so a filter an admin/customer
// just applied doesn't look like it silently vanished after a reload.
function CheckboxGroup({
  label,
  name,
  options,
  active,
  showShapeIcons,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  active: Set<string>;
  /** Cut/shape options only — renders each one's actual faceted outline
   * (the same procedural GemVisualizer the rest of the catalog uses, just
   * neutral-toned) beside its label, the "visual shape picker" pattern
   * competitor sites (Blue Nile, Brilliant Earth) use instead of a plain
   * text list. Reuses the real renderer rather than hand-drawn icons, so
   * it can never drift out of sync with how a cut actually looks. */
  showShapeIcons?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <details className="group rounded-lg border border-border-subtle p-3" open={active.size > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wide text-charcoal/70">
        {label}
        {active.size > 0 && <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] text-charcoal">{active.size}</span>}
        <span className="ml-auto text-charcoal/65 group-open:hidden">+</span>
        <span className="hidden text-charcoal/65 group-open:inline">−</span>
      </summary>
      <div className="mt-3 flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name={name} value={opt.value} defaultChecked={active.has(opt.value)} className="accent-gold" />
            {showShapeIcons && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ivory-soft">
                {/* resolveGemColor floors saturation at 35% (gems never
                    render fully desaturated), so true grayscale isn't
                    achievable here — a muted gold tone instead, which
                    doubles as reading like the site's own accent colour
                    rather than an arbitrary neutral. */}
                <GemVisualizer
                  cutSlug={opt.value}
                  hue={40}
                  darkness={45}
                  saturation={30}
                  claritySlug="loupe-clean"
                  caratWeight={1}
                  seedKey={opt.value}
                  className="h-7 w-7"
                />
              </span>
            )}
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export async function GemFilterBar({ minerals, cuts, clarityGrades, treatments, origins, current }: GemFilterBarProps) {
  const t = await getTranslations("catalog.filters");
  // `page` alone (no real filter set) shouldn't count as "something to
  // clear" — it'd make the button appear just from paging through an
  // unfiltered catalog, which has nothing to do with what it's for.
  const hasActiveFilters = Object.entries(current).some(([key, value]) => {
    if (key === "page") return false;
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  // Everything except the search text, sort, and page — what the mobile
  // "Filters" button's badge counts as "narrowing" the catalog.
  const activeCount = Object.entries(current).reduce((n, [key, value]) => {
    if (key === "q" || key === "sort" || key === "page" || !value) return n;
    return n + (Array.isArray(value) ? value.length : 1);
  }, 0);

  return (
    <form method="get" className="rounded-xl border border-border-subtle bg-surface p-5">
      <div className="mb-4">
        <Label htmlFor="q">{t("search")}</Label>
        <Input id="q" name="q" defaultValue={first(current.q)} placeholder={t("gemPlaceholder")} />
      </div>

      <FilterCollapse activeCount={activeCount}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CheckboxGroup label={t("mineral")} name="mineral" active={toSet(current.mineral)} options={minerals.map((m) => ({ value: m.slug, label: m.name }))} />
        <CheckboxGroup label={t("cut")} name="cut" active={toSet(current.cut)} options={cuts.map((c) => ({ value: c.slug, label: c.name }))} showShapeIcons />
        <CheckboxGroup label={t("colour")} name="color" active={toSet(current.color)} options={GEM_COLOR_FAMILIES.map((c) => ({ value: c.key, label: c.label }))} />
        <CheckboxGroup label={t("treatment")} name="treatment" active={toSet(current.treatment)} options={treatments.map((t) => ({ value: t.slug, label: t.name }))} />
        <CheckboxGroup label={t("clarity")} name="clarity" active={toSet(current.clarity)} options={clarityGrades.map((c) => ({ value: c.slug, label: c.name }))} />
        <CheckboxGroup label={t("origin")} name="origin" active={toSet(current.origin)} options={origins.map((o) => ({ value: o.slug, label: o.name }))} />

        <div className="rounded-lg border border-border-subtle p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/70">{t("price")} (<CurrencySymbol />)</p>
          <div className="mt-3 flex items-center gap-2">
            <Input name="minPrice" type="number" min={0} step="1" placeholder={t("min")} defaultValue={first(current.minPrice)} className="text-sm" />
            <span className="text-charcoal/65">–</span>
            <Input name="maxPrice" type="number" min={0} step="1" placeholder={t("max")} defaultValue={first(current.maxPrice)} className="text-sm" />
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/70">{t("carat")}</p>
          <div className="mt-3 flex items-center gap-2">
            <Input name="minCarat" type="number" min={0} step="0.1" placeholder={t("min")} defaultValue={first(current.minCarat)} className="text-sm" />
            <span className="text-charcoal/65">–</span>
            <Input name="maxCarat" type="number" min={0} step="0.1" placeholder={t("max")} defaultValue={first(current.maxCarat)} className="text-sm" />
          </div>
        </div>

        <div>
          <Label htmlFor="sort">{t("sortBy")}</Label>
          <Select id="sort" name="sort" defaultValue={first(current.sort) ?? "newest"}>
            <option value="newest">{t("newest")}</option>
            <option value="carat">{t("caratWeight")}</option>
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
          <HardLinkButton href="/gems" variant="outline" className="flex-1 sm:flex-none sm:px-10">{t("clear")}</HardLinkButton>
        )}
      </div>
    </form>
  );
}
