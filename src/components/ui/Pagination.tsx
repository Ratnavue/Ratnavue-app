import Link from "@/components/ui/MarketLink";
import { cn } from "@/lib/utils";

/**
 * Shared page-number nav for any list view — public catalog pages and admin
 * tables alike. Pure server-rendered links (no client JS): each href is
 * `?<other query params>&page=N` relative to the current route, built from
 * whatever searchParams the page already received, so filters/sorts/status
 * tabs survive a page change and a page change survives a back-button.
 * Page 1 omits the `page` param entirely, matching how these routes already
 * treat "no page in the URL" as page 1.
 */
export function Pagination({
  currentPage,
  totalPages,
  searchParams,
  paramName = "page",
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  /** Defaults to "page" — override when a page renders more than one
   * paginated list at once (e.g. /search's separate gem/jewelry results)
   * so each list's page number survives independently in the URL instead
   * of both controls fighting over the same `?page=`. */
  paramName?: string;
}) {
  if (totalPages <= 1) return null;

  function hrefForPage(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === paramName || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, value);
    }
    if (page > 1) params.set(paramName, String(page));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  // A window of page numbers around the current one, plus the first/last
  // page always pinned, with "…" filling any gap — keeps the control a
  // fixed, scannable width even when there are dozens of pages.
  const window = 1;
  const pages = new Set<number>([1, totalPages]);
  for (let p = currentPage - window; p <= currentPage + window; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const linkBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      <Link
        href={hrefForPage(Math.max(1, currentPage - 1))}
        aria-label="Previous page"
        aria-disabled={currentPage === 1}
        className={cn(
          linkBase,
          "border border-border-subtle text-charcoal/70",
          currentPage === 1 ? "pointer-events-none opacity-35" : "hover:border-charcoal hover:text-charcoal"
        )}
      >
        ←
      </Link>

      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1] > 1 && <span className="px-1 text-charcoal/65">…</span>}
          <Link
            href={hrefForPage(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={cn(
              linkBase,
              p === currentPage ? "bg-charcoal text-ivory" : "text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal"
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={hrefForPage(Math.min(totalPages, currentPage + 1))}
        aria-label="Next page"
        aria-disabled={currentPage === totalPages}
        className={cn(
          linkBase,
          "border border-border-subtle text-charcoal/70",
          currentPage === totalPages ? "pointer-events-none opacity-35" : "hover:border-charcoal hover:text-charcoal"
        )}
      >
        →
      </Link>
    </nav>
  );
}
