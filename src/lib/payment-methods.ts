import type { Market } from "@/lib/market-shared";

// Client-safe (no Prisma import) — the checkout form renders these, and the
// server action re-checks them, from the same list.
//
// International: PayHere card only, as before. Sri Lanka store (/lk): bank
// wire transfer and PayHere card are both live; cash on delivery is shown
// but disabled as "Coming soon". These are the hardcoded *defaults* — an
// admin can override a specific (market, method) pair's status without a
// deploy via lib/payment-method-settings.ts + /admin/commerce-settings;
// resolvePaymentMethods below layers those overrides on top of this list,
// same "DB override on a static baseline" shape as lib/translations.ts.

export type PaymentMethodKey = "PAYHERE_CARD" | "WIRE_TRANSFER" | "COD";
export type PaymentMethodStatus = "live" | "coming_soon";

export interface PaymentMethodOption {
  key: PaymentMethodKey;
  status: PaymentMethodStatus;
}

const METHODS: Record<Market, PaymentMethodOption[]> = {
  intl: [{ key: "PAYHERE_CARD", status: "live" }],
  lk: [
    { key: "WIRE_TRANSFER", status: "live" },
    { key: "PAYHERE_CARD", status: "live" },
    { key: "COD", status: "coming_soon" },
  ],
};

// Flat overrides keyed "market:methodKey" -> status, exactly what
// lib/payment-method-settings.ts's getPaymentMethodOverrides() returns —
// a pair with no entry here just keeps its hardcoded default, so this is
// safe to call with an empty object (nothing changes) or omit entirely.
export function resolvePaymentMethods(overrides: Record<string, PaymentMethodStatus> = {}): Record<Market, PaymentMethodOption[]> {
  const result = {} as Record<Market, PaymentMethodOption[]>;
  for (const market of Object.keys(METHODS) as Market[]) {
    result[market] = METHODS[market].map((m) => ({
      key: m.key,
      status: overrides[`${market}:${m.key}`] ?? m.status,
    }));
  }
  return result;
}

export function paymentMethodsFor(market: Market, methods: Record<Market, PaymentMethodOption[]> = METHODS): PaymentMethodOption[] {
  return methods[market];
}

export function isPaymentMethodLive(market: Market, key: string, methods: Record<Market, PaymentMethodOption[]> = METHODS): key is PaymentMethodKey {
  return methods[market].some((m) => m.key === key && m.status === "live");
}

/** The method a customer gets without choosing: the first live one. */
export function defaultPaymentMethod(market: Market, methods: Record<Market, PaymentMethodOption[]> = METHODS): PaymentMethodKey {
  return methods[market].find((m) => m.status === "live")!.key;
}
