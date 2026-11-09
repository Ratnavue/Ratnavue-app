import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";
import { prismaMock } from "@/test/prisma-mock";
import { createGemstone, createJewelry } from "@/actions/catalog-admin";

// Regression: creating a gem/jewelry piece used to end in redirect(), which
// works by throwing. The admin forms call these actions inside try/catch, so
// the throw was caught as a failure and the admin saw "Something went wrong"
// for a listing that had in fact been saved. The actions now return where to
// go and the form navigates itself.

vi.mock("@/lib/rbac", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
  requireStaffArea: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", staffMarketScope: null }),
  requireMarketAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/media", () => ({ saveCertificateFile: vi.fn(), deleteUploadedFile: vi.fn(), createDirectUpload: vi.fn(), inspectDirectUpload: vi.fn() }));

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
  market: "intl",
};

const jewelryFields = { name: "Sapphire Ring", pieceType: "RING", metalType: "GOLD", market: "intl" };

describe("createGemstone", () => {
  it("resolves with the new gem's edit page instead of throwing a redirect", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue(null);
    prismaMock.gemstone.create.mockResolvedValue({ id: "gem-new" } as never);

    const result = await createGemstone(formData(gemFields));

    expect(result).toEqual({ ok: true, redirectTo: "/admin/gems/gem-new" });
    expect(prismaMock.gemstone.create).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a validation error (and saves nothing) for an invalid form", async () => {
    const result = await createGemstone(formData({ ...gemFields, name: "" }));

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("redirectTo");
    expect(prismaMock.gemstone.create).not.toHaveBeenCalled();
  });
});

describe("createJewelry", () => {
  it("resolves with the new piece's edit page instead of throwing a redirect", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue(null);
    prismaMock.jewelryPiece.create.mockResolvedValue({ id: "jew-new" } as never);

    const result = await createJewelry(formData(jewelryFields));

    expect(result).toEqual({ ok: true, redirectTo: "/admin/jewelry/jew-new" });
    expect(prismaMock.jewelryPiece.create).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });
});
