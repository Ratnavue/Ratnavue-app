// Realistic gemstone rendering for "stone" shapes — reuses the same
// procedural, cut-aware SVG renderer the /configurator page and admin
// quote previews already use (src/components/gem-visualizer/), instead of
// building a second one. See PaneSVG's ShapeGlyph: a "stone" shape with
// `gem` set renders through <GemVisualizer>; without it, it falls back to
// the original flat ellipse (so old saved designs keep rendering fine).
//
// Cuts are the catalog's own STANDARD_CUTS (src/lib/gem-constants.ts) —
// the fixed list every gemstone in the shop is already cut from, not a
// separate list invented for this tool. Colors are a curated set of
// representative hue/darkness/saturation values for each of the catalog's
// STANDARD_MINERALS (picked by hand rather than derived from their
// hueMin/hueMax ranges — a couple of those ranges are wide or wrap past
// 360°, and the one thing this preset list needs is a single good-looking
// default, not the full physically-plausible range the configurator's
// color picker constrains to), plus a colorless option for diamond-style
// accents (there's no "Diamond" mineral in this Ceylon-gem-focused
// catalog).

export interface GemColorPreset {
  label: string;
  hue: number;
  darkness: number;
  saturation: number;
}

export const GEM_COLOR_PRESETS: GemColorPreset[] = [
  { label: "Colorless", hue: 210, darkness: 8, saturation: 8 },
  { label: "Blue Sapphire", hue: 222, darkness: 58, saturation: 72 },
  { label: "Padparadscha Sapphire", hue: 22, darkness: 45, saturation: 78 },
  { label: "Pink Sapphire", hue: 332, darkness: 42, saturation: 75 },
  { label: "Yellow Sapphire", hue: 52, darkness: 40, saturation: 85 },
  { label: "Ruby", hue: 355, darkness: 52, saturation: 80 },
  { label: "Alexandrite", hue: 150, darkness: 48, saturation: 55 },
  { label: "Spinel", hue: 345, darkness: 48, saturation: 70 },
  { label: "Garnet", hue: 5, darkness: 55, saturation: 70 },
  { label: "Zircon", hue: 205, darkness: 50, saturation: 75 },
  { label: "Tourmaline (Pink)", hue: 330, darkness: 45, saturation: 72 },
  { label: "Tourmaline (Green)", hue: 145, darkness: 48, saturation: 65 },
  { label: "Moonstone", hue: 215, darkness: 25, saturation: 30 },
  { label: "Aquamarine", hue: 188, darkness: 40, saturation: 60 },
  { label: "Amethyst", hue: 272, darkness: 48, saturation: 60 },
  { label: "Citrine", hue: 42, darkness: 48, saturation: 80 },
  { label: "Peridot", hue: 80, darkness: 45, saturation: 65 },
  { label: "Topaz", hue: 35, darkness: 42, saturation: 75 },
];

export const DEFAULT_GEM_COLOR = GEM_COLOR_PRESETS[1]; // Blue Sapphire — Ceylon's signature gem.

export interface GemSpec {
  cutSlug: string;
  hue: number;
  darkness: number;
  saturation: number;
  claritySlug: string;
  caratWeight: number;
}

export const DEFAULT_CLARITY_SLUG = "eye-clean";
