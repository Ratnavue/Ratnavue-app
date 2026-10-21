import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommerceSettings, LoyaltySettings } from "@prisma/client";
import { prismaMock } from "@/test/prisma-mock";
import {
  ensureReferralCode,
  captureReferral,
  pointsForAmount,
  pointsValue,
  resolvePointsRedemption,
  recordPointsTransaction,
  settlePointsForPaidOrder,
  settleReferralForPaidOrder,
} from "@/lib/rewards";

const loyaltyFixture: LoyaltySettings = {
  id: "singleton",
  pointsPerCurrencyUnit: 1,
  pointsRedemptionValue: 0.01,
  pointsPerCurrencyUnitLkr: 0.01,
  pointsRedemptionValueLkr: 1,
  minRedeemPoints: 500,
  maxRedeemPercentOfOrder: 50,
  referralMinOrderValue: 50,
  referralReferrerBonusPoints: 500,
  referralRefereeBonusPoints: 250,
  updatedAt: new Date("2026-01-01"),
};

const commerceFixture: CommerceSettings = {
  id: "singleton",
  vatPercent: 18,
  applyVatToInternational: false,
  gatewayCommissionPercent: 3.5,
  handlingFeeMarginPercent: 1,
  birthdayDiscountPercent: 10,
  usdToLkrRate: 300,
  freeShippingThresholdUsd: null,
  freeShippingThresholdLkr: null,
  codDepositThresholdLkr: 10000,
  codDepositPercent: 25,
  updatedAt: new Date("2026-01-01"),
};

// pointsForAmount/pointsValue/resolvePointsRedemption all read the
// singleton settings via getLoyaltySettings/getCommerceSettings, which
// call prisma.loyaltySettings.findUnique / prisma.commerceSettings.findUnique
// directly — mocking those two calls is enough to cover every function in
// this file that touches settings.
function mockSettings(loyalty: Partial<LoyaltySettings> = {}, commerce: Partial<CommerceSettings> = {}) {
  prismaMock.loyaltySettings.findUnique.mockResolvedValue({ ...loyaltyFixture, ...loyalty });
  prismaMock.commerceSettings.findUnique.mockResolvedValue({ ...commerceFixture, ...commerce });
}

describe("pointsForAmount", () => {
  it("converts a USD amount to whole points at the configured rate", async () => {
    mockSettings();
    await expect(pointsForAmount(80, "USD")).resolves.toBe(80);
  });

  it("floors fractional points", async () => {
    mockSettings({ pointsPerCurrencyUnit: 0.33 });
    await expect(pointsForAmount(10, "USD")).resolves.toBe(3); // floor(3.3)
  });

  it("uses the Sri Lanka store's own native LKR rate, not a USD conversion", async () => {
    mockSettings();
    await expect(pointsForAmount(30000, "LKR")).resolves.toBe(300); // 30000 * 0.01 (pointsPerCurrencyUnitLkr)
  });

  it("changing usdToLkrRate has no effect on LKR earning (it's not consulted)", async () => {
    mockSettings({}, { usdToLkrRate: 9999 });
    await expect(pointsForAmount(30000, "LKR")).resolves.toBe(300);
  });
});

describe("pointsValue", () => {
  it("values points in USD at the configured redemption rate", async () => {
    mockSettings();
    await expect(pointsValue(100, "USD")).resolves.toBeCloseTo(1);
  });

  it("values points in LKR at the Sri Lanka store's own native redemption rate", async () => {
    mockSettings();
    await expect(pointsValue(100, "LKR")).resolves.toBeCloseTo(100); // 100 * 1 (pointsRedemptionValueLkr)
  });
});

