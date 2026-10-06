import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { updateCommerceSettings } from "@/actions/commerce-settings";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }) }));

const settingsFixture = {
  id: "singleton", vatPercent: 18, applyVatToInternational: false, gatewayCommissionPercent: 3.5,
  handlingFeeMarginPercent: 1, birthdayDiscountPercent: 10, usdToLkrRate: 300,
  freeShippingThresholdUsd: null, freeShippingThresholdLkr: null, updatedAt: new Date(),
};

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  vatPercent: "18", gatewayCommissionPercent: "3.5", handlingFeeMarginPercent: "1",
  birthdayDiscountPercent: "10", usdToLkrRate: "300",
};

beforeEach(() => {
  prismaMock.commerceSettings.findUnique.mockResolvedValue(settingsFixture as never);
  prismaMock.commerceSettings.update.mockResolvedValue(settingsFixture as never);
});

describe("updateCommerceSettings — free shipping thresholds", () => {
  it("stores null (disabled) for both thresholds when left blank", async () => {
    const result = await updateCommerceSettings(formData({ ...validFields, freeShippingThresholdUsd: "", freeShippingThresholdLkr: "" }));
    expect(result.ok).toBe(true);
    expect(prismaMock.commerceSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ freeShippingThresholdUsd: null, freeShippingThresholdLkr: null }) }),
    );
  });

  it("stores a valid threshold value", async () => {
    const result = await updateCommerceSettings(formData({ ...validFields, freeShippingThresholdUsd: "150", freeShippingThresholdLkr: "45000" }));
    expect(result.ok).toBe(true);
    expect(prismaMock.commerceSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ freeShippingThresholdUsd: 150, freeShippingThresholdLkr: 45000 }) }),
    );
  });

  it("accepts 0 as a valid threshold (free shipping on every order), distinct from blank (disabled)", async () => {
    const result = await updateCommerceSettings(formData({ ...validFields, freeShippingThresholdUsd: "0", freeShippingThresholdLkr: "" }));
    expect(result.ok).toBe(true);
    expect(prismaMock.commerceSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ freeShippingThresholdUsd: 0, freeShippingThresholdLkr: null }) }),
    );
  });

  it("rejects a negative threshold rather than silently clamping or disabling it", async () => {
    const result = await updateCommerceSettings(formData({ ...validFields, freeShippingThresholdUsd: "-10", freeShippingThresholdLkr: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.commerceSettings.update).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric threshold", async () => {
    const result = await updateCommerceSettings(formData({ ...validFields, freeShippingThresholdUsd: "abc", freeShippingThresholdLkr: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.commerceSettings.update).not.toHaveBeenCalled();
  });
});

describe("updateCommerceSettings — applyVatToInternational checkbox", () => {
  // The real form submits this field twice (a hidden "false" input,
  // followed by the checkbox itself at "true" when checked) — the same
  // hidden-false + checkbox-true convention every boolean toggle on these
  // admin forms uses. The shared formData() helper above uses .set(),
  // which can only hold one value per key, so it can't reproduce this; a
  // plain object with a single string also can't. Build the FormData by
  // hand with .append() in DOM order to match what a real browser submits.
  function formDataWithDuplicateCheckbox(checked: boolean): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(validFields)) fd.set(k, v);
    fd.append("applyVatToInternational", "false");
    if (checked) fd.append("applyVatToInternational", "true");
    return fd;
  }

  it("saves true when the checkbox is checked, even though the hidden false field submits first", async () => {
    const result = await updateCommerceSettings(formDataWithDuplicateCheckbox(true));
    expect(result.ok).toBe(true);
    expect(prismaMock.commerceSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ applyVatToInternational: true }) }),
    );
  });

  it("saves false when the checkbox is unchecked (only the hidden field submits)", async () => {
    const result = await updateCommerceSettings(formDataWithDuplicateCheckbox(false));
    expect(result.ok).toBe(true);
    expect(prismaMock.commerceSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ applyVatToInternational: false }) }),
    );
  });
});
