"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { bulkSetCatalogStatus, type CatalogKind } from "@/actions/catalog-admin";
import { LISTING_STATUSES, LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/item-number";
import { Button } from "@/components/ui/Button";

interface SelectionContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("CatalogRowCheckbox/CatalogBulkToolbar must be used inside CatalogBulkSelectionProvider");
  return ctx;
}

/** Wraps an admin catalog table (gems or jewelry) to add bulk-select —
 * one shared selection Set, provided via context so a server-rendered
 * <table>'s row checkboxes and the toolbar above it can both reach it
 * without lifting the whole table into a client component. */
export function CatalogBulkSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function CatalogRowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label="Select row"
      className="h-4 w-4 rounded border-border-subtle accent-charcoal"
    />
  );
}

/** "N selected" + the bulk actions, shown only once something's checked:
 * move the batch to Draft / Finished / Live (only Live is on the storefront),
 * or open a printable sheet of their QR labels. Doesn't touch
 * isFeatured/stockStatus — those already have their own per-row controls. */
export function CatalogBulkToolbar({ kind }: { kind: CatalogKind }) {
  const { selected, clear } = useSelection();
  const router = useRouter();
  const [pending, setPending] = useState<ListingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (selected.size === 0) return null;

  async function apply(status: ListingStatus) {
    setError(null);
    setPending(status);
    try {
      const result = await bulkSetCatalogStatus(kind, [...selected], status);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clear();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const labelsHref = `/admin/${kind === "gemstone" ? "gems" : "jewelry"}/qr-labels?ids=${[...selected].join(",")}`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5">
      <p className="text-sm text-charcoal">{selected.size} selected</p>
      <span className="text-xs text-charcoal/60">Set status:</span>
      {LISTING_STATUSES.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant={status === "LIVE" ? "gold" : "outline"}
          disabled={pending !== null}
          onClick={() => apply(status)}
        >
          {pending === status ? "Working..." : LISTING_STATUS_LABELS[status].label}
        </Button>
      ))}
      <Link
        href={labelsHref}
        target="_blank"
        className="ml-auto inline-flex items-center gap-1.5 text-sm text-charcoal underline decoration-charcoal/30 underline-offset-2 hover:text-gold"
      >
        <QrCode className="h-4 w-4" aria-hidden />
        Print QR labels
      </Link>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
