// Static starter templates — no DB, no seeding, just a shape list that
// seeds a pane when picked from the toolbar's template menu. Schematic
// sketches (circles/lines, not photorealistic renders), consistent with
// the Design Studio's confirmed "2D sketch tool" scope.

import { newShape, PANE_SIZE, type Shape, type ShapeType } from "./types";
import { radialRepeat } from "./shape-ops";

const CENTER = { x: PANE_SIZE / 2, y: PANE_SIZE / 2 };

function shape(type: ShapeType, overrides: Partial<Shape> = {}): Shape {
  return { ...newShape(type, CENTER), ...overrides };
}

export type TemplateCategory = "ring" | "earring-pendant" | "bracelet-necklace";

export interface DesignTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  /** Called fresh each time the template is applied, so every shape gets
   * its own id — never share one static array across applications. */
  build: () => Shape[];
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ring: "Ring bands",
  "earring-pendant": "Earrings & pendants",
  "bracelet-necklace": "Bracelets & necklaces",
};

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "solitaire",
    label: "Solitaire",
    category: "ring",
    build: () => [
      shape("band"),
      shape("stone", { x: 200, y: 90, w: 40, h: 40 }),
    ],
  },
  {
    id: "pave-band",
    label: "Pavé Band",
    category: "ring",
    build: () => {
      const band = shape("band");
      const seed = shape("stone", { x: 200, y: 90, w: 16, h: 16 });
      return [band, ...radialRepeat([seed], { x: band.x, y: band.y }, 16)];
    },
  },
  {
    id: "eternity-band",
    label: "Eternity Band",
    category: "ring",
    build: () => {
      const band = shape("band");
      const seed = shape("stone", { x: 200, y: 88, w: 14, h: 14 });
      return [band, ...radialRepeat([seed], { x: band.x, y: band.y }, 28)];
    },
  },
  {
    id: "three-stone",
    label: "Three-Stone",
    category: "ring",
    build: () => [
      shape("band"),
      shape("stone", { x: 200, y: 86, w: 38, h: 38 }),
      shape("stone", { x: 150, y: 100, w: 22, h: 22 }),
      shape("stone", { x: 250, y: 100, w: 22, h: 22 }),
    ],
  },
  {
    id: "stud",
    label: "Stud",
    category: "earring-pendant",
    build: () => [
      shape("stone", { x: 200, y: 170, w: 48, h: 48 }),
      shape("prong", { x: 200, y: 210, w: 6, h: 24 }),
    ],
  },
  {
    id: "drop-earring",
    label: "Drop Earring",
    category: "earring-pendant",
    build: () => [
      shape("stone", { x: 200, y: 90, w: 20, h: 20 }),
      shape("chain", { x: 200, y: 160, w: 4, h: 110, rotation: 0 }),
      shape("stone", { x: 200, y: 260, w: 36, h: 48 }),
    ],
  },
  {
    id: "halo-pendant",
    label: "Halo Pendant",
    category: "earring-pendant",
    build: () => {
      const center = shape("stone", { x: 200, y: 220, w: 44, h: 44 });
      const haloSeed = shape("stone", { x: 200, y: 180, w: 12, h: 12 });
      const loop = shape("chain", { x: 200, y: 140, w: 24, h: 24, rotation: 0 });
      return [loop, center, ...radialRepeat([haloSeed], { x: center.x, y: center.y }, 12)];
    },
  },
  {
    id: "tennis-bracelet",
    label: "Tennis Bracelet",
    category: "bracelet-necklace",
    build: () => {
      const stoneCount = 9;
      const startX = 70;
      const spacing = (PANE_SIZE - 140) / (stoneCount - 1);
      const stones: Shape[] = [];
      for (let i = 0; i < stoneCount; i++) {
        stones.push(shape("stone", { x: startX + spacing * i, y: 200, w: 18, h: 18 }));
      }
      return [shape("chain", { x: 200, y: 200, w: PANE_SIZE - 100, h: 6 }), ...stones];
    },
  },
  {
    id: "chain-pendant",
    label: "Chain with Pendant",
    category: "bracelet-necklace",
    build: () => [
      shape("chain", { x: 200, y: 70, w: 280, h: 6 }),
      shape("line", { x: 200, y: 140, w: 4, h: 90 }),
      shape("stone", { x: 200, y: 230, w: 40, h: 52 }),
    ],
  },
];

export function templatesByCategory(category: TemplateCategory): DesignTemplate[] {
  return DESIGN_TEMPLATES.filter((t) => t.category === category);
}
