"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Gem } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";
import { getSearchSuggestionsForHeader } from "@/actions/search";
import type { SearchSuggestion, SearchSuggestions } from "@/lib/search-suggestions";
import { Modal } from "@/components/ui/Modal";
import Link from "@/components/ui/MarketLink";

const DEBOUNCE_MS = 300;
const EMPTY: SearchSuggestions = { gems: [], jewelry: [] };

/**
 * Every competitor site reviewed (Blue Nile, Brilliant Earth, thenaturalgem.com)
 * puts search directly in the header — this site's search previously only
 * existed inside each catalog's own filter bar, meaning a shopper on any
 * other page (home, about, a product detail page) had no way to search at
 * all without first navigating to /gems or /jewelry.
 *
 * Opens as a proper overlay (not an inline-expanding input, the previous
 * design) with live suggestions as the shopper types — a lightweight,
 * separately-queried preview (see lib/search-suggestions.ts; the full
 * /search page's own query is too heavy to run on every keystroke).
 * Submitting (Enter, the button, or "View all results") always goes to
 * /search?q=..., which queries both catalogs at once since a shopper
 * typing "necklace" shouldn't have to guess which one to search first.
 */
export function HeaderSearch({ transparent }: { transparent: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  // Which query string `suggestions` actually reflects — lets "loading" be
  // derived during render (value.trim() !== suggestionsFor) instead of its
  // own setState called synchronously from an effect body.
  const [suggestionsFor, setSuggestionsFor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const router = useRouter();
  const market = useMarket();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    // Below the minimum length, nothing is fetched and any stale
    // suggestions simply never render — see hasQuery gating them below —
    // so there's nothing to reset state for here.
    if (q.length < 2) return;
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const result = await getSearchSuggestionsForHeader(q);
      // Ignore a stale response that resolved after a newer keystroke's
      // request — otherwise a slow early request can overwrite a faster
      // later one's results.
      if (thisRequestId === requestIdRef.current) {
        setSuggestions(result);
        setSuggestionsFor(q);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function close() {
    setOpen(false);
    setValue("");
    setSuggestions(EMPTY);
    setSuggestionsFor("");
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(withMarket(`/search?q=${encodeURIComponent(q)}`, market));
    close();
  }

  const trimmedValue = value.trim();
  const hasQuery = trimmedValue.length >= 2;
  const loading = hasQuery && suggestionsFor !== trimmedValue;
  const hasResults = !loading && (suggestions.gems.length > 0 || suggestions.jewelry.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn("transition-colors duration-300", transparent ? "text-cream/85 hover:text-cream" : "text-charcoal/80 hover:text-charcoal")}
      >
        <Search size={19} />
      </button>

      <Modal open={open} onClose={close} title="Search" className="max-w-lg">
        <form onSubmit={submit} className="flex items-center gap-2 border-b border-border-subtle pb-3">
          <Search size={16} className="shrink-0 text-charcoal/65" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search gems, jewelry..."
            className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal/65"
          />
        </form>

        <div className="mt-3 max-h-96 overflow-y-auto">
          {!hasQuery && <p className="px-1 py-6 text-center text-sm text-charcoal/65">Try a mineral, a piece type, or a style — &ldquo;sapphire,&rdquo; &ldquo;ring,&rdquo; &ldquo;pear cut.&rdquo;</p>}

          {hasQuery && loading && <p className="px-1 py-6 text-center text-sm text-charcoal/65">Searching...</p>}

          {hasQuery && !loading && !hasResults && (
            <p className="px-1 py-6 text-center text-sm text-charcoal/65">No matches for &ldquo;{trimmedValue}&rdquo; yet.</p>
          )}

          {hasQuery && hasResults && (
            <div className="space-y-4">
              {suggestions.gems.length > 0 && <SuggestionGroup title="Gemstones" items={suggestions.gems} basePath="gems" market={market} onSelect={close} />}
              {suggestions.jewelry.length > 0 && <SuggestionGroup title="Jewelry" items={suggestions.jewelry} basePath="jewelry" market={market} onSelect={close} />}
            </div>
          )}
        </div>

        {hasQuery && (
          <button
            type="button"
            onClick={() => submit()}
            className="mt-3 w-full rounded-lg border border-border-subtle py-2 text-center text-sm text-gold-deep transition-colors hover:border-gold-deep hover:bg-gold/5"
          >
            View all results for &ldquo;{trimmedValue}&rdquo; →
          </button>
        )}
      </Modal>
    </>
  );
}

function SuggestionGroup({
  title,
  items,
  basePath,
  market,
  onSelect,
}: {
  title: string;
  items: SearchSuggestion[];
  basePath: "gems" | "jewelry";
  market: "intl" | "lk";
  onSelect: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-charcoal/65">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={withMarket(`/${basePath}/${item.slug}`, market)}
            onClick={onSelect}
            className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-ivory-soft"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ivory-soft">
              {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" /> : <Gem size={16} strokeWidth={1} className="text-charcoal/25" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-charcoal">{item.name}</span>
            {item.price != null && <span className="shrink-0 text-xs text-charcoal/60">{formatPrice(item.price, item.currency)}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
