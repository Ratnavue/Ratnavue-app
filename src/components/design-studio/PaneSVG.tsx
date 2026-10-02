"use client";

import { useId, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { Pane, Shape } from "@/lib/design-studio/types";
import { PANE_SIZE } from "@/lib/design-studio/types";
import { symmetryPivot } from "@/lib/design-studio/shape-ops";
import { METALS } from "@/lib/design-studio/metals";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { cn } from "@/lib/utils";

type DragMode = { kind: "move"; starts: { id: string; x: number; y: number }[] } | { kind: "resize"; id: string; startW: number; startH: number } | { kind: "rotate"; id: string };
type View = { scale: number; tx: number; ty: number };
const DEFAULT_VIEW: View = { scale: 1, tx: 0, ty: 0 };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
// Below this many viewBox units of pointer travel, a background press-drag
// still counts as a click (clear the selection) rather than a pan — lets a
// slightly-jittery click still deselect instead of being swallowed as a
// no-op pan.
const PAN_CLICK_THRESHOLD = 3;

interface PaneSVGProps {
  pane: Pane;
  active: boolean;
  selectedIds: string[];
  onActivate: () => void;
  onSelect: (ids: string[]) => void;
  onMoveShapes: (updates: { id: string; x: number; y: number }[]) => void;
  onResizeShape: (id: string, w: number, h: number) => void;
  onRotateShape: (id: string, rotation: number) => void;
  /** Fired once when a shape drag (move/resize/rotate) begins/ends, so the
   * whole drag becomes a single undo step rather than one per
   * pointermove — see DesignStudio's handleDragStart/handleDragEnd. */
  onDragStart: () => void;
  onDragEnd: () => void;
  /** When true, the next click on empty canvas sets pane.symmetryCenter
   * instead of the normal select/deselect — the toolbar's "Set center"
   * tool, one shot (turns itself off again once a point's picked). */
  settingCenter: boolean;
  onPickSymmetryCenter: (point: { x: number; y: number }) => void;
}

/** Renders one pane as an SVG, with drag-to-move, a resize handle, a
 * rotate handle on the single selected shape, Shift+scroll/button zoom,
 * drag-to-pan, and (when `pane.symmetry` is set) a live radial-mirror
 * mode for symmetric pieces like bangles and eternity bands — the one
 * interactive canvas every pane in the Design Studio is built from.
 * Deliberately simple (no bezier paths, no snapping) — a schematic sketch
 * tool, not a full vector editor. */
export function PaneSVG({ pane, active, selectedIds, onActivate, onSelect, onMoveShapes, onResizeShape, onRotateShape, onDragStart, onDragEnd, settingCenter, onPickSymmetryCenter }: PaneSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startRawX: number; startRawY: number; startTx: number; startTy: number; moved: boolean } | null>(null);
  const [view, setView] = useState<View>(DEFAULT_VIEW);

  /** Raw viewBox-space position of a client point — the pane's fixed 0–400
   * square, independent of the current zoom/pan (used for panning deltas,
   * which should move 1:1 with the pointer regardless of zoom level). */
  function rawPoint(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * PANE_SIZE, y: ((clientY - rect.top) / rect.height) * PANE_SIZE };
  }

  /** Model-space position — rawPoint with the current zoom/pan inverted
   * out, i.e. where a click actually lands among the shapes. */
  function toLocal(clientX: number, clientY: number) {
    const raw = rawPoint(clientX, clientY);
    return { x: (raw.x - view.tx) / view.scale, y: (raw.y - view.ty) / view.scale };
  }

  /** Changes zoom while keeping the given raw viewBox point visually
   * stationary — the pane center for the +/−/reset buttons, the cursor
   * position for the wheel, same as any map/image editor's zoom. */
  function zoomAt(rawX: number, rawY: number, factor: number) {
    setView((v) => {
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor));
      const px = (rawX - v.tx) / v.scale;
      const py = (rawY - v.ty) / v.scale;
      return { scale: newScale, tx: rawX - newScale * px, ty: rawY - newScale * py };
    });
  }

  // Shift+scroll zooms; a plain scroll over the canvas falls through to
  // the page instead (no preventDefault), so scrolling down the page past
  // a pane doesn't get swallowed as a zoom. Same modifier convention as
  // most map/image editors for exactly this reason.
  function handleWheel(e: React.WheelEvent) {
    if (!e.shiftKey) return;
    e.preventDefault();
    const raw = rawPoint(e.clientX, e.clientY);
    zoomAt(raw.x, raw.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    if (settingCenter) {
      onActivate();
      onPickSymmetryCenter(toLocal(e.clientX, e.clientY));
      return;
    }
    beginPan(e);
  }

  function beginPan(e: React.PointerEvent) {
    const raw = rawPoint(e.clientX, e.clientY);
    panRef.current = { startRawX: raw.x, startRawY: raw.y, startTx: view.tx, startTy: view.ty, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function beginMove(e: React.PointerEvent, shape: Shape, interactive: boolean) {
    if (!interactive) return;
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
    onDragStart();
    dragRef.current = { mode: { kind: "move", starts }, startX: local.x, startY: local.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function beginResize(e: React.PointerEvent, shape: Shape) {
    e.stopPropagation();
    const local = toLocal(e.clientX, e.clientY);
    onDragStart();
    dragRef.current = { mode: { kind: "resize", id: shape.id, startW: shape.w, startH: shape.h }, startX: local.x, startY: local.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function beginRotate(e: React.PointerEvent, shape: Shape) {
    e.stopPropagation();
    onDragStart();
    dragRef.current = { mode: { kind: "rotate", id: shape.id }, startX: shape.x, startY: shape.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const pan = panRef.current;
      const raw = rawPoint(e.clientX, e.clientY);
      const dx = raw.x - pan.startRawX;
      const dy = raw.y - pan.startRawY;
      if (Math.hypot(dx, dy) > PAN_CLICK_THRESHOLD) pan.moved = true;
      setView((v) => ({ ...v, tx: pan.startTx + dx, ty: pan.startTy + dy }));
      return;
    }

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
      if (target.type === "band") {
        // A band only ever renders as a perfect circle driven by `w`
        // alone (see ShapeGlyph) — resizing it from w/h independently,
        // the way every other shape's corner handle does, meant dragging
        // anywhere other than the exact diagonal barely changed anything
        // visible (a mostly-vertical drag only ever touched the ignored
        // `h`), which read as "resize doesn't work". Both dimensions move
        // together here instead, so any drag direction grows/shrinks the
        // ring and the bounding box stays square, matching what renders.
        const delta = (localDx + localDy) / 2;
        const size = Math.max(8, startW + delta * 2);
        onResizeShape(id, size, size);
      } else {
        onResizeShape(id, Math.max(8, startW + localDx * 2), Math.max(8, startH + localDy * 2));
      }
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
    if (panRef.current) {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      if (!panRef.current.moved) onSelect([]);
      panRef.current = null;
      return;
    }
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      onDragEnd();
    }
    dragRef.current = null;
  }

  const symmetry = pane.symmetry && pane.symmetry > 1 ? pane.symmetry : null;
  const symmetryCenter = symmetry ? symmetryPivot(pane, { x: PANE_SIZE / 2, y: PANE_SIZE / 2 }) : null;

  // One "pass" per render of the shape list: just the master (interactive)
  // when symmetry is off, or the master plus N−1 rotated, read-only mirror
  // passes when it's on (see Pane.symmetry's own comment) — plain data,
  // mapped directly in the JSX below rather than through a helper function,
  // so every closure that touches dragRef/svgRef (beginMove and friends) is
  // still constructed inline during the component's own render, the one
  // place react-hooks' ref-safety check can see it's only used as a later
  // event handler.
  const passes: { rotate: number; interactive: boolean }[] =
    symmetry && symmetryCenter
      ? Array.from({ length: symmetry }, (_, i) => ({ rotate: i === 0 ? 0 : (360 / symmetry) * i, interactive: i === 0 }))
      : [{ rotate: 0, interactive: true }];

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
        onWheel={handleWheel}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <rect
            x={0}
            y={0}
            width={PANE_SIZE}
            height={PANE_SIZE}
            fill="transparent"
            className={settingCenter ? "cursor-crosshair" : undefined}
            onPointerDown={handleBackgroundPointerDown}
          />

          {symmetry && symmetryCenter && <SymmetryGuides center={symmetryCenter} count={symmetry} />}
          {pane.symmetryCenter && <CenterMarker point={pane.symmetryCenter} />}

          {passes.map((pass, passIndex) => (
            <g key={passIndex} transform={pass.rotate ? `rotate(${pass.rotate} ${symmetryCenter!.x} ${symmetryCenter!.y})` : undefined} style={pass.interactive ? undefined : { pointerEvents: "none" }}>
              {pane.shapes.map((shape) => {
                if (shape.hidden) return null;
                const selected = pass.interactive && selectedIds.includes(shape.id);
                return (
                  <g
                    key={shape.id}
                    transform={`rotate(${shape.rotation} ${shape.x} ${shape.y})`}
                    onPointerDown={(e) => beginMove(e, shape, pass.interactive)}
                    className={pass.interactive ? "cursor-move" : undefined}
                  >
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
            </g>
          ))}
        </g>
      </svg>

      <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-charcoal/40">
        {pane.label}
        {symmetry ? ` · ${symmetry}-way symmetry` : ""}
      </span>

      <div className="absolute bottom-1.5 right-1.5 flex gap-1 rounded-md border border-border-subtle bg-surface/90 p-0.5 shadow-sm backdrop-blur-sm">
        <ZoomButton title="Zoom out (or hold Shift and scroll)" onClick={() => zoomAt(PANE_SIZE / 2, PANE_SIZE / 2, 1 / 1.25)}>
          <ZoomOut size={13} />
        </ZoomButton>
        <ZoomButton title="Reset zoom" onClick={() => setView(DEFAULT_VIEW)}>
          <Maximize size={12} />
        </ZoomButton>
        <ZoomButton title="Zoom in (or hold Shift and scroll)" onClick={() => zoomAt(PANE_SIZE / 2, PANE_SIZE / 2, 1.25)}>
          <ZoomIn size={13} />
        </ZoomButton>
      </div>
    </div>
  );
}

function ZoomButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="rounded p-1 text-charcoal/60 hover:bg-ivory-soft hover:text-charcoal">
      {children}
    </button>
  );
}

/** Radial guide lines at each symmetry boundary, plus a faint tint over
 * the one "master" wedge (always the slice starting at the top and
 * sweeping clockwise) so it's visually obvious which slice is live-
 * editable versus mirrored preview. Angles use the same clockwise,
 * rotate()-around-center convention as the mirror groups themselves (and
 * shape-ops.ts's radialRepeat), so the guides line up exactly with where
 * the mirrors actually render. */
function SymmetryGuides({ center, count }: { center: { x: number; y: number }; count: number }) {
  const radius = PANE_SIZE * 0.48;
  const step = 360 / count;
  const boundaryPoint = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const dx = 0;
    const dy = -radius;
    return { x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad), y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad) };
  };
  const p0 = boundaryPoint(0);
  const p1 = boundaryPoint(step);
  const largeArc = step > 180 ? 1 : 0;

  return (
    <g pointerEvents="none">
      <path d={`M ${center.x},${center.y} L ${p0.x},${p0.y} A ${radius},${radius} 0 ${largeArc},1 ${p1.x},${p1.y} Z`} fill="#c9a04d" fillOpacity={0.08} />
      {Array.from({ length: count }, (_, i) => {
        const p = boundaryPoint(step * i);
        return <line key={i} x1={center.x} y1={center.y} x2={p.x} y2={p.y} stroke="#c9a04d" strokeOpacity={0.35} strokeDasharray="3 3" strokeWidth={1} />;
      })}
    </g>
  );
}

/** A small crosshair at a user-placed symmetryCenter (the "Set center"
 * tool) — shown whenever one's set, even with symmetry currently off, so
 * it stays visible/manageable rather than only appearing once symmetry
 * is also on. */
function CenterMarker({ point }: { point: { x: number; y: number } }) {
  return (
    <g pointerEvents="none">
      <circle cx={point.x} cy={point.y} r={7} fill="none" stroke="#2f4f9b" strokeWidth={1.5} />
      <line x1={point.x - 11} y1={point.y} x2={point.x + 11} y2={point.y} stroke="#2f4f9b" strokeWidth={1.5} />
      <line x1={point.x} y1={point.y - 11} x2={point.x} y2={point.y + 11} stroke="#2f4f9b" strokeWidth={1.5} />
    </g>
  );
}

function ShapeGlyph({ shape }: { shape: Shape }) {
  const uid = useId();
  const { type, x, y, w, h, fill, stroke, strokeWidth, metal, gem } = shape;

  if (type === "band") {
    if (metal) {
      const m = METALS[metal];
      const gradId = `metal-ring-${uid}`;
      return (
        <>
          <defs>
            <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={m.light} />
              <stop offset="55%" stopColor={m.base} />
              <stop offset="100%" stopColor={m.dark} />
            </radialGradient>
          </defs>
          <circle cx={x} cy={y} r={w / 2} fill="transparent" stroke={`url(#${gradId})`} strokeWidth={Math.max(6, strokeWidth * 4)} />
        </>
      );
    }
    // fill="transparent" (not "none") so the whole disk is clickable, not
    // just the thin stroke line — "none" opts the interior out of hit
    // testing entirely, and a click anywhere inside the ring should still
    // select it.
    return <circle cx={x} cy={y} r={w / 2} fill="transparent" stroke={fill} strokeWidth={Math.max(6, strokeWidth * 4)} />;
  }

  if (type === "stone") {
    if (gem) {
      return (
        <svg x={x - w / 2} y={y - h / 2} width={w} height={h} style={{ overflow: "visible" }}>
          <GemVisualizer cutSlug={gem.cutSlug} hue={gem.hue} darkness={gem.darkness} saturation={gem.saturation} claritySlug={gem.claritySlug} caratWeight={gem.caratWeight} />
        </svg>
      );
    }
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
  const barFill = metal ? `url(#metal-bar-${uid})` : fill;
  return (
    <>
      {metal && (
        <defs>
          <linearGradient id={`metal-bar-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={METALS[metal].light} />
            <stop offset="55%" stopColor={METALS[metal].base} />
            <stop offset="100%" stopColor={METALS[metal].dark} />
          </linearGradient>
        </defs>
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        fill={barFill}
        stroke={metal ? METALS[metal].dark : stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={type === "chain" ? "6 3" : undefined}
        rx={Math.min(w, h) / 2}
      />
    </>
  );
}
