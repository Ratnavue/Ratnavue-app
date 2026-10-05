// Pure landmark math for the AR try-on overlay, kept free of
// Three.js/MediaPipe/DOM so it's unit-testable on its own — same "keep
// the math pure and separately testable" pattern as the Design Studio's
// shape-ops.ts. Takes face landmarks (forehead, chin, cheeks) plus the
// two shoulder landmarks and turns them into where/how big/how tilted
// the 3D necklace model should render.
//
// History: originally built on PoseLandmarker's two shoulder landmarks
// alone, then switched to pure face-landmark extrapolation (a fixed drop
// below the chin) when shoulders proved unreliable in that first pass —
// see TODO.md. Real-device calibration sessions (2026-10-03/04, via the
// `?arDebug=1` panel) found shoulder tracking is in fact reliable on this
// device, and that anchoring purely by chin-drop-fraction or purely by
// shoulder-width both misjudge how a real necklace actually sits: too
// far down/wide when scaled to shoulder width, but a pure face-based
// guess couldn't reliably clear the chin either. Composited test renders
// directly onto a real photo (not just live trial and error) found that
// a HYBRID works: horizontal size from face width (a necklace hugs the
// neck, closer to face-width than full shoulder-width), vertical anchor
// interpolated between the chin and the shoulder line (not the chin
// alone, and not the shoulder line alone), and tilt from the shoulders
// (a more reliable body-tilt reference than the face). See
// computeNecklaceAnchor below.

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
   * head/shoulder tilt. Clamped because a wider angle almost always means
   * a bad detection (a person's natural tilt rarely exceeds this), not a
   * real pose worth matching exactly. */
  rotationRad: number;
}

// A face width (in the same 0–1 normalized x-units, measured ear-to-ear
// at cheek level) that reads as "about life-size" for a typical phone
// selfie distance — scale is 1 at this width. Tuned by eye, not measured
// against real video.
export const REFERENCE_FACE_WIDTH = 0.3;

// How far below the chin, as a fraction of the gap between the chin and
// the shoulder line, the necklace's own anchor sits — 0 would put it
// exactly at the chin, 1 exactly at the shoulder line. A real necklace
// hugs the neck, close to the chin/jaw, not out at the shoulders — a
// small fraction read right in composited tests against a real photo
// (2026-10-04, see TODO.md).
export const NECK_BASE_FRACTION = 0.12;

// The necklace's own width as a multiple of face width — a real necklace
// (as opposed to a statement/wide chain) sits close to the neck, a
// little wider than the face itself, nowhere near full shoulder width.
// Also read from composited real-photo tests.
export const NECKLACE_WIDTH_MULTIPLIER = 1.15;

const MAX_ROTATION_RAD = Math.PI / 6; // 30°

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface ShoulderLandmark {
  x: number;
  y: number;
}

export interface NecklaceAnchor {
  /** Normalized 0–1 position for the necklace's own top-center anchor
   * (where the chain's highest point sits), interpolated between the
   * chin and the shoulder line. */
  x: number;
  y: number;
  /** The necklace's target width, in the same normalized x-units as x —
   * a multiple of the measured face width (see NECKLACE_WIDTH_MULTIPLIER),
   * not shoulder width. */
  width: number;
  /** Radians, clamped to ±30°, from the shoulder line's own tilt — a
   * more reliable body-tilt reference than the face. */
  rotationRad: number;
}

/** Turns face landmarks (forehead unused here, chin + the two face-edge
 * points) and the two shoulder landmarks into where/how wide/how tilted
 * the necklace's chain should render, and where its top anchor sits.
 * `aspect` is the video's height/width ratio — needed because x is
 * normalized to frame width and y to frame height, two different
 * physical scales whenever the frame isn't square (a phone selfie never
 * is); mixing them directly in one hypot/atan2 silently gives the wrong
 * width/angle (the same class of bug that first made the old
 * drop-fraction-only version wrong — see git history on this file). */
export function computeNecklaceAnchor(
  chin: FaceLandmark,
  leftFace: FaceLandmark,
  rightFace: FaceLandmark,
  leftShoulder: ShoulderLandmark,
  rightShoulder: ShoulderLandmark,
  aspect: number,
  neckBaseFraction: number = NECK_BASE_FRACTION,
  widthMultiplier: number = NECKLACE_WIDTH_MULTIPLIER,
): NecklaceAnchor {
  const faceDx = rightFace.x - leftFace.x;
  const faceDy = (rightFace.y - leftFace.y) * aspect;
  const faceWidth = Math.hypot(faceDx, faceDy);

  // MediaPipe's "left shoulder" (landmark 11) is the SUBJECT's own left,
  // which in a raw/unmirrored selfie frame appears on the larger-x side —
  // the opposite of what the label suggests spatially. Sort by actual
  // frame position, not the semantic label, so the result doesn't depend
  // on which argument the caller passed as "left" vs "right".
  const [p1, p2] = leftShoulder.x >= rightShoulder.x ? [leftShoulder, rightShoulder] : [rightShoulder, leftShoulder];
  const shoulderDx = p1.x - p2.x;
  const shoulderDy = (p1.y - p2.y) * aspect;

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;

  const x = chin.x;
  const y = chin.y + (shoulderMidY - chin.y) * neckBaseFraction;
  const width = faceWidth * widthMultiplier;
  const rotationRad = clamp(Math.atan2(shoulderDy, shoulderDx), -MAX_ROTATION_RAD, MAX_ROTATION_RAD);

  return { x, y, width, rotationRad };
}
