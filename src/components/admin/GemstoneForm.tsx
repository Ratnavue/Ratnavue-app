"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { hueAtPercent, percentAtHue, resolveGemColor } from "@/components/gem-visualizer/color";
import { createGemstone, updateGemstone, deleteGemstone } from "@/actions/catalog-admin";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StoreField, type ListingMarket } from "@/components/admin/StoreField";
import { LkPricingFields } from "@/components/admin/LkPricingFields";
import { DraftMediaPicker } from "@/components/admin/DraftMediaPicker";

interface Option {
  id: string;
  name: string;
  slug?: string;
  hueMin?: number;
  hueMax?: number;
  category?: string;
}

interface GemstoneFormProps {
  minerals: Option[];
  cuts: Option[];
  clarityGrades: Option[];
  treatments: Option[];
  origins: Option[];
  certificationLabs: Option[];
  shippingWeightTiers: { id: string; label: string }[];
  initial?: {
    id: string;
    name: string;
    description: string | null;
    mineralId: string;
    variety: string | null;
    cutId: string;
    caratWeight: number;
    lengthMm: number | null;
    widthMm: number | null;
    depthMm: number | null;
    colorHue: number;
    colorSaturation: number;
    colorLightness: number;
    colorLabel: string | null;
    clarityGradeId: string;
    treatmentId: string;
    originId: string;
    symmetryNotes: string | null;
    polishNotes: string | null;
    certLabId: string | null;
    certReportNumber: string | null;
    certFileUrl: string | null;
    price: number | null;
    showPrice: boolean;
    retailPrice: number | null;
    costPrice: number | null;
    stockStatus: string;
    isPublished: boolean;
    isFeatured: boolean;
    market: string;
    lkrRetailPrice: number | null;
    lkrPrice: number | null;
    shippingWeightTierId: string | null;
    quoteShipping: boolean;
  };
  /** Which store a NEW gemstone starts on (from the list page's "Add Sri Lanka" button). */
  defaultMarket?: ListingMarket;
  /** A STAFF member: no cost price, no featuring, no deleting, and an existing
   * item's prices are read-only (the server enforces all of this too). */
  staff?: boolean;
  /** Fixes the store picker (a STAFF member scoped to one store). */
  lockMarket?: boolean;
}

