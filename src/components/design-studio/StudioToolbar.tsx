"use client";

import { useState } from "react";
import { Circle, Minus, Link2, GripVertical, Type, Copy, ClipboardPaste, RotateCw, Trash2, Plus, X, Save, Gem as GemIcon, Info, Undo2, Redo2 } from "lucide-react";
import type { Shape, ShapeType } from "@/lib/design-studio/types";
import { TEMPLATE_CATEGORY_LABELS, templatesByCategory, type TemplateCategory } from "@/lib/design-studio/templates";
import { STANDARD_CUTS } from "@/lib/gem-constants";
import { GEM_COLOR_PRESETS, type GemColorPreset } from "@/lib/design-studio/gems";
import { resolveGemColor } from "@/components/gem-visualizer/color";
import { METAL_KEYS, METALS, type MetalKey } from "@/lib/design-studio/metals";
import { cn } from "@/lib/utils";

const SHAPE_BUTTONS: { type: ShapeType; label: string; icon: typeof Circle; title: string }[] = [
  { type: "band", label: "Band", icon: Circle, title: "Add a band (the ring/bangle outline) — drag its edge to resize" },
  { type: "prong", label: "Prong", icon: GripVertical, title: "Add a prong (a small post that holds a stone in place)" },
  { type: "line", label: "Line", icon: Minus, title: "Add a straight bar or wire" },
  { type: "chain", label: "Chain", icon: Link2, title: "Add a chain (a dashed link bar)" },
  { type: "text", label: "Text", icon: Type, title: "Add a text label — click it, then edit the label below" },
];

const SYMMETRY_OPTIONS = [
  { value: null, label: "Off" },
  { value: 4, label: "4×" },
  { value: 6, label: "6×" },
  { value: 8, label: "8×" },
  { value: 12, label: "12×" },
];

function ToolButton({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex flex-col items-center gap-1 rounded-lg border border-border-subtle px-3 py-2 text-[11px] text-charcoal/70 transition-colors hover:border-charcoal/40 hover:text-charcoal disabled:opacity-40 disabled:hover:border-border-subtle"
    >
      {children}
    </button>
  );
}

