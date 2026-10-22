"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import type { ActionResult } from "./auth";

export async function updateLoyaltySettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  await getLoyaltySettings(); // ensure the singleton row exists before updating it

  const num = (key: string) => {
    const v = Number(formData.get(key));
    return Number.isFinite(v) ? v : null;
  };
  const pointsPerCurrencyUnit = num("pointsPerCurrencyUnit");
  const pointsRedemptionValue = num("pointsRedemptionValue");
  const pointsPerCurrencyUnitLkr = num("pointsPerCurrencyUnitLkr");
  const pointsRedemptionValueLkr = num("pointsRedemptionValueLkr");
  const minRedeemPoints = num("minRedeemPoints");
  const maxRedeemPercentOfOrder = num("maxRedeemPercentOfOrder");
  const referralMinOrderValue = num("referralMinOrderValue");
  const referralReferrerBonusPoints = num("referralReferrerBonusPoints");
  const referralRefereeBonusPoints = num("referralRefereeBonusPoints");

  if (
    pointsPerCurrencyUnit == null || pointsPerCurrencyUnit < 0 ||
    pointsRedemptionValue == null || pointsRedemptionValue < 0 ||
    pointsPerCurrencyUnitLkr == null || pointsPerCurrencyUnitLkr < 0 ||
    pointsRedemptionValueLkr == null || pointsRedemptionValueLkr < 0 ||
    minRedeemPoints == null || minRedeemPoints < 0 ||
    maxRedeemPercentOfOrder == null || maxRedeemPercentOfOrder < 0 || maxRedeemPercentOfOrder > 100 ||
    referralMinOrderValue == null || referralMinOrderValue < 0 ||
    referralReferrerBonusPoints == null || referralReferrerBonusPoints < 0 ||
    referralRefereeBonusPoints == null || referralRefereeBonusPoints < 0
  ) {
    return { ok: false, error: "Enter valid, non-negative numbers (the redemption cap must be between 0 and 100)." };
  }

  // Same hidden-false + checkbox-true convention every boolean toggle on
  // these admin forms uses (see commerce-settings.ts's own comment) —
  // getAll() + includes checks every submitted value for this name
  // regardless of DOM order, since a bare .get() would always read the
  // hidden "false" field first.
  const pointsEnabled = formData.getAll("pointsEnabled").includes("true");
  const referralsEnabled = formData.getAll("referralsEnabled").includes("true");

  await prisma.loyaltySettings.update({
    where: { id: "singleton" },
    data: {
      pointsPerCurrencyUnit,
      pointsRedemptionValue,
      pointsPerCurrencyUnitLkr,
      pointsRedemptionValueLkr,
      minRedeemPoints,
      maxRedeemPercentOfOrder,
      referralMinOrderValue,
      referralReferrerBonusPoints,
      referralRefereeBonusPoints,
      pointsEnabled,
      referralsEnabled,
    },
  });

  revalidatePath("/admin/loyalty-settings");
  return { ok: true };
}
