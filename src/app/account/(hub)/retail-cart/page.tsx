import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRetailCartWithItems, retailCartItemLabel, retailCartSubtotal, retailCartUnitPrice } from "@/lib/retail-cart";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import { getMarket } from "@/lib/market";
import { getTranslations } from "next-intl/server";
import { MARKETS } from "@/lib/market-shared";
import { isBirthdayEligible } from "@/lib/birthday-promo";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { RetailCartItemRow } from "@/components/catalog/RetailCartItemRow";
import { RetailDiscountCodeControl } from "@/components/catalog/RetailDiscountCodeControl";
import { RetailPointsControl } from "@/components/catalog/RetailPointsControl";
import { LinkButton } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Your Cart" };

export default async function RetailCartPage() {
  const session = await auth();
  if (!session?.user) return null; // middleware guards this route

  const [market, t] = await Promise.all([getMarket(), getTranslations("cart")]);
  const currency = MARKETS[market].currency;
  const [cart, user, promotions, commerceSettings, loyalty] = await Promise.all([
    getRetailCartWithItems(session.user.id, market),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { dateOfBirth: true, lastBirthdayDiscountAt: true, pointsBalance: true } }),
    getActivePromotionMaps(market),
    getCommerceSettings(),
    getLoyaltySettings(),
  ]);

  const subtotal = retailCartSubtotal(cart.items.map((item) => ({ unitPrice: retailCartUnitPrice(item, market), quantity: item.quantity })));
  // Same currency-native convention as LoyaltySettings' LKR-specific rates —
  // each store's threshold is its own field, never converted from the other.
  const freeShippingThreshold = market === "lk" ? commerceSettings.freeShippingThresholdLkr : commerceSettings.freeShippingThresholdUsd;
  const amountToFreeShipping = freeShippingThreshold != null ? Math.max(0, freeShippingThreshold - subtotal) : null;
  const birthdayEligible = isBirthdayEligible(user);
  // A varianted line's real availability is its own variant's stock — the
  // parent piece's stockStatus is only a derived "any variant left"
  // summary once it has any (see lib/orders.ts's recompute).
  const itemStockStatus = (item: (typeof cart.items)[number]) => item.jewelryVariant?.stockStatus ?? item.gemstone?.stockStatus ?? item.jewelry?.stockStatus;
  const hasUnavailableItem = cart.items.some((item) => itemStockStatus(item) !== "AVAILABLE");
  const hasNonPromoItemWithCost = cart.items.some((item) => {
    const isPromotional = item.gemstoneId ? promotions.gemstonePrices.has(item.gemstoneId) : item.jewelryId ? promotions.jewelryPrices.has(item.jewelryId) : false;
    const costPrice = item.jewelryVariant?.costPrice ?? item.gemstone?.costPrice ?? item.jewelry?.costPrice ?? null;
    return !isPromotional && costPrice != null;
  });

  return (
    <div className="w-full">
      <p className="text-xs uppercase tracking-widest text-gold-deep">{t("kicker")}</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">{t("title")}</h1>

      {cart.items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface p-8 text-center">
          <p className="text-charcoal/60">{t("empty")}</p>
          <LinkButton href="/gems" variant="primary" className="mt-4">{t("browseGems")}</LinkButton>
        </div>
      ) : (
        <>
          {birthdayEligible && hasNonPromoItemWithCost && (
            <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-charcoal">
              {t("birthday")}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-border-subtle bg-surface p-5">
            {cart.items.map((item) => (
              <RetailCartItemRow
                key={item.id}
                item={{
                  id: item.id,
                  quantity: item.quantity,
                  unitPrice: retailCartUnitPrice(item, market),
                  label: retailCartItemLabel(item),
                  href: item.gemstone ? `/gems/${item.gemstone.slug}` : `/jewelry/${item.jewelry!.slug}`,
                  imageUrl: (item.gemstone?.media[0]?.url) ?? (item.jewelry?.media[0]?.url),
                  unavailable: itemStockStatus(item) !== "AVAILABLE",
                }}
              />
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
            <RetailDiscountCodeControl appliedCode={cart.discountCode?.code ?? null} />
          </div>

          {loyalty.pointsEnabled && (user.pointsBalance > 0 || cart.pointsToRedeem > 0) && (
            <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
              <RetailPointsControl balance={user.pointsBalance} staged={cart.pointsToRedeem} />
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
            <p className="text-sm text-charcoal/60">
              {t("subtotalItems", { count: cart.items.reduce((n, i) => n + i.quantity, 0) })}
            </p>
            <p className="font-serif text-2xl text-charcoal">{formatPrice(subtotal, currency)}</p>
          </div>
          <p className="mt-1 text-right text-xs text-charcoal/65">{t("taxNote")}</p>
          {amountToFreeShipping != null && (
            <p className="mt-1 text-right text-xs font-medium text-gold-deep">
              {amountToFreeShipping === 0 ? t("freeShippingUnlocked") : t("freeShippingProgress", { amount: formatPrice(amountToFreeShipping, currency) })}
            </p>
          )}

          {hasUnavailableItem && (
            <p className="mt-4 text-right text-sm text-red-700">{t("removeUnavailable")}</p>
          )}
          <div className="mt-6 flex justify-end">
            {hasUnavailableItem ? (
              <LinkButton href="/checkout" variant="gold" size="lg" aria-disabled className="pointer-events-none opacity-50">
                {t("proceed")}
              </LinkButton>
            ) : (
              <LinkButton href="/checkout" variant="gold" size="lg">{t("proceed")}</LinkButton>
            )}
          </div>
        </>
      )}

      <p className="mt-8 text-center text-sm text-charcoal/65">
        <Link href="/account" className="underline hover:text-charcoal">{t("back")}</Link>
      </p>
    </div>
  );
}
