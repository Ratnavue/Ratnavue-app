import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { saveTranslationOverride } from "@/actions/translations";

const requireAdminMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
vi.mock("@/lib/rbac", () => ({ requireAdmin: () => requireAdminMock() }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("saveTranslationOverride", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(saveTranslationOverride(formData({ key: "nav.shopGems", locale: "es", value: "Comprar Gemas" }))).rejects.toThrow();
  });

  it("rejects a missing key", async () => {
    const result = await saveTranslationOverride(formData({ key: "", locale: "es", value: "x" }));
    expect(result).toEqual({ ok: false, error: "Missing translation key." });
    expect(prismaMock.translationOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale", async () => {
    const result = await saveTranslationOverride(formData({ key: "nav.shopGems", locale: "xx", value: "x" }));
    expect(result).toEqual({ ok: false, error: "Unsupported locale." });
    expect(prismaMock.translationOverride.upsert).not.toHaveBeenCalled();
  });

  it("saves a valid override", async () => {
    prismaMock.translationOverride.upsert.mockResolvedValue({} as never);
    const result = await saveTranslationOverride(formData({ key: "nav.shopGems", locale: "es", value: "Comprar Gemas" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.translationOverride.upsert).toHaveBeenCalledWith({
      where: { key_locale: { key: "nav.shopGems", locale: "es" } },
      create: { key: "nav.shopGems", locale: "es", value: "Comprar Gemas" },
      update: { value: "Comprar Gemas" },
    });
  });

  it("accepts a blank value to clear an override", async () => {
    prismaMock.translationOverride.deleteMany.mockResolvedValue({ count: 1 } as never);
    const result = await saveTranslationOverride(formData({ key: "nav.shopGems", locale: "es", value: "" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.translationOverride.deleteMany).toHaveBeenCalledWith({ where: { key: "nav.shopGems", locale: "es" } });
  });

  it("accepts a locale that isn't built in but was added as a custom language", async () => {
    prismaMock.locale.count.mockResolvedValue(1);
    prismaMock.translationOverride.upsert.mockResolvedValue({} as never);
    const result = await saveTranslationOverride(formData({ key: "nav.shopGems", locale: "ja", value: "ジェム" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.translationOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key_locale: { key: "nav.shopGems", locale: "ja" } } }),
    );
  });
});
