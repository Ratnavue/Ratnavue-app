import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { quickCreateGemstoneForSourcing, quickCreateJewelryForSourcing, createSourcingOrderAction } from "@/actions/sourcing-order";
import { createOrderFromSourcing } from "@/lib/orders";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }) }));
vi.mock("@/lib/orders", () => ({ createOrderFromSourcing: vi.fn() }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("quickCreateGemstoneForSourcing", () => {
  const validFields = { name: "Rough Spinel", mineralId: "mineral-1", cutId: "cut-1", caratWeight: "2.5", clarityGradeId: "clarity-1", treatmentId: "treatment-1", originId: "origin-1" };

  it("rejects an invalid submission (missing mineral) before touching the database", async () => {
    const result = await quickCreateGemstoneForSourcing(formData({ ...validFields, mineralId: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.gemstone.create).not.toHaveBeenCalled();
  });

  it("refuses when the selected mineral doesn't exist", async () => {
    prismaMock.mineral.findUnique.mockResolvedValue(null);
    const result = await quickCreateGemstoneForSourcing(formData(validFields));
    expect(result).toEqual({ ok: false, error: "Select a mineral." });
  });

  it("creates a private (unpublished) gemstone with the hue derived from the mineral's own range", async () => {
    prismaMock.mineral.findUnique.mockResolvedValue({ id: "mineral-1", hueMin: 200, hueMax: 240 } as never);
    prismaMock.gemstone.findUnique.mockResolvedValue(null); // slug uniqueness check
    prismaMock.gemstone.create.mockResolvedValue({ id: "gem-1", name: "Rough Spinel" } as never);

    const result = await quickCreateGemstoneForSourcing(formData(validFields));

    expect(result).toEqual({ ok: true, item: { kind: "gemstone", id: "gem-1", name: "Rough Spinel" } });
    expect(prismaMock.gemstone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Rough Spinel",
          mineralId: "mineral-1",
          cutId: "cut-1",
          caratWeight: 2.5,
          colorHue: 220, // midpoint of 200-240
          market: "intl",
          stockStatus: "AVAILABLE",
          isPublished: false,
        }),
      }),
    );
  });
});

describe("quickCreateJewelryForSourcing", () => {
  it("creates a private (unpublished) jewelry piece with sensible defaults", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue(null); // slug uniqueness check
    prismaMock.jewelryPiece.create.mockResolvedValue({ id: "jew-1", name: "Custom Setting" } as never);

    const result = await quickCreateJewelryForSourcing(formData({ name: "Custom Setting" }));

    expect(result).toEqual({ ok: true, item: { kind: "jewelry", id: "jew-1", name: "Custom Setting" } });
    expect(prismaMock.jewelryPiece.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Custom Setting", pieceType: "OTHER", metalType: "GOLD", market: "intl", isPublished: false }) }),
    );
  });

  it("rejects a blank name", async () => {
    const result = await quickCreateJewelryForSourcing(formData({ name: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.jewelryPiece.create).not.toHaveBeenCalled();
  });
});

describe("createSourcingOrderAction", () => {
  beforeEach(() => {
    vi.mocked(createOrderFromSourcing).mockResolvedValue({ ok: true, orderId: "order-1" });
  });

  it("rejects a submission with no items", async () => {
    const result = await createSourcingOrderAction("sourcing-1", formData({ items: "[]" }));
    expect(result).toEqual({ ok: false, error: "Add at least one item" });
    expect(createOrderFromSourcing).not.toHaveBeenCalled();
  });

  it("builds the order and redirects on success", async () => {
    const result = await createSourcingOrderAction("sourcing-1", formData({ items: JSON.stringify([{ gemstoneId: "gem-1", unitPrice: 1200 }]) }));

    expect(createOrderFromSourcing).toHaveBeenCalledWith("sourcing-1", "admin-1", [{ gemstoneId: "gem-1", unitPrice: 1200 }]);
    // The form navigates; the action returns where to (see ActionResult).
    expect(result).toEqual({ ok: true, redirectTo: "/admin/orders/order-1" });
  });

  it("surfaces the underlying error without redirecting when the sale can't be completed", async () => {
    vi.mocked(createOrderFromSourcing).mockResolvedValue({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });

    const result = await createSourcingOrderAction("sourcing-1", formData({ items: JSON.stringify([{ gemstoneId: "gem-1", unitPrice: 1200 }]) }));

    expect(result).toEqual({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });
    expect(result).not.toHaveProperty("redirectTo");
  });
});
