"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { StudioCanvas } from "./StudioCanvas";
import { StudioToolbar } from "./StudioToolbar";
import { LayersPanel } from "./LayersPanel";
import { emptyStudioState, newPane, newShape, MAX_PANES, type Shape, type ShapeType, type StudioState } from "@/lib/design-studio/types";
import { bringToFront, cloneShapes, moveBackward, moveForward, paneCenter, radialRepeat, sendToBack, symmetryPivot, wedgeMidpoint } from "@/lib/design-studio/shape-ops";
import { exportPanesToPngBlob } from "@/lib/design-studio/export";
import { saveDesign, uploadDesignThumbnail, submitDesignStudioRequest, listMyDesigns, type MyDesignSummary } from "@/actions/design-studio";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { STANDARD_CUTS } from "@/lib/gem-constants";
import { DEFAULT_CLARITY_SLUG, type GemColorPreset } from "@/lib/design-studio/gems";
import { caratToRenderScale } from "@/components/gem-visualizer/size";
import { DEFAULT_METAL, type MetalKey } from "@/lib/design-studio/metals";

const METAL_SHAPE_TYPES: ShapeType[] = ["band", "prong", "line", "chain"];
/** 18–68px diameter across the usable carat range — big enough to read as
 * a stone against a ~220px band, small enough that a few don't crowd a
 * 400-unit pane. */
function gemSizePx(carat: number): number {
  return 18 + caratToRenderScale(carat) * 50;
}

export interface InitialDesign {
  id: string;
  name: string;
  data: StudioState;
  thumbnailUrl: string | null;
  quoteRequestId: string | null;
}

interface DesignStudioProps {
  mode: "admin" | "customer";
  initialDesign?: InitialDesign | null;
  /** Customer mode only — whether there's a signed-in session to submit
   * with (mirrors how /configurator passes this through today). Admin
   * mode is always reached signed-in (the route itself requires it). */
  isAuthenticated?: boolean;
}

const AUTOSAVE_DELAY_MS = 2000;

