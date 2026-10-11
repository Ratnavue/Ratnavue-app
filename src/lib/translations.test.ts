import { describe, it, expect } from "vitest";
import { revalidateTag } from "next/cache";
import { prismaMock } from "@/test/prisma-mock";
import {
  flattenToMap,
  flattenEnglishKeys,
  applyOverrides,
  getTranslationOverrides,
  setTranslationOverride,
  TRANSLATION_OVERRIDES_TAG,
  type Messages,
} from "@/lib/translations";

describe("flattenToMap", () => {
  it("flattens a nested message tree into dot-path keys", () => {
    const messages: Messages = { nav: { shopGems: "Shop Gems", shopJewelry: "Shop Jewelry" }, footer: { tagline: "Fine gems" } };
    expect(flattenToMap(messages)).toEqual({
      "nav.shopGems": "Shop Gems",
      "nav.shopJewelry": "Shop Jewelry",
      "footer.tagline": "Fine gems",
    });
  });

  it("returns an empty object for an empty tree", () => {
    expect(flattenToMap({})).toEqual({});
  });
});

describe("flattenEnglishKeys", () => {
  it("produces a non-empty list of real keys with their English text, no duplicates", () => {
    const keys = flattenEnglishKeys();
    expect(keys.length).toBeGreaterThan(0);
    const keyNames = keys.map((k) => k.key);
    expect(new Set(keyNames).size).toBe(keyNames.length);
    // A key known to exist in messages/en.json's "nav" section.
    expect(keys.some((k) => k.key.startsWith("nav."))).toBe(true);
  });
});

describe("applyOverrides", () => {
  it("sets a value at an existing nested path without mutating the input", () => {
    const messages: Messages = { nav: { shopGems: "Shop Gems" } };
    const result = applyOverrides(messages, { "nav.shopGems": "Comprar Gemas" });
    expect(result).toEqual({ nav: { shopGems: "Comprar Gemas" } });
    expect(messages).toEqual({ nav: { shopGems: "Shop Gems" } }); // unchanged
  });

  it("creates intermediate objects for a path that doesn't exist yet", () => {
    const result = applyOverrides({}, { "nav.shopGems": "Comprar Gemas" });
    expect(result).toEqual({ nav: { shopGems: "Comprar Gemas" } });
  });

  it("leaves untouched keys alone", () => {
    const messages: Messages = { nav: { shopGems: "Shop Gems", shopJewelry: "Shop Jewelry" } };
    const result = applyOverrides(messages, { "nav.shopGems": "Comprar Gemas" });
    expect(result).toEqual({ nav: { shopGems: "Comprar Gemas", shopJewelry: "Shop Jewelry" } });
  });

  it("applies multiple overrides", () => {
    const result = applyOverrides({}, { "nav.shopGems": "A", "footer.tagline": "B" });
    expect(result).toEqual({ nav: { shopGems: "A" }, footer: { tagline: "B" } });
  });
});

describe("getTranslationOverrides", () => {
  it("reduces the DB rows for a locale into a flat key->value map", async () => {
    prismaMock.translationOverride.findMany.mockResolvedValue([
      { key: "nav.shopGems", value: "Comprar Gemas" },
      { key: "footer.tagline", value: "Gemas finas" },
    ] as never);
    const result = await getTranslationOverrides("es");
    expect(result).toEqual({ "nav.shopGems": "Comprar Gemas", "footer.tagline": "Gemas finas" });
    expect(prismaMock.translationOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { locale: "es" } }),
    );
  });
});

describe("setTranslationOverride", () => {
  it("upserts a non-blank value and drops the cache", async () => {
    prismaMock.translationOverride.upsert.mockResolvedValue({} as never);
    await setTranslationOverride("nav.shopGems", "es", "Comprar Gemas");
    expect(prismaMock.translationOverride.upsert).toHaveBeenCalledWith({
      where: { key_locale: { key: "nav.shopGems", locale: "es" } },
      create: { key: "nav.shopGems", locale: "es", value: "Comprar Gemas" },
      update: { value: "Comprar Gemas" },
    });
    expect(revalidateTag).toHaveBeenCalledWith(TRANSLATION_OVERRIDES_TAG, { expire: 0 });
  });

  it("trims whitespace before saving", async () => {
    prismaMock.translationOverride.upsert.mockResolvedValue({} as never);
    await setTranslationOverride("nav.shopGems", "es", "  Comprar Gemas  ");
    expect(prismaMock.translationOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ value: "Comprar Gemas" }) }),
    );
  });

  it("deletes the row instead of saving a blank value — clears back to the JSON fallback, not an empty string", async () => {
    prismaMock.translationOverride.deleteMany.mockResolvedValue({ count: 1 } as never);
    await setTranslationOverride("nav.shopGems", "es", "   ");
    expect(prismaMock.translationOverride.deleteMany).toHaveBeenCalledWith({ where: { key: "nav.shopGems", locale: "es" } });
    expect(prismaMock.translationOverride.upsert).not.toHaveBeenCalled();
    expect(revalidateTag).toHaveBeenCalledWith(TRANSLATION_OVERRIDES_TAG, { expire: 0 });
  });
});
