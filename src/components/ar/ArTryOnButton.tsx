"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";

// A browser-capability check, not a true external subscription — but
// useSyncExternalStore is still the right tool: it's the dedicated API
// for "a value that can differ between server and client and must render
// the server's value on the client's first paint too" (server snapshot
// false, real check after), without the hydration-mismatch risk a plain
// useState+useEffect pair has for exactly this kind of check.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}
function getServerSnapshot() {
  return false;
}

// The AR overlay pulls in Three.js + MediaPipe's pose tracker (a real
// amount of code and a WASM download) — lazy-loaded only once this
// button is actually clicked, and ssr:false since it's camera/WebGL-only
// browser code with nothing to render on the server.
const ArTryOnOverlay = dynamic(() => import("./ArTryOnOverlay").then((m) => m.ArTryOnOverlay), { ssr: false });

/** "Try it on" — live camera AR for a necklace/pendant, only where it can
 * plausibly work: `lg:hidden` keeps it off desktop (no phone camera to
 * point at your own neck there), and the camera-API feature check keeps
 * it off a browser/device that doesn't support it, rather than offering
 * a button that just fails when tapped. Renders nothing at all when the
 * piece has no `arModelUrl` (see JewelryPiece.arModelUrl's own comment). */
export function ArTryOnButton({ modelUrl, pieceName }: { modelUrl: string | null; pieceName: string }) {
  const supported = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);

  if (!modelUrl || !supported) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="mt-3 lg:hidden" onClick={() => setOpen(true)}>
        <Camera size={15} /> Try it on
      </Button>
      {open && <ArTryOnOverlay modelUrl={modelUrl} pieceName={pieceName} onClose={() => setOpen(false)} />}
    </>
  );
}
