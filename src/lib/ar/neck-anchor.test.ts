import { describe, it, expect } from "vitest";
import { computeNeckAnchor } from "./neck-anchor";

describe("computeNeckAnchor", () => {
  it("places the anchor at the shoulder midpoint horizontally", () => {
    const anchor = computeNeckAnchor({ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.x).toBeCloseTo(0.5, 5);
  });

  it("offsets upward (smaller y) from the shoulder midpoint", () => {
    const anchor = computeNeckAnchor({ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.y).toBeLessThan(0.5);
  });

  it("scales 1:1 at the reference shoulder width", () => {
    // Reference width is 0.22 — a pair 0.11 apart on each side of center.
    const anchor = computeNeckAnchor({ x: 0.39, y: 0.5 }, { x: 0.61, y: 0.5 });
    expect(anchor.scale).toBeCloseTo(1, 1);
  });

  it("scales up for wider-apart (closer) shoulders and down for narrower (farther)", () => {
    const narrow = computeNeckAnchor({ x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 });
    const wide = computeNeckAnchor({ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 });
    expect(wide.scale).toBeGreaterThan(narrow.scale);
  });

  it("has no rotation for level shoulders", () => {
    const anchor = computeNeckAnchor({ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.rotationRad).toBeCloseTo(0, 5);
  });

  it("rotates to match a shoulder tilt, within the clamp", () => {
    // Right shoulder lower than left — a real, modest tilt.
    const anchor = computeNeckAnchor({ x: 0.4, y: 0.48 }, { x: 0.6, y: 0.52 });
    expect(anchor.rotationRad).toBeGreaterThan(0);
    expect(Math.abs(anchor.rotationRad)).toBeLessThanOrEqual(Math.PI / 6);
  });

  it("clamps an extreme/bad-detection tilt rather than spinning the piece wildly", () => {
    // A near-vertical "shoulder line" — not a real pose, should clamp to 30°.
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.2 }, { x: 0.51, y: 0.8 });
    expect(Math.abs(anchor.rotationRad)).toBeCloseTo(Math.PI / 6, 5);
  });

  it("stays finite and doesn't divide by zero when both landmarks coincide", () => {
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.scale).toBe(1);
    expect(anchor.rotationRad).toBe(0);
  });
});
