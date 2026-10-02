// Metal shades for band/prong/line/chain shapes — the same five values as
// the catalog's own `MetalType` enum on JewelryPiece (prisma/schema.prisma),
// so a sketch's metal choice matches the vocabulary admin/customers already
// see on real product listings. Each has light/base/dark stops for a
// gradient (see PaneSVG's <linearGradient>/<radialGradient> use of these)
// instead of the flat SHAPE_COLORS fill, so metal shapes actually read as
// metallic rather than a flat-colored outline.

export const METAL_KEYS = ["GOLD", "WHITE_GOLD", "ROSE_GOLD", "PLATINUM", "SILVER"] as const;
export type MetalKey = (typeof METAL_KEYS)[number];

export interface MetalDef {
  label: string;
  light: string;
  base: string;
  dark: string;
}

export const METALS: Record<MetalKey, MetalDef> = {
  GOLD: { label: "Yellow Gold", light: "#f3d989", base: "#c9a04d", dark: "#8a6d2f" },
  WHITE_GOLD: { label: "White Gold", light: "#f3f3f0", base: "#c9c8c0", dark: "#8f8e86" },
  ROSE_GOLD: { label: "Rose Gold", light: "#f0c3b4", base: "#d09080", dark: "#9c5c4e" },
  PLATINUM: { label: "Platinum", light: "#eef0f2", base: "#c9ced4", dark: "#8d939b" },
  SILVER: { label: "Silver", light: "#e9edf0", base: "#c7cdd4", dark: "#8a9099" },
};

export const DEFAULT_METAL: MetalKey = "GOLD";
