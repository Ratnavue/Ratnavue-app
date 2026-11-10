import { describe, expect, it } from "vitest";
import { AUDIENCE_SEO_LABELS, PAGE_SEO, fill } from "./seo-copy";
import { MAX_PAGE_DESCRIPTION_LENGTH, lkDescription } from "./seo";

// Long-but-realistic values for the templated entries, so the limits are
// checked against what a page could actually render.
const SAMPLE = { audience: "Everyone", label: "Spring Blossom", item: "Natural Blue Sapphire – 2.10 Carat", mineral: "Padparadscha Sapphire", type: "Jewelry Sets" };
const entries = Object.entries(PAGE_SEO).map(([key, v]) => ({ key, title: fill(v.title, SAMPLE), description: fill(v.description, SAMPLE) }));

describe("PAGE_SEO", () => {
  it("keeps every description short enough for the Sri Lanka note to fit untrimmed", () => {
    // Copy that already mentions rupees takes no note (see lkDescription), so only 160 applies to it.
    const limit = (d: string) => (/rupee/i.test(d) ? 160 : MAX_PAGE_DESCRIPTION_LENGTH);
    const tooLong = entries.filter((e) => e.description.length > limit(e.description)).map((e) => `${e.key} (${e.description.length})`);
    expect(tooLong).toEqual([]);
  });

  it("keeps descriptions long enough to be useful in results (40+), except search", () => {
    expect(entries.filter((e) => e.key !== "search" && e.description.length < 40).map((e) => e.key)).toEqual([]);
  });

  it("keeps titles within ~60 characters with the Sri Lanka suffix", () => {
    const tooLong = entries
      .filter((e) => e.key !== "homeLk" && `${e.title} · Ratnavue Sri Lanka`.length > 60 && `${e.title} · Ratnavue`.length > 60)
      .map((e) => e.key);
    expect(tooLong).toEqual([]);
  });

  it("has no duplicate titles or descriptions", () => {
    const titles = entries.map((e) => e.title);
    const descriptions = entries.map((e) => e.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("produces a distinct Sri Lanka description for every shared page, never cut short", () => {
    for (const e of entries) {
      const lk = lkDescription(e.description);
      // homeLk only exists on the Sri Lanka store (and already says rupees).
      if (e.key !== "homeLk") expect(lk).not.toBe(e.description);
      expect(lk.length).toBeLessThanOrEqual(160);
      expect(lk).not.toContain("…");
    }
  });

  it("reads naturally for every jewelry audience", () => {
    expect(Object.values(AUDIENCE_SEO_LABELS).map((a) => fill(PAGE_SEO.jewelryAudience.title, { audience: a }))).toEqual([
      "Fine Jewelry for Women",
      "Fine Jewelry for Men",
      "Fine Jewelry for Couples",
      "Fine Jewelry for Everyone",
    ]);
  });
});

describe("lkDescription", () => {
  it("adds the full note, the short one when Sri Lanka is already named, and none when rupees are", () => {
    expect(lkDescription("Fine Ceylon gems.")).toBe("Fine Ceylon gems. Prices in rupees, for Sri Lanka.");
    expect(lkDescription("Sourced in Sri Lanka.")).toBe("Sourced in Sri Lanka. Prices in rupees.");
    expect(lkDescription("Priced in rupees.")).toBe("Priced in rupees.");
  });

  it("trims long copy to make room for the note, staying within 160", () => {
    const out = lkDescription("word ".repeat(60).trim());
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith(" Prices in rupees, for Sri Lanka.")).toBe(true);
  });
});
