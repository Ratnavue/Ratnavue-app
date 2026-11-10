import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import {
  createGemstone,
  updateGemstone,
  updateJewelry,
  deleteGemstone,
  deleteJewelry,
  toggleGemstoneFeatured,
  removeCertificateFile,
  deleteJewelryVariant,
  updateJewelryVariant,
  createJewelryVariant,
  bulkSetCatalogStatus,
} from "@/actions/catalog-admin";
import { setPrimaryMedia, deleteProductMedia, registerProductMedia, reorderProductMedia } from "@/actions/media";
import { auth } from "@/lib/auth";

// The real rbac module on purpose: these tests are about what a STAFF
// session can and can't do, so only the session itself is faked.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/media", () => ({ saveCertificateFile: vi.fn(), deleteUploadedFile: vi.fn(), createDirectUpload: vi.fn(), inspectDirectUpload: vi.fn() }));

function staff(scope: "intl" | "lk" | "both", permissions: string[] = ["catalog"]) {
  vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: scope, staffPermissions: permissions } } as never);
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const gemFields = {
  name: "Blue Sapphire",
  mineralId: "m1",
  cutId: "c1",
  caratWeight: "2.1",
  colorHue: "220",
  clarityGradeId: "cl1",
  treatmentId: "t1",
  originId: "o1",
};

const existingGem = {
  market: "intl",
  price: 4200,
  showPrice: true,
  retailPrice: 4800,
  costPrice: 2600,
  lkrRetailPrice: null,
  lkrPrice: null,
  isFeatured: true,
};

beforeEach(() => {
  vi.mocked(auth).mockReset();
});

describe("STAFF without the catalog area", () => {
  it("can't create, edit or publish anything", async () => {
    staff("both", ["orders", "reviews"]);
    await expect(createGemstone(formData(gemFields))).rejects.toThrow("FORBIDDEN");
    await expect(updateGemstone("gem-1", formData(gemFields))).rejects.toThrow("FORBIDDEN");
    await expect(bulkSetCatalogStatus("gemstone", ["gem-1"], "LIVE")).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.gemstone.create).not.toHaveBeenCalled();
    expect(prismaMock.gemstone.update).not.toHaveBeenCalled();
  });
});

describe("STAFF with the catalog area — market scope", () => {
  it("can't create a listing in a store outside their scope", async () => {
    staff("intl");
    await expect(createGemstone(formData({ ...gemFields, market: "lk", lkrRetailPrice: "1000" }))).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.gemstone.create).not.toHaveBeenCalled();
  });

  it("can't edit a listing that belongs to another store", async () => {
    staff("lk");
    prismaMock.gemstone.findUnique.mockResolvedValue({ ...existingGem, market: "intl" } as never);
    await expect(updateGemstone("gem-1", formData(gemFields))).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.gemstone.update).not.toHaveBeenCalled();
  });

  it("can't bulk-publish a batch that includes an out-of-scope item", async () => {
    staff("intl");
    prismaMock.gemstone.findMany.mockResolvedValue([{ market: "intl" }, { market: "lk" }] as never);
    await expect(bulkSetCatalogStatus("gemstone", ["a", "b"], "LIVE")).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("can't attach a photo to another store's item", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue({ market: "lk" } as never);
    await expect(registerProductMedia({ key: "k", gemstoneId: "gem-1" })).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.mediaAsset.create).not.toHaveBeenCalled();
  });

  it("can't change the primary photo of another store's item", async () => {
    staff("intl");
    prismaMock.mediaAsset.findUnique.mockResolvedValue({ gemstoneId: null, jewelryId: "jew-lk" } as never);
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ market: "lk" } as never);
    await expect(setPrimaryMedia("media-1")).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("can't edit a variant through a piece in their own store when the variant is in another", async () => {
    staff("intl");
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ jewelry: { id: "jew-lk", market: "lk" } } as never);
    // jewelryId sent by the client says "my own piece" — the variant's real piece wins.
    await expect(updateJewelryVariant("variant-1", "jew-intl", formData({ label: "Size 7", stockStatus: "AVAILABLE" }))).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.jewelryVariant.update).not.toHaveBeenCalled();
  });
});

describe("STAFF with the catalog area — arranging a gallery", () => {
  it("can't reorder another store's gallery", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue({ market: "lk" } as never);
    await expect(reorderProductMedia({ gemstoneId: "gem-lk", orderedIds: ["a", "b"] })).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("can reorder their own store's gallery: index becomes the order and the first is primary", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue({ market: "intl" } as never);
    prismaMock.mediaAsset.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }] as never);
    prismaMock.mediaAsset.update.mockResolvedValue({} as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await reorderProductMedia({ gemstoneId: "gem-1", orderedIds: ["c", "a", "b"] });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.mediaAsset.update).toHaveBeenCalledWith({ where: { id: "c" }, data: { sortOrder: 0, isPrimary: true } });
    expect(prismaMock.mediaAsset.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { sortOrder: 1, isPrimary: false } });
    expect(prismaMock.mediaAsset.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { sortOrder: 2, isPrimary: false } });
  });

  it("rejects an order that drops, repeats or invents an image", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue({ market: "intl" } as never);
    prismaMock.mediaAsset.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    for (const orderedIds of [["a"], ["a", "a"], ["a", "x"], ["a", "b", "c"]]) {
      const result = await reorderProductMedia({ gemstoneId: "gem-1", orderedIds });
      expect(result.ok).toBe(false);
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("needs exactly one of gemstoneId / jewelryId", async () => {
    staff("both");
    expect((await reorderProductMedia({ orderedIds: [] })).ok).toBe(false);
    expect((await reorderProductMedia({ gemstoneId: "g", jewelryId: "j", orderedIds: [] })).ok).toBe(false);
  });
});

