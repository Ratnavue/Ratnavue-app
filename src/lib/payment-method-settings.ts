import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PaymentMethodStatus } from "@/lib/payment-methods";

export const PAYMENT_METHODS_TAG = "payment-methods";

async function fetchOverrides(): Promise<Record<string, PaymentMethodStatus>> {
  const rows = await prisma.paymentMethodOverride.findMany({ select: { market: true, methodKey: true, status: true } });
  return Object.fromEntries(rows.map((r) => [`${r.market}:${r.methodKey}`, r.status as PaymentMethodStatus]));
}

// Cached the same way site-config-cache.ts / lib/translations.ts / lib/locales.ts
// cache their own per-request reads — checkout (both the form and the
// server action re-validating it) needs this on every request, so it has
// to stay cheap. Dropped immediately by setPaymentMethodStatus below, so
// a save is live right away rather than after the 60s window.
export const getPaymentMethodOverrides = unstable_cache(fetchOverrides, ["payment-method-overrides"], {
  revalidate: 60,
  tags: [PAYMENT_METHODS_TAG],
});

export async function setPaymentMethodStatus(market: string, methodKey: string, status: PaymentMethodStatus): Promise<void> {
  await prisma.paymentMethodOverride.upsert({
    where: { market_methodKey: { market, methodKey } },
    create: { market, methodKey, status },
    update: { status },
  });
  revalidateTag(PAYMENT_METHODS_TAG, { expire: 0 });
}

// Deletes the override — the pair goes back to its hardcoded default
// (not "disabled"), same "blank/absent means unset" convention as
// clearing a TranslationOverride.
export async function resetPaymentMethodStatus(market: string, methodKey: string): Promise<void> {
  await prisma.paymentMethodOverride.deleteMany({ where: { market, methodKey } });
  revalidateTag(PAYMENT_METHODS_TAG, { expire: 0 });
}
