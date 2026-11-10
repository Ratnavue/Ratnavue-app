"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Mobile-only sticky action bar — once the real buy box (Add to Cart /
 * Request a Quote, wrapped in `#buy-box` on the detail page) scrolls out of
 * view, a shopper on a long product page (gallery, specs, certification,
 * cross-sell) has no visible way to act without scrolling back up. Common
 * pattern on every jewelry competitor site reviewed. Doesn't duplicate the
 * cart/quote logic itself (auth checks, retail cart mutations) — that stays
 * exactly where it is; this just scrolls back to it, which is both simpler
 * and safer than re-implementing checkout-adjacent logic in a second place.
 */
export function StickyBuyBar({ name, priceLabel }: { name: string; priceLabel: string }) {
  const t = useTranslations("product");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById("buy-box");
    if (!target) return;
    // Shown only once the buy box has scrolled up out of view — not while
    // it's still below the fold, which on a phone is the moment the page
    // opens (the bar used to sit over the product title before the shopper
    // had scrolled at all).
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function scrollToBuyBox() {
    document.getElementById("buy-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div
      className={cn(
        // pr-20: FloatingChatButton floats fixed bottom-6 right-6 for
        // signed-in visitors (z-40, above this bar's z-30) — without this
        // clearance its circle sits directly on top of the CTA button
        // below, exactly where a thumb would tap to act on either one.
        "fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 py-3 pl-4 pr-20 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-transform duration-300 md:hidden",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-charcoal">{name}</p>
          <p className="text-xs text-charcoal/60">{priceLabel}</p>
        </div>
        <Button type="button" variant="gold" size="sm" onClick={scrollToBuyBox} className="shrink-0">
          {t("viewOptions")}
        </Button>
      </div>
    </div>
  );
}
