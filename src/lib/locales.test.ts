import { describe, it, expect } from "vitest";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/prisma-mock";
import {
  addCustomLocale,
  setCustomLocaleActive,
  deleteCustomLocale,
  customLocaleExists,
  getActiveCustomLocales,
  CUSTOM_LOCALES_TAG,
} from "@/lib/locales";

const BUILT_IN = ["en", "es", "fr", "de", "pt", "si", "ta"] as const;

describe("addCustomLocale", () => {
  it("rejects a code that isn't 2-3 lowercase letters", async () => {
    const result = await addCustomLocale("Japanese!", "Japanese", "日本語", BUILT_IN);
    expect(result).toEqual({ ok: false, error: "Use a 2-3 letter language code, e.g. \"ja\"." });
    expect(prismaMock.locale.create).not.toHaveBeenCalled();
  });

  it("rejects a code that's already a built-in language", async () => {
    const result = await addCustomLocale("es", "Spanish", "Español", BUILT_IN);
    expect(result).toEqual({ ok: false, error: '"es" is already a built-in language.' });
    expect(prismaMock.locale.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name or native name", async () => {
    const result = await addCustomLocale("ja", "", "日本語", BUILT_IN);
    expect(result.ok).toBe(false);
    expect(prismaMock.locale.create).not.toHaveBeenCalled();
  });

  it("lowercases and trims the code, creates the row, and drops the cache", async () => {
    prismaMock.locale.count.mockResolvedValue(2);
    prismaMock.locale.create.mockResolvedValue({} as never);
    const result = await addCustomLocale(" JA ", "Japanese", "日本語", BUILT_IN);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.locale.create).toHaveBeenCalledWith({
      data: { code: "ja", name: "Japanese", nativeName: "日本語", sortOrder: 2 },
    });
    expect(revalidateTag).toHaveBeenCalledWith(CUSTOM_LOCALES_TAG, { expire: 0 });
  });

  it("returns a friendly error instead of throwing on a duplicate code", async () => {
    prismaMock.locale.count.mockResolvedValue(0);
    prismaMock.locale.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.19.3" }),
    );
    const result = await addCustomLocale("ja", "Japanese", "日本語", BUILT_IN);
    expect(result).toEqual({ ok: false, error: '"ja" has already been added.' });
  });
});

describe("setCustomLocaleActive", () => {
  it("updates the row and drops the cache", async () => {
    prismaMock.locale.update.mockResolvedValue({} as never);
    await setCustomLocaleActive("ja", false);
    expect(prismaMock.locale.update).toHaveBeenCalledWith({ where: { code: "ja" }, data: { active: false } });
    expect(revalidateTag).toHaveBeenCalledWith(CUSTOM_LOCALES_TAG, { expire: 0 });
  });
});

describe("deleteCustomLocale", () => {
  it("deletes the locale's overrides and the locale itself, then drops the cache", async () => {
    prismaMock.translationOverride.deleteMany.mockResolvedValue({ count: 3 } as never);
    prismaMock.locale.delete.mockResolvedValue({} as never);
    await deleteCustomLocale("ja");
    expect(prismaMock.translationOverride.deleteMany).toHaveBeenCalledWith({ where: { locale: "ja" } });
    expect(prismaMock.locale.delete).toHaveBeenCalledWith({ where: { code: "ja" } });
    expect(revalidateTag).toHaveBeenCalledWith(CUSTOM_LOCALES_TAG, { expire: 0 });
  });
});

describe("customLocaleExists", () => {
  it("is true when a row with that code exists, regardless of active state", async () => {
    prismaMock.locale.count.mockResolvedValue(1);
    expect(await customLocaleExists("ja")).toBe(true);
    expect(prismaMock.locale.count).toHaveBeenCalledWith({ where: { code: "ja" } });
  });

  it("is false when no row matches", async () => {
    prismaMock.locale.count.mockResolvedValue(0);
    expect(await customLocaleExists("xx")).toBe(false);
  });
});

describe("getActiveCustomLocales", () => {
  it("only returns active locales, sorted", async () => {
    prismaMock.locale.findMany.mockResolvedValue([{ code: "ja", name: "Japanese", nativeName: "日本語", active: true }] as never);
    const result = await getActiveCustomLocales();
    expect(result).toEqual([{ code: "ja", name: "Japanese", nativeName: "日本語", active: true }]);
    expect(prismaMock.locale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    );
  });
});
