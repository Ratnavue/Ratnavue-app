"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAvailableCatalogItems, type CatalogSearchResult } from "@/actions/manual-sale";
import { quickCreateGemstoneForSourcing, quickCreateJewelryForSourcing, createSourcingOrderAction } from "@/actions/sourcing-order";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

interface Line {
  key: string;
  gemstoneId?: string;
  jewelryId?: string;
  jewelryVariantId?: string;
  label: string;
  unitPrice: number;
}

interface NamedOption {
  id: string;
  name: string;
}

export function SourcingOrderBuilder({
  sourcingRequestId,
  minerals,
  cuts,
  clarityGrades,
  treatments,
  origins,
}: {
  sourcingRequestId: string;
  minerals: NamedOption[];
  cuts: NamedOption[];
  clarityGrades: NamedOption[];
  treatments: NamedOption[];
  origins: NamedOption[];
}) {
  const router = useRouter();
  const [itemQuery, setItemQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [resultsFor, setResultsFor] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const requestIdRef = useRef(0);

  const [creating, setCreating] = useState<"gemstone" | "jewelry" | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingPending, setCreatingPending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const trimmedQuery = itemQuery.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const thisRequestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      searchAvailableCatalogItems("intl", trimmedQuery).then((found) => {
        if (thisRequestId === requestIdRef.current) {
          setResults(found);
          setResultsFor(trimmedQuery);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const searching = trimmedQuery.length >= 2 && resultsFor !== trimmedQuery;
  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  function addLine(line: Line) {
    setLines((prev) => (prev.some((l) => l.key === line.key) ? prev : [...prev, line]));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updatePrice(key: string, price: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unitPrice: price } : l)));
  }

  async function handleQuickCreate(formData: FormData) {
    setCreateError(null);
    setCreatingPending(true);
    try {
      const result = creating === "gemstone" ? await quickCreateGemstoneForSourcing(formData) : await quickCreateJewelryForSourcing(formData);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      addLine({
        key: `${result.item.kind}-${result.item.id}`,
        gemstoneId: result.item.kind === "gemstone" ? result.item.id : undefined,
        jewelryId: result.item.kind === "jewelry" ? result.item.id : undefined,
        label: result.item.name,
        unitPrice: 0,
      });
      setCreating(null);
    } finally {
      setCreatingPending(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    formData.set(
      "items",
      JSON.stringify(lines.map((l) => ({ gemstoneId: l.gemstoneId, jewelryId: l.jewelryId, jewelryVariantId: l.jewelryVariantId, unitPrice: l.unitPrice }))),
    );
    setPending(true);
    try {
      const result = await createSourcingOrderAction(sourcingRequestId, formData);
      if (!result.ok) setError(result.error);
      else if (result.redirectTo) router.push(result.redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice, 0);

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <Label htmlFor="so-item-search">Add an existing catalog item</Label>
        <Input id="so-item-search" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Search available gems or jewelry by name..." />
        {searching && <p className="mt-1.5 text-xs text-charcoal/50">Searching...</p>}
        {!searching && trimmedQuery.length >= 2 && visibleResults.length === 0 && (
          <p className="mt-1.5 text-xs text-charcoal/50">No available items match.</p>
        )}
        {visibleResults.length > 0 && (
          <ul className="mt-2 divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {visibleResults.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-charcoal">
                    {r.name} {r.price != null && <span className="text-charcoal/50">· {formatPrice(r.price)}</span>}
                  </span>
                  {r.variants.length === 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addLine({ key: `${r.kind}-${r.id}`, gemstoneId: r.kind === "gemstone" ? r.id : undefined, jewelryId: r.kind === "jewelry" ? r.id : undefined, label: r.name, unitPrice: r.price ?? 0 })}
                    >
                      Add
                    </Button>
                  )}
                </div>
                {r.variants.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="rounded-full border border-border-subtle px-3 py-1 text-xs text-charcoal/80 hover:border-gold"
                        onClick={() => addLine({ key: `variant-${v.id}`, jewelryId: r.id, jewelryVariantId: v.id, label: `${r.name} — ${v.label}`, unitPrice: v.price ?? r.price ?? 0 })}
                      >
                        {v.label}{v.price != null && ` · ${formatPrice(v.price)}`}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-ivory-soft/50 p-4">
        <p className="text-sm font-medium text-charcoal">Or create a new private item just for this sale</p>
        <p className="mt-1 text-xs text-charcoal/50">
          Not published or browsable — the customer only ever reaches it through this order.
        </p>
        {creating === null ? (
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating("gemstone")}>+ New Gemstone</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating("jewelry")}>+ New Jewelry Piece</Button>
          </div>
        ) : creating === "gemstone" ? (
          <form action={handleQuickCreate} className="mt-3 space-y-3">
            <div>
              <Label htmlFor="qcg-name">Name</Label>
              <Input id="qcg-name" name="name" required />
            </div>
            <div>
              <Label htmlFor="qcg-description">Description</Label>
              <Textarea id="qcg-description" name="description" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qcg-mineral">Mineral</Label>
                <Select id="qcg-mineral" name="mineralId" required defaultValue="">
                  <option value="" disabled>Select...</option>
                  {minerals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="qcg-cut">Cut</Label>
                <Select id="qcg-cut" name="cutId" required defaultValue="">
                  <option value="" disabled>Select...</option>
                  {cuts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="qcg-carat">Carat Weight</Label>
                <Input id="qcg-carat" name="caratWeight" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <Label htmlFor="qcg-clarity">Clarity</Label>
                <Select id="qcg-clarity" name="clarityGradeId" required defaultValue="">
                  <option value="" disabled>Select...</option>
                  {clarityGrades.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="qcg-treatment">Treatment</Label>
                <Select id="qcg-treatment" name="treatmentId" required defaultValue="">
                  <option value="" disabled>Select...</option>
                  {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="qcg-origin">Origin</Label>
                <Select id="qcg-origin" name="originId" required defaultValue="">
                  <option value="" disabled>Select...</option>
                  {origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="gold" disabled={creatingPending}>{creatingPending ? "Creating..." : "Create & Add"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={creatingPending} onClick={() => setCreating(null)}>Cancel</Button>
            </div>
            <FieldError>{createError ?? undefined}</FieldError>
          </form>
        ) : (
          <form action={handleQuickCreate} className="mt-3 space-y-3">
            <div>
              <Label htmlFor="qcj-name">Name</Label>
              <Input id="qcj-name" name="name" required />
            </div>
            <div>
              <Label htmlFor="qcj-description">Description</Label>
              <Textarea id="qcj-description" name="description" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qcj-pieceType">Piece Type</Label>
                <Select id="qcj-pieceType" name="pieceType" defaultValue="OTHER">
                  <option value="RING">Ring</option>
                  <option value="NECKLACE">Necklace</option>
                  <option value="EARRINGS">Earrings</option>
                  <option value="BRACELET">Bracelet</option>
                  <option value="PENDANT">Pendant</option>
                  <option value="BROOCH">Brooch</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="qcj-metalType">Metal Type</Label>
                <Select id="qcj-metalType" name="metalType" defaultValue="GOLD">
                  <option value="GOLD">Gold</option>
                  <option value="WHITE_GOLD">White Gold</option>
                  <option value="ROSE_GOLD">Rose Gold</option>
                  <option value="PLATINUM">Platinum</option>
                  <option value="SILVER">Silver</option>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="gold" disabled={creatingPending}>{creatingPending ? "Creating..." : "Create & Add"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={creatingPending} onClick={() => setCreating(null)}>Cancel</Button>
            </div>
            <FieldError>{createError ?? undefined}</FieldError>
          </form>
        )}
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Items in this order</p>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/50">No items added yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2">
                <span className="flex-1 text-sm text-charcoal">{l.label}</span>
                <Input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => updatePrice(l.key, Number(e.target.value))} className="w-32" />
                <button type="button" className="text-xs text-red-700 underline" onClick={() => removeLine(l.key)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && <p className="mt-2 text-right text-sm font-medium text-charcoal">Total: {formatPrice(total)}</p>}
      </section>

      <form action={handleSubmit}>
        <FieldError>{error ?? undefined}</FieldError>
        <Button type="submit" variant="gold" disabled={pending}>
          {pending ? "Sending..." : "Create Order & Notify Customer"}
        </Button>
      </form>
    </div>
  );
}
