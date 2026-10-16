import { describe, it, expect } from "vitest";
import { paymentMethodsFor, isPaymentMethodLive, defaultPaymentMethod, resolvePaymentMethods } from "@/lib/payment-methods";

describe("paymentMethodsFor", () => {
  it("offers only PayHere card, live, on the international site", () => {
    expect(paymentMethodsFor("intl")).toEqual([{ key: "PAYHERE_CARD", status: "live" }]);
  });

  it("offers wire and card live, COD as coming soon, on the Sri Lanka store", () => {
    const methods = paymentMethodsFor("lk");
    expect(methods.find((m) => m.key === "WIRE_TRANSFER")?.status).toBe("live");
    expect(methods.find((m) => m.key === "PAYHERE_CARD")?.status).toBe("live");
    expect(methods.find((m) => m.key === "COD")?.status).toBe("coming_soon");
  });
});

describe("isPaymentMethodLive", () => {
  it("accepts PayHere card internationally", () => {
    expect(isPaymentMethodLive("intl", "PAYHERE_CARD")).toBe(true);
  });

  it("rejects wire transfer internationally (not offered there at all)", () => {
    expect(isPaymentMethodLive("intl", "WIRE_TRANSFER")).toBe(false);
  });

  it("accepts wire transfer on /lk", () => {
    expect(isPaymentMethodLive("lk", "WIRE_TRANSFER")).toBe(true);
  });

  it("accepts PayHere card on /lk", () => {
    expect(isPaymentMethodLive("lk", "PAYHERE_CARD")).toBe(true);
  });

  it("rejects a not-yet-live method on /lk (COD is listed but disabled)", () => {
    expect(isPaymentMethodLive("lk", "COD")).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(isPaymentMethodLive("lk", "BITCOIN")).toBe(false);
  });
});

describe("defaultPaymentMethod", () => {
  it("defaults to PayHere card internationally", () => {
    expect(defaultPaymentMethod("intl")).toBe("PAYHERE_CARD");
  });

  it("defaults to wire transfer on /lk (first live method in the list)", () => {
    expect(defaultPaymentMethod("lk")).toBe("WIRE_TRANSFER");
  });
});

describe("resolvePaymentMethods", () => {
  it("matches the hardcoded defaults with no overrides", () => {
    expect(resolvePaymentMethods({})).toEqual({
      intl: [{ key: "PAYHERE_CARD", status: "live" }],
      lk: [
        { key: "WIRE_TRANSFER", status: "live" },
        { key: "PAYHERE_CARD", status: "live" },
        { key: "COD", status: "coming_soon" },
      ],
    });
  });

  it("also matches the defaults when called with no argument at all", () => {
    expect(resolvePaymentMethods()).toEqual(resolvePaymentMethods({}));
  });

  it("an override flips just that one (market, method) pair", () => {
    const resolved = resolvePaymentMethods({ "lk:COD": "live" });
    expect(resolved.lk.find((m) => m.key === "COD")?.status).toBe("live");
    // Untouched pairs keep their hardcoded default.
    expect(resolved.lk.find((m) => m.key === "WIRE_TRANSFER")?.status).toBe("live");
    expect(resolved.intl).toEqual([{ key: "PAYHERE_CARD", status: "live" }]);
  });

  it("an override can also turn a normally-live method off", () => {
    const resolved = resolvePaymentMethods({ "intl:PAYHERE_CARD": "coming_soon" });
    expect(resolved.intl).toEqual([{ key: "PAYHERE_CARD", status: "coming_soon" }]);
  });

  it("feeds straight into paymentMethodsFor/isPaymentMethodLive/defaultPaymentMethod", () => {
    const resolved = resolvePaymentMethods({ "lk:COD": "live", "lk:WIRE_TRANSFER": "coming_soon" });
    expect(paymentMethodsFor("lk", resolved).find((m) => m.key === "COD")?.status).toBe("live");
    expect(isPaymentMethodLive("lk", "WIRE_TRANSFER", resolved)).toBe(false);
    // WIRE_TRANSFER is first in the list but no longer live, so the next
    // live one in order (PAYHERE_CARD) becomes the default instead.
    expect(defaultPaymentMethod("lk", resolved)).toBe("PAYHERE_CARD");
  });
});
