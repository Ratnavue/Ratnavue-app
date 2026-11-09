import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, themeForPath } from "./theme";

describe("parseTheme", () => {
  it("accepts the two real themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("falls back to the dark default for anything else", () => {
    expect(DEFAULT_THEME).toBe("dark");
    for (const value of [undefined, null, "", "LIGHT", "sepia", "dark; injected"]) {
      expect(parseTheme(value)).toBe("dark");
    }
  });
});

describe("themeForPath", () => {
  it("keeps the admin back office on the light theme whatever was saved", () => {
    expect(themeForPath("/admin", "dark")).toBe("light");
    expect(themeForPath("/admin/gems/new", "dark")).toBe("light");
  });

  it("uses the saved theme everywhere else", () => {
    expect(themeForPath("/", "dark")).toBe("dark");
    expect(themeForPath("/gems", "light")).toBe("light");
    // A storefront path that merely starts with the letters "admin" isn't the back office.
    expect(themeForPath("/administration-guide", "dark")).toBe("dark");
  });
});