describe("resolvePointsRedemption", () => {
  it("redeems nothing for a non-positive request without touching settings", async () => {
    const result = await resolvePointsRedemption({ requestedPoints: 0, availableBalance: 10000, orderableAmount: 100, currency: "USD" });
    expect(result).toEqual({ points: 0, discount: 0 });
    expect(prismaMock.loyaltySettings.findUnique).not.toHaveBeenCalled();
  });

  it("clamps to the order's max-redeem-percent cap, not the full balance", async () => {
    mockSettings();
    // cap = 100 * 50% = $50 -> 5000 points; balance and request are both far above that.
    const result = await resolvePointsRedemption({ requestedPoints: 100000, availableBalance: 10000, orderableAmount: 100, currency: "USD" });
    expect(result).toEqual({ points: 5000, discount: 50 });
  });

  it("clamps to the available balance when it's the tightest limit", async () => {
    mockSettings();
    const result = await resolvePointsRedemption({ requestedPoints: 100000, availableBalance: 600, orderableAmount: 100000, currency: "USD" });
    expect(result.points).toBe(600);
  });

  it("redeems nothing below the minimum redeemable threshold", async () => {
    mockSettings();
    const result = await resolvePointsRedemption({ requestedPoints: 100, availableBalance: 100, orderableAmount: 100000, currency: "USD" });
    expect(result).toEqual({ points: 0, discount: 0 });
  });

  it("clamps LKR redemption through the order's own currency cap, using the native LKR redemption rate", async () => {
    mockSettings();
    // cap = 30000 LKR * 50% = 15000 LKR -> 15000 / 1 (pointsRedemptionValueLkr) = 15000 points -> discount 15000 * 1 = 15000 LKR
    const result = await resolvePointsRedemption({ requestedPoints: 100000, availableBalance: 100000, orderableAmount: 30000, currency: "LKR" });
    expect(result).toEqual({ points: 15000, discount: 15000 });
  });
});

describe("ensureReferralCode", () => {
  it("returns the existing code without writing anything", async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ referralCode: "ABC1234" } as never);
    await expect(ensureReferralCode("user-1")).resolves.toBe("ABC1234");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("mints and persists a new code when none exists yet", async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ referralCode: null } as never);
    prismaMock.user.update.mockResolvedValue({ referralCode: "FRESH01" } as never);
    await expect(ensureReferralCode("user-2")).resolves.toBe("FRESH01");
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  it("retries on a unique-constraint collision instead of failing immediately", async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ referralCode: null } as never);
    prismaMock.user.update
      .mockRejectedValueOnce(new Error("Unique constraint failed"))
      .mockResolvedValueOnce({ referralCode: "SECOND1" } as never);
    await expect(ensureReferralCode("user-3")).resolves.toBe("SECOND1");
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated collisions", async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ referralCode: null } as never);
    prismaMock.user.update.mockRejectedValue(new Error("Unique constraint failed"));
    await expect(ensureReferralCode("user-4")).rejects.toThrow(/could not generate/i);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(10);
  });
});

describe("captureReferral", () => {
  it("does nothing for an empty/whitespace code", async () => {
    await captureReferral("referee-1", "   ");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("does nothing when the code doesn't belong to anyone", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await captureReferral("referee-1", "NOBODY1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing for a self-referral", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "same-user" } as never);
    await captureReferral("same-user", "OWNCODE");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("stamps referredByCode and creates a PENDING Referral for a valid code", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "referrer-1" } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.referral.create.mockResolvedValue({} as never);

    await captureReferral("referee-1", "  goodcode ");

    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "referee-1" }, data: { referredByCode: "GOODCODE" } });
    expect(prismaMock.referral.create).toHaveBeenCalledWith({ data: { referrerId: "referrer-1", refereeId: "referee-1", code: "GOODCODE" } });
  });

  it("silently swallows a transaction failure (e.g. a duplicate Referral row)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "referrer-1" } as never);
    prismaMock.$transaction.mockRejectedValueOnce(new Error("Unique constraint failed on refereeId"));
    await expect(captureReferral("referee-1", "GOODCODE")).resolves.toBeUndefined();
  });
});

describe("recordPointsTransaction", () => {
  it("increments the balance and creates the transaction in one nested write", async () => {
    prismaMock.user.update.mockResolvedValue({} as never);
    await recordPointsTransaction(prismaMock, { userId: "u1", amount: 50, reason: "EARNED_PURCHASE", orderId: "o1" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { pointsBalance: { increment: 50 }, pointsTransactions: { create: { amount: 50, reason: "EARNED_PURCHASE", orderId: "o1" } } },
    });
  });
});

