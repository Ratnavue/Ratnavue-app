// Pure landmark math for the AR try-on overlay, kept free of
// Three.js/MediaPipe/DOM so it's unit-testable on its own — same "keep
// the math pure and separately testable" pattern as the Design Studio's
// shape-ops.ts. Takes MediaPipe PoseLandmarker's two shoulder landmarks
// (indices 11/12 in its 33-point topology) and turns them into where/how
// big/how tilted the 3D necklace model should render.

/** A MediaPipe NormalizedLandmark, narrowed to the fields this needs —
 * x/y are 0–1, normalized to the video frame's width/height. */
export interface ShoulderLandmark {
  x: number;
  y: number;
}

export interface NeckAnchor {
  /** Normalized 0–1 position (same space as the input landmarks) for
   * where the piece's center should render. */
  x: number;
  y: number;
  /** Unitless multiplier: 1 at a "typical" selfie-distance shoulder
   * width, bigger when the shoulders are further apart (closer to the
   * camera) — a free, camera-only depth cue with no real depth sensor. */
  scale: number;
  /** Radians, clamped to ±30° — how much to rotate the piece to match
   * shoulder/head tilt. Clamped because a wider angle almost always means
   * a bad detection (a person's natural shoulder tilt rarely exceeds
   * this), not a real pose worth matching exactly. */
  rotationRad: number;
}

// How far above the shoulder midpoint (as a fraction of shoulder width)
// the neck/collarbone sits — tuned by eye against a typical selfie
// framing, not measured; adjust here if the piece renders consistently
// too high/low once tried against real video.
const NECK_OFFSET_FRACTION = 0.35;

// A shoulder width (in the same 0–1 normalized units) that reads as
// "about life-size" for a typical phone selfie distance — scale is 1 at
// this width. Also tuned by eye, same caveat as above.
const REFERENCE_SHOULDER_WIDTH = 0.22;

const MAX_ROTATION_RAD = Math.PI / 6; // 30°

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns the two shoulder landmarks into where/how big/how tilted the
 * piece should render. Always offsets straight up (decreasing y) in
 * image space from the shoulder midpoint — not perpendicular to the
 * shoulder line — since a necklace sits above the shoulders regardless
 * of which landmark the tracker happened to call "left" vs "right"
 * (that labeling, and so the sign of a shoulder-relative perpendicular,
 * flips depending on camera mirroring and landmark order; straight-up
 * doesn't have that failure mode). */
export function computeNeckAnchor(leftShoulder: ShoulderLandmark, rightShoulder: ShoulderLandmark): NeckAnchor {
  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;
  const shoulderWidth = Math.hypot(dx, dy);

  const midX = (leftShoulder.x + rightShoulder.x) / 2;
  const midY = (leftShoulder.y + rightShoulder.y) / 2;

  const x = midX;
  const y = midY - shoulderWidth * NECK_OFFSET_FRACTION;

  const scale = shoulderWidth > 0 ? shoulderWidth / REFERENCE_SHOULDER_WIDTH : 1;
  const rotationRad = shoulderWidth > 0 ? clamp(Math.atan2(dy, dx), -MAX_ROTATION_RAD, MAX_ROTATION_RAD) : 0;

  return { x, y, scale, rotationRad };
}
