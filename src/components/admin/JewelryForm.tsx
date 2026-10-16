"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJewelry, updateJewelry, deleteJewelry } from "@/actions/catalog-admin";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StoreField, type ListingMarket } from "@/components/admin/StoreField";
import { LkPricingFields } from "@/components/admin/LkPricingFields";
import { DraftMediaPicker } from "@/components/admin/DraftMediaPicker";
import { PIECE_TYPES, METAL_TYPES } from "@/lib/gem-constants";
import { JEWELRY_AUDIENCES, AUDIENCE_LABELS, pieceTypeLabel } from "@/lib/jewelry-categories";

interface JewelryFormProps {
  shippingWeightTiers: { id: string; label: string }[];
  initial?: {
    id: string;
    name: string;
    description: string | null;
    pieceType: string;
    audience?: string;
    metalType: string;
    metalPurity: string | null;
    metalWeightG: number | null;
    ringSize: string | null;
    styleTags: string[];
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
  /** Which store a NEW piece starts on (from the list page's "Add Sri Lanka" button). */
  defaultMarket?: ListingMarket;
  /** A STAFF member: no cost price, no featuring, no deleting, and an existing
   * item's prices are read-only (the server enforces all of this too). */
  staff?: boolean;
  /** Fixes the store picker (a STAFF member scoped to one store). */
  lockMarket?: boolean;
}

export function JewelryForm({ shippingWeightTiers, initial, defaultMarket, staff = false, lockMarket = false }: JewelryFormProps) {
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

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const result = initial ? await updateJewelry(initial.id, formData) : await createJewelry(formData);
      if (result && !result.ok) {
        setError(result.error);
      } else if (initial) {
        // A new piece instead redirects (createJewelry calls redirect()
        // server-side), so a toast there would fire right as the page
        // navigates away — not worth it. An update stays on the same page
        // (router.refresh()), where the confirmation is actually visible.
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
      const result = await deleteJewelry(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/jewelry");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="max-w-2xl space-y-8">
      <StoreField market={market} onChange={setMarket} locked={!!initial || lockMarket} noun="piece" />

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
          <Label htmlFor="pieceType">Piece Type</Label>
          <Select id="pieceType" name="pieceType" defaultValue={initial?.pieceType ?? "RING"}>
            {PIECE_TYPES.map((p) => <option key={p} value={p}>{pieceTypeLabel(p)}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="audience">Designed for</Label>
          <Select id="audience" name="audience" defaultValue={initial?.audience ?? "UNISEX"}>
            {JEWELRY_AUDIENCES.map((a) => <option key={a} value={a.toUpperCase()}>{AUDIENCE_LABELS[a]}</option>)}
          </Select>
          <p className="mt-1 text-xs text-charcoal/45">
            The top level of the jewelry catalog. Men and Women also show Unisex pieces; Couple is for matching pairs.
          </p>
        </div>
        <div>
          <Label htmlFor="metalType">Metal Type</Label>
          <Select id="metalType" name="metalType" defaultValue={initial?.metalType ?? "GOLD"}>
            {METAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="metalPurity">Metal Purity</Label>
          <Input id="metalPurity" name="metalPurity" defaultValue={initial?.metalPurity ?? ""} placeholder="E.g. 18K, 950" />
        </div>
        <div>
          <Label htmlFor="metalWeightG">Metal Weight (g)</Label>
          <Input id="metalWeightG" name="metalWeightG" type="number" step="0.01" defaultValue={initial?.metalWeightG ?? ""} />
        </div>
        <div>
          <Label htmlFor="ringSize">Ring Size / Adjustability</Label>
          <Input id="ringSize" name="ringSize" defaultValue={initial?.ringSize ?? ""} />
        </div>
        <div>
          <Label htmlFor="styleTags">Style Tags (comma-separated)</Label>
          <Input id="styleTags" name="styleTags" defaultValue={initial?.styleTags?.join(", ") ?? ""} placeholder="Bridal, Everyday, Statement" />
        </div>
        <div>
          <Label htmlFor="stockStatus">Stock Status</Label>
          <Select id="stockStatus" name="stockStatus" defaultValue={initial?.stockStatus ?? "AVAILABLE"}>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
          </Select>
        </div>
        {!lk && !lockPricing && (
        <>
        <div>
          <Label htmlFor="price">Price (USD)</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={initial?.price ?? ""} placeholder="E.g. 6800" />
          <p className="mt-1 text-xs text-charcoal/45">
            Used as the quoting reference either way. Only shown to customers if &ldquo;Show price publicly&rdquo; is
            checked.
          </p>
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-charcoal/75">
          <input type="hidden" name="showPrice" value="false" />
          <input type="checkbox" name="showPrice" value="true" defaultChecked={initial?.showPrice ?? false} className="accent-gold" />
          Show price publicly (otherwise this piece stays quote-only)
        </label>
        </>
        )}
      </section>

      {!lk && !lockPricing && (
      <section className="grid gap-5 sm:grid-cols-2 border-t border-border-subtle pt-5">
        <div>
          <Label htmlFor="retailPrice">Retail Price (USD)</Label>
          <Input id="retailPrice" name="retailPrice" type="number" step="0.01" min="0" defaultValue={initial?.retailPrice ?? ""} placeholder="E.g. 7400" />
          <p className="mt-1 text-xs text-charcoal/45">
            Once set, retail customers see this price directly and can buy the piece outright — always shown,
            independent of &ldquo;Show price publicly&rdquo; above.
          </p>
        </div>
        {!staff && (
        <div>
          <Label htmlFor="costPrice">Cost Price (USD)</Label>
          <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue={initial?.costPrice ?? ""} placeholder="E.g. 4200" />
          <p className="mt-1 text-xs text-charcoal/45">
            Internal only, never shown to customers. Used to compute the birthday promotion&apos;s 10%-off-profit
            discount (Retail Price − Cost Price) — left blank, this piece simply never gets that discount.
          </p>
        </div>
        )}
      </section>
      )}

      {lk && !lockPricing && <LkPricingFields initial={initial} noun="piece" hideCost={staff} />}
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
        Featured (shown in the {lk ? "Sri Lanka" : "international"} home page&apos;s Featured Jewelry section)
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
          {pending ? "Saving..." : initial ? "Save Changes" : "Create Jewelry Piece"}
        </Button>
        {initial && !staff && (
          <Button type="button" variant="outline" disabled={pending} onClick={handleDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
