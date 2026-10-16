import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { searchPromoterCandidates, createPromoter, togglePromoterActive, resolvePayoutRequest, requestOwnPayout } from "@/actions/sales-referrals";

const requireAdminMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
const requireUserMock = vi.fn().mockResolvedValue({ id: "user-1", role: "STAFF" });
vi.mock("@/lib/rbac", () => ({
  requireAdmin: () => requireAdminMock(),
  requireUser: () => requireUserMock(),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("searchPromoterCandidates", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(searchPromoterCandidates("jane")).rejects.toThrow();
  });

  it("returns nothing for a too-short query without querying the database", async () => {
    const result = await searchPromoterCandidates("j");
    expect(result).toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("filters to ADMIN or STAFF-with-areas users matching the query", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", name: "Jane", email: "jane@x.com", role: "ADMIN" }] as never);
    const result = await searchPromoterCandidates("jane");
    expect(result).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ OR: [{ role: "ADMIN" }, { role: "STAFF", staffPermissions: { isEmpty: false } }] }, expect.anything()] },
      }),
    );
  });
});

describe("createPromoter", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createPromoter("user-1")).rejects.toThrow();
  });

  it("rejects a user with no admin access", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "CUSTOMER", staffPermissions: [] } as never);
    const result = await createPromoter("user-1");
    expect(result).toEqual({ ok: false, error: "This user has no admin portal access." });
    expect(prismaMock.salesReferralPromoter.create).not.toHaveBeenCalled();
  });

  it("rejects a STAFF user with no areas enabled", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF", staffPermissions: [] } as never);
    const result = await createPromoter("user-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.salesReferralPromoter.create).not.toHaveBeenCalled();
  });

  it("designates an ADMIN user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", staffPermissions: [] } as never);
    prismaMock.salesReferralPromoter.create.mockResolvedValue({} as never);
    const result = await createPromoter("user-1");
    expect(result).toEqual({ ok: true });
  });

  it("designates a STAFF user with at least one area", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF", staffPermissions: ["orders"] } as never);
    prismaMock.salesReferralPromoter.create.mockResolvedValue({} as never);
    const result = await createPromoter("user-1");
    expect(result).toEqual({ ok: true });
  });
});

describe("togglePromoterActive", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(togglePromoterActive("promo-1", false)).rejects.toThrow();
  });

  it("updates the active flag", async () => {
    prismaMock.salesReferralPromoter.update.mockResolvedValue({} as never);
    const result = await togglePromoterActive("promo-1", false);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.salesReferralPromoter.update).toHaveBeenCalledWith({ where: { id: "promo-1" }, data: { active: false } });
  });
});

describe("resolvePayoutRequest", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(resolvePayoutRequest("payout-1", "PAID", formData({}))).rejects.toThrow();
  });

  it("resolves PAID with the given reference", async () => {
    prismaMock.salesReferralPayoutRequest.update.mockResolvedValue({} as never);
    const result = await resolvePayoutRequest("payout-1", "PAID", formData({ paymentReference: "TXN-1" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.salesReferralPayoutRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID", paymentReference: "TXN-1" }) }),
    );
  });
});

describe("requestOwnPayout", () => {
  it("requires sign-in", async () => {
    requireUserMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(requestOwnPayout("USD")).rejects.toThrow();
  });

  it("rejects a signed-in user who isn't a promoter", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue(null);
    const result = await requestOwnPayout("USD");
    expect(result).toEqual({ ok: false, error: "You're not a sales referral promoter." });
  });

  it("requests a payout for the signed-in user's own promoter row", async () => {
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ id: "promo-1", active: true } as never);
    prismaMock.salesReferralCommission.findMany.mockResolvedValue([{ id: "c1", commissionAmount: 20 }] as never);
    prismaMock.salesReferralPayoutRequest.create.mockResolvedValue({ id: "payout-1" } as never);
    prismaMock.salesReferralCommission.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await requestOwnPayout("USD");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.salesReferralPayoutRequest.create).toHaveBeenCalledWith({ data: { promoterId: "promo-1", currency: "USD", amount: 20 } });
  });
});
