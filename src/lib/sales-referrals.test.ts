import { describe, it, expect, type Mock } from "vitest";
import { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/prisma-mock";
import {
  computeSalesReferralCommission,
  settleSalesReferralCommission,
  getActivePromoterIdByToken,
  designatePromoter,
  setPromoterActive,
  getEligibleUnpaidCommissions,
  requestSalesReferralPayout,
  resolveSalesReferralPayout,
} from "@/lib/sales-referrals";

describe("computeSalesReferralCommission", () => {
  it("is 50% of (total - item cost - VAT - handling)", () => {
    // total 150, cost 50 (2 units @ 25 each), tax 18, handling 6.3
    const result = computeSalesReferralCommission(
      { total: 150, taxAmount: 18, handlingFeeAmount: 6.3 },
      [{ quantity: 2, lineTotal: 150, gemstone: { costPrice: 25 }, jewelry: null, jewelryVariant: null }],
    );
    // profit = 150 - 50 - 18 - 6.3 = 75.7
    expect(result.profit).toBeCloseTo(75.7, 5);
    expect(result.commissionAmount).toBeCloseTo(37.85, 5);
  });

  it("treats an item with no recorded cost as $0 cost, never inflating profit by guessing", () => {
    const result = computeSalesReferralCommission(
      { total: 100, taxAmount: 0, handlingFeeAmount: 0 },
      [{ quantity: 1, lineTotal: 100, gemstone: null, jewelry: null, jewelryVariant: null }],
    );
    expect(result.profit).toBe(100);
    expect(result.commissionAmount).toBe(50);
  });

  it("prefers jewelryVariant cost, then gemstone, then jewelry", () => {
    const result = computeSalesReferralCommission(
      { total: 100, taxAmount: 0, handlingFeeAmount: 0 },
      [{ quantity: 1, lineTotal: 100, gemstone: { costPrice: 999 }, jewelry: { costPrice: 999 }, jewelryVariant: { costPrice: 40 } }],
    );
    expect(result.profit).toBe(60);
  });

  it("floors profit at 0 instead of going negative", () => {
    const result = computeSalesReferralCommission(
      { total: 50, taxAmount: 10, handlingFeeAmount: 5 },
      [{ quantity: 1, lineTotal: 50, gemstone: { costPrice: 100 }, jewelry: null, jewelryVariant: null }],
    );
    expect(result.profit).toBe(0);
    expect(result.commissionAmount).toBe(0);
  });

  it("sums cost across multiple items and quantities", () => {
    const result = computeSalesReferralCommission(
      { total: 1000, taxAmount: 0, handlingFeeAmount: 0 },
      [
        { quantity: 3, lineTotal: 300, gemstone: { costPrice: 50 }, jewelry: null, jewelryVariant: null },
        { quantity: 1, lineTotal: 700, gemstone: null, jewelry: { costPrice: 200 }, jewelryVariant: null },
      ],
    );
    // cost = 3*50 + 200 = 350; profit = 1000 - 350 = 650
    expect(result.profit).toBe(650);
    expect(result.commissionAmount).toBe(325);
  });
});

describe("getActivePromoterIdByToken", () => {
  it("returns the promoter id when active", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ id: "promo-1", active: true } as never);
    expect(await getActivePromoterIdByToken("tok")).toBe("promo-1");
  });

  it("returns null when inactive", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ id: "promo-1", active: false } as never);
    expect(await getActivePromoterIdByToken("tok")).toBeNull();
  });

  it("returns null when the token doesn't match any promoter", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue(null);
    expect(await getActivePromoterIdByToken("bogus")).toBeNull();
  });
});

describe("settleSalesReferralCommission", () => {
  it("does nothing when the order has no attribution", async () => {
    await settleSalesReferralCommission({ id: "o1", referredByPromoterId: null, currency: "USD", total: 100, taxAmount: 0, handlingFeeAmount: 0, paidAt: new Date() });
    expect(prismaMock.salesReferralCommission.create).not.toHaveBeenCalled();
  });

  it("does nothing when the promoter has since been deactivated", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ active: false } as never);
    await settleSalesReferralCommission({ id: "o1", referredByPromoterId: "promo-1", currency: "USD", total: 100, taxAmount: 0, handlingFeeAmount: 0, paidAt: new Date() });
    expect(prismaMock.salesReferralCommission.create).not.toHaveBeenCalled();
  });

  it("creates a commission row with the computed amount and a 30-day eligibility date", async () => {
    const paidAt = new Date("2026-01-01T00:00:00Z");
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ active: true } as never);
    prismaMock.order.findUnique.mockResolvedValue({
      items: [{ quantity: 1, lineTotal: 100, gemstone: { costPrice: 20 }, jewelry: null, jewelryVariant: null }],
    } as never);
    prismaMock.salesReferralCommission.create.mockResolvedValue({} as never);

    await settleSalesReferralCommission({ id: "o1", referredByPromoterId: "promo-1", currency: "USD", total: 100, taxAmount: 10, handlingFeeAmount: 5, paidAt });

    expect(prismaMock.salesReferralCommission.create).toHaveBeenCalledWith({
      data: {
        promoterId: "promo-1",
        orderId: "o1",
        currency: "USD",
        orderTotal: 100,
        profit: 65, // 100 - 20 - 10 - 5
        commissionAmount: 32.5,
        eligibleAt: new Date("2026-01-31T00:00:00Z"),
      },
    });
  });

  it("skips creating a row when the computed commission is zero", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ active: true } as never);
    prismaMock.order.findUnique.mockResolvedValue({
      items: [{ quantity: 1, lineTotal: 10, gemstone: { costPrice: 50 }, jewelry: null, jewelryVariant: null }],
    } as never);

    await settleSalesReferralCommission({ id: "o1", referredByPromoterId: "promo-1", currency: "USD", total: 10, taxAmount: 0, handlingFeeAmount: 0, paidAt: new Date() });

    expect(prismaMock.salesReferralCommission.create).not.toHaveBeenCalled();
  });
});

