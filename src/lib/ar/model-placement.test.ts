import { describe, it, expect } from "vitest";
import { computeModelPlacement } from "./model-placement";

describe("computeModelPlacement", () => {
  it("centers the offset horizontally (x/z)", () => {
    const { offset } = computeModelPlacement({ min: { x: -2, y: 0, z: -1 }, max: { x: 4, y: 3, z: 1 } });
    // Center of [-2,4] is 1 — offset should cancel it out to 0.
    expect(offset.x).toBeCloseTo(-1, 5);
    expect(offset.z).toBeCloseTo(0, 5);
  });

  it("anchors at the top (min y), not the vertical center", () => {
    const { offset } = computeModelPlacement({ min: { x: -1, y: -2, z: -1 }, max: { x: 1, y: 4, z: 1 } });
    expect(offset.y).toBeCloseTo(2, 5);
    // After applying the offset, min.y moves to exactly 0 — the model's
    // own top sits at the anchor, with everything else at y >= 0.
    expect(-2 + offset.y).toBeCloseTo(0, 5);
    expect(4 + offset.y).toBeGreaterThan(0);
  });

  it("scales the largest dimension to exactly 1", () => {
    const { scale } = computeModelPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 5, z: 1 } });
    expect(scale).toBeCloseTo(1 / 5, 5);
  });

  it("picks whichever axis is actually largest", () => {
    const wide = computeModelPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 1, z: 1 } });
    const tall = computeModelPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 10, z: 1 } });
    expect(wide.scale).toBeCloseTo(1 / 10, 5);
    expect(tall.scale).toBeCloseTo(1 / 10, 5);
  });

  it("stays finite for a degenerate (zero-size) box", () => {
    const { scale, offset } = computeModelPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
    expect(Number.isFinite(scale)).toBe(true);
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
    expect(Number.isFinite(offset.z)).toBe(true);
  });
});
