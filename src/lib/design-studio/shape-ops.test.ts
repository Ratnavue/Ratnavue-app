import { describe, it, expect } from "vitest";
import { cloneShapes, paneCenter, radialRepeat, wedgeMidpoint } from "./shape-ops";
import type { Shape } from "./types";

function stone(overrides: Partial<Shape> = {}): Shape {
  return { id: "s1", type: "stone", x: 200, y: 100, w: 16, h: 16, rotation: 0, fill: "#fff", stroke: "#000", strokeWidth: 1, ...overrides };
}

describe("cloneShapes", () => {
  it("gives every clone a fresh id and offsets its position", () => {
    const originals = [stone({ id: "a" }), stone({ id: "b", x: 50, y: 50 })];

    const clones = cloneShapes(originals, 10);

    expect(clones).toHaveLength(2);
    expect(clones.map((c) => c.id)).not.toEqual(["a", "b"]);
    expect(new Set(clones.map((c) => c.id)).size).toBe(2);
    expect(clones[0]).toMatchObject({ x: 210, y: 110 });
    expect(clones[1]).toMatchObject({ x: 60, y: 60 });
  });

  it("preserves an existing groupId on the clone", () => {
    const [clone] = cloneShapes([stone({ groupId: "ring-1" })]);
    expect(clone.groupId).toBe("ring-1");
  });
});

describe("paneCenter", () => {
  it("uses the pane's band shape as the pivot when one exists", () => {
    const band: Shape = { ...stone({ type: "band" }), x: 120, y: 130 };
    const center = paneCenter({ shapes: [band, stone()] }, { x: 0, y: 0 });
    expect(center).toEqual({ x: 120, y: 130 });
  });

  it("averages every shape's position when there's no band", () => {
    const center = paneCenter({ shapes: [stone({ x: 0, y: 0 }), stone({ x: 100, y: 100 })] }, { x: 0, y: 0 });
    expect(center).toEqual({ x: 50, y: 50 });
  });

  it("falls back to the given point for an empty pane", () => {
    expect(paneCenter({ shapes: [] }, { x: 200, y: 200 })).toEqual({ x: 200, y: 200 });
  });
});

describe("radialRepeat", () => {
  it("produces exactly `count` copies, all sharing one new groupId", () => {
    const copies = radialRepeat([stone()], { x: 200, y: 200 }, 8);
    expect(copies).toHaveLength(8);
    const groupIds = new Set(copies.map((c) => c.groupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBeTruthy();
  });

  it("repeats multiple selected shapes together, count times each", () => {
    const copies = radialRepeat([stone({ id: "a" }), stone({ id: "b" })], { x: 200, y: 200 }, 4);
    expect(copies).toHaveLength(8);
  });

  it("spaces copies evenly around the center, each at the same radius as the original", () => {
    const original = stone({ x: 200, y: 100 }); // 100 units above a center of (200, 200)
    const copies = radialRepeat([original], { x: 200, y: 200 }, 4);

    for (const copy of copies) {
      const radius = Math.hypot(copy.x - 200, copy.y - 200);
      expect(radius).toBeCloseTo(100, 5);
    }
    // 4 copies 90° apart starting from directly above the center.
    expect(copies[0].x).toBeCloseTo(200, 5);
    const angles = copies.map((c) => (Math.atan2(c.y - 200, c.x - 200) * 180) / Math.PI);
    const sorted = [...angles].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo(90, 5);
    }
  });

  it("clamps the count to a sane 2–72 range", () => {
    expect(radialRepeat([stone()], { x: 0, y: 0 }, 1)).toHaveLength(2);
    expect(radialRepeat([stone()], { x: 0, y: 0 }, 500)).toHaveLength(72);
  });

  it("rotates each copy by its share of the full turn", () => {
    const copies = radialRepeat([stone({ rotation: 0 })], { x: 200, y: 200 }, 4);
    expect(copies.map((c) => c.rotation)).toEqual([0, 90, 180, 270]);
  });
});

describe("wedgeMidpoint", () => {
  it("sits at the given radius from center", () => {
    const p = wedgeMidpoint({ x: 200, y: 200 }, 8, 90);
    expect(Math.hypot(p.x - 200, p.y - 200)).toBeCloseTo(90, 5);
  });

  it("sits at half the wedge angle, clockwise from straight up", () => {
    // 4-way symmetry: wedge 0 spans 0°–90°, so its midpoint is 45°
    // clockwise from (center.x, center.y - radius) — i.e. up-and-right.
    const p = wedgeMidpoint({ x: 0, y: 0 }, 4, 100);
    expect(p.x).toBeCloseTo(100 * Math.sin((45 * Math.PI) / 180), 5);
    expect(p.y).toBeCloseTo(-100 * Math.cos((45 * Math.PI) / 180), 5);
  });

  it("never lands exactly on center, so a shape placed there is still visible once mirrored", () => {
    for (const count of [4, 6, 8, 12]) {
      const p = wedgeMidpoint({ x: 200, y: 200 }, count, 90);
      expect(p.x === 200 && p.y === 200).toBe(false);
    }
  });
});
