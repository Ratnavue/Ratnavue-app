"use client";

import { useRouter } from "next/navigation";
import { setPaymentMethodOverride, clearPaymentMethodOverride } from "@/actions/payment-methods";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { Button } from "@/components/ui/Button";
import type { PaymentMethodKey, PaymentMethodStatus } from "@/lib/payment-methods";

const MARKET_LABELS: Record<string, string> = { intl: "International", lk: "Sri Lanka" };
const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  PAYHERE_CARD: "Card payment (PayHere)",
  WIRE_TRANSFER: "Bank transfer",
  COD: "Cash on delivery",
};

export interface PaymentMethodRow {
  market: string;
  key: PaymentMethodKey;
  status: PaymentMethodStatus;
  /** Whether an admin override exists for this pair, vs. it's currently
   * just running on the hardcoded default from lib/payment-methods.ts. */
  overridden: boolean;
}

export function PaymentMethodsManager({ rows }: { rows: PaymentMethodRow[] }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();

  function toggle(row: PaymentMethodRow) {
    const next: PaymentMethodStatus = row.status === "live" ? "coming_soon" : "live";
    run(() => setPaymentMethodOverride(row.market, row.key, next), () => router.refresh());
  }

  function reset(row: PaymentMethodRow) {
    run(() => clearPaymentMethodOverride(row.market, row.key), () => router.refresh());
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Payment Methods</p>
      <p className="mt-1 text-sm text-charcoal/60">
        Turn a payment method on or off for either store — takes effect immediately, no deploy needed.
      </p>
      <ul className="mt-4 divide-y divide-border-subtle">
        {rows.map((row) => (
          <li key={`${row.market}:${row.key}`} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <span className="text-xs uppercase tracking-wide text-charcoal/50">{MARKET_LABELS[row.market] ?? row.market}</span>{" "}
              <span className="text-sm text-charcoal">{METHOD_LABELS[row.key] ?? row.key}</span>
              <span className={row.status === "live" ? "ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800" : "ml-2 rounded-full bg-charcoal/5 px-2 py-0.5 text-[11px] text-charcoal/50"}>
                {row.status === "live" ? "Live" : "Coming soon"}
              </span>
              {row.overridden && <span className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] text-gold-deep">Overridden</span>}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" size="sm" variant={row.status === "live" ? "outline" : "gold"} disabled={pending} onClick={() => toggle(row)}>
                {row.status === "live" ? "Turn off" : "Turn on"}
              </Button>
              {row.overridden && (
                <button type="button" className="text-xs text-charcoal/50 underline disabled:opacity-50" disabled={pending} onClick={() => reset(row)}>
                  Reset to default
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
