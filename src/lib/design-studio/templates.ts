// Static starter templates — no DB, no seeding, just a shape list that
// seeds a pane when picked from the toolbar's template menu. Schematic
// sketches (circles/lines, not photorealistic renders), consistent with
// the Design Studio's confirmed "2D sketch tool" scope.

import { newShape, PANE_SIZE, type Shape, type ShapeType } from "./types";
import { radialRepeat } from "./shape-ops";
import { GEM_COLOR_PRESETS, DEFAULT_CLARITY_SLUG, type GemColorPreset } from "./gems";
import { DEFAULT_METAL } from "./metals";

const CENTER = { x: PANE_SIZE / 2, y: PANE_SIZE / 2 };
const COLORLESS = GEM_COLOR_PRESETS[0];
const BLUE_SAPPHIRE = GEM_COLOR_PRESETS[1];

function shape(type: ShapeType, overrides: Partial<Shape> = {}): Shape {
  const base = newShape(type, CENTER);
  // A newly inserted band/prong/line/chain gets the default metal, same
  // as the toolbar's own "add shape" buttons — so a template's band looks
  // the same gold as anything the user adds after it, not flat charcoal.
  if (type === "band" || type === "prong" || type === "line" || type === "chain") base.metal = DEFAULT_METAL;
  return { ...base, ...overrides };
}

/** A realistic "stone" shape (see PaneSVG's gem rendering) rather than a
 * flat ellipse — sized from carat the same way the toolbar's Gem panel
 * does (see DesignStudio's gemSizePx), so a template's stones look like
 * what you'd get by picking the same cut/color/carat there. */
function gemShape(center: { x: number; y: number }, cutSlug: string, preset: GemColorPreset, carat: number): Shape {
  const size = 18 + Math.min(1, Math.sqrt(Math.max(0.25, carat) / 3)) * 50;
  return shape("stone", {
    x: center.x,
    y: center.y,
    w: size,
    h: size,
    gem: { cutSlug, hue: preset.hue, darkness: preset.darkness, saturation: preset.saturation, claritySlug: DEFAULT_CLARITY_SLUG, caratWeight: carat },
  });
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
    build: () => [shape("band"), gemShape({ x: 200, y: 90 }, "round-brilliant", BLUE_SAPPHIRE, 2.5)],
  },
  {
    id: "pave-band",
    label: "Pavé Band",
    category: "ring",
    build: () => {
      const band = shape("band");
      const seed = gemShape({ x: 200, y: 90 }, "round-brilliant", COLORLESS, 0.15);
      return [band, ...radialRepeat([seed], { x: band.x, y: band.y }, 16)];
    },
  },
  {
    id: "eternity-band",
    label: "Eternity Band",
    category: "ring",
    build: () => {
      const band = shape("band");
      const seed = gemShape({ x: 200, y: 88 }, "round-brilliant", COLORLESS, 0.1);
      return [band, ...radialRepeat([seed], { x: band.x, y: band.y }, 28)];
    },
  },
  {
    id: "three-stone",
    label: "Three-Stone",
    category: "ring",
    build: () => [
      shape("band"),
      gemShape({ x: 200, y: 86 }, "round-brilliant", BLUE_SAPPHIRE, 2.2),
      gemShape({ x: 150, y: 100 }, "round-brilliant", COLORLESS, 0.5),
      gemShape({ x: 250, y: 100 }, "round-brilliant", COLORLESS, 0.5),
    ],
  },
  {
    id: "stud",
    label: "Stud",
    category: "earring-pendant",
    build: () => [gemShape({ x: 200, y: 170 }, "round-brilliant", BLUE_SAPPHIRE, 3.5), shape("prong", { x: 200, y: 210, w: 6, h: 24 })],
  },
  {
    id: "drop-earring",
    label: "Drop Earring",
    category: "earring-pendant",
    build: () => [
      gemShape({ x: 200, y: 90 }, "round-brilliant", COLORLESS, 0.3),
      shape("chain", { x: 200, y: 160, w: 4, h: 110, rotation: 0 }),
      gemShape({ x: 200, y: 260 }, "pear", BLUE_SAPPHIRE, 2),
    ],
  },
  {
    id: "halo-pendant",
    label: "Halo Pendant",
    category: "earring-pendant",
    build: () => {
      const center = gemShape({ x: 200, y: 220 }, "round-brilliant", BLUE_SAPPHIRE, 3);
      const haloSeed = gemShape({ x: 200, y: 180 }, "round-brilliant", COLORLESS, 0.1);
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
        stones.push(gemShape({ x: startX + spacing * i, y: 200 }, "round-brilliant", COLORLESS, 0.2));
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
      gemShape({ x: 200, y: 230 }, "pear", BLUE_SAPPHIRE, 2.5),
    ],
  },
];

export function templatesByCategory(category: TemplateCategory): DesignTemplate[] {
  return DESIGN_TEMPLATES.filter((t) => t.category === category);
}
