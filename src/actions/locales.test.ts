import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { createCustomLocale, toggleCustomLocaleActive, removeCustomLocale } from "@/actions/locales";

const requireAdminMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
vi.mock("@/lib/rbac", () => ({ requireAdmin: () => requireAdminMock() }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("createCustomLocale", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createCustomLocale(formData({ code: "ja", name: "Japanese", nativeName: "日本語" }))).rejects.toThrow();
  });

  it("rejects an invalid code without touching the database", async () => {
    const result = await createCustomLocale(formData({ code: "en", name: "English", nativeName: "English" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.locale.create).not.toHaveBeenCalled();
  });

  it("creates a valid new language", async () => {
    prismaMock.locale.count.mockResolvedValue(0);
    prismaMock.locale.create.mockResolvedValue({} as never);
    const result = await createCustomLocale(formData({ code: "ja", name: "Japanese", nativeName: "日本語" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.locale.create).toHaveBeenCalledWith({ data: { code: "ja", name: "Japanese", nativeName: "日本語", sortOrder: 0 } });
  });
});

describe("toggleCustomLocaleActive", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(toggleCustomLocaleActive("ja", false)).rejects.toThrow();
  });

  it("updates the active flag", async () => {
    prismaMock.locale.update.mockResolvedValue({} as never);
    const result = await toggleCustomLocaleActive("ja", false);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.locale.update).toHaveBeenCalledWith({ where: { code: "ja" }, data: { active: false } });
  });
});

describe("removeCustomLocale", () => {
  it("requires admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(removeCustomLocale("ja")).rejects.toThrow();
  });

  it("deletes the locale and its overrides", async () => {
    prismaMock.translationOverride.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.locale.delete.mockResolvedValue({} as never);
    const result = await removeCustomLocale("ja");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.locale.delete).toHaveBeenCalledWith({ where: { code: "ja" } });
  });
});