describe("designatePromoter", () => {
  it("creates the promoter row", async () => {
    prismaMock.salesReferralPromoter.create.mockResolvedValue({} as never);
    const result = await designatePromoter("user-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.salesReferralPromoter.create).toHaveBeenCalledWith({ data: { userId: "user-1" } });
  });

  it("returns a friendly error instead of throwing on a duplicate", async () => {
    prismaMock.salesReferralPromoter.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.19.3" }),
    );
    const result = await designatePromoter("user-1");
    expect(result).toEqual({ ok: false, error: "This user is already a sales referral promoter." });
  });
});

describe("setPromoterActive", () => {
  it("updates the active flag", async () => {
    prismaMock.salesReferralPromoter.update.mockResolvedValue({} as never);
    await setPromoterActive("promo-1", false);
    expect(prismaMock.salesReferralPromoter.update).toHaveBeenCalledWith({ where: { id: "promo-1" }, data: { active: false } });
  });
});

describe("getEligibleUnpaidCommissions", () => {
  it("groups by currency", async () => {
    (prismaMock.salesReferralCommission.groupBy as unknown as Mock).mockResolvedValue([
      { currency: "USD", _sum: { commissionAmount: 150 }, _count: { _all: 3 } },
      { currency: "LKR", _sum: { commissionAmount: 5000 }, _count: { _all: 1 } },
    ] as never);
    const result = await getEligibleUnpaidCommissions("promo-1");
    expect(result).toEqual([
      { currency: "USD", amount: 150, count: 3 },
      { currency: "LKR", amount: 5000, count: 1 },
    ]);
  });
});

describe("requestSalesReferralPayout", () => {
  it("rejects when nothing is eligible", async () => {
    prismaMock.salesReferralCommission.findMany.mockResolvedValue([]);
    const result = await requestSalesReferralPayout("promo-1", "USD");
    expect(result).toEqual({ ok: false, error: "Nothing is eligible for payout yet." });
    expect(prismaMock.salesReferralPayoutRequest.create).not.toHaveBeenCalled();
  });

  it("bundles eligible commissions into one payout request and links them", async () => {
    prismaMock.salesReferralCommission.findMany.mockResolvedValue([
      { id: "c1", commissionAmount: 20 },
      { id: "c2", commissionAmount: 30 },
    ] as never);
    prismaMock.salesReferralPayoutRequest.create.mockResolvedValue({ id: "payout-1" } as never);
    prismaMock.salesReferralCommission.updateMany.mockResolvedValue({ count: 2 } as never);

    const result = await requestSalesReferralPayout("promo-1", "USD");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.salesReferralPayoutRequest.create).toHaveBeenCalledWith({ data: { promoterId: "promo-1", currency: "USD", amount: 50 } });
    expect(prismaMock.salesReferralCommission.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["c1", "c2"] } }, data: { payoutRequestId: "payout-1" } });
  });
});

describe("resolveSalesReferralPayout", () => {
  it("marks PAID and leaves commissions linked", async () => {
    prismaMock.salesReferralPayoutRequest.update.mockResolvedValue({} as never);
    await resolveSalesReferralPayout("payout-1", "PAID", { paymentReference: "TXN-1" });
    expect(prismaMock.salesReferralPayoutRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "payout-1" }, data: expect.objectContaining({ status: "PAID", paymentReference: "TXN-1" }) }),
    );
    expect(prismaMock.salesReferralCommission.updateMany).not.toHaveBeenCalled();
  });

  it("marks DENIED and unlinks its commissions so they're eligible again", async () => {
    prismaMock.salesReferralPayoutRequest.update.mockResolvedValue({} as never);
    prismaMock.salesReferralCommission.updateMany.mockResolvedValue({ count: 2 } as never);
    await resolveSalesReferralPayout("payout-1", "DENIED", { adminNotes: "Fraud suspected" });
    expect(prismaMock.salesReferralCommission.updateMany).toHaveBeenCalledWith({ where: { payoutRequestId: "payout-1" }, data: { payoutRequestId: null } });
  });
});
