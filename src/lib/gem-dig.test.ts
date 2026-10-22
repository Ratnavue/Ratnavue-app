import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LoyaltySettings } from "@prisma/client";
import { prismaMock } from "@/test/prisma-mock";
import { isGemDigEligible, gemDigPointsRange, playGemDig, notifyGemDigAvailable, type GemDigOrder } from "@/lib/gem-dig";
import { createNotification } from "@/lib/notifications";

vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

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
  pointsEnabled: true,
  referralsEnabled: true,
  updatedAt: new Date("2026-01-01"),
};

function mockLoyalty(overrides: Partial<LoyaltySettings> = {}) {
  prismaMock.loyaltySettings.findUnique.mockResolvedValue({ ...loyaltyFixture, ...overrides });
}

function baseOrder(overrides: Partial<GemDigOrder> = {}): GemDigOrder {
  return {
    id: "order-1",
    userId: "user-1",
    status: "PAID",
    currency: "USD",
    gemDigPlayedAt: null,
    gemDigPointsAwarded: null,
    items: [
      {
        quantity: 1,
        lineTotal: 200,
        gemstone: { costPrice: 100 },
        jewelry: null,
        jewelryVariant: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isGemDigEligible", () => {
  it("is eligible for a paid order with real profit", () => {
    expect(isGemDigEligible(baseOrder())).toBe(true);
  });

  it("is eligible for shipped/delivered orders too", () => {
    expect(isGemDigEligible(baseOrder({ status: "SHIPPED" }))).toBe(true);
    expect(isGemDigEligible(baseOrder({ status: "DELIVERED" }))).toBe(true);
  });

  it("rejects an order in a status outside the eligible set", () => {
    expect(isGemDigEligible(baseOrder({ status: "PENDING_PAYMENT" }))).toBe(false);
  });

  it("rejects an order that has already been dug", () => {
    expect(isGemDigEligible(baseOrder({ gemDigPlayedAt: new Date() }))).toBe(false);
  });

  it("rejects an order with zero profit", () => {
    const order = baseOrder({
      items: [{ quantity: 1, lineTotal: 100, gemstone: { costPrice: 100 }, jewelry: null, jewelryVariant: null }],
    });
    expect(isGemDigEligible(order)).toBe(false);
  });

  it("treats an item with no recorded cost as contributing zero profit, never guessed at", () => {
    const order = baseOrder({
      items: [{ quantity: 1, lineTotal: 500, gemstone: { costPrice: null }, jewelry: null, jewelryVariant: null }],
    });
    expect(isGemDigEligible(order)).toBe(false);
  });

  it("prefers the jewelry variant's cost override over the parent piece's", () => {
    const order = baseOrder({
      items: [
        {
          quantity: 1,
          lineTotal: 200,
          gemstone: null,
          jewelry: { costPrice: 500 }, // would make profit negative/zero if used
          jewelryVariant: { costPrice: 50 },
        },
      ],
    });
    expect(isGemDigEligible(order)).toBe(true);
  });
});

describe("gemDigPointsRange", () => {
  it("computes a 1%-5%-of-profit range at the order currency's native rate", async () => {
    mockLoyalty();
    // profit = 200 - 100 = 100; USD rate = 1 => min floor(100*0.01)=1, max floor(100*0.05)=5
    const range = await gemDigPointsRange(baseOrder());
    expect(range).toEqual({ min: 1, max: 5 });
  });

  it("uses the LKR native rate for LKR orders, not a USD conversion", async () => {
    mockLoyalty();
    const order = baseOrder({
      currency: "LKR",
      items: [{ quantity: 1, lineTotal: 40000, gemstone: { costPrice: 10000 }, jewelry: null, jewelryVariant: null }],
    });
    // profit = 30000; LKR rate = 0.01 => min floor(30000*0.01*0.01)=3, max floor(30000*0.05*0.01)=15
    const range = await gemDigPointsRange(order);
    expect(range).toEqual({ min: 3, max: 15 });
  });

  it("floors both ends at 1 point even for very small profit", async () => {
    mockLoyalty();
    const order = baseOrder({
      items: [{ quantity: 1, lineTotal: 101, gemstone: { costPrice: 100 }, jewelry: null, jewelryVariant: null }],
    });
    const range = await gemDigPointsRange(order);
    expect(range.min).toBeGreaterThanOrEqual(1);
    expect(range.max).toBeGreaterThanOrEqual(1);
  });
});

describe("playGemDig", () => {
  it("rejects when the order doesn't belong to the caller", async () => {
    prismaMock.order.findUnique.mockResolvedValue(baseOrder({ userId: "someone-else" }) as never);
    const result = await playGemDig("order-1", "user-1");
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("rejects when the order isn't eligible", async () => {
    prismaMock.order.findUnique.mockResolvedValue(baseOrder({ status: "CANCELLED" }) as never);
    const result = await playGemDig("order-1", "user-1");
    expect(result.ok).toBe(false);
  });

  it("awards points within the 1-5% range and records a GEM_DIG_BONUS transaction", async () => {
    mockLoyalty();
    prismaMock.order.findUnique.mockResolvedValue(baseOrder() as never);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await playGemDig("order-1", "user-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toBeGreaterThanOrEqual(1);
      expect(result.points).toBeLessThanOrEqual(5); // 5% of 100 profit at rate 1
    }
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", gemDigPlayedAt: null },
      data: expect.objectContaining({ gemDigPlayedAt: expect.any(Date) }),
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          pointsTransactions: { create: expect.objectContaining({ reason: "GEM_DIG_BONUS", orderId: "order-1" }) },
        }),
      }),
    );
  });

  it("refuses to award twice when the conditional claim loses the race", async () => {
    mockLoyalty();
    prismaMock.order.findUnique.mockResolvedValue(baseOrder() as never);
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 }); // someone else's request already claimed it

    const result = await playGemDig("order-1", "user-1");
    expect(result).toEqual({ ok: false, error: "This reward has already been claimed." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("notifyGemDigAvailable", () => {
  it("sends a notification pointing at the order page when the order is eligible", async () => {
    prismaMock.order.findUnique.mockResolvedValue(baseOrder() as never);
    await notifyGemDigAvailable({ id: "order-1", userId: "user-1" });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }),
    );
  });

  it("silently skips a zero/uncosted-profit order rather than offering a hollow dig", async () => {
    const order = baseOrder({
      items: [{ quantity: 1, lineTotal: 500, gemstone: { costPrice: null }, jewelry: null, jewelryVariant: null }],
    });
    prismaMock.order.findUnique.mockResolvedValue(order as never);
    await notifyGemDigAvailable({ id: "order-1", userId: "user-1" });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("skips when the order can no longer be found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await notifyGemDigAvailable({ id: "order-1", userId: "user-1" });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
