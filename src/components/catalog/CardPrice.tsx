"use client";

import { cn, formatPrice } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/providers/MarketProvider";

interface CardPriceProps {
  price?: number | null;
  showPrice?: boolean;
  /** The retail direct-purchase price (Gemstone/JewelryPiece.retailPrice)
   * — additive to price/showPrice above, not a replacement (see the field
   * comment in schema.prisma): once an admin sets it, it's always shown
   * and preferred over price/showPrice, but an item that still doesn't
   * have one falls back to exactly the old price/showPrice/Request-a-Quote
   * behaviour, unchanged. */
  retailPrice?: number | null;
  /** Set only when this item is in the *currently live* promotional
   * collection — see getActivePromotionMaps. */
  promoPrice?: number | null;
  priceClassName: string;
  quoteClassName: string;
}

// Shared by GemCard and JewelryCard's grid/list variants so a promotional
// price reads identically everywhere on the catalog, not just on the
// item's own detail page — the promo price in gold, the regular price
// struck through beside it only when the item has actually opted into
// public pricing and that price is higher (nothing honest to compare
// against otherwise), falling back to the existing price/Request-a-Quote
// behaviour when there's no active promotion at all.
export function CardPrice({ price, showPrice, retailPrice, promoPrice, priceClassName, quoteClassName }: CardPriceProps) {
  const currency = useCurrency();
  const t = useTranslations("catalog");
  const displayPrice = retailPrice ?? price;
  const displayable = retailPrice != null || !!showPrice;

  if (promoPrice != null) {
    const showRegular = displayable && displayPrice != null && displayPrice > promoPrice;
    return (
      <div className={cn("flex flex-wrap items-baseline gap-x-2", priceClassName)}>
        <span className="font-serif text-gold-deep">{formatPrice(promoPrice, currency)}</span>
        {showRegular && <span className="text-[0.85em] text-charcoal/65 line-through">{formatPrice(displayPrice!, currency)}</span>}
      </div>
    );
  }

  if (displayable && displayPrice != null) {
    return <p className={cn("font-serif text-charcoal", priceClassName)}>{formatPrice(displayPrice, currency)}</p>;
  }

  return (
    <p className={cn("font-medium text-gold-deep transition-colors group-hover:text-charcoal", quoteClassName)}>
      {t("requestQuote")}
    </p>
  );
}

// Same gold pill PromotionItemCard already uses on /promotions/collection
// — kept as one shared definition so the "this is on sale" visual
// language can't drift between where it first shows up and everywhere
// else it appears.
export function PromotionBadge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wide text-night sm:px-2.5 sm:py-1 sm:text-[11px]", className)}>
      Promotion
    </span>
  );
}
