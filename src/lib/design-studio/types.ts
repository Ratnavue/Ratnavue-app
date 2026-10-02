// The Design Studio's editor state — stored verbatim as JewelryDesign.data
// (JSON), the same "just store the JSON" approach QuoteRequest.configuredSpec
// already uses for the gem configurator. Nothing here is DB-enforced beyond
// being valid JSON; StudioState is the one place that defines its shape.

export const SHAPE_TYPES = ["band", "stone", "prong", "line", "chain", "text"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export interface Shape {
  id: string;
  type: ShapeType;
  /** Center position, in the pane's 0–400 local unit square. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees. */
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** "text" shapes only. */
  text?: string;
  /** Shapes created together by a radial repeat share one groupId, so the
   * whole ring of copies can be selected/deleted as a unit afterward. */
  groupId?: string;
  /** "stone" shapes only — when set, PaneSVG renders this shape through
   * the real gem-visualizer (src/lib/design-studio/gems.ts) instead of a
   * flat ellipse. fill/stroke above are ignored for a shape with this
   * set (the visualizer derives its own gradient from hue/darkness). */
  gem?: { cutSlug: string; hue: number; darkness: number; saturation: number; claritySlug: string; caratWeight: number };
  /** "band"/"prong"/"line"/"chain" shapes only — when set, PaneSVG renders
   * a metallic gradient (src/lib/design-studio/metals.ts) instead of the
   * flat `fill` above. */
  metal?: import("./metals").MetalKey;
}

export interface Pane {
  id: string;
  label: string;
  shapes: Shape[];
  /** Live radial symmetry: when set to N (e.g. 6 or 8), `shapes` above is
   * only the one "master" wedge — PaneSVG renders it plus N−1 rotated
   * mirror copies on every render (not baked into separate shape rows the
   * way "Repeat around circle" is), so editing the master updates every
   * mirror instantly. undefined/1 means no symmetry (the normal mode
   * every pane started with before this existed). */
  symmetry?: number;
}

export interface StudioState {
  panes: Pane[];
  activePaneId: string;
}

export const PANE_SIZE = 400;
export const MAX_PANES = 4;

export const SHAPE_COLORS = [
  { label: "Gold", fill: "#c9a04d", stroke: "#8a6d2f" },
  { label: "Silver", fill: "#c7cdd4", stroke: "#8a9099" },
  { label: "Charcoal", fill: "#3a332c", stroke: "#1f1b17" },
  { label: "Diamond", fill: "#eef6ff", stroke: "#9db8d8" },
  { label: "Ruby", fill: "#9b2f3d", stroke: "#6b1f29" },
  { label: "Sapphire", fill: "#2f4f9b", stroke: "#20366b" },
  { label: "Emerald", fill: "#2f6b4a", stroke: "#1f4a33" },
] as const;

export const DEFAULT_SHAPE_SIZE: Record<ShapeType, { w: number; h: number }> = {
  band: { w: 220, h: 220 },
  stone: { w: 28, h: 28 },
  prong: { w: 6, h: 26 },
  line: { w: 160, h: 4 },
  chain: { w: 300, h: 10 },
  text: { w: 120, h: 24 },
};

export function newPane(label: string): Pane {
  return { id: crypto.randomUUID(), label, shapes: [] };
}

export function newShape(type: ShapeType, center: { x: number; y: number } = { x: PANE_SIZE / 2, y: PANE_SIZE / 2 }): Shape {
  const size = DEFAULT_SHAPE_SIZE[type];
  const color = type === "band" ? SHAPE_COLORS[0] : type === "stone" ? SHAPE_COLORS[3] : SHAPE_COLORS[0];
  return {
    id: crypto.randomUUID(),
    type,
    x: center.x,
    y: center.y,
    w: size.w,
    h: size.h,
    rotation: 0,
    fill: color.fill,
    stroke: color.stroke,
    strokeWidth: type === "band" || type === "chain" ? 3 : 1.5,
    text: type === "text" ? "Label" : undefined,
  };
}

export function emptyStudioState(): StudioState {
  const pane = newPane("View 1");
  return { panes: [pane], activePaneId: pane.id };
}
