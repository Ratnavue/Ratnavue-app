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