export function GemstoneForm({ minerals, cuts, clarityGrades, treatments, origins, certificationLabs, shippingWeightTiers, initial, defaultMarket, staff = false, lockMarket = false }: GemstoneFormProps) {
  const lockPricing = staff && !!initial;
  const router = useRouter();
  const [market, setMarket] = useState<ListingMarket>((initial?.market as ListingMarket | undefined) ?? defaultMarket ?? "intl");
  const lk = market === "lk";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const [shippingWeightTierId, setShippingWeightTierId] = useState(initial?.shippingWeightTierId ?? "");
  const [quoteShipping, setQuoteShipping] = useState(initial?.quoteShipping ?? false);

  const [mineralId, setMineralId] = useState(initial?.mineralId ?? minerals[0]?.id ?? "");
  const [cutId, setCutId] = useState(initial?.cutId ?? cuts[0]?.id ?? "");
  const [caratWeight, setCaratWeight] = useState(initial?.caratWeight ?? 1);
  const [huePercent, setHuePercent] = useState(() => {
    const m = minerals.find((x) => x.id === (initial?.mineralId ?? minerals[0]?.id));
    return m ? percentAtHue(m.hueMin ?? 0, m.hueMax ?? 360, initial?.colorHue ?? (m.hueMin ?? 0)) : 50;
  });
  const [darkness, setDarkness] = useState(initial?.colorLightness ?? 45);
  const [clarityId, setClarityId] = useState(initial?.clarityGradeId ?? clarityGrades[0]?.id ?? "");

  const mineral = minerals.find((m) => m.id === mineralId);
  const cut = cuts.find((c) => c.id === cutId);
  const clarity = clarityGrades.find((c) => c.id === clarityId);
  const hue = mineral ? hueAtPercent(mineral.hueMin ?? 0, mineral.hueMax ?? 360, huePercent) : 0;

  function handleMineralChange(id: string) {
    const next = minerals.find((m) => m.id === id);
    setMineralId(id);
    if (next) setHuePercent(percentAtHue(next.hueMin ?? 0, next.hueMax ?? 360, hue));
  }

  const gradientStops = useMemo(() => {
    if (!mineral) return "";
    const steps = 12;
    const stops = Array.from({ length: steps + 1 }, (_, i) => {
      const p = (i / steps) * 100;
      const h = hueAtPercent(mineral.hueMin ?? 0, mineral.hueMax ?? 360, p);
      return resolveGemColor(h, darkness).base;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [mineral, darkness]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const result = initial ? await updateGemstone(initial.id, formData) : await createGemstone(formData);
      if (result && !result.ok) {
        setError(result.error);
      } else if (initial) {
        // See JewelryForm's matching comment — a new gem instead redirects
        // server-side, where a toast wouldn't be visible.
        toast("Saved");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!(await confirm(`Delete "${initial.name}"? This cannot be undone.`, { confirmLabel: "Delete", danger: true }))) return;
    setError(null);
    setPending(true);
    try {
      const result = await deleteGemstone(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/gems");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div>
        <div className="rounded-xl border border-border-subtle bg-gradient-to-b from-ivory-soft to-ivory p-6">
          {cut && (
            <GemVisualizer
              cutSlug={cut.slug ?? "round-brilliant"}
              hue={hue}
              darkness={darkness}
              claritySlug={clarity?.slug ?? "eye-clean"}
              caratWeight={caratWeight}
              seedKey="admin-preview"
              className="aspect-square w-full"
            />
          )}
        </div>
        <p className="mt-2 text-center text-xs text-charcoal/45">Live preview from the fields on the right.</p>
      </div>

      <form action={handleSubmit} className="space-y-8">
        <StoreField market={market} onChange={setMarket} locked={!!initial || lockMarket} noun="gemstone" />

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} />
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="mineralId">Mineral</Label>
            <Select id="mineralId" name="mineralId" value={mineralId} onChange={(e) => handleMineralChange(e.target.value)}>
              {minerals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="variety">Variety</Label>
            <Input id="variety" name="variety" defaultValue={initial?.variety ?? ""} placeholder="E.g. Padparadscha" />
          </div>
          <div>
            <Label htmlFor="cutId">Cut</Label>
            <Select id="cutId" name="cutId" value={cutId} onChange={(e) => setCutId(e.target.value)}>
              <optgroup label="Faceted">
                {cuts.filter((c) => c.category === "FACETED").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Cabochon">
                {cuts.filter((c) => c.category === "CABOCHON").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </Select>
          </div>
          <div>
            <Label htmlFor="caratWeight">Carat Weight</Label>
            <Input
              id="caratWeight"
              name="caratWeight"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={caratWeight}
              onChange={(e) => setCaratWeight(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="lengthMm">Length (mm)</Label>
            <Input id="lengthMm" name="lengthMm" type="number" step="0.01" defaultValue={initial?.lengthMm ?? ""} />
          </div>
          <div>
            <Label htmlFor="widthMm">Width (mm)</Label>
            <Input id="widthMm" name="widthMm" type="number" step="0.01" defaultValue={initial?.widthMm ?? ""} />
          </div>
          <div>
            <Label htmlFor="depthMm">Depth (mm)</Label>
            <Input id="depthMm" name="depthMm" type="number" step="0.01" defaultValue={initial?.depthMm ?? ""} />
          </div>
          <div>
            <Label htmlFor="colorLabel">Colour Label</Label>
            <Input id="colorLabel" name="colorLabel" defaultValue={initial?.colorLabel ?? ""} placeholder="E.g. Royal Blue" />
          </div>
        </section>

        <section>
          <Label>Colour (constrained to {mineral?.name})</Label>
          <input type="range" min={0} max={100} value={huePercent} onChange={(e) => setHuePercent(Number(e.target.value))} className="w-full" />
          <div className="h-2 rounded-full" style={{ background: gradientStops }} />
          <input type="hidden" name="colorHue" value={hue} />
          <input type="hidden" name="colorSaturation" value={72} />

          <div className="mt-4 flex items-center justify-between">
            <Label className="mb-0">Darkness / Tone</Label>
            <span className="text-sm text-charcoal/60">{darkness}</span>
          </div>
          <input type="range" min={0} max={100} name="colorLightness" value={darkness} onChange={(e) => setDarkness(Number(e.target.value))} className="w-full" />
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="clarityGradeId">Clarity</Label>
            <Select id="clarityGradeId" name="clarityGradeId" value={clarityId} onChange={(e) => setClarityId(e.target.value)}>
              {clarityGrades.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="treatmentId">Treatment</Label>
            <Select id="treatmentId" name="treatmentId" defaultValue={initial?.treatmentId ?? treatments[0]?.id}>
              {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="originId">Origin</Label>
            <Select id="originId" name="originId" defaultValue={initial?.originId ?? origins[0]?.id}>
              {origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="stockStatus">Stock Status</Label>
            <Select id="stockStatus" name="stockStatus" defaultValue={initial?.stockStatus ?? "AVAILABLE"}>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="SOLD">Sold</option>
            </Select>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="symmetryNotes">Symmetry / Polish Notes</Label>
            <Input id="symmetryNotes" name="symmetryNotes" defaultValue={initial?.symmetryNotes ?? ""} />
          </div>
          <div>
            <Label htmlFor="polishNotes">Polish Notes</Label>
            <Input id="polishNotes" name="polishNotes" defaultValue={initial?.polishNotes ?? ""} />
          </div>
          <div>
            <Label htmlFor="certLabId">Certification Lab</Label>
            <Select id="certLabId" name="certLabId" defaultValue={initial?.certLabId ?? ""}>
              <option value="">None</option>
              {certificationLabs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
            </Select>
            <p className="mt-1 text-xs text-charcoal/45">
              Manage the list (and each lab&apos;s verification URL) under Master Data → Certification Labs.
            </p>
          </div>
          <div>
            <Label htmlFor="certReportNumber">Certificate Report #</Label>
            <Input id="certReportNumber" name="certReportNumber" defaultValue={initial?.certReportNumber ?? ""} />
            <p className="mt-1 text-xs text-charcoal/45">
              If the selected lab has a verification URL configured, this number is substituted into it to build a
              &ldquo;Verify Certificate&rdquo; link on the public gem page.
            </p>
          </div>
        </section>

        {!lk && !lockPricing && (
        <>
        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Price (USD)</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={initial?.price ?? ""} placeholder="E.g. 4200" />
            <p className="mt-1 text-xs text-charcoal/45">
              Used as the quoting reference either way. Only shown to customers if &ldquo;Show price publicly&rdquo;
              is checked.
            </p>
          </div>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-charcoal/75">
            <input type="hidden" name="showPrice" value="false" />
            <input type="checkbox" name="showPrice" value="true" defaultChecked={initial?.showPrice ?? false} className="accent-gold" />
            Show price publicly (otherwise this item stays quote-only)
          </label>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 border-t border-border-subtle pt-5">
          <div>
            <Label htmlFor="retailPrice">Retail Price (USD)</Label>
            <Input id="retailPrice" name="retailPrice" type="number" step="0.01" min="0" defaultValue={initial?.retailPrice ?? ""} placeholder="E.g. 4800" />
            <p className="mt-1 text-xs text-charcoal/45">
              Once set, retail customers see this price directly and can buy the item outright — always shown,
              independent of &ldquo;Show price publicly&rdquo; above.
            </p>
          </div>
          {!staff && (
          <div>
            <Label htmlFor="costPrice">Cost Price (USD)</Label>
            <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue={initial?.costPrice ?? ""} placeholder="E.g. 2600" />
            <p className="mt-1 text-xs text-charcoal/45">
              Internal only, never shown to customers. Used to compute the birthday promotion&apos;s 10%-off-profit
              discount (Retail Price − Cost Price) — left blank, this item simply never gets that discount.
            </p>
          </div>
          )}
        </section>

        </>
        )}

        {lk && !lockPricing && <LkPricingFields initial={initial} noun="gemstone" hideCost={staff} />}
        {lockPricing && (
          <p className="rounded-lg border border-border-subtle bg-ivory-soft p-3 text-xs text-charcoal/60">
            Prices can only be changed by an admin.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-charcoal/75">
          <input type="hidden" name="isPublished" value="false" />
          <input type="checkbox" name="isPublished" value="true" defaultChecked={initial?.isPublished ?? true} className="accent-gold" />
          Published (visible in the public catalog)
        </label>

        {!staff && (
        <label className="flex items-center gap-2 text-sm text-charcoal/75">
          <input type="hidden" name="isFeatured" value="false" />
          <input type="checkbox" name="isFeatured" value="true" defaultChecked={initial?.isFeatured ?? false} className="accent-gold" />
          Featured (shown in the {lk ? "Sri Lanka" : "international"} home page&apos;s Featured Gemstones section)
        </label>
        )}

        <section className="rounded-xl border border-border-subtle bg-ivory-soft/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Shipping (optional)</p>
          <p className="mt-1 text-xs text-charcoal/50">
            Leave both blank to charge the normal destination-based rate. A weight tier gives this item its own flat
            rate instead; Quote Shipping charges nothing at checkout and flags the order for you to follow up on.
          </p>
          <div className="mt-3">
            <Label htmlFor="shippingWeightTierId">Weight tier</Label>
            <Select
              id="shippingWeightTierId"
              name="shippingWeightTierId"
              value={shippingWeightTierId}
              onChange={(e) => {
                setShippingWeightTierId(e.target.value);
                if (e.target.value) setQuoteShipping(false);
              }}
            >
              <option value="">None — use the destination-based rate</option>
              {shippingWeightTiers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-charcoal/75">
            <input type="hidden" name="quoteShipping" value="false" />
            <input
              type="checkbox"
              name="quoteShipping"
              value="true"
              checked={quoteShipping}
              onChange={(e) => {
                setQuoteShipping(e.target.checked);
                if (e.target.checked) setShippingWeightTierId("");
              }}
              className="accent-gold"
            />
            Quote Shipping (no fixed shipping cost — arranged with the customer after purchase)
          </label>
        </section>

        {!initial && (
          <section className="rounded-xl border border-border-subtle bg-ivory-soft/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Photos &amp; videos</p>
            <div className="mt-3">
              <DraftMediaPicker />
            </div>
          </section>
        )}

        <FieldError>{error ?? undefined}</FieldError>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="gold" disabled={pending}>
            {pending ? "Saving..." : initial ? "Save Changes" : "Create Gemstone"}
          </Button>
          {initial && !staff && (
            <Button type="button" variant="outline" disabled={pending} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