describe("STAFF with the catalog area — never costs, never price changes", () => {
  it("creating a listing drops any cost price and never features it", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue(null);
    prismaMock.gemstone.create.mockResolvedValue({ id: "gem-new" } as never);

    await createGemstone(formData({ ...gemFields, market: "intl", retailPrice: "4800", costPrice: "1", isFeatured: "true" }));

    const data = prismaMock.gemstone.create.mock.calls[0][0].data;
    expect(data.costPrice).toBeUndefined();
    expect(data.isFeatured).toBe(false);
    expect(data.retailPrice).toBe(4800);
  });

  it("editing keeps the saved prices, cost and featured flag whatever the request says", async () => {
    staff("intl");
    prismaMock.gemstone.findUnique.mockResolvedValue(existingGem as never);
    prismaMock.gemstone.update.mockResolvedValue({} as never);

    const result = await updateGemstone(
      "gem-1",
      formData({ ...gemFields, price: "1", retailPrice: "1", costPrice: "999999", showPrice: "false", isFeatured: "false" }),
    );

    expect(result).toEqual({ ok: true });
    const data = prismaMock.gemstone.update.mock.calls[0][0].data;
    expect(data.price).toBe(4200);
    expect(data.retailPrice).toBe(4800);
    expect(data.costPrice).toBe(2600);
    expect(data.showPrice).toBe(true);
    expect(data.isFeatured).toBe(true);
  });

  it("editing an existing LK listing can't zero its rupee price", async () => {
    staff("lk");
    prismaMock.gemstone.findUnique.mockResolvedValue({ ...existingGem, market: "lk", price: null, retailPrice: null, costPrice: null, lkrRetailPrice: 1450000, lkrPrice: 1500000 } as never);
    prismaMock.gemstone.update.mockResolvedValue({} as never);

    const result = await updateGemstone("gem-1", formData({ ...gemFields, lkrRetailPrice: "1", lkrPrice: "1" }));

    expect(result).toEqual({ ok: true });
    const data = prismaMock.gemstone.update.mock.calls[0][0].data;
    expect(data.lkrRetailPrice).toBe(1450000);
    expect(data.lkrPrice).toBe(1500000);
  });

  it("jewelry edits keep saved prices too", async () => {
    staff("intl");
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ ...existingGem } as never);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await updateJewelry("jew-1", formData({ name: "Ring", pieceType: "RING", metalType: "GOLD", retailPrice: "1", costPrice: "1" }));

    const data = prismaMock.jewelryPiece.update.mock.calls[0][0].data;
    expect(data.retailPrice).toBe(4800);
    expect(data.costPrice).toBe(2600);
  });

  it("a variant edit changes the label and stock but never touches its prices", async () => {
    staff("intl");
    prismaMock.jewelryVariant.findUnique.mockResolvedValue({ jewelry: { id: "jew-1", market: "intl" } } as never);
    prismaMock.jewelryVariant.update.mockResolvedValue({} as never);
    prismaMock.jewelryVariant.count.mockResolvedValue(1);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await updateJewelryVariant("variant-1", "jew-1", formData({ label: "Size 8", stockStatus: "SOLD", retailPrice: "1", costPrice: "1" }));

    expect(prismaMock.jewelryVariant.update).toHaveBeenCalledWith({ where: { id: "variant-1" }, data: { label: "Size 8", stockStatus: "SOLD" } });
  });

  it("a new variant never carries price or cost overrides from staff", async () => {
    staff("intl");
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ market: "intl" } as never);
    prismaMock.jewelryVariant.count.mockResolvedValue(0);
    prismaMock.jewelryVariant.create.mockResolvedValue({} as never);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await createJewelryVariant("jew-1", formData({ label: "Size 6", stockStatus: "AVAILABLE", retailPrice: "1", costPrice: "1" }));

    const data = prismaMock.jewelryVariant.create.mock.calls[0][0].data;
    expect(data.retailPrice).toBeUndefined();
    expect(data.costPrice).toBeUndefined();
  });
});

describe("STAFF with the catalog area — admin-only stays admin-only", () => {
  it("can't delete, feature, or remove files", async () => {
    staff("both", ["orders", "catalog", "requests", "reviews"]);
    await expect(deleteGemstone("gem-1")).rejects.toThrow("FORBIDDEN");
    await expect(deleteJewelry("jew-1")).rejects.toThrow("FORBIDDEN");
    await expect(toggleGemstoneFeatured("gem-1", true)).rejects.toThrow("FORBIDDEN");
    await expect(removeCertificateFile("gem-1")).rejects.toThrow("FORBIDDEN");
    await expect(deleteJewelryVariant("v-1", "jew-1")).rejects.toThrow("FORBIDDEN");
    await expect(deleteProductMedia("media-1")).rejects.toThrow("FORBIDDEN");
    expect(prismaMock.gemstone.delete).not.toHaveBeenCalled();
  });
});

describe("ADMIN is unchanged", () => {
  it("still saves whatever prices and cost the form sends", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN", staffMarketScope: null, staffPermissions: [] } } as never);
    prismaMock.gemstone.findUnique.mockResolvedValue(existingGem as never);
    prismaMock.gemstone.update.mockResolvedValue({} as never);

    await updateGemstone("gem-1", formData({ ...gemFields, retailPrice: "5000", costPrice: "3000", isFeatured: "false" }));

    const data = prismaMock.gemstone.update.mock.calls[0][0].data;
    expect(data.retailPrice).toBe(5000);
    expect(data.costPrice).toBe(3000);
    expect(data.isFeatured).toBe(false);
  });
});
