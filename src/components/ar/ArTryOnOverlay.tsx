"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FilesetResolver, FaceLandmarker, PoseLandmarker, type FaceLandmarkerResult, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { computeNeckAnchor, NECK_DROP_FRACTION } from "@/lib/ar/neck-anchor";
import { computeModelPlacement } from "@/lib/ar/model-placement";

// Pinned to the installed npm package's own version so the WASM runtime
// fetched from the CDN always matches the JS API surface this code was
// written against. Follow-up (not done this pass, see TODO.md): self-host
// these two CDN assets under this app's own domain instead of depending
// on Google's CDN at runtime.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
// Detects the face first (478 points, including the jaw/chin), then
// neck-anchor.ts derives the neck from four of those points — a far more
// direct anchor than the pose tracker's shoulder landmarks this used
// before (see TODO.md's AR follow-up note on why that changed).
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const FOREHEAD_INDEX = 10;
const CHIN_INDEX = 152;
const LEFT_FACE_INDEX = 234;
const RIGHT_FACE_INDEX = 454;
// Debug-only: shoulder landmarks from the pose tracker this used to use
// for production anchoring (see the note above) — loaded again here
// purely so `?arDebug=1` can draw them as a real body-tracking reference
// alongside the face dots, to judge necklace size/drop against actual
// shoulder position instead of guessing from face proportions alone.
// Never loaded for a real customer — only when debugMode is true.
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const LEFT_SHOULDER_INDEX = 11;
const RIGHT_SHOULDER_INDEX = 12;

// How big the piece renders at computeNeckAnchor's scale=1 (a "typical"
// selfie-distance face width) — the model's own geometry is first
// normalized to a 1-unit bounding box (see loadModel below), then scaled
// by this constant times the live anchor scale. The original 0.22 (eyeballed,
// never tried on a real device) rendered enormous — real-device testing
// via the `?arDebug=1` size slider (2026-10-03) found 0.3x that looked
// proportionate, folded in directly here: 0.22 * 0.3 = 0.066.
const BASE_MODEL_SIZE = 0.066;

type Status = "starting" | "denied" | "unsupported" | "loading-model" | "ready" | "error";

