"use client";

import { useRef } from "react";
import type { Pane, Shape } from "@/lib/design-studio/types";
import { PANE_SIZE } from "@/lib/design-studio/types";
import { cn } from "@/lib/utils";

type DragMode = { kind: "move"; starts: { id: string; x: number; y: number }[] } | { kind: "resize"; id: string; startW: number; startH: number } | { kind: "rotate"; id: string };

interface PaneSVGProps {
  pane: Pane;
  active: boolean;
  selectedIds: string[];
  onActivate: () => void;
  onSelect: (ids: string[]) => void;
  onMoveShapes: (updates: { id: string; x: number; y: number }[]) => void;
  onResizeShape: (id: string, w: number, h: number) => void;
  onRotateShape: (id: string, rotation: number) => void;
}

/** Renders one pane as an SVG, with drag-to-move, a resize handle and a
 * rotate handle on the single selected shape — the one interactive canvas
 * every pane in the Design Studio is built from. Deliberately simple
 * (no bezier paths, no snapping) — a schematic sketch tool, not a full
 * vector editor. */
export function PaneSVG({ pane, active, selectedIds, onActivate, onSelect, onMoveShapes, onResizeShape, onRotateShape }: PaneSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number } | null>(null);

  function toLocal(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * PANE_SIZE, y: ((clientY - rect.top) / rect.height) * PANE_SIZE };
  }

  function beginMove(e: React.PointerEvent, shape: Shape) {
    // Without this, the event bubbles to the <svg>'s own onPointerDown
    // (background click → activate + clear selection) right after this
    // handler sets it, wiping the selection out in the same batch.
    e.stopPropagation();
    onActivate();
    const alreadySelected = selectedIds.includes(shape.id);
    const nextSelection = e.shiftKey ? (alreadySelected ? selectedIds.filter((id) => id !== shape.id) : [...selectedIds, shape.id]) : alreadySelected ? selectedIds : [shape.id];
    onSelect(nextSelection);
    if (!nextSelection.includes(shape.id)) return;
    const starts = pane.shapes.filter((s) => nextSelection.includes(s.id)).map((s) => ({ id: s.id, x: s.x, y: s.y }));
    const local = toLocal(e.clientX, e.clientY);
    dragRef.current = { mode: { kind: "move", starts }, startX: local.x, startY: local.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function beginResize(e: React.PointerEvent, shape: Shape) {
    e.stopPropagation();
    const local = toLocal(e.clientX, e.clientY);
    dragRef.current = { mode: { kind: "resize", id: shape.id, startW: shape.w, startH: shape.h }, startX: local.x, startY: local.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function beginRotate(e: React.PointerEvent, shape: Shape) {
    e.stopPropagation();
    dragRef.current = { mode: { kind: "rotate", id: shape.id }, startX: shape.x, startY: shape.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const local = toLocal(e.clientX, e.clientY);

    if (drag.mode.kind === "move") {
      const dx = local.x - drag.startX;
      const dy = local.y - drag.startY;
      onMoveShapes(drag.mode.starts.map((s) => ({ id: s.id, x: s.x + dx, y: s.y + dy })));
      return;
    }
    if (drag.mode.kind === "resize") {
      const { id, startW, startH } = drag.mode;
      const target = pane.shapes.find((s) => s.id === id);
      if (!target) return;
      const rad = (-target.rotation * Math.PI) / 180;
      const rawDx = local.x - drag.startX;
      const rawDy = local.y - drag.startY;
      const localDx = rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      const localDy = rawDx * Math.sin(rad) + rawDy * Math.cos(rad);
      onResizeShape(id, Math.max(8, startW + localDx * 2), Math.max(8, startH + localDy * 2));
      return;
    }
    if (drag.mode.kind === "rotate") {
      const { id } = drag.mode;
      const target = pane.shapes.find((s) => s.id === id);
      if (!target) return;
      const angleDeg = (Math.atan2(local.y - target.y, local.x - target.x) * 180) / Math.PI + 90;
      onRotateShape(target.id, Math.round(angleDeg));
    }
  }

  function endDrag(e: React.PointerEvent) {
    if (dragRef.current) (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-lg border bg-[#faf7f2]", active ? "border-gold-deep ring-1 ring-gold-deep" : "border-border-subtle")}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PANE_SIZE} ${PANE_SIZE}`}
        className="h-full w-full touch-none select-none"
        onPointerDown={() => onActivate()}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect
          x={0}
          y={0}
          width={PANE_SIZE}
          height={PANE_SIZE}
          fill="transparent"
          onPointerDown={() => onSelect([])}
        />
        {pane.shapes.map((shape) => {
          const selected = selectedIds.includes(shape.id);
          return (
            <g key={shape.id} transform={`rotate(${shape.rotation} ${shape.x} ${shape.y})`} onPointerDown={(e) => beginMove(e, shape)} className="cursor-move">
              <ShapeGlyph shape={shape} />
              {selected && (
                <>
                  <rect x={shape.x - shape.w / 2 - 4} y={shape.y - shape.h / 2 - 4} width={shape.w + 8} height={shape.h + 8} fill="none" stroke="#c9a04d" strokeDasharray="4 3" strokeWidth={1.5} />
                  <circle
                    cx={shape.x + shape.w / 2 + 4}
                    cy={shape.y + shape.h / 2 + 4}
                    r={6}
                    fill="#c9a04d"
                    stroke="#fff"
                    strokeWidth={1.5}
                    className="cursor-nwse-resize"
                    onPointerDown={(e) => beginResize(e, shape)}
                  />
                  <circle cx={shape.x} cy={shape.y - shape.h / 2 - 22} r={6} fill="#2f4f9b" stroke="#fff" strokeWidth={1.5} className="cursor-grab" onPointerDown={(e) => beginRotate(e, shape)} />
                  <line x1={shape.x} y1={shape.y - shape.h / 2} x2={shape.x} y2={shape.y - shape.h / 2 - 22} stroke="#2f4f9b" strokeWidth={1} />
                </>
              )}
            </g>
          );
        })}
      </svg>
      <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-charcoal/40">{pane.label}</span>
    </div>
  );
}

function ShapeGlyph({ shape }: { shape: Shape }) {
  const { type, x, y, w, h, fill, stroke, strokeWidth } = shape;
  if (type === "band") {
    // fill="transparent" (not "none") so the whole disk is clickable, not
    // just the thin stroke line — "none" opts the interior out of hit
    // testing entirely, and a click anywhere inside the ring should still
    // select it.
    return <circle cx={x} cy={y} r={w / 2} fill="transparent" stroke={fill} strokeWidth={Math.max(6, strokeWidth * 4)} />;
  }
  if (type === "stone") {
    return <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (type === "text") {
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(10, h)} fill={fill} className="select-none">
        {shape.text || "Label"}
      </text>
    );
  }
  // prong, line, chain — all a simple bar, chain gets a dashed "link" look.
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={type === "chain" ? "6 3" : undefined}
      rx={Math.min(w, h) / 2}
    />
  );
}
