"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The full filter panel (checkbox groups, price, carat, sort, toggles) starts
 * collapsed on every screen size behind a "Show filters" button, so the
 * results lead the page; the search box above it stays visible. A badge on
 * the button counts the filters already applied, so a collapsed panel never
 * hides the fact that the list is filtered.
 *
 * The collapsed content is hidden with CSS (collapsed to zero height and
 * `invisible`, so it slides open and shut), not unmounted, so
 * its inputs still submit with the surrounding GET form — a customer who
 * collapses the panel after choosing filters and then hits "Filter"
 * doesn't silently lose them.
 */
export function FilterCollapse({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const t = useTranslations("catalog.filters");
  const [open, setOpen] = useState(false);
  // Clipped while closed or mid-slide (that's what hides the content as the
  // row grows/shrinks); unclipped once fully open, so nothing inside —
  // a focus ring, a popover — gets cut off at the panel's edge.
  const [settled, setSettled] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSettled(false);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-border-subtle px-3.5 py-2.5 text-sm font-medium text-charcoal transition-colors hover:border-gold/50 sm:w-auto sm:gap-6"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={15} />
          {open ? t("hideFilters") : t("showFilters")}
          {activeCount > 0 && (
            <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-night">{activeCount}</span>
          )}
        </span>
        <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <div
        data-state={open ? "open" : "closed"}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && open) setSettled(true);
        }}
        className={cn(
          "motion-collapse grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-out",
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cn("min-h-0", open && settled ? "overflow-visible" : "overflow-hidden")}>
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </>
  );
}
