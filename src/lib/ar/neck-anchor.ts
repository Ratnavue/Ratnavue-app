// Pure landmark math for the AR try-on overlay, kept free of
// Three.js/MediaPipe/DOM so it's unit-testable on its own — same "keep
// the math pure and separately testable" pattern as the Design Studio's
// shape-ops.ts. Takes four of MediaPipe FaceLandmarker's 478 face points
// (forehead, chin, and the two face-edge/cheek points) and turns them
// into where/how big/how tilted the 3D necklace model should render.
//
// This replaces an earlier version built on PoseLandmarker's two shoulder
// landmarks — shoulders turned out to be a poor proxy for "where the neck
// is" on real devices (see TODO.md's AR follow-up note). Detecting the
// face first and deriving the neck from it (a fixed drop below the chin)
// is a much more direct anchor: the face is what the tracker actually
// finds, the neck is immediately below it.

/** A MediaPipe NormalizedLandmark, narrowed to the fields this needs —
 * x/y are 0–1, normalized to the video frame's width/height. */
export interface FaceLandmark {
  x: number;
  y: number;
}

export interface NeckAnchor {
  /** Normalized 0–1 position (same space as the input landmarks) for
   * where the piece's center should render. */
  x: number;
  y: number;
  /** Unitless multiplier: 1 at a "typical" selfie-distance face width,
   * bigger when the face is wider (closer to the camera) — a free,
   * camera-only depth cue with no real depth sensor. */
  scale: number;
  /** Radians, clamped to ±30° — how much to rotate the piece to match
   * head tilt. Clamped because a wider angle almost always means a bad
   * detection (a person's natural head tilt rarely exceeds this), not a
   * real pose worth matching exactly. */
  rotationRad: number;
}

// How far below the chin the neck/collar — where a necklace or pendant
// actually rests — sits, as a fraction of the face's own height
// (forehead-to-chin). Deliberately generous: the first version of this
// (a fraction of face WIDTH, added directly to the y-coordinate) mixed
// two different normalized axes — a video frame's width and height aren't
// equal, so an x-measured distance applied as a y-offset doesn't mean
// what it looks like it means — and even measured correctly, the first
// value (0.55) was reported as still landing on the chin on a real
// device. Using face HEIGHT keeps the offset on the same axis as the
// drop (no unit mismatch), and this fraction is intentionally large
// enough to clear the chin with room to spare. Still "tuned by eye, not
// measured against real video" — see TODO.md. Exported so
// ArTryOnOverlay's debug mode (`?arDebug=1`) can offer it as a live,
// adjustable starting point — the fastest way to get a real number here
// is to let someone nudge it while watching their own neck, not another
// round of guessing.
//
// History: 0.55 (face-WIDTH based, a unit-mismatch bug — see git log)
// still landed on the chin → fixed the units and tried 1.1, which
// real-device testing (2026-10-03) overshot to the chest. 0.6 is the
// next best estimate, still unconfirmed against a real device.
export const NECK_DROP_FRACTION = 0.6;

// A face width (in the same 0–1 normalized x-units, measured ear-to-ear
// at cheek level) that reads as "about life-size" for a typical phone
// selfie distance — scale is 1 at this width. Also tuned by eye, same
// caveat as above.
const REFERENCE_FACE_WIDTH = 0.3;

const MAX_ROTATION_RAD = Math.PI / 6; // 30°

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns the forehead/chin landmarks and the two face-edge landmarks
 * (MediaPipe FaceLandmarker's indices 10, 152, 234, 454 — see
 * ArTryOnOverlay's own constants) into where/how big/how tilted the piece
 * should render. Always drops straight down (increasing y) in image
 * space from the chin — not perpendicular to the cheek line — since a
 * necklace hangs down from the neck regardless of which landmark the
 * tracker calls "left" vs "right" (that labeling, and so the sign of a
 * cheek-relative perpendicular, flips depending on camera mirroring and
 * landmark order; straight-down doesn't have that failure mode). */
export function computeNeckAnchor(forehead: FaceLandmark, chin: FaceLandmark, leftFace: FaceLandmark, rightFace: FaceLandmark, dropFraction: number = NECK_DROP_FRACTION): NeckAnchor {
  const dx = rightFace.x - leftFace.x;
  const dy = rightFace.y - leftFace.y;
  const faceWidth = Math.hypot(dx, dy);
  const faceHeight = Math.abs(chin.y - forehead.y);

  const x = chin.x;
  const y = chin.y + faceHeight * dropFraction;

  const scale = faceWidth > 0 ? faceWidth / REFERENCE_FACE_WIDTH : 1;
  const rotationRad = faceWidth > 0 ? clamp(Math.atan2(dy, dx), -MAX_ROTATION_RAD, MAX_ROTATION_RAD) : 0;

  return { x, y, scale, rotationRad };
}
