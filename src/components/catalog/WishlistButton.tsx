"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";
import { toggleWishlistAction } from "@/actions/wishlist";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  gemstoneId?: string;
  jewelryId?: string;
  initialSaved: boolean;
  isAuthenticated: boolean;
  className?: string;
}

// Sits as a small overlay on a catalog card (itself one big Link to the
// product) or beside a product page's buy box. Nested inside the card's
// own <a>, so every handler stops propagation/prevents default — otherwise
// a click here would also navigate the card away before the toggle lands.
export function WishlistButton({ gemstoneId, jewelryId, initialSaved, isAuthenticated, className }: WishlistButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const market = useMarket();

  const baseClass = cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-charcoal/60 shadow-sm backdrop-blur-sm transition-[color,transform] hover:scale-110 hover:text-red-500 active:scale-95",
    className,
  );

  if (!isAuthenticated) {
    return (
      // A button, not a link: this sits inside the card's own <a>, and an
      // <a> inside an <a> is invalid HTML (React reports it as a hydration
      // error). Navigating from the click handler behaves the same for a
      // visitor and keeps the markup valid.
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(withMarket("/account/login", market));
        }}
        className={baseClass}
        aria-label="Sign in to save to your wishlist"
      >
        <Heart size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !saved;
        setSaved(next); // optimistic — reconciled with the real result below
        startTransition(async () => {
          const result = await toggleWishlistAction({ gemstoneId, jewelryId });
          setSaved(result.ok ? result.saved : !next);
          // Re-renders the wishlist page's own server-fetched list (a
          // removed item otherwise leaves its now-stale card on screen
          // until an unrelated navigation happens to refetch it) — cheap
          // everywhere else too, since every other caller's card list is
          // keyed on item id and re-renders identically either way.
          router.refresh();
        });
      }}
      className={baseClass}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
    >
      <Heart key={saved ? "saved" : "unsaved"} size={16} className={saved ? "animate-heart-pop fill-red-500 text-red-500" : ""} />
    </button>
  );
}