export function ArTryOnOverlay({ modelUrl, pieceName, onClose }: { modelUrl: string; pieceName: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  // Calibration aid — `?arDebug=1` on the product page URL shows a live
  // slider for the drop-below-chin fraction plus a crosshair at the
  // computed anchor, so the exact right number for NECK_DROP_FRACTION
  // (src/lib/ar/neck-anchor.ts) can be found by nudging it while watching
  // it against a real neck, instead of guessing blind from a screen away.
  // Nothing here reaches customers: it's opt-in by URL and never surfaced
  // in any UI.
  const [debugMode] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("arDebug") === "1");
  const [dropFraction, setDropFraction] = useState(NECK_DROP_FRACTION);
  const dropFractionRef = useRef(NECK_DROP_FRACTION);
  // Multiplies the final rendered size (on top of BASE_MODEL_SIZE and the
  // live face-distance scale) — a separate axis from dropFraction, for
  // further adjustment beyond the calibrated BASE_MODEL_SIZE baseline.
  // Starts at 1 (no adjustment) now that the 0.3x real-device finding
  // (2026-10-03) is folded directly into BASE_MODEL_SIZE itself, not left
  // as a debug-only multiplier.
  const [sizeMultiplier, setSizeMultiplier] = useState(1);
  const sizeMultiplierRef = useRef(1);
  const debugMarkerRef = useRef<HTMLDivElement>(null);
  // A plain 2D overlay (not the Three.js canvas) for drawing every
  // detected face landmark plus the chin→anchor line — lets whoever's
  // calibrating see what the tracker actually found, not just the final
  // computed result, so a bad landmark read is distinguishable from a
  // bad drop/size number.
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let poseLandmarker: PoseLandmarker | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let rafId: number | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      } catch {
        if (!cancelled) setStatus("denied");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!video || !canvas || !container) return;

      video.srcObject = stream;
      await video.play();
      if (cancelled) return;

      // Scene: an orthographic camera spanning exactly [0,1]x[0,1] with
      // top=0/bottom=1 means a point's Three.js world (x,y) equals its
      // MediaPipe normalized image (x,y) directly — no projection math
      // needed to place the piece from a landmark position.
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10);
      camera.position.z = 1;
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const key = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(0.5, -1, 1);
      scene.add(key);

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);

      if (debugMode && debugCanvasRef.current) {
        debugCanvasRef.current.width = container.clientWidth;
        debugCanvasRef.current.height = container.clientHeight;
      }

      let piece: THREE.Object3D | null = null;
      try {
        piece = await loadModel(modelUrl);
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not load this piece's 3D model.");
          setStatus("error");
        }
        return;
      }
      if (cancelled || !piece) return;
      piece.visible = false;
      scene.add(piece);

      const [fileset] = await Promise.all([FilesetResolver.forVisionTasks(WASM_BASE)]);
      if (cancelled) return;

      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch {
        if (!cancelled) {
          setErrorMessage("Couldn't start the camera tracker on this device.");
          setStatus("error");
        }
        return;
      }
      if (cancelled) return;

      // Debug-only, best-effort: if this fails for any reason, the
      // calibration panel just shows face dots without shoulder dots —
      // never blocks the real face tracking a customer would see.
      if (debugMode) {
        try {
          poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          poseLandmarker = null;
        }
        if (cancelled) return;
      }

      setStatus("ready");

      /** Draws every detected face landmark (faint dots), the four used
       * ones (colored), the forehead→chin line (face height, cyan), the
       * chin→anchor line (the drop, pink), and — when the debug-only pose
       * tracker found a body — the two shoulder landmarks plus the line
       * between them, in green, as a real (not extrapolated) reference
       * for how big the piece should actually be relative to the body.
       * Debug-only, so a bad landmark read is visually distinguishable
       * from a bad drop/size number instead of guessing which is wrong. */
      function drawDebugOverlay(
        all: { x: number; y: number }[] | undefined,
        forehead: { x: number; y: number } | null,
        chin: { x: number; y: number } | null,
        leftFace: { x: number; y: number } | null,
        rightFace: { x: number; y: number } | null,
        anchor: { x: number; y: number } | null,
        leftShoulder: { x: number; y: number } | null,
        rightShoulder: { x: number; y: number } | null,
      ) {
        if (!debugMode || !debugCanvasRef.current) return;
        const dctx = debugCanvasRef.current.getContext("2d");
        if (!dctx) return;
        const w = debugCanvasRef.current.width;
        const h = debugCanvasRef.current.height;
        dctx.clearRect(0, 0, w, h);
        if (all) {
          dctx.fillStyle = "rgba(255,255,255,0.4)";
          for (const lm of all) {
            dctx.beginPath();
            dctx.arc(lm.x * w, lm.y * h, 1.5, 0, Math.PI * 2);
            dctx.fill();
          }
        }
        const dot = (p: { x: number; y: number }, color: string) => {
          dctx.fillStyle = color;
          dctx.beginPath();
          dctx.arc(p.x * w, p.y * h, 6, 0, Math.PI * 2);
          dctx.fill();
          dctx.strokeStyle = "rgba(0,0,0,0.6)";
          dctx.lineWidth = 1;
          dctx.stroke();
        };
        if (forehead) dot(forehead, "#22d3ee");
        if (chin) dot(chin, "#ef4444");
        if (leftFace) dot(leftFace, "#facc15");
        if (rightFace) dot(rightFace, "#facc15");
        if (forehead && chin) {
          dctx.strokeStyle = "#22d3ee";
          dctx.lineWidth = 2;
          dctx.beginPath();
          dctx.moveTo(forehead.x * w, forehead.y * h);
          dctx.lineTo(chin.x * w, chin.y * h);
          dctx.stroke();
        }
        if (leftFace && rightFace) {
          dctx.strokeStyle = "#facc15";
          dctx.lineWidth = 2;
          dctx.beginPath();
          dctx.moveTo(leftFace.x * w, leftFace.y * h);
          dctx.lineTo(rightFace.x * w, rightFace.y * h);
          dctx.stroke();
        }
        if (chin && anchor) {
          dctx.strokeStyle = "#f472b6";
          dctx.lineWidth = 2;
          dctx.setLineDash([4, 4]);
          dctx.beginPath();
          dctx.moveTo(chin.x * w, chin.y * h);
          dctx.lineTo(anchor.x * w, anchor.y * h);
          dctx.stroke();
          dctx.setLineDash([]);
        }
        if (leftShoulder) dot(leftShoulder, "#4ade80");
        if (rightShoulder) dot(rightShoulder, "#4ade80");
        if (leftShoulder && rightShoulder) {
          dctx.strokeStyle = "#4ade80";
          dctx.lineWidth = 2;
          dctx.beginPath();
          dctx.moveTo(leftShoulder.x * w, leftShoulder.y * h);
          dctx.lineTo(rightShoulder.x * w, rightShoulder.y * h);
          dctx.stroke();
        }
      }

      function renderFrame() {
        rafId = requestAnimationFrame(renderFrame);
        if (!video || !faceLandmarker || !renderer || !piece) return;
        if (video.readyState < 2) return;

        let result: FaceLandmarkerResult;
        try {
          result = faceLandmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }

        let leftShoulder: { x: number; y: number } | null = null;
        let rightShoulder: { x: number; y: number } | null = null;
        if (poseLandmarker) {
          try {
            const poseResult: PoseLandmarkerResult = poseLandmarker.detectForVideo(video, performance.now());
            const poseLandmarks = poseResult.landmarks[0];
            leftShoulder = poseLandmarks?.[LEFT_SHOULDER_INDEX] ?? null;
            rightShoulder = poseLandmarks?.[RIGHT_SHOULDER_INDEX] ?? null;
          } catch {
            // Debug-only aid — a failed pose read just means no green
            // shoulder dots this frame, never blocks face tracking/render.
          }
        }

        const landmarks = result.faceLandmarks[0];
        const forehead = landmarks?.[FOREHEAD_INDEX];
        const chin = landmarks?.[CHIN_INDEX];
        const leftFace = landmarks?.[LEFT_FACE_INDEX];
        const rightFace = landmarks?.[RIGHT_FACE_INDEX];
        if (forehead && chin && leftFace && rightFace) {
          const anchor = computeNeckAnchor(forehead, chin, leftFace, rightFace, dropFractionRef.current);
          piece.position.set(anchor.x, anchor.y, 0);
          piece.rotation.z = anchor.rotationRad;
          const s = BASE_MODEL_SIZE * anchor.scale * sizeMultiplierRef.current;
          piece.scale.set(s, s, s);
          piece.visible = true;
          setTracking(true);
          if (debugMarkerRef.current) {
            debugMarkerRef.current.style.left = `${anchor.x * 100}%`;
            debugMarkerRef.current.style.top = `${anchor.y * 100}%`;
            debugMarkerRef.current.style.display = "block";
          }
          drawDebugOverlay(landmarks, forehead, chin, leftFace, rightFace, anchor, leftShoulder, rightShoulder);
        } else {
          piece.visible = false;
          setTracking(false);
          if (debugMarkerRef.current) debugMarkerRef.current.style.display = "none";
          drawDebugOverlay(landmarks, null, null, null, null, null, leftShoulder, rightShoulder);
        }

        renderer.render(scene, camera);
      }
      renderFrame();
    }

    start().catch(() => {
      if (!cancelled) {
        setErrorMessage("Something went wrong starting the camera.");
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      faceLandmarker?.close();
      poseLandmarker?.close();
      renderer?.dispose();
    };
    // debugMode never changes after mount (its useState has no setter
    // call anywhere) — listed for exhaustive-deps, not because it varies.
  }, [modelUrl, debugMode]);

  function handleCapture() {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!video || !overlay) return;
    const out = document.createElement("canvas");
    out.width = video.videoWidth;
    out.height = video.videoHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    // Matches the mirrored (scaleX(-1)) display so the saved photo looks
    // like what was actually on screen, not a flipped version of it.
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-out.width, 0);
    ctx.drawImage(video, 0, 0, out.width, out.height);
    ctx.drawImage(overlay, 0, 0, out.width, out.height);
    ctx.restore();
    setCapturedUrl(out.toDataURL("image/png"));
  }

  // Portaled straight to <body> rather than rendered in place — a z-index
  // number alone doesn't reliably beat the root layout's own fixed chrome
  // (Navbar, the mobile StickyBuyBar) since each can sit in its own CSS
  // stacking context; mounting outside the whole page tree sidesteps that
  // class of bug entirely, the same way most full-screen takeovers need to.
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black">
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [transform:scaleX(-1)]" />
        {debugMode && <canvas ref={debugCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full [transform:scaleX(-1)]" />}

        {debugMode && (
          // Same scaleX(-1) as the video/canvas above so it lines up with
          // the mirrored display, not the raw (unmirrored) landmark space
          // it's actually positioned in.
          <div className="pointer-events-none absolute inset-0 [transform:scaleX(-1)]">
            <div
              ref={debugMarkerRef}
              className="absolute hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400"
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-400" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-400" />
            </div>
          </div>
        )}

        {debugMode && (
          <div className="absolute left-3 top-16 z-10 w-60 rounded-lg bg-black/70 p-3 text-white">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Calibration (debug only)</p>

            <p className="mt-2 text-xs">
              Drop fraction: <span className="font-mono">{dropFraction.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={-0.3}
              max={2.5}
              step={0.05}
              value={dropFraction}
              onChange={(e) => {
                const v = Number(e.target.value);
                dropFractionRef.current = v;
                setDropFraction(v);
              }}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[10px] text-white/50">Nudge until the cyan crosshair sits right where the chain should rest.</p>

            <p className="mt-3 text-xs">
              Size: <span className="font-mono">{sizeMultiplier.toFixed(2)}×</span>
            </p>
            <input
              type="range"
              min={0.02}
              max={2}
              step={0.02}
              value={sizeMultiplier}
              onChange={(e) => {
                const v = Number(e.target.value);
                sizeMultiplierRef.current = v;
                setSizeMultiplier(v);
              }}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[10px] text-white/50">Shrink/grow until the necklace is proportioned to your neck, not spanning your whole chest.</p>

            <div className="mt-3 space-y-1 border-t border-white/20 pt-2 text-[10px] text-white/70">
              <p className="text-white/50">What the dots mean:</p>
              <p>
                <span className="text-cyan-400">●</span> forehead &nbsp; <span className="text-red-500">●</span> chin &nbsp; <span className="text-yellow-400">●</span> face edges
              </p>
              <p>
                <span className="text-cyan-400">—</span> face height &nbsp; <span className="text-pink-400">┄</span> the drop
              </p>
              <p>
                <span className="text-green-400">●</span> shoulders (real body tracking, not guessed from the face)
              </p>
              <p className="text-white/40">Faint white dots = everything the tracker sees on your face. No green dots = the body tracker could not start on this device, or your shoulders are not in frame.</p>
            </div>

            <p className="mt-2 text-[10px] text-white/50">Report both numbers back once they look right — and whether the colored dots actually land on your forehead/chin/cheeks.</p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-4">
          <p className="truncate text-sm font-medium text-white">{pieceName}</p>
          <button type="button" onClick={onClose} className="rounded-full bg-black/40 p-2 text-white" title="Close">
            <X size={20} />
          </button>
        </div>

        {status === "ready" && !tracking && (
          <p className="absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-white/90">
            Make sure your face is fully in frame and well-lit.
          </p>
        )}

        {(status === "starting" || status === "loading-model") && <OverlayMessage icon={<Loader2 className="animate-spin" size={28} />} message="Starting the camera..." />}
        {status === "denied" && (
          <OverlayMessage
            message="Camera access was blocked. Allow camera access for this site in your browser settings, then try again."
            action={{ label: "Close", onClick: onClose }}
          />
        )}
        {status === "unsupported" && (
          <OverlayMessage message="Your browser doesn't support live camera try-on. Try this on a recent version of Chrome or Safari on your phone." action={{ label: "Close", onClick: onClose }} />
        )}
        {status === "error" && <OverlayMessage message={errorMessage ?? "Something went wrong."} action={{ label: "Close", onClick: onClose }} />}

        {status === "ready" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/60 to-transparent p-6">
            <button type="button" onClick={handleCapture} className="flex flex-col items-center gap-1 text-white" title="Save a photo">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white">
                <Download size={20} />
              </span>
              <span className="text-xs">Save photo</span>
            </button>
          </div>
        )}

        {capturedUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- a client-only captured data URL, not an optimizable remote/static asset */}
            <img src={capturedUrl} alt="" className="max-h-[70vh] max-w-full rounded-lg [transform:scaleX(-1)]" />
            <div className="flex gap-3">
              <a href={capturedUrl} download={`${pieceName}-try-on.png`} className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-charcoal">
                <Download size={15} /> Save
              </a>
              <button type="button" onClick={() => setCapturedUrl(null)} className="flex items-center gap-1.5 rounded-full border border-white/40 px-4 py-2 text-sm text-white">
                <RotateCcw size={15} /> Retake
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function OverlayMessage({ icon, message, action }: { icon?: React.ReactNode; message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-8 text-center">
      {icon}
      <p className="max-w-xs text-sm text-white/90">{message}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="rounded-full border border-white/40 px-4 py-2 text-sm text-white">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Loads the GLB and normalizes its scale/position so computeNeckAnchor's
 * scale=1 reads consistently regardless of how the source file happened
 * to be authored (its own units, an off-center origin, etc.) — centers it
 * horizontally but anchors it at its own TOP vertically (see
 * computeModelPlacement's own comment for why: a hanging necklace should
 * render at-or-below the neck point, not straddle it), and scales its
 * largest dimension to 1 world unit, so BASE_MODEL_SIZE above is the only
 * place piece size is actually tuned. */
async function loadModel(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  // `true` = precise mode: the default walks the object's own LOCAL
  // bounding box and transforms just its 8 corners by the world matrix,
  // which badly over-estimates the box for anything with a rotation in
  // its hierarchy (confirmed while building the current placeholder: a
  // ~45°-rotated mesh came out ~sqrt(2)x too big that way). Precise mode
  // walks the actual vertex positions instead.
  const box = new THREE.Box3().setFromObject(root, true);

  const placement = computeModelPlacement(box);

  const wrapper = new THREE.Group();
  root.position.x += placement.offset.x;
  root.position.y += placement.offset.y;
  root.position.z += placement.offset.z;
  wrapper.add(root);
  wrapper.scale.setScalar(placement.scale);

  return wrapper;
}