export function DesignStudio({ mode, initialDesign, isAuthenticated = true }: DesignStudioProps) {
  const router = useRouter();
  // Not component state — nothing renders off it directly, and doSave needs
  // to read whichever value is current at the moment it actually runs
  // (not whatever was in scope when it was scheduled), which a useState
  // closure can't give it. See saveChain's own comment for why that
  // staleness specifically matters here.
  const designIdRef = useRef<string | null>(initialDesign?.id ?? null);
  const [name, setName] = useState(initialDesign?.name ?? "Untitled design");
  const [studio, setStudio] = useState<StudioState>(initialDesign?.data ?? emptyStudioState());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Shape[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!initialDesign?.quoteRequestId);

  const [myDesigns, setMyDesigns] = useState<MyDesignSummary[] | null>(null);

  // Defaults applied to the next inserted gem/metal shape — and, when
  // exactly one eligible shape is already selected, live-restyle that
  // shape too instead (see handlePickGemColor/handlePickMetal below).
  const [gemCutSlug, setGemCutSlug] = useState(STANDARD_CUTS[0].slug);
  const [gemCarat, setGemCarat] = useState(1);
  const [metalKey, setMetalKey] = useState<MetalKey>(DEFAULT_METAL);
  // The toolbar's "Set center" tool — true while waiting for the next
  // canvas click to place pane.symmetryCenter (see PaneSVG's own prop).
  const [settingCenter, setSettingCenter] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo. Refs (not state) because every mutation needs to push onto
  // this synchronously without waiting for a re-render — exposed to the
  // toolbar's enabled/disabled state via historyVersion, bumped on every
  // push/undo/redo so a read of historyRef.current during render reflects
  // what just happened. Snapshots are whole StudioState objects, not deep
  // clones: every mutation in this file is already immutable (fresh
  // objects/arrays via spread/.map()/.filter()), so an old `studio`
  // reference is never mutated out from under a history entry.
  const historyRef = useRef<{ past: StudioState[]; future: StudioState[] }>({ past: [], future: [] });
  // The state immediately before the drag currently in progress (if any)
  // — see handleDragStart/handleDragEnd. A drag fires many setStudio
  // calls (one per pointermove); only the state from *before* it started
  // becomes a single undo step, once it ends.
  const dragSnapshotRef = useRef<StudioState | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const HISTORY_LIMIT = 50;
  // Serializes every save (debounced autosave and explicit Save/Submit
  // clicks alike) through one queue — without this, a manual save firing
  // while an autosave from a moment earlier is still in flight can each
  // read a stale `designId` (still null) and create two separate rows
  // instead of one being created then the other updated.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const activePane = studio.panes.find((p) => p.id === studio.activePaneId) ?? studio.panes[0];
  // historyRef is a ref (mutated synchronously, outside React's state
  // flow), so reading it here only reflects the latest push/undo/redo
  // because every one of those also bumps historyVersion — the dependency
  // on it below is what makes these recompute, not just decoration.
  const canUndo = historyVersion >= 0 && historyRef.current.past.length > 0;
  const canRedo = historyVersion >= 0 && historyRef.current.future.length > 0;
  const singleSelected = selectedIds.length === 1 ? activePane?.shapes.find((s) => s.id === selectedIds[0]) : undefined;
  const gemApplicable = singleSelected?.type === "stone";
  const metalApplicable = !!singleSelected && METAL_SHAPE_TYPES.includes(singleSelected.type);

  useEffect(() => {
    if (mode !== "admin") return;
    listMyDesigns().then(setMyDesigns).catch(() => setMyDesigns([]));
  }, [mode]);

  // Debounced autosave of the editor state (not the thumbnail — that's
  // only regenerated on an explicit Save, see doSave below) a couple of
  // seconds after the last edit, rather than on every shape nudge.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void doSave(false);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doSave closes over state that changes every render; re-running on `studio`/`name` alone is the intent.
  }, [studio, name]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo — even
      // while typing in the name/description field is fine here, since
      // those fields have their own native undo and this only acts on
      // the canvas's own history.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (typing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        deleteSelection();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeSelected(dx, dy);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- every handler here closes over current state each render; this listener is cheap to re-attach.
  }, [selectedIds, studio]);

  /** Arrow-key nudge — 1 unit, or 10 with Shift — for precise placement
   * beyond what dragging by eye can manage. Each nudge is its own undo
   * step, same granularity as every other discrete edit. */
  function nudgeSelected(dx: number, dy: number) {
    if (!activePane) return;
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => shapes.map((s) => (selectedIds.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s)));
  }

  function updatePane(paneId: string, updater: (shapes: Shape[]) => Shape[]) {
    setStudio((prev) => ({ ...prev, panes: prev.panes.map((p) => (p.id === paneId ? { ...p, shapes: updater(p.shapes) } : p)) }));
  }

  /** Records `prevState` (the state right before the mutation about to
   * happen) as one undo step. Called at the top of every discrete
   * mutating handler, before it changes `studio` — drags are the
   * exception (see handleDragStart/handleDragEnd, which commit once per
   * whole drag instead of once per pointermove). */
  function commitHistory(prevState: StudioState) {
    const h = historyRef.current;
    h.past.push(prevState);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
    setHistoryVersion((v) => v + 1);
  }

  function handleUndo() {
    const h = historyRef.current;
    const previous = h.past.pop();
    if (!previous) return;
    h.future.push(studio);
    setStudio(previous);
    setSelectedIds([]);
    setHistoryVersion((v) => v + 1);
  }

  function handleRedo() {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(studio);
    setStudio(next);
    setSelectedIds([]);
    setHistoryVersion((v) => v + 1);
  }

  /** Called from PaneSVG when a shape drag (move/resize/rotate) begins —
   * captures the pre-drag state so the whole drag becomes one undo step
   * when it ends, not one per pointermove. */
  function handleDragStart() {
    dragSnapshotRef.current = studio;
  }

  function handleDragEnd() {
    const before = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (before && before !== studio) commitHistory(before);
  }

  function handleActivate(paneId: string) {
    setStudio((prev) => (prev.activePaneId === paneId ? prev : { ...prev, activePaneId: paneId }));
    setSelectedIds([]);
  }

  /** Where a newly added (non-band) shape should spawn — the pane center
   * normally, or a point inside the live-symmetry master wedge when one's
   * active, so it's visibly distinct once mirrored rather than landing
   * exactly on the pivot (see wedgeMidpoint's own comment). A band always
   * centers on the pane regardless, since it IS the circle itself. */
  function spawnPoint(type: ShapeType): { x: number; y: number } | undefined {
    if (type === "band" || !activePane?.symmetry || activePane.symmetry <= 1) return undefined;
    // symmetryPivot, not paneCenter — must match the same fixed pivot
    // PaneSVG renders the live mirrors around (see its own comment), or a
    // second stone would spawn relative to a different center than the
    // first one is mirrored around.
    const center = symmetryPivot(activePane, { x: 200, y: 200 });
    return wedgeMidpoint(center, activePane.symmetry, 90);
  }

  function handleAddShape(type: ShapeType) {
    commitHistory(studio);
    const shape = newShape(type, spawnPoint(type));
    if (METAL_SHAPE_TYPES.includes(type)) shape.metal = metalKey;
    updatePane(studio.activePaneId, (shapes) => [...shapes, shape]);
    setSelectedIds([shape.id]);
  }

  /** Click a color swatch in the Gem panel: restyles the selected gem if
   * one is selected, otherwise inserts a new one with the toolbar's
   * current cut/carat. Cut and carat changes alone don't insert/restyle
   * by themselves (see StudioToolbar) — only a color click commits. */
  function handlePickGemColor(preset: GemColorPreset) {
    commitHistory(studio);
    const size = gemSizePx(gemCarat);
    const gem = { cutSlug: gemCutSlug, hue: preset.hue, darkness: preset.darkness, saturation: preset.saturation, claritySlug: DEFAULT_CLARITY_SLUG, caratWeight: gemCarat };
    if (singleSelected?.type === "stone") {
      updatePane(studio.activePaneId, (shapes) => shapes.map((s) => (s.id === singleSelected.id ? { ...s, gem, w: size, h: size } : s)));
      return;
    }
    const shape: Shape = { ...newShape("stone", spawnPoint("stone")), w: size, h: size, gem };
    updatePane(studio.activePaneId, (shapes) => [...shapes, shape]);
    setSelectedIds([shape.id]);
  }

  /** Click a metal swatch: sets the default for the next band/prong/line/
   * chain shape added, and restyles the selected shape too if it's one of
   * those types. */
  function handlePickMetal(metal: MetalKey) {
    setMetalKey(metal);
    if (singleSelected && METAL_SHAPE_TYPES.includes(singleSelected.type)) {
      commitHistory(studio);
      updatePane(studio.activePaneId, (shapes) => shapes.map((s) => (s.id === singleSelected.id ? { ...s, metal } : s)));
    }
  }

  /** Live radial symmetry for the active pane — see Pane.symmetry's own
   * comment. null turns it off. */
  function handleSetSymmetry(count: number | null) {
    commitHistory(studio);
    setStudio((prev) => ({ ...prev, panes: prev.panes.map((p) => (p.id === prev.activePaneId ? { ...p, symmetry: count ?? undefined } : p)) }));
  }

  function handleApplyTemplate(shapes: Shape[]) {
    commitHistory(studio);
    updatePane(studio.activePaneId, () => shapes);
    setSelectedIds([]);
  }

  function handleAddPane() {
    if (studio.panes.length >= MAX_PANES) return;
    commitHistory(studio);
    const pane = newPane(`View ${studio.panes.length + 1}`);
    setStudio((prev) => ({ panes: [...prev.panes, pane], activePaneId: pane.id }));
    setSelectedIds([]);
  }

  function handleRemovePane() {
    if (studio.panes.length <= 1) return;
    commitHistory(studio);
    setStudio((prev) => {
      const panes = prev.panes.filter((p) => p.id !== studio.activePaneId);
      return { panes, activePaneId: panes[0].id };
    });
    setSelectedIds([]);
  }

  function handleCopy() {
    if (!activePane) return;
    const shapes = activePane.shapes.filter((s) => selectedIds.includes(s.id));
    if (shapes.length) setClipboard(shapes);
  }

  function handlePaste() {
    if (!clipboard) return;
    commitHistory(studio);
    const copies = cloneShapes(clipboard);
    updatePane(studio.activePaneId, (shapes) => [...shapes, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }

  function deleteSelection() {
    if (!activePane || selectedIds.length === 0) return;
    commitHistory(studio);
    const group = new Set(activePane.shapes.filter((s) => selectedIds.includes(s.id) && s.groupId).map((s) => s.groupId));
    updatePane(studio.activePaneId, (shapes) => shapes.filter((s) => !selectedIds.includes(s.id) && !(s.groupId && group.has(s.groupId))));
    setSelectedIds([]);
  }

  function handleBringToFront() {
    if (!activePane || selectedIds.length === 0) return;
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => bringToFront(shapes, selectedIds));
  }

  function handleSendToBack() {
    if (!activePane || selectedIds.length === 0) return;
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => sendToBack(shapes, selectedIds));
  }

  /** One-step layer reordering from the Layers panel — a single shape at
   * a time, unlike the toolbar's selection-wide bring-to-front/send-to-back. */
  function handleMoveForward(id: string) {
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => moveForward(shapes, id));
  }

  function handleMoveBackward(id: string) {
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => moveBackward(shapes, id));
  }

  /** Hide/show from the Layers panel — a hidden shape stays in the data
   * (and the panel), just skipped on the canvas (see PaneSVG), same
   * "hide, don't delete" convention as any layer panel. */
  function handleToggleHidden(id: string) {
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => shapes.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s)));
  }

  /** Mirror toggle from the Layers panel — scopes live symmetry to just
   * the layers that should actually repeat, instead of every shape in the
   * pane (see Shape.excludeFromSymmetry's own comment). */
  function handleToggleSymmetryExclude(id: string) {
    commitHistory(studio);
    updatePane(studio.activePaneId, (shapes) => shapes.map((s) => (s.id === id ? { ...s, excludeFromSymmetry: !s.excludeFromSymmetry } : s)));
  }

  /** Click a row in the Layers panel: selects just that shape, or adds/
   * removes it from the selection with Shift — mirrors PaneSVG's own
   * shift-click-on-canvas behavior, since the panel is just another way
   * to pick the same selection. */
  function handleSelectLayer(id: string, additive: boolean) {
    setSelectedIds((prev) => (additive ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  }

  function handleToggleSetCenterTool() {
    setSettingCenter((v) => !v);
  }

  /** Called from PaneSVG once the "Set center" tool's next canvas click
   * lands — places pane.symmetryCenter there and turns the tool back off
   * (one-shot, like most editors' "pick a point" tools). */
  function handlePickSymmetryCenter(paneId: string, point: { x: number; y: number }) {
    commitHistory(studio);
    setStudio((prev) => ({ ...prev, panes: prev.panes.map((p) => (p.id === paneId ? { ...p, symmetryCenter: point } : p)) }));
    setSettingCenter(false);
  }

  function handleClearSymmetryCenter() {
    if (!activePane?.symmetryCenter) return;
    commitHistory(studio);
    setStudio((prev) => ({ ...prev, panes: prev.panes.map((p) => (p.id === prev.activePaneId ? { ...p, symmetryCenter: undefined } : p)) }));
  }

  function handleRadialRepeat(count: number) {
    if (!activePane || selectedIds.length === 0) return;
    commitHistory(studio);
    const selected = activePane.shapes.filter((s) => selectedIds.includes(s.id));
    const center = paneCenter(activePane, { x: 200, y: 200 });
    const copies = radialRepeat(selected, center, count);
    updatePane(studio.activePaneId, (shapes) => [...shapes, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }

  function handleMoveShapes(paneId: string, updates: { id: string; x: number; y: number }[]) {
    updatePane(paneId, (shapes) => shapes.map((s) => {
      const found = updates.find((u) => u.id === s.id);
      return found ? { ...s, x: found.x, y: found.y } : s;
    }));
  }

  function handleResizeShape(paneId: string, id: string, w: number, h: number) {
    updatePane(paneId, (shapes) => shapes.map((s) => (s.id === id ? { ...s, w, h } : s)));
  }

  function handleRotateShape(paneId: string, id: string, rotation: number) {
    updatePane(paneId, (shapes) => shapes.map((s) => (s.id === id ? { ...s, rotation } : s)));
  }

  async function doSaveInner(withThumbnail: boolean): Promise<string | null> {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveDesign(designIdRef.current, name, studio);
      if (!result.ok) {
        setSaveError(result.error);
        return null;
      }
      designIdRef.current = result.id;

      if (withThumbnail && canvasRef.current) {
        try {
          const blob = await exportPanesToPngBlob(canvasRef.current);
          const formData = new FormData();
          formData.set("thumbnail", new File([blob], "design.png", { type: "image/png" }));
          const uploaded = await uploadDesignThumbnail(result.id, formData);
          if (!uploaded.ok) setSaveError(uploaded.error);
        } catch (err) {
          // A failed thumbnail export shouldn't block saving the sketch
          // data itself, but a caller relying on the thumbnail (customer
          // submit) needs to know it didn't happen.
          setSaveError(err instanceof Error ? err.message : "Could not export the sketch.");
        }
      }
      setLastSavedAt(new Date());
      return result.id;
    } finally {
      setSaving(false);
    }
  }

  // Every save — the debounced autosave and explicit Save/Submit clicks
  // alike — runs through this one queue, so a manual save that lands while
  // an autosave from a moment earlier is still in flight waits its turn
  // instead of racing it (see saveChain's own comment).
  function doSave(withThumbnail: boolean): Promise<string | null> {
    const run = saveChain.current.then(() => doSaveInner(withThumbnail));
    saveChain.current = run.catch(() => undefined);
    return run;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!isAuthenticated) {
      setSubmitError("Please sign in to submit a custom design request.");
      return;
    }
    setSubmitting(true);
    try {
      const id = await doSave(true);
      if (!id) {
        setSubmitError(saveError ?? "Could not save the sketch.");
        return;
      }
      const result = await submitDesignStudioRequest(id, description);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface p-6">
        <CircleCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
        <div>
          <p className="text-sm font-medium text-charcoal">Request sent</p>
          <p className="mt-1 text-sm text-charcoal/70">Our design team will review your sketch and reach out by email with next steps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "admin" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="design-name">Design name</Label>
            <Input id="design-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <p className="shrink-0 pt-5 text-xs text-charcoal/50">
            {saving ? "Saving..." : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Not saved yet"}
          </p>
        </div>
      )}

      <StudioToolbar
        selectionCount={selectedIds.length}
        paneCount={studio.panes.length}
        onAddShape={handleAddShape}
        onApplyTemplate={handleApplyTemplate}
        onAddPane={handleAddPane}
        onRemovePane={handleRemovePane}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={deleteSelection}
        onRadialRepeat={handleRadialRepeat}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onSave={() => doSave(true)}
        saving={saving}
        canPaste={!!clipboard}
        symmetry={activePane?.symmetry}
        onSetSymmetry={handleSetSymmetry}
        settingCenter={settingCenter}
        onToggleSetCenterTool={handleToggleSetCenterTool}
        hasSymmetryCenter={!!activePane?.symmetryCenter}
        onClearSymmetryCenter={handleClearSymmetryCenter}
        metalKey={metalKey}
        onPickMetal={handlePickMetal}
        metalApplicable={metalApplicable}
        gemCutSlug={gemCutSlug}
        onSetGemCut={setGemCutSlug}
        gemCarat={gemCarat}
        onSetGemCarat={setGemCarat}
        onPickGemColor={handlePickGemColor}
        gemApplicable={gemApplicable}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <FieldError>{saveError ?? undefined}</FieldError>

      <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
        <div ref={canvasRef}>
          <StudioCanvas
            panes={studio.panes}
            activePaneId={studio.activePaneId}
            selectedIds={selectedIds}
            onActivate={handleActivate}
            onSelect={setSelectedIds}
            onMoveShapes={handleMoveShapes}
            onResizeShape={handleResizeShape}
            onRotateShape={handleRotateShape}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            settingCenter={settingCenter}
            onPickSymmetryCenter={handlePickSymmetryCenter}
          />
        </div>
        {activePane && (
          <LayersPanel
            shapes={activePane.shapes}
            selectedIds={selectedIds}
            onSelect={handleSelectLayer}
            onToggleHidden={handleToggleHidden}
            onMoveForward={handleMoveForward}
            onMoveBackward={handleMoveBackward}
            symmetryActive={!!activePane.symmetry && activePane.symmetry > 1}
            onToggleSymmetryExclude={handleToggleSymmetryExclude}
          />
        )}
      </div>

      {mode === "admin" && myDesigns !== null && myDesigns.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-charcoal/50">My designs</p>
          <div className="flex flex-wrap gap-3">
            {myDesigns.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => router.push(`/admin/design-studio?design=${d.id}`)}
                className="w-28 rounded-lg border border-border-subtle p-1.5 text-left hover:border-gold/40"
                title={d.name}
              >
                <span className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-[#faf7f2]">
                  {d.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin-only thumbnail list, not worth Next/Image overhead here
                    <img src={d.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-charcoal/30">No preview</span>
                  )}
                </span>
                <span className="mt-1 block truncate text-xs text-charcoal/70">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "customer" && (
        <div className="rounded-xl border border-border-subtle bg-surface p-5">
          <Label htmlFor="design-description">Describe what you&apos;re going for</Label>
          <Textarea
            id="design-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={10}
            maxLength={2000}
            rows={4}
            placeholder="A signet ring with a dark garnet centre stone, engraved initials, oxidized silver band..."
          />
          <FieldError>{submitError ?? undefined}</FieldError>
          {!isAuthenticated ? (
            <p className="mt-3 text-sm text-charcoal/70">
              <a href="/account/login" className="text-gold-deep underline">
                Sign in
              </a>{" "}
              to submit this sketch as a custom design request.
            </p>
          ) : (
            <Button type="button" variant="gold" size="lg" className="mt-3" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Sending..." : "Submit Custom Request"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
