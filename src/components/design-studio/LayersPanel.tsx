"use client";

import { Eye, EyeOff, ChevronUp, ChevronDown, Circle, Minus, Link2, GripVertical, Type, Repeat, RepeatOff } from "lucide-react";
import type { Shape, ShapeType } from "@/lib/design-studio/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<ShapeType, typeof Circle> = {
  band: Circle,
  stone: Circle,
  prong: GripVertical,
  line: Minus,
  chain: Link2,
  text: Type,
};

const TYPE_LABEL: Record<ShapeType, string> = {
  band: "Band",
  stone: "Stone",
  prong: "Prong",
  line: "Line",
  chain: "Chain",
  text: "Text",
};

function layerLabel(shape: Shape): string {
  if (shape.type === "text") return shape.text || "Text";
  if (shape.type === "stone" && shape.gem) return `Stone (${shape.gem.cutSlug.replace(/-/g, " ")})`;
  return TYPE_LABEL[shape.type];
}

interface LayersPanelProps {
  shapes: Shape[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggleHidden: (id: string) => void;
  onMoveForward: (id: string) => void;
  onMoveBackward: (id: string) => void;
  /** Whether the active pane currently has live symmetry turned on — the
   * per-row mirror toggle only renders when it's relevant (it has no
   * visible effect otherwise). */
  symmetryActive: boolean;
  onToggleSymmetryExclude: (id: string) => void;
}

/** The active pane's shapes, Figma-style: top row of the list is the
 * frontmost (last-painted) shape, click a row to select it (Shift to add
 * to the selection), per-row eye toggle to hide without deleting, up/down
 * to nudge one layer forward/back (the toolbar's "To front"/"To back"
 * buttons jump a whole selection all the way instead), and — while
 * symmetry's on — a per-row mirror toggle so live symmetry can be scoped
 * to just the layers that should actually repeat. */
export function LayersPanel({ shapes, selectedIds, onSelect, onToggleHidden, onMoveForward, onMoveBackward, symmetryActive, onToggleSymmetryExclude }: LayersPanelProps) {
  // Reversed so the list reads top-to-bottom as front-to-back, matching
  // how the shapes actually paint (later in the array = on top).
  const rows = [...shapes].map((shape, index) => ({ shape, index })).reverse();

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-2">
      <p className="px-1.5 pb-1.5 text-[10px] uppercase tracking-wide text-charcoal/50">Layers — top is in front</p>
      {rows.length === 0 ? (
        <p className="px-1.5 py-2 text-xs text-charcoal/40">No shapes yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map(({ shape, index }) => {
            const Icon = TYPE_ICON[shape.type];
            const selected = selectedIds.includes(shape.id);
            return (
              <li key={shape.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onSelect(shape.id, e.shiftKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(shape.id, e.shiftKey);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs cursor-pointer",
                    selected ? "bg-gold/15 text-charcoal" : "text-charcoal/70 hover:bg-ivory-soft",
                    shape.hidden && "opacity-40",
                  )}
                >
                  <Icon size={13} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{layerLabel(shape)}</span>
                  <button
                    type="button"
                    title={shape.hidden ? "Show" : "Hide"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHidden(shape.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-charcoal/50 hover:bg-charcoal/10 hover:text-charcoal"
                  >
                    {shape.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {symmetryActive && (
                    <button
                      type="button"
                      title={shape.excludeFromSymmetry ? "Excluded from live symmetry — click to mirror it too" : "Mirrored by live symmetry — click to exclude it"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSymmetryExclude(shape.id);
                      }}
                      className={cn("shrink-0 rounded p-0.5 hover:bg-charcoal/10", shape.excludeFromSymmetry ? "text-charcoal/30 hover:text-charcoal" : "text-gold-deep hover:text-charcoal")}
                    >
                      {shape.excludeFromSymmetry ? <RepeatOff size={13} /> : <Repeat size={13} />}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Move one layer forward"
                    disabled={index === shapes.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveForward(shape.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-charcoal/50 hover:bg-charcoal/10 hover:text-charcoal disabled:opacity-30"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    title="Move one layer back"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveBackward(shape.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-charcoal/50 hover:bg-charcoal/10 hover:text-charcoal disabled:opacity-30"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
