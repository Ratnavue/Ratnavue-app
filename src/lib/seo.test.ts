import { describe, expect, it, vi, beforeEach } from "vitest";

const headerValues = new Map<string, string>();
let market: "intl" | "lk" = "intl";
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => headerValues.get(k) ?? null }) }));
vi.mock("@/lib/market", async (orig) => ({ ...(await orig<typeof import("@/lib/market")>()), getMarket: async () => market }));

const { homeJsonLd, jsonLdScript, metaDescription, pageMetadata, productJsonLd, SITE_URL } = await import("./seo");

beforeEach(() => {
  headerValues.clear();
  market = "intl";
});

describe("metaDescription", () => {
  it("leaves short copy alone (whitespace tidied)", () => {
    expect(metaDescription("  A  fine\nsapphire. ")).toBe("A fine sapphire.");
  });

  it("trims long copy on a whole word, within the limit, with an ellipsis", () => {
    const long = "Discover the mesmerizing beauty of this natural color-changing spinel, a remarkable gemstone that embodies elegance, mystery, and timeless sophistication.";
    const out = metaDescription(long, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("…")).toBe(true);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(out).not.toMatch(/,…$/);
  });
});

describe("pageMetadata", () => {
  it("gives the international page a full Open Graph block with the brand share image", async () => {
    headerValues.set("x-app-path", "/gems");
    const m = await pageMetadata({ title: "Ceylon Gemstones", description: "Shop natural Ceylon gems." });
    expect(m.title).toEqual({ absolute: "Ceylon Gemstones · Ratnavue" });
    expect(m.openGraph).toMatchObject({
      title: "Ceylon Gemstones · Ratnavue",
      url: `${SITE_URL}/gems`,
      siteName: "Ratnavue",
      type: "website",
      locale: "en_US",
      images: [expect.objectContaining({ url: "/opengraph-image", width: 1200, height: 630 })],
    });
    expect(m.robots).toBeUndefined();
  });

  it("makes the Sri Lanka copy of a page distinct (title, description, URL, locale)", async () => {
    market = "lk";
    headerValues.set("x-app-path", "/gems");
    const m = await pageMetadata({ title: "Ceylon Gemstones", description: "Shop natural Ceylon gems." });
    expect(m.title).toEqual({ absolute: "Ceylon Gemstones · Ratnavue Sri Lanka" });
    expect(m.description).toContain("Sri Lanka");
    expect(m.openGraph).toMatchObject({ url: `${SITE_URL}/lk/gems`, locale: "en_LK", siteName: "Ratnavue Sri Lanka" });
  });

  it("uses a product's own photo as the share image, and keeps absolute titles as-is", async () => {
    const m = await pageMetadata({ title: { absolute: "Ratnavue — Home" }, description: "x".repeat(60), image: "/media/gem.webp" });
    expect(m.title).toEqual({ absolute: "Ratnavue — Home" });
    expect(m.openGraph).toMatchObject({ images: [{ url: "/media/gem.webp" }] });
  });

  it("shortens the suffix rather than letting a long product title run past ~60 characters", async () => {
    market = "lk";
    const longName = "Natural Pink Garnet Ring – Size 8 | 925 Sterling Silver"; // 55 chars
    const m = await pageMetadata({ title: longName, description: "A garnet ring in sterling silver." });
    expect(m.title).toEqual({ absolute: longName });
    const mid = await pageMetadata({ title: "Natural Blue Sapphire – 0.90 Carat Oval Cut", description: "A sapphire." });
    expect(mid.title).toEqual({ absolute: "Natural Blue Sapphire – 0.90 Carat Oval Cut · Ratnavue" });
  });

  it("can noindex a page while still letting crawlers follow its links", async () => {
    const m = await pageMetadata({ title: "Search", description: "Search the catalog.", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: true });
  });
});

describe("productJsonLd", () => {
  const base = {
    name: "Natural Blue Sapphire",
    description: "A cornflower blue Ceylon sapphire.",
    url: `${SITE_URL}/gems/blue`,
    images: ["/media/a.webp", "https://cdn.example.com/b.jpg"],
    sku: "blue",
    category: "Gemstones > Blue Sapphire",
    currency: "USD",
  };

  it("includes a priced offer with availability when the price is public", () => {
    const ld = productJsonLd({ ...base, price: 4200, stockStatus: "AVAILABLE" });
    expect(ld).toMatchObject({ "@type": "Product", brand: { name: "Ratnavue" }, image: [`${SITE_URL}/media/a.webp`, "https://cdn.example.com/b.jpg"] });
    expect(ld.offers).toMatchObject({ price: "4200.00", priceCurrency: "USD", availability: "https://schema.org/InStock" });
  });

  it("maps reserved and sold stock", () => {
    expect(productJsonLd({ ...base, price: 1, stockStatus: "RESERVED" }).offers?.availability).toBe("https://schema.org/LimitedAvailability");
    expect(productJsonLd({ ...base, price: 1, stockStatus: "SOLD" }).offers?.availability).toBe("https://schema.org/SoldOut");
  });

  it("omits the offer for a quote-only piece", () => {
    expect(productJsonLd({ ...base, price: null, stockStatus: "AVAILABLE" })).not.toHaveProperty("offers");
  });
});

describe("homeJsonLd / jsonLdScript", () => {
  it("describes the organization and a site search for each store", () => {
    const [org, site] = homeJsonLd("lk");
    expect(org).toMatchObject({ "@type": "Organization", name: "Ratnavue" });
    expect(site).toMatchObject({ "@type": "WebSite", url: `${SITE_URL}/lk` });
    expect(site.potentialAction.target).toBe(`${SITE_URL}/lk/search?q={search_term_string}`);
  });

  it("escapes '<' so admin-written text can't close the script tag", () => {
    const out = jsonLdScript({ description: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).description).toBe("</script><script>alert(1)</script>");
  });
});
