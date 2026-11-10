import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { deleteGemstone, deleteJewelry, bulkSetCatalogStatus, createJewelryVariant, updateJewelryVariant, deleteJewelryVariant } from "@/actions/catalog-admin";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

vi.mock("@/lib/rbac", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
  requireStaffArea: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", staffMarketScope: null }),
  requireMarketAccess: vi.fn().mockResolvedValue(undefined),
}));

describe("deleteGemstone", () => {
  it("refuses to delete a gemstone with paid order history", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", _count: { orderItems: 1, quoteRequests: 0, auctions: 0 } } as never);

    const result = await deleteGemstone("gem-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.gemstone.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a gemstone with quote-request history", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", _count: { orderItems: 0, quoteRequests: 2, auctions: 0 } } as never);

    const result = await deleteGemstone("gem-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.gemstone.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a gemstone with auction history", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", _count: { orderItems: 0, quoteRequests: 0, auctions: 1 } } as never);

    const result = await deleteGemstone("gem-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.gemstone.delete).not.toHaveBeenCalled();
  });

  it("allows deleting a gemstone with no order/quote/auction history", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", _count: { orderItems: 0, quoteRequests: 0, auctions: 0 } } as never);
    prismaMock.gemstone.delete.mockResolvedValue({} as never);

    const result = await deleteGemstone("gem-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.gemstone.delete).toHaveBeenCalledWith({ where: { id: "gem-1" } });
  });

  it("returns a clean error for an id that doesn't exist, rather than throwing", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue(null);
    const result = await deleteGemstone("missing");
    expect(result.ok).toBe(false);
  });
});

describe("deleteJewelry", () => {
  it("refuses to delete a piece with order/quote/auction history", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ id: "jew-1", _count: { orderItems: 1, quoteRequests: 0, auctions: 0 } } as never);

    const result = await deleteJewelry("jew-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.jewelryPiece.delete).not.toHaveBeenCalled();
  });

  it("allows deleting a piece with no history", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ id: "jew-1", _count: { orderItems: 0, quoteRequests: 0, auctions: 0 } } as never);
    prismaMock.jewelryPiece.delete.mockResolvedValue({} as never);

    const result = await deleteJewelry("jew-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.jewelryPiece.delete).toHaveBeenCalledWith({ where: { id: "jew-1" } });
  });
});

describe("bulkSetCatalogStatus", () => {
  it("refuses an empty selection without touching the database", async () => {
    const result = await bulkSetCatalogStatus("gemstone", [], "DRAFT");

    expect(result).toEqual({ ok: false, error: "Nothing selected." });
    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("moves a batch of gemstones back to draft, hiding them from the storefront", async () => {
    prismaMock.gemstone.findMany.mockResolvedValue([{ market: "intl" }, { market: "intl" }] as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 2 });

    const result = await bulkSetCatalogStatus("gemstone", ["gem-1", "gem-2"], "DRAFT");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["gem-1", "gem-2"] } }, data: { listingStatus: "DRAFT", isPublished: false } });
    expect(prismaMock.jewelryPiece.updateMany).not.toHaveBeenCalled();
  });

  it("keeps a finished item off the storefront", async () => {
    prismaMock.gemstone.findMany.mockResolvedValue([{ market: "intl" }] as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    const result = await bulkSetCatalogStatus("gemstone", ["gem-1"], "FINISHED");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["gem-1"] } }, data: { listingStatus: "FINISHED", isPublished: false } });
  });

  it("rejects an unknown status", async () => {
    const result = await bulkSetCatalogStatus("gemstone", ["gem-1"], "ARCHIVED" as never);

    expect(result.ok).toBe(false);
    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("takes a batch of jewelry pieces live", async () => {
    prismaMock.jewelryPiece.findMany.mockResolvedValue([{ market: "intl" }, { market: "intl" }, { market: "intl" }] as never);
    prismaMock.jewelryPiece.updateMany.mockResolvedValue({ count: 3 });

    const result = await bulkSetCatalogStatus("jewelry", ["jew-1", "jew-2", "jew-3"], "LIVE");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.jewelryPiece.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["jew-1", "jew-2", "jew-3"] } }, data: { listingStatus: "LIVE", isPublished: true } });
    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
  });
});

