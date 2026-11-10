"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Debounced text search for an admin list page — writes to the `q` query
 * param (and resets `page` back to 1), the same URL-is-the-source-of-truth
 * convention this app's admin filter pills and Pagination already use, so
 * a search survives a page reload/back-button and composes with whatever
 * other filters a given list already has.
 */
export function AdminSearchBox({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  // Keeps the input in sync when the URL's own `q` changes from outside a
  // keystroke here (browser back/forward, a filter pill that also carries
  // `q`) — adjusting state during render, not in an effect, per React's own
  // guidance for "derived state that should reset when a prop changes."
  const [trackedUrlQuery, setTrackedUrlQuery] = useState(urlQuery);
  if (urlQuery !== trackedUrlQuery) {
    setTrackedUrlQuery(urlQuery);
    setValue(urlQuery);
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      params.delete("page");
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    }, 350);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
      <input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-border-subtle bg-surface py-1.5 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-gold-deep focus:outline-none"
      />
    </div>
  );
}
