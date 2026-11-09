import { describe, expect, it } from "vitest";
import { gemColorFor, tint } from "./gem-palette";

const HEX = /^#[0-9a-f]{6}$/;

describe("gemColorFor", () => {
  it("uses the hand-picked colour for a known mineral, by slug or by name", () => {
    expect(gemColorFor("blue-sapphire")).toBe("#5b7cc9");
    expect(gemColorFor("Blue Sapphire")).toBe("#5b7cc9");
    expect(gemColorFor("Cat's Eye Chrysoberyl")).toBe(gemColorFor("cats-eye-chrysoberyl"));
  });

  it("falls back to the middle of an unknown mineral's hue range", () => {
    const green = gemColorFor("brand-new-mineral", { hueMin: 100, hueMax: 140 });
    expect(green).toMatch(HEX);
    // Hue 120 → a green: the green channel dominates.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(green.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("always returns a valid hex colour, even with no hue range", () => {
    expect(gemColorFor("unknown")).toMatch(HEX);
  });
});

describe("tint", () => {
  it("blends toward white by the given amount", () => {
    expect(tint("#000000", 0)).toBe("#000000");
    expect(tint("#000000", 1)).toBe("#ffffff");
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(tint("#5b7cc9", 0.2)).toMatch(HEX);
  });
});
