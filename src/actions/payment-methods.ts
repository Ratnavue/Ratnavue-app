"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { setPaymentMethodStatus, resetPaymentMethodStatus } from "@/lib/payment-method-settings";
import type { PaymentMethodStatus } from "@/lib/payment-methods";
import type { ActionResult } from "./auth";

// Admin-only, same reasoning as the translation/locale overrides — this
// changes what a real customer can pay with across the live site.
export async function setPaymentMethodOverride(market: string, methodKey: string, status: PaymentMethodStatus): Promise<ActionResult> {
  await requireAdmin();
  if (market !== "intl" && market !== "lk") return { ok: false, error: "Unknown market." };
  if (status !== "live" && status !== "coming_soon") return { ok: false, error: "Invalid status." };
  await setPaymentMethodStatus(market, methodKey, status);
  revalidatePath("/admin/commerce-settings");
  return { ok: true };
}

export async function clearPaymentMethodOverride(market: string, methodKey: string): Promise<ActionResult> {
  await requireAdmin();
  await resetPaymentMethodStatus(market, methodKey);
  revalidatePath("/admin/commerce-settings");
  return { ok: true };
}
