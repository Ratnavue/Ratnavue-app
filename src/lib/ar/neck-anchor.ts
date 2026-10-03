// Pure landmark math for the AR try-on overlay, kept free of
// Three.js/MediaPipe/DOM so it's unit-testable on its own — same "keep
// the math pure and separately testable" pattern as the Design Studio's
// shape-ops.ts. Takes three of MediaPipe FaceLandmarker's 478 face points
// (chin + the two face-edge/cheek points) and turns them into where/how
// big/how tilted the 3D necklace model should render.
//
// This replaces an earlier version built on PoseLandmarker's two shoulder
// landmarks — shoulders turned out to be a poor proxy for "where the neck
// is" on real devices (see TODO.md's AR follow-up note). Detecting the
// face first and deriving the neck from it (a fixed drop below the chin,
// scaled to the face's own width) is a much more direct anchor: the face
// is what the tracker actually finds, the neck is immediately below it.

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

// How far below the chin (as a fraction of face width) the neck/collar —
// where a necklace or pendant actually rests — sits. Tuned by eye against
// a typical selfie framing, not measured against real recorded video;
// adjust here if the piece renders consistently too high/low once tried
// on a real device (see TODO.md).
const NECK_DROP_FRACTION = 0.55;

// A face width (in the same 0–1 normalized units, measured ear-to-ear at
// cheek level) that reads as "about life-size" for a typical phone
// selfie distance — scale is 1 at this width. Also tuned by eye, same
// caveat as above.
const REFERENCE_FACE_WIDTH = 0.3;

const MAX_ROTATION_RAD = Math.PI / 6; // 30°

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns the chin landmark and the two face-edge landmarks (MediaPipe
 * FaceLandmarker's indices 152, 234, 454 — see ArTryOnOverlay's own
 * constants) into where/how big/how tilted the piece should render.
 * Always drops straight down (increasing y) in image space from the chin
 * — not perpendicular to the cheek line — since a necklace hangs down
 * from the neck regardless of which landmark the tracker calls "left" vs
 * "right" (that labeling, and so the sign of a cheek-relative
 * perpendicular, flips depending on camera mirroring and landmark order;
 * straight-down doesn't have that failure mode). */
export function computeNeckAnchor(chin: FaceLandmark, leftFace: FaceLandmark, rightFace: FaceLandmark): NeckAnchor {
  const dx = rightFace.x - leftFace.x;
  const dy = rightFace.y - leftFace.y;
  const faceWidth = Math.hypot(dx, dy);

  const x = chin.x;
  const y = chin.y + faceWidth * NECK_DROP_FRACTION;

  const scale = faceWidth > 0 ? faceWidth / REFERENCE_FACE_WIDTH : 1;
  const rotationRad = faceWidth > 0 ? clamp(Math.atan2(dy, dx), -MAX_ROTATION_RAD, MAX_ROTATION_RAD) : 0;

  return { x, y, scale, rotationRad };
}
