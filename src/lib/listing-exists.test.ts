import { describe, expect, it, vi } from "vitest";
import { listingExists, productPathOf } from "./listing-exists";

describe("productPathOf", () => {
  it("recognises product URLs only", () => {
    expect(productPathOf("/gems/blue-sapphire")).toEqual({ kind: "gemstone", slug: "blue-sapphire" });
    expect(productPathOf("/jewelry/gold-ring")).toEqual({ kind: "jewelry", slug: "gold-ring" });
    for (const p of ["/gems", "/gems/", "/gems/a/b", "/jewelry", "/about", "/gems/%E0%A4%A"]) expect(productPathOf(p)).toBeNull();
  });
});

describe("listingExists", () => {
  const product = { kind: "gemstone" as const, slug: "blue-sapphire" };

  it("asks the existence route for this store", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ exists: false }));
    expect(await listingExists("https://x.test", product, "lk", fetchImpl as never)).toBe(false);
    const url = (fetchImpl.mock.calls[0] as unknown as [URL])[0];
    expect(url.toString()).toBe("https://x.test/api/catalog/listing-exists?kind=gemstone&slug=blue-sapphire&market=lk");
  });

  it("can't say (null) on an error, a bad status or an odd body — so the page is served as usual", async () => {
    expect(await listingExists("https://x.test", product, "intl", (async () => { throw new Error("down"); }) as never)).toBeNull();
    expect(await listingExists("https://x.test", product, "intl", (async () => new Response("", { status: 500 })) as never)).toBeNull();
    expect(await listingExists("https://x.test", product, "intl", (async () => Response.json({ nope: 1 })) as never)).toBeNull();
  });
});