describe("createJewelryVariant", () => {
  it("rejects a blank label before touching the database", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ market: "intl" } as never);

    const result = await createJewelryVariant("jew-1", formData({ label: "" }));

    expect(result.ok).toBe(false);
    expect(prismaMock.jewelryVariant.create).not.toHaveBeenCalled();
  });

  it("creates an intl variant with the USD price field, at the next sortOrder, and recomputes the piece", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ market: "intl" } as never);
    prismaMock.jewelryVariant.count.mockResolvedValueOnce(2); // existing variants -> sortOrder
    prismaMock.jewelryVariant.create.mockResolvedValue({ id: "variant-1" } as never);
    prismaMock.jewelryVariant.count.mockResolvedValueOnce(3); // recompute's own count
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    const result = await createJewelryVariant("jew-1", formData({ label: "Size 7", retailPrice: "650", lkrRetailPrice: "999999" }));

    expect(result).toEqual({ ok: true });
    expect(prismaMock.jewelryVariant.create).toHaveBeenCalledWith({
      data: { jewelryId: "jew-1", label: "Size 7", retailPrice: 650, lkrRetailPrice: undefined, costPrice: undefined, stockStatus: "AVAILABLE", sortOrder: 2 },
    });
  });

  it("creates an /lk variant with the LKR price field, ignoring any USD field submitted", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ market: "lk" } as never);
    prismaMock.jewelryVariant.count.mockResolvedValueOnce(0);
    prismaMock.jewelryVariant.create.mockResolvedValue({ id: "variant-1" } as never);
    prismaMock.jewelryVariant.count.mockResolvedValueOnce(1);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await createJewelryVariant("jew-1", formData({ label: "Size 7", retailPrice: "650", lkrRetailPrice: "199000" }));

    expect(prismaMock.jewelryVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ retailPrice: undefined, lkrRetailPrice: 199000 }) }),
    );
  });

  it("returns an error when the piece doesn't exist", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue(null);

    const result = await createJewelryVariant("jew-missing", formData({ label: "Size 7" }));

    expect(result).toEqual({ ok: false, error: "Jewelry piece not found." });
  });
});

describe("updateJewelryVariant", () => {
  it("clears a previously-set price override when the field is submitted blank", async () => {
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ jewelry: { id: "jew-1", market: "intl" } } as never);
    prismaMock.jewelryVariant.update.mockResolvedValue({} as never);
    prismaMock.jewelryVariant.count.mockResolvedValue(1);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    const result = await updateJewelryVariant("variant-1", "jew-1", formData({ label: "Size 7", stockStatus: "AVAILABLE" }));

    expect(result).toEqual({ ok: true });
    expect(prismaMock.jewelryVariant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { label: "Size 7", retailPrice: null, lkrRetailPrice: null, costPrice: null, stockStatus: "AVAILABLE" },
    });
  });

  it("recomputes the parent piece's availability after a stock-status edit", async () => {
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ jewelry: { id: "jew-1", market: "intl" } } as never);
    prismaMock.jewelryVariant.update.mockResolvedValue({} as never);
    prismaMock.jewelryVariant.count.mockResolvedValue(0);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await updateJewelryVariant("variant-1", "jew-1", formData({ label: "Size 7", stockStatus: "SOLD" }));

    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "SOLD" } });
  });
});

describe("deleteJewelryVariant", () => {
  it("refuses to delete a variant with order history", async () => {
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ id: "variant-1", _count: { orderItems: 1 } } as never);

    const result = await deleteJewelryVariant("variant-1", "jew-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.jewelryVariant.delete).not.toHaveBeenCalled();
  });

  it("deletes a variant with no order history and recomputes the parent piece", async () => {
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ id: "variant-1", _count: { orderItems: 0 } } as never);
    prismaMock.jewelryVariant.delete.mockResolvedValue({} as never);
    prismaMock.jewelryVariant.count.mockResolvedValue(0);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    const result = await deleteJewelryVariant("variant-1", "jew-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.jewelryVariant.delete).toHaveBeenCalledWith({ where: { id: "variant-1" } });
    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "SOLD" } });
  });
});
