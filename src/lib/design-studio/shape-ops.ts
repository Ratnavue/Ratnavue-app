// Pure shape-manipulation math, kept free of React/DOM so it's unit
// testable on its own: cloning (for copy/paste), and the radial-repeat
// tool (draw one segment of a ring, repeat it evenly around a center).

import type { Pane, Shape } from "./types";

/** Deep-clones a set of shapes with fresh ids, offset so a paste into the
 * same pane is visibly distinct from the originals. groupId is preserved
 * so a pasted radial-repeat group is still selectable as one unit. */
export function cloneShapes(shapes: Shape[], offset = 16): Shape[] {
  return shapes.map((s) => ({ ...s, id: crypto.randomUUID(), x: s.x + offset, y: s.y + offset }));
}

/** The centroid of a pane's own "band"/ring shape if it has one (the
 * natural pivot for a repeated prong/stone pattern around a band), else
 * the centroid of all its shapes, else the pane center. */
export function paneCenter(pane: Pick<Pane, "shapes">, fallback: { x: number; y: number }): { x: number; y: number } {
  const band = pane.shapes.find((s) => s.type === "band");
  if (band) return { x: band.x, y: band.y };
  if (pane.shapes.length === 0) return fallback;
  const sum = pane.shapes.reduce((acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y }), { x: 0, y: 0 });
  return { x: sum.x / pane.shapes.length, y: sum.y / pane.shapes.length };
}

/** Repeats the given shapes `count` times, evenly spaced around `center`,
 * starting from each shape's own current angle/distance from that center
 * (so the first copy lands back on the original position — callers keep
 * the originals separately and only insert the returned copies). Every
 * returned shape shares one new groupId, so the whole repeated ring can
 * later be selected or deleted as a single unit. Count is clamped to a
 * sane range; fewer than 2 copies isn't a "repeat" and more than 72
 * (5° apart) isn't a readable schematic sketch. */
export function radialRepeat(shapes: Shape[], center: { x: number; y: number }, count: number): Shape[] {
  const n = Math.round(Math.max(2, Math.min(72, count)));
  const groupId = crypto.randomUUID();
  const step = 360 / n;
  const copies: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (step * i * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const s of shapes) {
      const dx = s.x - center.x;
      const dy = s.y - center.y;
      copies.push({
        ...s,
        id: crypto.randomUUID(),
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
        rotation: s.rotation + step * i,
        groupId,
      });
    }
  }
  return copies;
}

/** The midpoint of live-symmetry wedge 0 (the master slice, spanning
 * angle 0 to 360/count — same clockwise, rotate()-around-center
 * convention as radialRepeat above and PaneSVG's SymmetryGuides), at the
 * given distance from center. Used as the spawn point for a newly added
 * shape when symmetry is on, so it lands visibly inside the editable
 * wedge instead of exactly on the pivot (where all its mirrors would
 * stack invisibly on top of each other — a shape sitting exactly at the
 * rotation center doesn't move when rotated). */
export function wedgeMidpoint(center: { x: number; y: number }, count: number, radius: number): { x: number; y: number } {
  const angleDeg = 360 / count / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = 0;
  const dy = -radius;
  return { x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad), y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad) };
}
