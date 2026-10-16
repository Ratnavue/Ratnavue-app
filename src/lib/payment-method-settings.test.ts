import { describe, it, expect } from "vitest";
import { revalidateTag } from "next/cache";
import { prismaMock } from "@/test/prisma-mock";
import {
  getPaymentMethodOverrides,
  setPaymentMethodStatus,
  resetPaymentMethodStatus,
  PAYMENT_METHODS_TAG,
} from "@/lib/payment-method-settings";

describe("getPaymentMethodOverrides", () => {
  it("reduces the DB rows into a flat 'market:methodKey' -> status map", async () => {
    prismaMock.paymentMethodOverride.findMany.mockResolvedValue([
      { market: "lk", methodKey: "COD", status: "live" },
      { market: "intl", methodKey: "PAYHERE_CARD", status: "coming_soon" },
    ] as never);
    const result = await getPaymentMethodOverrides();
    expect(result).toEqual({ "lk:COD": "live", "intl:PAYHERE_CARD": "coming_soon" });
  });
});

describe("setPaymentMethodStatus", () => {
  it("upserts the override and drops the cache", async () => {
    prismaMock.paymentMethodOverride.upsert.mockResolvedValue({} as never);
    await setPaymentMethodStatus("lk", "COD", "live");
    expect(prismaMock.paymentMethodOverride.upsert).toHaveBeenCalledWith({
      where: { market_methodKey: { market: "lk", methodKey: "COD" } },
      create: { market: "lk", methodKey: "COD", status: "live" },
      update: { status: "live" },
    });
    expect(revalidateTag).toHaveBeenCalledWith(PAYMENT_METHODS_TAG, { expire: 0 });
  });
});

describe("resetPaymentMethodStatus", () => {
  it("deletes the override and drops the cache", async () => {
    prismaMock.paymentMethodOverride.deleteMany.mockResolvedValue({ count: 1 } as never);
    await resetPaymentMethodStatus("lk", "COD");
    expect(prismaMock.paymentMethodOverride.deleteMany).toHaveBeenCalledWith({ where: { market: "lk", methodKey: "COD" } });
    expect(revalidateTag).toHaveBeenCalledWith(PAYMENT_METHODS_TAG, { expire: 0 });
  });
});
