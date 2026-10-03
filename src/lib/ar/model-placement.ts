// Pure math for recentering/scaling a loaded 3D model before it's placed
// at a neck anchor — kept free of Three.js so it's unit-testable on its
// own (same pattern as neck-anchor.ts). Takes a plain bounding-box shape
// (whatever THREE.Box3 reports) rather than a THREE.Box3 instance itself.

export interface BoundingBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface ModelPlacement {
  /** Offset to add to the model's own position so it's centered
   * horizontally (x/z) but anchored at its own TOP vertically (y) —
   * not its bounding-box center. A necklace/pendant hangs DOWN from
   * where it rests on the neck; anchoring at the center would place half
   * the model above the neck point and half below (reads as "the piece
   * is floating through the chin" — exactly the bug reported after the
   * first real-device try), while anchoring at the top means the whole
   * model renders at-or-below the anchor, the way a real necklace does. */
  offset: { x: number; y: number; z: number };
  /** Uniform scale that normalizes the model's largest dimension to 1
   * world unit, so a fixed BASE_MODEL_SIZE constant is the only place
   * final on-screen size is tuned, regardless of how the source file's
   * own units/scale happened to be authored. */
  scale: number;
}

/** This scene's camera/landmark convention has Y increasing DOWN the
 * screen (see ArTryOnOverlay's camera setup) — "the model's own top" means
 * its smallest local Y, which becomes the part closest to the neck
 * anchor once placed. */
export function computeModelPlacement(box: BoundingBox): ModelPlacement {
  const sizeX = box.max.x - box.min.x;
  const sizeY = box.max.y - box.min.y;
  const sizeZ = box.max.z - box.min.z;
  const largest = Math.max(sizeX, sizeY, sizeZ, 1e-6);

  return {
    offset: {
      x: -(box.min.x + box.max.x) / 2,
      y: -box.min.y,
      z: -(box.min.z + box.max.z) / 2,
    },
    scale: 1 / largest,
  };
}

/** What fraction of the whole model's largest dimension one named part
 * (e.g. the pendant) takes up — lets the real-world scale be calibrated
 * against a part with a known physical size ("the pendant is 5cm") instead
 * of an eyeballed BASE_MODEL_SIZE constant for the whole piece. Works for
 * any model that names its calibration part consistently (see
 * ArTryOnOverlay's loadModel), not just today's one placeholder. */
export function fractionOfWhole(partBox: BoundingBox, wholeBox: BoundingBox): number {
  const partSize = Math.max(partBox.max.x - partBox.min.x, partBox.max.y - partBox.min.y, partBox.max.z - partBox.min.z);
  const wholeSize = Math.max(wholeBox.max.x - wholeBox.min.x, wholeBox.max.y - wholeBox.min.y, wholeBox.max.z - wholeBox.min.z, 1e-6);
  return partSize / wholeSize;
}
