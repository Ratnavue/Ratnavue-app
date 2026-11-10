import { describe, it, expect } from "vitest";
import { isLiveStatus, itemScanPath, parseItemNumber } from "@/lib/item-number";

describe("parseItemNumber", () => {
  it("reads the canonical form", () => {
    expect(parseItemNumber("G-000123")).toEqual({ kind: "gemstone", itemNumber: "G-000123" });
    expect(parseItemNumber("J-000045")).toEqual({ kind: "jewelry", itemNumber: "J-000045" });
  });

  it("accepts the ways people actually type a number", () => {
    for (const raw of ["g-000123", "G000123", "g123", "G-123", " G 123 ", "G%2D000123"]) {
      expect(parseItemNumber(raw)).toEqual({ kind: "gemstone", itemNumber: "G-000123" });
    }
  });

  it("keeps numbers past six digits intact", () => {
    expect(parseItemNumber("J-1234567")).toEqual({ kind: "jewelry", itemNumber: "J-1234567" });
  });

  it("rejects anything that isn't an item number", () => {
    for (const raw of ["", "G-", "X-000123", "G-0", "blue-sapphire", "G-12a", "GG-1", "%E0%A4%A"]) {
      expect(parseItemNumber(raw)).toBeNull();
    }
  });
});

describe("isLiveStatus", () => {
  it("is only true for LIVE", () => {
    expect(isLiveStatus("LIVE")).toBe(true);
    expect(isLiveStatus("FINISHED")).toBe(false);
    expect(isLiveStatus("DRAFT")).toBe(false);
  });
});

describe("itemScanPath", () => {
  it("points at the item number, not a slug", () => {
    expect(itemScanPath("G-000123")).toBe("/i/G-000123");
  });
});
