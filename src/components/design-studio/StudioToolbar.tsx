"use client";

import { useState } from "react";
import { Circle, Minus, Link2, GripVertical, Type, Copy, ClipboardPaste, RotateCw, Trash2, Plus, X, Save } from "lucide-react";
import type { Shape, ShapeType } from "@/lib/design-studio/types";
import { TEMPLATE_CATEGORY_LABELS, templatesByCategory, type TemplateCategory } from "@/lib/design-studio/templates";
import { cn } from "@/lib/utils";

const SHAPE_BUTTONS: { type: ShapeType; label: string; icon: typeof Circle }[] = [
  { type: "band", label: "Band", icon: Circle },
  { type: "stone", label: "Stone", icon: Circle },
  { type: "prong", label: "Prong", icon: GripVertical },
  { type: "line", label: "Line", icon: Minus },
  { type: "chain", label: "Chain", icon: Link2 },
  { type: "text", label: "Text", icon: Type },
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
}: StudioToolbarProps) {
  const [repeatCount, setRepeatCount] = useState(8);
  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border-subtle bg-surface p-3">
      <div className="flex flex-wrap gap-1.5">
        {SHAPE_BUTTONS.map(({ type, label, icon: Icon }) => (
          <ToolButton key={type} title={`Add ${label.toLowerCase()}`} onClick={() => onAddShape(type)}>
            <Icon size={16} />
            {label}
          </ToolButton>
        ))}
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
        <ToolButton title="Copy selection" onClick={onCopy} disabled={selectionCount === 0}>
          <Copy size={16} />
          Copy
        </ToolButton>
        <ToolButton title="Paste into this pane" onClick={onPaste} disabled={!canPaste}>
          <ClipboardPaste size={16} />
          Paste
        </ToolButton>
        <ToolButton title="Delete selection" onClick={onDelete} disabled={selectionCount === 0}>
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
        <ToolButton title="Repeat the selection evenly around a circle" onClick={() => onRadialRepeat(repeatCount)} disabled={selectionCount === 0}>
          <RotateCw size={16} />
          Around circle
        </ToolButton>
      </div>

      <div className="h-10 w-px bg-border-subtle max-sm:hidden" />

      <div className="flex flex-wrap gap-1.5">
        <ToolButton title="Add a pane" onClick={onAddPane} disabled={paneCount >= 4}>
          <Plus size={16} />
          Add pane
        </ToolButton>
        <ToolButton title="Remove this pane" onClick={onRemovePane} disabled={paneCount <= 1}>
          <X size={16} />
          Remove pane
        </ToolButton>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
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
  );
}
