import { describe, it, expect } from "vitest";
import { computeNecklaceAnchor, NECK_BASE_FRACTION, NECKLACE_WIDTH_MULTIPLIER } from "./neck-anchor";

const CHIN = { x: 0.5, y: 0.6 };
const LEFT_FACE = { x: 0.4, y: 0.5 };
const RIGHT_FACE = { x: 0.6, y: 0.5 };
const LEFT_SHOULDER = { x: 0.7, y: 0.8 }; // frame-right (the subject's own left)
const RIGHT_SHOULDER = { x: 0.3, y: 0.8 }; // frame-left (the subject's own right)
const ASPECT = 16 / 9;

describe("computeNecklaceAnchor", () => {
  it("anchors horizontally at the chin", () => {
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    expect(anchor.x).toBeCloseTo(CHIN.x, 5);
  });

  it("anchors vertically between the chin and the shoulder line, closer to the chin", () => {
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    const shoulderMidY = (LEFT_SHOULDER.y + RIGHT_SHOULDER.y) / 2;
    expect(anchor.y).toBeGreaterThan(CHIN.y);
    expect(anchor.y).toBeLessThan(shoulderMidY);
    expect(anchor.y).toBeCloseTo(CHIN.y + (shoulderMidY - CHIN.y) * NECK_BASE_FRACTION, 5);
  });

  it("sizes the necklace as a multiple of face width, not shoulder width", () => {
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    const faceWidth = Math.hypot(RIGHT_FACE.x - LEFT_FACE.x, (RIGHT_FACE.y - LEFT_FACE.y) * ASPECT);
    expect(anchor.width).toBeCloseTo(faceWidth * NECKLACE_WIDTH_MULTIPLIER, 5);
  });

  it("scales up for a wider (closer) face and down for a narrower (farther) one", () => {
    const narrow = computeNecklaceAnchor(CHIN, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    const wide = computeNecklaceAnchor(CHIN, { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    expect(wide.width).toBeGreaterThan(narrow.width);
  });

  it("has no rotation for level shoulders", () => {
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    expect(anchor.rotationRad).toBeCloseTo(0, 5);
  });

  it("rotates to match a shoulder tilt, within the clamp, regardless of argument order", () => {
    // Frame-right shoulder lower than frame-left — a real, modest tilt.
    const tiltedLeft = { x: 0.7, y: 0.85 };
    const tiltedRight = { x: 0.3, y: 0.78 };
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, tiltedLeft, tiltedRight, ASPECT);
    expect(anchor.rotationRad).toBeGreaterThan(0);
    expect(Math.abs(anchor.rotationRad)).toBeLessThanOrEqual(Math.PI / 6);

    // Swapping which landmark is passed as "left" vs "right" shouldn't
    // flip the result — the function sorts by actual frame position.
    const swapped = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, tiltedRight, tiltedLeft, ASPECT);
    expect(swapped.rotationRad).toBeCloseTo(anchor.rotationRad, 5);
  });

  it("clamps an extreme/bad-detection tilt rather than spinning the piece wildly", () => {
    const extremeLeft = { x: 0.51, y: 0.2 };
    const extremeRight = { x: 0.5, y: 0.9 };
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, extremeLeft, extremeRight, ASPECT);
    expect(Math.abs(anchor.rotationRad)).toBeCloseTo(Math.PI / 6, 5);
  });

  it("stays finite and doesn't divide by zero when both face-edge landmarks coincide", () => {
    const anchor = computeNecklaceAnchor(CHIN, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, LEFT_SHOULDER, RIGHT_SHOULDER, ASPECT);
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.width).toBe(0);
  });

  it("stays finite when both shoulder landmarks coincide", () => {
    const anchor = computeNecklaceAnchor(CHIN, LEFT_FACE, RIGHT_FACE, { x: 0.5, y: 0.8 }, { x: 0.5, y: 0.8 }, ASPECT);
    expect(Number.isFinite(anchor.rotationRad)).toBe(true);
    expect(anchor.rotationRad).toBe(0);
  });
});
