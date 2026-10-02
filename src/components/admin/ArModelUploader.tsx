"use client";

import { createElement, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Trash2 } from "lucide-react";
import { uploadArModel, removeArModel } from "@/actions/ar-models";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/** The GLB 3D model behind a necklace/pendant's mobile AR "try it on"
 * button — only shown when editing an existing piece (there's no id to
 * attach a model to before the piece itself is saved), same
 * immediate-upload-on-select pattern as CertLabRow's LogoUploader.
 *
 * Previewed here via Google's <model-viewer> web component — a plain
 * custom element loaded from a CDN script, not an npm dependency, so it
 * only costs anything on this admin page, never the customer bundle
 * (which uses the real Three.js + MediaPipe AR overlay instead — see
 * src/components/ar/). createElement (not JSX) sidesteps needing a
 * global JSX type augmentation just for one admin-only preview element. */
export function ArModelUploader({ jewelryId, modelUrl, pieceName }: { jewelryId: string; modelUrl: string | null; pieceName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  function handleUpload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadArModel(jewelryId, formData);
      if (!result.ok) setError(result.error);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    });
  }

  async function handleRemove() {
    if (!(await confirm(`Remove the AR model for "${pieceName}"? The "Try it on" button stops showing for this piece.`))) return;
    startTransition(async () => { await removeArModel(jewelryId); router.refresh(); });
  }

  return (
    <div>
      <Script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" strategy="lazyOnload" />
      <Label>AR 3D Model (necklaces &amp; pendants only)</Label>
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-ivory-soft">
        {modelUrl ? (
          createElement("model-viewer", { src: modelUrl, "camera-controls": true, "auto-rotate": true, style: { width: "100%", height: "100%" } })
        ) : (
          <span className="px-2 text-center text-[10px] uppercase tracking-wide text-charcoal/30">No 3D model</span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <input
          ref={fileInput}
          type="file"
          accept=".glb,model/gltf-binary"
          className="w-40 text-[11px] text-charcoal/70 file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-gold file:px-2.5 file:py-1 file:text-[10px] file:font-medium file:tracking-wide file:text-charcoal file:transition-colors hover:file:bg-gold-soft"
        />
        <p className="text-[10px] text-charcoal/45">.glb files only, up to 3.5MB.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleUpload} disabled={pending} className="!px-2.5 !py-1 text-[11px]">
            {pending ? "..." : modelUrl ? "Replace" : "Upload"}
          </Button>
          {modelUrl && (
            <button type="button" onClick={handleRemove} disabled={pending} title="Remove 3D model" className="rounded p-1 text-charcoal/50 hover:bg-charcoal/10 hover:text-red-700">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <p className="mt-2 max-w-sm text-xs text-charcoal/45">
        Only used on the public product page when this piece&apos;s Piece Type is Necklace or Pendant — the live
        camera try-on button only shows up there once a model&apos;s set.
      </p>
    </div>
  );
}
