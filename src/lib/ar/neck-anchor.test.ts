import { describe, it, expect } from "vitest";
import { computeNeckAnchor } from "./neck-anchor";

describe("computeNeckAnchor", () => {
  it("places the anchor under the chin horizontally", () => {
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.x).toBeCloseTo(0.5, 5);
  });

  it("offsets downward (bigger y) from the chin", () => {
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.y).toBeGreaterThan(0.55);
  });

  it("scales 1:1 at the reference face width", () => {
    // Reference width is 0.3 — a pair 0.15 apart on each side of center.
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 });
    expect(anchor.scale).toBeCloseTo(1, 1);
  });

  it("scales up for a wider (closer) face and down for a narrower (farther) one", () => {
    const narrow = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 });
    const wide = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 });
    expect(wide.scale).toBeGreaterThan(narrow.scale);
  });

  it("has no rotation for a level head", () => {
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
    expect(anchor.rotationRad).toBeCloseTo(0, 5);
  });

  it("rotates to match a head tilt, within the clamp", () => {
    // Right side of the face lower than the left — a real, modest tilt.
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.4, y: 0.48 }, { x: 0.6, y: 0.52 });
    expect(anchor.rotationRad).toBeGreaterThan(0);
    expect(Math.abs(anchor.rotationRad)).toBeLessThanOrEqual(Math.PI / 6);
  });

  it("clamps an extreme/bad-detection tilt rather than spinning the piece wildly", () => {
    // A near-vertical "face line" — not a real pose, should clamp to 30°.
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.5, y: 0.2 }, { x: 0.51, y: 0.8 });
    expect(Math.abs(anchor.rotationRad)).toBeCloseTo(Math.PI / 6, 5);
  });

  it("stays finite and doesn't divide by zero when both face-edge landmarks coincide", () => {
    const anchor = computeNeckAnchor({ x: 0.5, y: 0.55 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.scale).toBe(1);
    expect(anchor.rotationRad).toBe(0);
  });
});
