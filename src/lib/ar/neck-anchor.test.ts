import { describe, it, expect } from "vitest";
import { computeNeckAnchor } from "./neck-anchor";

const FOREHEAD = { x: 0.5, y: 0.2 };
const CHIN = { x: 0.5, y: 0.55 };
const LEFT = { x: 0.4, y: 0.5 };
const RIGHT = { x: 0.6, y: 0.5 };

describe("computeNeckAnchor", () => {
  it("places the anchor under the chin horizontally", () => {
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, LEFT, RIGHT);
    expect(anchor.x).toBeCloseTo(0.5, 5);
  });

  it("offsets downward (bigger y) from the chin, scaled to face height", () => {
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, LEFT, RIGHT);
    expect(anchor.y).toBeGreaterThan(CHIN.y);
    expect(anchor.y).toBeCloseTo(CHIN.y + 0.35 * 0.6, 5);
  });

  it("drops further for a taller (closer, or just bigger-framed) face", () => {
    const shortFace = computeNeckAnchor({ x: 0.5, y: 0.4 }, CHIN, LEFT, RIGHT);
    const tallFace = computeNeckAnchor({ x: 0.5, y: 0.1 }, CHIN, LEFT, RIGHT);
    expect(tallFace.y).toBeGreaterThan(shortFace.y);
  });

  it("scales 1:1 at the reference face width", () => {
    // Reference width is 0.3 — a pair 0.15 apart on each side of center.
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 });
    expect(anchor.scale).toBeCloseTo(1, 1);
  });

  it("scales up for a wider (closer) face and down for a narrower (farther) one", () => {
    const narrow = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 });
    const wide = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 });
    expect(wide.scale).toBeGreaterThan(narrow.scale);
  });

  it("has no rotation for a level head", () => {
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, LEFT, RIGHT);
    expect(anchor.rotationRad).toBeCloseTo(0, 5);
  });

  it("rotates to match a head tilt, within the clamp", () => {
    // Right side of the face lower than the left — a real, modest tilt.
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.4, y: 0.48 }, { x: 0.6, y: 0.52 });
    expect(anchor.rotationRad).toBeGreaterThan(0);
    expect(Math.abs(anchor.rotationRad)).toBeLessThanOrEqual(Math.PI / 6);
  });

  it("clamps an extreme/bad-detection tilt rather than spinning the piece wildly", () => {
    // A near-vertical "face line" — not a real pose, should clamp to 30°.
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.5, y: 0.2 }, { x: 0.51, y: 0.8 });
    expect(Math.abs(anchor.rotationRad)).toBeCloseTo(Math.PI / 6, 5);
  });

  it("accepts an explicit dropFraction override instead of the default", () => {
    const shallow = computeNeckAnchor(FOREHEAD, CHIN, LEFT, RIGHT, 0.2);
    const deep = computeNeckAnchor(FOREHEAD, CHIN, LEFT, RIGHT, 2);
    expect(shallow.y).toBeLessThan(deep.y);
    expect(shallow.y).toBeCloseTo(CHIN.y + 0.35 * 0.2, 5);
  });

  it("stays finite and doesn't divide by zero when both face-edge landmarks coincide", () => {
    const anchor = computeNeckAnchor(FOREHEAD, CHIN, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.scale).toBe(1);
    expect(anchor.rotationRad).toBe(0);
  });
});
