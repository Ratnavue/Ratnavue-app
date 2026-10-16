"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { initiateRetailCheckout } from "@/actions/checkout";
import type { PayhereCheckoutFields } from "@/lib/payhere";
import Link from "@/components/ui/MarketLink";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";
import type { PaymentMethodKey, PaymentMethodOption } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

// A country select would need a full ISO list — a plain text field here
// instead, matched case-insensitively against each ShippingZone's
// countries and against "Sri Lanka" for the domestic/VAT check (see
// lib/checkout.ts's isSriLanka). Good enough for the countries this
// business actually ships to today; a real dropdown is a easy follow-up
// once the shipping zone list is finalized. On the Sri Lanka store (/lk)
// the country isn't asked at all: it delivers within Sri Lanka only.
export function CheckoutForm({ methods, defaultMethod }: {
  /** Resolved server-side in the checkout page (lib/payment-methods.ts's
   * resolvePaymentMethods, layering any /admin/commerce-settings override
   * on top of the hardcoded defaults) — this component no longer resolves
   * them itself so an admin's change is reflected on the very next page
   * load, not baked into client-bundled code. */
  methods: PaymentMethodOption[];
  defaultMethod: PaymentMethodKey;
}) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const market = useMarket();
  const [method, setMethod] = useState(defaultMethod);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isWire = method === "WIRE_TRANSFER";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await initiateRetailCheckout(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.method === "WIRE_TRANSFER") {
        router.push(withMarket(`/checkout/wire?order=${encodeURIComponent(result.orderRecordId)}`, market));
        return;
      }
      submitToPayhere(result.checkoutUrl, result.fields);
    });
  }

  function submitToPayhere(checkoutUrl: string, fields: PayhereCheckoutFields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = checkoutUrl;
    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input id="firstName" name="firstName" required autoComplete="given-name" />
        </div>
        <div>
          <Label htmlFor="lastName">{t("lastName")}</Label>
          <Input id="lastName" name="lastName" required autoComplete="family-name" />
        </div>
      </div>
      <div>
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input id="phone" name="phone" required autoComplete="tel" />
      </div>
      <div>
        <Label htmlFor="address">{t("address")}</Label>
        <Input id="address" name="address" required autoComplete="street-address" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="city">{t("city")}</Label>
          <Input id="city" name="city" required autoComplete="address-level2" />
        </div>
        {market === "lk" ? (
          <div className="flex items-end pb-2.5 text-sm text-charcoal/70">{t("deliveryNote")}</div>
        ) : (
          <div>
            <Label htmlFor="country">{t("country")}</Label>
            <Input id="country" name="country" required autoComplete="country-name" placeholder={t("countryPlaceholder")} />
          </div>
        )}
      </div>

      {/* Only shown where there's a real choice to make (the Sri Lanka
          store) — the international site has the one method, so its
          checkout looks exactly as it always has. A "coming soon" method is
          visible but disabled: a disabled radio isn't submitted, and the
          server re-checks the method against the same list anyway. */}
      {methods.length > 1 && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-charcoal">{t("paymentMethod")}</legend>
          {methods.map((option) => {
            const live = option.status === "live";
            return (
              <label
                key={option.key}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                  live ? "cursor-pointer hover:border-gold" : "cursor-not-allowed bg-charcoal/[0.03] opacity-70",
                  live && method === option.key ? "border-gold bg-gold/5" : "border-border-subtle",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.key}
                  disabled={!live}
                  checked={live && method === option.key}
                  onChange={() => setMethod(option.key)}
                  className="mt-1 accent-gold"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-charcoal">{t(`methods.${option.key}.name`)}</span>
                    {!live && (
                      <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-charcoal/70">
                        {t("comingSoon")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-charcoal/65">{t(`methods.${option.key}.hint`)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <label className="flex items-start gap-2 text-sm text-charcoal/75">
        <input
          type="checkbox"
          name="agreedToTerms"
          value="true"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          required
          className="mt-0.5 accent-gold"
        />
        <span>
          {t.rich("agreeToTerms", {
            link: (chunks) => (
              <Link href="/terms" target="_blank" className="text-gold-deep underline hover:text-charcoal">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={pending || !agreedToTerms}>
        {isWire ? (pending ? t("placing") : t("placeOrder")) : pending ? t("preparing") : t("continueToPayment")}
      </Button>
      <p className="text-center text-xs text-charcoal/65">{isWire ? t("wireNote") : t("payhereNote")}</p>
    </form>
  );
}
