"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/ui/MarketLink";
import { ShoppingBag, Check } from "lucide-react";
import { addToRetailCart } from "@/actions/retail-cart";
import { Button } from "@/components/ui/Button";

// Adding an item stays on the product page (so a customer can add
// several items before checking out) rather than redirecting to the
// cart.
export function AddToCartButton({ gemstoneId, jewelryId, jewelryVariantId }: { gemstoneId?: string; jewelryId?: string; jewelryVariantId?: string }) {
  const t = useTranslations("product");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await addToRetailCart({ gemstoneId, jewelryId, jewelryVariantId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdded(true);
    });
  }

  return (
    <div>
      <Button type="button" variant="primary" size="lg" disabled={pending} onClick={handleClick} className="flex items-center gap-2">
        {added ? <Check size={18} className="animate-heart-pop" /> : <ShoppingBag size={18} />}
        {pending ? t("adding") : added ? t("added") : t("addToCart")}
      </Button>
      {added && (
        <p className="animate-fade-in mt-2 text-sm text-charcoal/70">
          {t.rich("addedNote", {
            link: (chunks) => <Link href="/account/retail-cart" className="text-gold-deep underline hover:text-charcoal">{chunks}</Link>,
          })}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
