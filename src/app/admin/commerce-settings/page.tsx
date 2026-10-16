import Link from "next/link";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { CommerceSettingsForm } from "@/components/admin/CommerceSettingsForm";
import { PaymentMethodsManager, type PaymentMethodRow } from "@/components/admin/PaymentMethodsManager";
import { BackLink } from "@/components/admin/BackLink";
import { resolvePaymentMethods, paymentMethodsFor } from "@/lib/payment-methods";
import { getPaymentMethodOverrides } from "@/lib/payment-method-settings";
import { MARKETS, type Market } from "@/lib/market-shared";

export default async function AdminCommerceSettingsPage() {
  const [settings, overrides] = await Promise.all([getCommerceSettings(), getPaymentMethodOverrides()]);
  const resolved = resolvePaymentMethods(overrides);
  const paymentMethodRows: PaymentMethodRow[] = (Object.keys(MARKETS) as Market[]).flatMap((market) =>
    paymentMethodsFor(market, resolved).map((m) => ({
      market,
      key: m.key,
      status: m.status,
      overridden: overrides[`${market}:${m.key}`] != null,
    })),
  );

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Commerce Settings</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Tax, shipping currency conversion, and handling fee inputs for the retail checkout — see also{" "}
        <Link href="/admin/shipping-zones" className="underline hover:text-charcoal">Shipping Zones</Link>.
      </p>

      <div className="mt-6">
        <CommerceSettingsForm settings={settings} />
      </div>

      <div className="mt-6">
        <PaymentMethodsManager rows={paymentMethodRows} />
      </div>
    </div>
  );
}
