import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { initiateRetailCheckout } from "@/actions/checkout";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import { buildCheckoutBreakdown } from "@/lib/checkout";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/market", () => ({ getMarket: vi.fn() }));
vi.mock("@/lib/checkout", () => ({ buildCheckoutBreakdown: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({ get: () => undefined }) }));

function checkoutFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const data = {
    firstName: "Jane",
    lastName: "Doe",
    phone: "0771234567",
    address: "123 Main St",
    city: "Colombo",
    country: "United States",
    agreedToTerms: "true",
    ...overrides,
  };
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("initiateRetailCheckout", () => {
  it("refuses when the customer hasn't agreed to the Terms & Conditions", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getMarket).mockResolvedValue("intl");

    const result = await initiateRetailCheckout(checkoutFormData({ agreedToTerms: "false" }));

    expect(result).toEqual({ ok: false, error: "Please agree to the Terms & Conditions to continue." });
    expect(buildCheckoutBreakdown).not.toHaveBeenCalled();
  });

  it("refuses when the agreedToTerms field is missing entirely", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getMarket).mockResolvedValue("intl");
    const fd = checkoutFormData();
    fd.delete("agreedToTerms");

    const result = await initiateRetailCheckout(fd);

    expect(result).toEqual({ ok: false, error: "Please agree to the Terms & Conditions to continue." });
    expect(buildCheckoutBreakdown).not.toHaveBeenCalled();
  });

  it("checks shipping details before the terms agreement", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getMarket).mockResolvedValue("intl");

    const result = await initiateRetailCheckout(checkoutFormData({ firstName: "", agreedToTerms: "false" }));

    expect(result.ok).toBe(false);
    expect(result).not.toEqual({ ok: false, error: "Please agree to the Terms & Conditions to continue." });
  });

  it("proceeds past validation and stamps termsAcceptedAt once agreed", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getMarket).mockResolvedValue("intl");
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "jane@example.com", businessAccountId: null } as never);
    prismaMock.paymentMethodOverride.findMany.mockResolvedValue([]);
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue({
      currency: "USD", market: "intl", discountCodeId: null, items: [], subtotal: 100, birthdayDiscount: 0,
      birthdayEligible: false, codeDiscount: 0, pointsRedeemed: 0, pointsDiscount: 0, tax: 0, shipping: 0,
      shippingZoneLabel: "", shippingToBeArranged: false, handlingFee: 0, total: 100,
    } as never);
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.order.count.mockResolvedValue(0);

    await initiateRetailCheckout(checkoutFormData({ agreedToTerms: "true" }));

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ termsAcceptedAt: expect.any(Date) }) }),
    );
  });
});

function codBreakdown(overrides: Record<string, unknown> = {}) {
  return {
    currency: "LKR", market: "lk", discountCodeId: null, items: [], subtotal: 10000, birthdayDiscount: 0,
    birthdayEligible: false, codeDiscount: 0, pointsRedeemed: 0, pointsDiscount: 0, tax: 0, shipping: 0,
    shippingZoneLabel: "", shippingToBeArranged: false, handlingFee: 0, total: 10000,
    codDepositThresholdLkr: 10000, codDepositPercent: 25,
    ...overrides,
  } as never;
}

describe("initiateRetailCheckout — COD", () => {
  function codSetup() {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getMarket).mockResolvedValue("lk");
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "jane@example.com", businessAccountId: null } as never);
    // lk:COD's hardcoded default is "coming_soon" — a live override is
    // what lets these tests (and, in production, an admin) actually
    // reach the COD branch at all.
    prismaMock.paymentMethodOverride.findMany.mockResolvedValue([{ market: "lk", methodKey: "COD", status: "live" }] as never);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.jewelryPiece.updateMany.mockResolvedValue({ count: 0 } as never);
  }

  it("still blocks COD while it resolves to coming_soon (no live override)", async () => {
    codSetup();
    prismaMock.paymentMethodOverride.findMany.mockResolvedValue([]);
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown());

    const result = await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    expect(result).toEqual({ ok: false, error: "That payment method isn't available yet — please choose another." });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("requires no deposit at exactly the threshold", async () => {
    codSetup();
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown({ total: 10000 }));
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);

    await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codDepositRequired: false, codDepositAmount: null }) }),
    );
  });

  it("requires a deposit one rupee over the threshold, rounded to the nearest whole rupee", async () => {
    codSetup();
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown({ total: 10001 }));
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);

    await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    // 25% of 10001 = 2500.25 -> rounds to 2500.
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codDepositRequired: true, codDepositAmount: 2500 }) }),
    );
  });

  it("labels the order's gateway \"cod\", not \"wire\"", async () => {
    codSetup();
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown({ total: 5000 }));
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);

    await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    expect(prismaMock.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentGateway: "cod" }) }));
  });

  it("creates the order and returns a COD result instead of a PayHere redirect — the regression this feature fixes", async () => {
    codSetup();
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown({ total: 5000 }));
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);

    const result = await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    expect(result).toEqual({ ok: true, method: "COD", orderRecordId: "order-1" });
  });

  it("reserves items the same way WIRE_TRANSFER does, rolling back if one was just taken", async () => {
    codSetup();
    vi.mocked(buildCheckoutBreakdown).mockResolvedValue(codBreakdown({
      total: 5000,
      items: [{ gemstoneId: "gem-1", jewelryId: null, jewelryVariantId: null, label: "Ruby", unitPrice: 5000, quantity: 1, lineTotal: 5000 }],
    }));
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 }); // already taken by someone else
    prismaMock.jewelryPiece.updateMany.mockResolvedValue({ count: 0 });

    const result = await initiateRetailCheckout(checkoutFormData({ paymentMethod: "COD" }));

    expect(result).toEqual({ ok: false, error: "One of the items in your cart was just taken by another customer — please review your cart." });
  });
});