describe("settlePointsForPaidOrder", () => {
  beforeEach(() => {
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.pointsTransaction.create.mockResolvedValue({} as never);
  });

  it("earns points on the order's subtotal", async () => {
    await settlePointsForPaidOrder(
      prismaMock,
      { id: "o1", userId: "u1", currency: "USD", subtotal: 80, pointsRedeemed: 0 },
      { loyalty: loyaltyFixture, commerce: commerceFixture },
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointsBalance: { increment: 80 } }) }),
    );
  });

  it("earns an LKR order's points at the Sri Lanka store's own native rate, not a USD conversion", async () => {
    await settlePointsForPaidOrder(
      prismaMock,
      { id: "o1", userId: "u1", currency: "LKR", subtotal: 30000, pointsRedeemed: 0 },
      { loyalty: loyaltyFixture, commerce: commerceFixture },
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointsBalance: { increment: 300 } }) }), // 30000 * 0.01 (pointsPerCurrencyUnitLkr)
    );
  });

  it("claims redeemed points with a REDEEMED_CHECKOUT transaction when the balance still covers it", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    await settlePointsForPaidOrder(
      prismaMock,
      { id: "o1", userId: "u1", currency: "USD", subtotal: 0, pointsRedeemed: 200 },
      { loyalty: { ...loyaltyFixture, pointsPerCurrencyUnit: 0 }, commerce: commerceFixture },
    );
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", pointsBalance: { gte: 200 } },
      data: { pointsBalance: { decrement: 200 } },
    });
    expect(prismaMock.pointsTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", amount: -200, reason: "REDEEMED_CHECKOUT", orderId: "o1" },
    });
  });

  it("does not write a redemption transaction when the balance moved since checkout", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await settlePointsForPaidOrder(
      prismaMock,
      { id: "o1", userId: "u1", currency: "USD", subtotal: 0, pointsRedeemed: 200 },
      { loyalty: { ...loyaltyFixture, pointsPerCurrencyUnit: 0 }, commerce: commerceFixture },
    );
    expect(prismaMock.pointsTransaction.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("settleReferralForPaidOrder", () => {
  const order = { id: "order-1", userId: "referee-1", currency: "USD" as const, subtotal: 80 };
  const settings = { loyalty: loyaltyFixture, commerce: commerceFixture };

  it("returns null when there's no referral for this user", async () => {
    prismaMock.referral.findUnique.mockResolvedValue(null);
    await expect(settleReferralForPaidOrder(prismaMock, order, settings)).resolves.toBeNull();
  });

  it("returns null when the referral isn't PENDING anymore", async () => {
    prismaMock.referral.findUnique.mockResolvedValue({ id: "r1", status: "REWARDED" } as never);
    await expect(settleReferralForPaidOrder(prismaMock, order, settings)).resolves.toBeNull();
  });

  it("returns null when this isn't the referee's first paid order", async () => {
    prismaMock.referral.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" } as never);
    prismaMock.order.count.mockResolvedValue(1);
    await expect(settleReferralForPaidOrder(prismaMock, order, settings)).resolves.toBeNull();
  });

  it("returns null when the order is below the qualifying minimum", async () => {
    prismaMock.referral.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" } as never);
    prismaMock.order.count.mockResolvedValue(0);
    const smallOrder = { ...order, subtotal: 10 }; // below referralMinOrderValue (50)
    await expect(settleReferralForPaidOrder(prismaMock, smallOrder, settings)).resolves.toBeNull();
  });

  it("pays both sides and returns the settled referral for a qualifying first order", async () => {
    prismaMock.referral.findUnique.mockResolvedValue({ id: "r1", status: "PENDING", referrerId: "referrer-1", refereeId: "referee-1" } as never);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.referral.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await settleReferralForPaidOrder(prismaMock, order, settings);

    expect(result).toEqual({
      referralId: "r1",
      referrerId: "referrer-1",
      refereeId: "referee-1",
      referrerBonus: loyaltyFixture.referralReferrerBonusPoints,
      refereeBonus: loyaltyFixture.referralRefereeBonusPoints,
    });
    expect(prismaMock.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: expect.objectContaining({ status: "REWARDED", qualifyingOrderId: "order-1" }) }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "referrer-1" }, data: expect.objectContaining({ pointsBalance: { increment: loyaltyFixture.referralReferrerBonusPoints } }) }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "referee-1" }, data: expect.objectContaining({ pointsBalance: { increment: loyaltyFixture.referralRefereeBonusPoints } }) }),
    );
  });
});