interface StudioToolbarProps {
  selectionCount: number;
  paneCount: number;
  onAddShape: (type: ShapeType) => void;
  onApplyTemplate: (shapes: Shape[]) => void;
  onAddPane: () => void;
  onRemovePane: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRadialRepeat: (count: number) => void;
  onSave: () => void;
  saving: boolean;
  canPaste: boolean;
  symmetry: number | undefined;
  onSetSymmetry: (count: number | null) => void;
  metalKey: MetalKey;
  onPickMetal: (metal: MetalKey) => void;
  metalApplicable: boolean;
  gemCutSlug: string;
  onSetGemCut: (slug: string) => void;
  gemCarat: number;
  onSetGemCarat: (carat: number) => void;
  onPickGemColor: (preset: GemColorPreset) => void;
  gemApplicable: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function StudioToolbar({
  selectionCount,
  paneCount,
  onAddShape,
  onApplyTemplate,
  onAddPane,
  onRemovePane,
  onCopy,
  onPaste,
  onDelete,
  onRadialRepeat,
  onSave,
  saving,
  canPaste,
  symmetry,
  onSetSymmetry,
  metalKey,
  onPickMetal,
  metalApplicable,
  gemCutSlug,
  onSetGemCut,
  gemCarat,
  onSetGemCarat,
  onPickGemColor,
  gemApplicable,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: StudioToolbarProps) {
  const [repeatCount, setRepeatCount] = useState(8);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [gemOpen, setGemOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(true);

  return (
    <div className="space-y-2">
      {hintOpen && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-charcoal/75">
          <Info size={14} className="mt-0.5 shrink-0 text-gold-deep" />
          <p className="flex-1">
            Drag a shape to move it, or select it and use the arrow keys to nudge it precisely (hold Shift for 10 at
            a time). Drag the gold corner handle to resize or the blue handle above it to rotate. Ctrl/Cmd+Z undoes,
            Ctrl/Cmd+Shift+Z redoes. Hover any button below for what it does — select a shape first for Copy, Delete,
            Metal and Gem color to apply to it instead of just setting the default for new ones.
          </p>
          <button type="button" onClick={() => setHintOpen(false)} className="shrink-0 text-charcoal/40 hover:text-charcoal" title="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border-subtle bg-surface p-3">
        <div className="flex flex-wrap gap-1.5">
          <ToolButton title="Undo (Ctrl/Cmd+Z)" onClick={onUndo} disabled={!canUndo}>
            <Undo2 size={16} />
            Undo
          </ToolButton>
          <ToolButton title="Redo (Ctrl/Cmd+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
            <Redo2 size={16} />
            Redo
          </ToolButton>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div className="flex flex-wrap gap-1.5">
          {SHAPE_BUTTONS.map(({ type, label, icon: Icon, title }) => (
            <ToolButton key={type} title={title} onClick={() => onAddShape(type)}>
              <Icon size={16} />
              {label}
            </ToolButton>
          ))}

          <div className="relative">
            <ToolButton
              title={gemApplicable ? "Change the selected gem's cut and color" : "Insert a realistic gemstone — pick a cut and color"}
              onClick={() => setGemOpen((v) => !v)}
            >
              <GemIcon size={16} />
              Gem
            </ToolButton>
            {gemOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
                <label className="block text-[10px] uppercase tracking-wide text-charcoal/50" htmlFor="gem-cut">
                  Cut
                </label>
                <select
                  id="gem-cut"
                  value={gemCutSlug}
                  onChange={(e) => onSetGemCut(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-2 py-1.5 text-xs"
                >
                  {STANDARD_CUTS.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <label className="mt-2 block text-[10px] uppercase tracking-wide text-charcoal/50" htmlFor="gem-carat">
                  Carat
                </label>
                <input
                  id="gem-carat"
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  value={gemCarat}
                  onChange={(e) => onSetGemCarat(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-2 py-1.5 text-xs"
                />

                <p className="mb-1.5 mt-2.5 text-[10px] uppercase tracking-wide text-charcoal/50">
                  Color — click to {gemApplicable ? "restyle the selected gem" : "insert"}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {GEM_COLOR_PRESETS.map((preset) => {
                    const swatch = resolveGemColor(preset.hue, preset.darkness, preset.saturation).base;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        title={preset.label}
                        onClick={() => {
                          onPickGemColor(preset);
                          setGemOpen(false);
                        }}
                        className="h-6 w-6 rounded-full border border-border-subtle transition-transform hover:scale-110"
                        style={{ backgroundColor: swatch }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-charcoal/50">
            Metal — click to {metalApplicable ? "restyle the selected shape" : "set the default for new ones"}
          </p>
          <div className="flex gap-1.5">
            {METAL_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={METALS[key].label}
                onClick={() => onPickMetal(key)}
                className={cn("h-6 w-6 rounded-full border transition-transform hover:scale-110", metalKey === key ? "border-charcoal ring-1 ring-charcoal" : "border-border-subtle")}
                style={{ background: `linear-gradient(135deg, ${METALS[key].light}, ${METALS[key].base} 55%, ${METALS[key].dark})` }}
              />
            ))}
          </div>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div className="relative">
          <ToolButton title="Start from a template" onClick={() => setTemplateOpen((v) => !v)}>
            <Plus size={16} />
            Template
          </ToolButton>
          {templateOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border-subtle bg-surface p-2 shadow-lg">
              {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]).map((category) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="px-1 text-[10px] uppercase tracking-wide text-charcoal/50">{TEMPLATE_CATEGORY_LABELS[category]}</p>
                  {templatesByCategory(category).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onApplyTemplate(t.build());
                        setTemplateOpen(false);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-charcoal/80 hover:bg-ivory-soft"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div className="flex flex-wrap gap-1.5">
          <ToolButton title="Copy the selected shape(s) — switch pane and Paste to duplicate them there" onClick={onCopy} disabled={selectionCount === 0}>
            <Copy size={16} />
            Copy
          </ToolButton>
          <ToolButton title="Paste the copied shape(s) into this pane" onClick={onPaste} disabled={!canPaste}>
            <ClipboardPaste size={16} />
            Paste
          </ToolButton>
          <ToolButton title="Delete the selected shape(s) (or press Delete/Backspace)" onClick={onDelete} disabled={selectionCount === 0}>
            <Trash2 size={16} />
            Delete
          </ToolButton>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div className="flex items-end gap-1.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="repeat-count" className="px-1 text-[10px] uppercase tracking-wide text-charcoal/50">
              Repeat ×
            </label>
            <input
              id="repeat-count"
              type="number"
              min={2}
              max={72}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value) || 2)}
              className="w-16 rounded-lg border border-border-subtle bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <ToolButton
            title="Select one or more shapes, then repeat them evenly around a circle — a one-time copy, good for a localized pattern"
            onClick={() => onRadialRepeat(repeatCount)}
            disabled={selectionCount === 0}
          >
            <RotateCw size={16} />
            Around circle
          </ToolButton>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-charcoal/50" title="Design one slice of this pane and every other slice mirrors it live as you edit — for a symmetric bangle or eternity band">
            Live symmetry
          </p>
          <div className="flex gap-1">
            {SYMMETRY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onSetSymmetry(opt.value)}
                title={opt.value ? `Mirror this pane's shapes live, ${opt.value} ways around its center` : "Turn off live symmetry for this pane"}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px]",
                  (symmetry ?? null) === opt.value ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle text-charcoal/70 hover:border-charcoal/40",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

        <div className="flex flex-wrap gap-1.5">
          <ToolButton title="Add another view (front/side/detail) — up to 4" onClick={onAddPane} disabled={paneCount >= 4}>
            <Plus size={16} />
            Add pane
          </ToolButton>
          <ToolButton title="Remove the current pane" onClick={onRemovePane} disabled={paneCount <= 1}>
            <X size={16} />
            Remove pane
          </ToolButton>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            title="Save this design (also happens automatically a couple of seconds after you stop editing)"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
              "bg-charcoal-soft text-ivory hover:bg-charcoal",
            )}
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
