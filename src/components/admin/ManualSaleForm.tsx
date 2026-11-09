"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAvailableCatalogItems, findCustomerByEmail, createManualSaleOrderAction, type CatalogSearchResult } from "@/actions/manual-sale";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

interface Line {
  key: string;
  kind: "gemstone" | "jewelry";
  gemstoneId?: string;
  jewelryId?: string;
  jewelryVariantId?: string;
  label: string;
  unitPrice: number;
}

type Market = "intl" | "lk";

export function ManualSaleForm() {
  const router = useRouter();
  const [market, setMarket] = useState<Market>("intl");
  const currency = market === "lk" ? "LKR" : "USD";

  const [customerEmail, setCustomerEmail] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [customerChecked, setCustomerChecked] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const [itemQuery, setItemQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  // Which "market:query" `results` actually reflects — lets "searching" be
  // derived during render instead of its own setState called synchronously
  // from an effect body (same pattern as HeaderSearch's suggestionsFor).
  const [resultsFor, setResultsFor] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "WIRE_TRANSFER">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);

  function handleMarketChange(next: Market) {
    setMarket(next);
    setLines([]);
    setResults([]);
    setItemQuery("");
  }

  async function handleLookupCustomer() {
    setLookingUp(true);
    setCustomerChecked(false);
    try {
      const found = await findCustomerByEmail(customerEmail);
      setCustomer(found);
    } finally {
      setLookingUp(false);
      setCustomerChecked(true);
    }
  }

  const trimmedQuery = itemQuery.trim();
  const queryKey = `${market}:${trimmedQuery}`;

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const thisRequestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      searchAvailableCatalogItems(market, trimmedQuery).then((found) => {
        // Ignore a stale response that resolved after a newer keystroke's
        // request — otherwise a slow early request can overwrite a faster
        // later one's results.
        if (thisRequestId === requestIdRef.current) {
          setResults(found);
          setResultsFor(queryKey);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmedQuery, market, queryKey]);

  const searching = trimmedQuery.length >= 2 && resultsFor !== queryKey;
  // A query shrunk back below 2 chars has nothing to show.
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

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!customer) {
      setError("Look up and select a customer first.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    formData.set("customerUserId", customer.id);
    formData.set("market", market);
    formData.set(
      "items",
      JSON.stringify(lines.map((l) => ({ gemstoneId: l.gemstoneId, jewelryId: l.jewelryId, jewelryVariantId: l.jewelryVariantId, unitPrice: l.unitPrice }))),
    );
    setPending(true);
    try {
      const result = await createManualSaleOrderAction(formData);
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
    <form ref={formRef} action={handleSubmit} className="max-w-2xl space-y-8">
      <section>
        <Label htmlFor="ms-market">Store</Label>
        <Select id="ms-market" value={market} onChange={(e) => handleMarketChange(e.target.value as Market)}>
          <option value="intl">International</option>
          <option value="lk">Sri Lanka</option>
        </Select>
      </section>

      <section>
        <Label htmlFor="ms-customer-email">Customer email</Label>
        <div className="flex gap-2">
          <Input
            id="ms-customer-email"
            type="email"
            value={customerEmail}
            onChange={(e) => {
              setCustomerEmail(e.target.value);
              setCustomer(null);
              setCustomerChecked(false);
            }}
            placeholder="customer@example.com"
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0 whitespace-nowrap" disabled={!customerEmail || lookingUp} onClick={handleLookupCustomer}>
            {lookingUp ? "Looking up..." : "Look up"}
          </Button>
        </div>
        {customerChecked && customer && (
          <p className="mt-1.5 text-xs text-emerald-700">Found: {customer.name ?? customer.email} ({customer.email})</p>
        )}
        {customerChecked && !customer && (
          <p className="mt-1.5 text-xs text-red-700">No account found with that email — the customer needs an account first.</p>
        )}
      </section>

      <section>
        <Label htmlFor="ms-item-search">Add items</Label>
        <Input id="ms-item-search" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Search available gems or jewelry by name..." />
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
                    {r.name} {r.price != null && <span className="text-charcoal/50">· {formatPrice(r.price, currency)}</span>}
                  </span>
                  {r.variants.length === 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addLine({ key: `${r.kind}-${r.id}`, kind: r.kind, gemstoneId: r.kind === "gemstone" ? r.id : undefined, jewelryId: r.kind === "jewelry" ? r.id : undefined, label: r.name, unitPrice: r.price ?? 0 })}
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
                        onClick={() => addLine({ key: `variant-${v.id}`, kind: "jewelry", jewelryId: r.id, jewelryVariantId: v.id, label: `${r.name} — ${v.label}`, unitPrice: v.price ?? r.price ?? 0 })}
                      >
                        {v.label}{v.price != null && ` · ${formatPrice(v.price, currency)}`}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Items in this sale</p>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/50">No items added yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2">
                <span className="flex-1 text-sm text-charcoal">{l.label}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.unitPrice}
                  onChange={(e) => updatePrice(l.key, Number(e.target.value))}
                  className="w-32"
                />
                <button type="button" className="text-xs text-red-700 underline" onClick={() => removeLine(l.key)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && <p className="mt-2 text-right text-sm font-medium text-charcoal">Total: {formatPrice(total, currency)}</p>}
      </section>

      <section>
        <p className="mb-2 text-sm font-medium text-charcoal">Payment</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="radio" name="paymentMethodChoice" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} className="accent-gold" />
            Cash
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="radio" name="paymentMethodChoice" checked={paymentMethod === "WIRE_TRANSFER"} onChange={() => setPaymentMethod("WIRE_TRANSFER")} className="accent-gold" />
            Bank transfer
          </label>
        </div>
        <input type="hidden" name="paymentMethod" value={paymentMethod} />

        {paymentMethod === "WIRE_TRANSFER" && (
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="ms-reference">Payment reference</Label>
              <Input id="ms-reference" name="paymentReference" required placeholder="Bank reference / slip number" />
            </div>
            <div>
              <Label htmlFor="ms-receipt">Receipt file (PDF, JPEG, PNG, or WEBP)</Label>
              <input id="ms-receipt" name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required className="block w-full text-sm" />
            </div>
          </div>
        )}
      </section>

      <FieldError>{error ?? undefined}</FieldError>

      <Button type="submit" variant="gold" disabled={pending}>
        {pending ? "Recording sale..." : "Record Sale"}
      </Button>
    </form>
  );
}
