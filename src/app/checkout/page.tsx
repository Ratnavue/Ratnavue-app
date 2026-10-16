import type { Metadata } from "next";
import { redirectInMarket, getMarket } from "@/lib/market";
import { MARKETS } from "@/lib/market-shared";
import { auth } from "@/lib/auth";
import { getRetailCartWithItems, retailCartSubtotal, retailCartUnitPrice } from "@/lib/retail-cart";
import { buildCheckoutBreakdown, type CheckoutBreakdown } from "@/lib/checkout";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { formatPrice } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { paymentMethodsFor, defaultPaymentMethod, resolvePaymentMethods } from "@/lib/payment-methods";
import { getPaymentMethodOverrides } from "@/lib/payment-method-settings";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user) return null; // middleware guards this route

  const market = await getMarket();
  const currency = MARKETS[market].currency;
  const cart = await getRetailCartWithItems(session.user.id, market);
  if (cart.items.length === 0) await redirectInMarket("/account/retail-cart");
  // The cart page's own "Proceed to Checkout" button is disabled while any
  // item is unavailable, but that's only a UI nicety — a direct visit to
  // this URL, or a stale tab, needs the same guard server-side. The real
  // enforcement is buildCheckoutBreakdown's re-check inside
  // initiateRetailCheckout; this redirect just avoids showing a shipping
  // form for an order that submit would refuse anyway.
  const hasUnavailableItem = cart.items.some((item) => (item.gemstone?.stockStatus ?? item.jewelry?.stockStatus) !== "AVAILABLE");
  if (hasUnavailableItem) await redirectInMarket("/account/retail-cart");

  const lines = cart.items.map((item) => ({ item, unitPrice: retailCartUnitPrice(item, market) }));
  const subtotal = retailCartSubtotal(lines.map(({ item, unitPrice }) => ({ unitPrice, quantity: item.quantity })));
  const [t, tPage, paymentMethodOverrides] = await Promise.all([getTranslations("checkout"), getTranslations("checkoutPage"), getPaymentMethodOverrides()]);
  const resolvedMethods = resolvePaymentMethods(paymentMethodOverrides);

  // The Sri Lanka store always ships domestically with no gateway fee, so
  // the full total is known up front and worth showing before the customer
  // commits to a bank-transfer order (which holds the items). The
  // international total depends on the shipping country typed below, so
  // there it's still worked out after the address is entered.
  let breakdown: CheckoutBreakdown | null = null;
  let breakdownError: string | null = null;
  if (market === "lk") {
    try {
      breakdown = await buildCheckoutBreakdown({ userId: session.user.id, shippingCountry: "Sri Lanka", market, paymentMethod: "WIRE_TRANSFER" });
    } catch (error) {
      breakdownError = error instanceof Error ? error.message : null;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">{tPage("kicker")}</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">{tPage("title")}</h1>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-charcoal/65">{t("summary.title")}</p>
        <div className="mt-2 space-y-1">
          {lines.map(({ item, unitPrice }) => (
            <div key={item.id} className="flex justify-between text-sm text-charcoal/75">
              <span>{(item.gemstone?.name ?? item.jewelry?.name ?? "Item")} × {item.quantity}</span>
              <span>{formatPrice(unitPrice * item.quantity, currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-border-subtle pt-2 text-sm font-medium text-charcoal">
          <span>{t("summary.subtotal")}</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        {breakdown ? (
          <div className="mt-2 space-y-1 text-sm text-charcoal/75">
            {breakdown.codeDiscount > 0 && <SummaryRow label={t("summary.discount")} value={`−${formatPrice(breakdown.codeDiscount, currency)}`} />}
            {breakdown.birthdayDiscount > 0 && <SummaryRow label={t("summary.birthday")} value={`−${formatPrice(breakdown.birthdayDiscount, currency)}`} />}
            {breakdown.bundleDiscount > 0 && <SummaryRow label={t("summary.bundle")} value={`−${formatPrice(breakdown.bundleDiscount, currency)}`} />}
            {breakdown.pointsDiscount > 0 && <SummaryRow label={t("summary.points")} value={`−${formatPrice(breakdown.pointsDiscount, currency)}`} />}
            {breakdown.tax > 0 && <SummaryRow label={t("summary.tax")} value={formatPrice(breakdown.tax, currency)} />}
            <SummaryRow label={t("summary.shipping")} value={formatPrice(breakdown.shipping, currency)} />
            <div className="flex justify-between border-t border-border-subtle pt-2 font-medium text-charcoal">
              <span>{t("summary.total")}</span>
              <span>{formatPrice(breakdown.total, currency)}</span>
            </div>
          </div>
        ) : breakdownError ? (
          <p className="mt-2 text-sm text-red-700">{breakdownError}</p>
        ) : (
          <p className="mt-1 text-xs text-charcoal/65">
            {tPage("estimateNote")}
          </p>
        )}
      </div>

      <div className="mt-8">
        <CheckoutForm methods={paymentMethodsFor(market, resolvedMethods)} defaultMethod={defaultPaymentMethod(market, resolvedMethods)} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
