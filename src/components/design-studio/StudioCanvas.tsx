"use client";

import { PaneSVG } from "./PaneSVG";
import type { Pane } from "@/lib/design-studio/types";
import { cn } from "@/lib/utils";

interface StudioCanvasProps {
  panes: Pane[];
  activePaneId: string;
  selectedIds: string[];
  onActivate: (paneId: string) => void;
  onSelect: (ids: string[]) => void;
  onMoveShapes: (paneId: string, updates: { id: string; x: number; y: number }[]) => void;
  onResizeShape: (paneId: string, id: string, w: number, h: number) => void;
  onRotateShape: (paneId: string, id: string, rotation: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

// Grid arrangement is purely derived from how many panes exist — never a
// separately stored "layout" field, so there's no hidden-pane state to
// lose track of when a pane is added or removed.
function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2";
}

export function StudioCanvas({ panes, activePaneId, selectedIds, onActivate, onSelect, onMoveShapes, onResizeShape, onRotateShape, onDragStart, onDragEnd }: StudioCanvasProps) {
  return (
    <div className={cn("grid gap-4", gridClass(panes.length))}>
      {panes.map((pane) => (
        <PaneSVG
          key={pane.id}
          pane={pane}
          active={pane.id === activePaneId}
          selectedIds={pane.id === activePaneId ? selectedIds : []}
          onActivate={() => onActivate(pane.id)}
          onSelect={onSelect}
          onMoveShapes={(updates) => onMoveShapes(pane.id, updates)}
          onResizeShape={(id, w, h) => onResizeShape(pane.id, id, w, h)}
          onRotateShape={(id, rotation) => onRotateShape(pane.id, id, rotation)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}
