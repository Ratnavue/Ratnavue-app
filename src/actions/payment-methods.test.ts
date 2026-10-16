import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { setPaymentMethodOverride, clearPaymentMethodOverride } from "@/actions/payment-methods";

const requireAdminMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
vi.mock("@/lib/rbac", () => ({ requireAdmin: () => requireAdminMock() }));

describe("setPaymentMethodOverride", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(setPaymentMethodOverride("lk", "COD", "live")).rejects.toThrow();
  });

  it("rejects an unknown market", async () => {
    const result = await setPaymentMethodOverride("xx", "COD", "live");
    expect(result).toEqual({ ok: false, error: "Unknown market." });
    expect(prismaMock.paymentMethodOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid status", async () => {
    const result = await setPaymentMethodOverride("lk", "COD", "yes" as never);
    expect(result).toEqual({ ok: false, error: "Invalid status." });
    expect(prismaMock.paymentMethodOverride.upsert).not.toHaveBeenCalled();
  });

  it("saves a valid override", async () => {
    prismaMock.paymentMethodOverride.upsert.mockResolvedValue({} as never);
    const result = await setPaymentMethodOverride("lk", "COD", "live");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.paymentMethodOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { market_methodKey: { market: "lk", methodKey: "COD" } } }),
    );
  });
});

describe("clearPaymentMethodOverride", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(clearPaymentMethodOverride("lk", "COD")).rejects.toThrow();
  });

  it("deletes the override", async () => {
    prismaMock.paymentMethodOverride.deleteMany.mockResolvedValue({ count: 1 } as never);
    const result = await clearPaymentMethodOverride("lk", "COD");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.paymentMethodOverride.deleteMany).toHaveBeenCalledWith({ where: { market: "lk", methodKey: "COD" } });
  });
});
