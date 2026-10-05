"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FilesetResolver, FaceLandmarker, PoseLandmarker, type FaceLandmarkerResult, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { computeNecklaceAnchor, NECK_BASE_FRACTION, NECKLACE_WIDTH_MULTIPLIER } from "@/lib/ar/neck-anchor";

// Pinned to the installed npm package's own version so the WASM runtime
// fetched from the CDN always matches the JS API surface this code was
// written against. Follow-up (not done this pass, see TODO.md): self-host
// these two CDN assets under this app's own domain instead of depending
// on Google's CDN at runtime.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const CHIN_INDEX = 152;
const LEFT_FACE_INDEX = 234;
const RIGHT_FACE_INDEX = 454;
// The necklace is anchored between the chin and the shoulder line (see
// neck-anchor.ts's computeNecklaceAnchor) — shoulders are tracked via a
// SECOND model, always loaded (not debug-only anymore; this pilot's
// real-device testing found shoulder tracking reliable enough to be a
// primary input, not just a debug reference — see TODO.md).
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const LEFT_SHOULDER_INDEX = 11;
const RIGHT_SHOULDER_INDEX = 12;

// Real-world-cm size calibration for the pendant specifically (the chain
// is sized directly from the live-measured face width instead — see
// NECKLACE_WIDTH_MULTIPLIER). REFERENCE_FACE_WIDTH_CM is an average adult
// bizygomatic (cheek-to-cheek) width — NOT measured for any specific
// customer. PENDANT_TARGET_CM is this one pilot placeholder's intended
// real size (customer-specified: "if pendant is 5x5cm it should be there
// as it is") — a real future model should carry its own physical size on
// the JewelryPiece record instead of a hardcoded page constant (flagged
// in TODO.md).
const REFERENCE_FACE_WIDTH_CM = 13.5;
const PENDANT_TARGET_CM = 5;
// Three.js object names the placeholder GLB tags its two independently-
// positioned parts with at export time (see build script referenced in
// TODO.md) — the chain spans between the neck-anchor points, the pendant
// hangs from wherever the chain's own live bottom-center ends up, scaled
// to its real-world cm size independent of the chain's width.
const CHAIN_NODE_NAME = "chain";
const PENDANT_NODE_NAME = "pendant";

type Status = "starting" | "denied" | "unsupported" | "loading-model" | "ready" | "error";

export function ArTryOnOverlay({ modelUrl, pieceName, onClose }: { modelUrl: string; pieceName: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  // Calibration aid — `?arDebug=1` on the product page URL shows live
  // sliders for the two tuning constants (see neck-anchor.ts) plus a full
  // landmark visualization, so the exact right numbers can be found by
  // nudging them while watching against a real neck/body, instead of
  // guessing blind from a screen away. Nothing here reaches customers:
  // it's opt-in by URL and never surfaced in any UI.
  const [debugMode] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("arDebug") === "1");
  const [neckBaseFraction, setNeckBaseFraction] = useState(NECK_BASE_FRACTION);
  const neckBaseFractionRef = useRef(NECK_BASE_FRACTION);
  const [widthMultiplier, setWidthMultiplier] = useState(NECKLACE_WIDTH_MULTIPLIER);
  const widthMultiplierRef = useRef(NECKLACE_WIDTH_MULTIPLIER);
  const debugMarkerRef = useRef<HTMLDivElement>(null);
  // A plain 2D overlay (not the Three.js canvas) for drawing every
  // detected face/body landmark plus the chin→anchor line — lets whoever's
  // calibrating see what the tracker actually found, not just the final
  // computed result, so a bad landmark read is distinguishable from a bad
  // tuning-constant value.
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

      // Camera world bounds match the container's actual aspect ratio
      // (not a fixed [0,1]x[0,1] square) so a world unit means the same
      // physical on-screen distance on both axes — a uniform scale
      // otherwise renders stretched on any non-square video (every phone
      // selfie), since the container is taller than it is wide.
      const aspect = container.clientHeight / container.clientWidth;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 1, 0, aspect, 0.1, 10);
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

      let chain: THREE.Object3D | null = null;
      let pendant: THREE.Object3D | null = null;
      let chainAuthoredWidth = 1;
      let pendantAuthoredSize = 1;
      try {
        const loaded = await loadModel(modelUrl);
        chain = loaded.chain;
        pendant = loaded.pendant;
        chainAuthoredWidth = loaded.chainAuthoredWidth;
        pendantAuthoredSize = loaded.pendantAuthoredSize;
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not load this piece's 3D model.");
          setStatus("error");
        }
        return;
      }
      if (cancelled || !chain || !pendant) return;
      chain.visible = false;
      pendant.visible = false;
      scene.add(chain, pendant);

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

      try {
        poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        if (!cancelled) {
          setErrorMessage("Couldn't start the camera tracker on this device.");
          setStatus("error");
        }
        return;
      }
      if (cancelled) return;

      setStatus("ready");

      /** Draws every detected face/body landmark (faint dots), the
       * ones actually used (colored), the chin→shoulder-line reference,
       * and the chin→anchor line onto a plain 2D overlay — debug-only,
       * so a bad landmark read is visually distinguishable from a bad
       * tuning-constant value instead of guessing which is wrong. */
      function drawDebugOverlay(
        allFace: { x: number; y: number }[] | undefined,
        chin: { x: number; y: number } | null,
        leftFace: { x: number; y: number } | null,
        rightFace: { x: number; y: number } | null,
        anchor: { x: number; y: number } | null,
        leftShoulder: { x: number; y: number } | null,
        rightShoulder: { x: number; y: number } | null,
        allPose: { x: number; y: number }[] | null,
      ) {
        if (!debugMode || !debugCanvasRef.current) return;
        const dctx = debugCanvasRef.current.getContext("2d");
        if (!dctx) return;
        const w = debugCanvasRef.current.width;
        const h = debugCanvasRef.current.height;
        dctx.clearRect(0, 0, w, h);
        if (allFace) {
          dctx.fillStyle = "rgba(255,255,255,0.4)";
          for (const lm of allFace) {
            dctx.beginPath();
            dctx.arc(lm.x * w, lm.y * h, 1.5, 0, Math.PI * 2);
            dctx.fill();
          }
        }
        if (allPose) {
          dctx.fillStyle = "rgba(74,222,128,0.5)";
          for (const lm of allPose) {
            dctx.beginPath();
            dctx.arc(lm.x * w, lm.y * h, 2.5, 0, Math.PI * 2);
            dctx.fill();
          }
          const bones: [number, number][] = [
            [11, 12],
            [11, 13],
            [13, 15],
            [12, 14],
            [14, 16],
            [11, 23],
            [12, 24],
            [23, 24],
          ];
          dctx.strokeStyle = "rgba(74,222,128,0.65)";
          dctx.lineWidth = 2;
          for (const [a, b] of bones) {
            const pa = allPose[a];
            const pb = allPose[b];
            if (!pa || !pb) continue;
            dctx.beginPath();
            dctx.moveTo(pa.x * w, pa.y * h);
            dctx.lineTo(pb.x * w, pb.y * h);
            dctx.stroke();
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
        if (chin) dot(chin, "#ef4444");
        if (leftFace) dot(leftFace, "#facc15");
        if (rightFace) dot(rightFace, "#facc15");
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
        if (!video || !faceLandmarker || !poseLandmarker || !renderer || !chain || !pendant) return;
        if (video.readyState < 2) return;

        let faceResult: FaceLandmarkerResult;
        let poseResult: PoseLandmarkerResult;
        try {
          faceResult = faceLandmarker.detectForVideo(video, performance.now());
          poseResult = poseLandmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }

        const faceLandmarks = faceResult.faceLandmarks[0];
        const chinLm = faceLandmarks?.[CHIN_INDEX];
        const leftFace = faceLandmarks?.[LEFT_FACE_INDEX];
        const rightFace = faceLandmarks?.[RIGHT_FACE_INDEX];
        const poseLandmarks = poseResult.landmarks[0];
        const leftShoulder = poseLandmarks?.[LEFT_SHOULDER_INDEX];
        const rightShoulder = poseLandmarks?.[RIGHT_SHOULDER_INDEX];

        if (chinLm && leftFace && rightFace && leftShoulder && rightShoulder) {
          const anchor = computeNecklaceAnchor(chinLm, leftFace, rightFace, leftShoulder, rightShoulder, aspect, neckBaseFractionRef.current, widthMultiplierRef.current);

          const chainScale = anchor.width / chainAuthoredWidth;
          chain.position.set(anchor.x, anchor.y * aspect, 0);
          chain.rotation.z = anchor.rotationRad;
          chain.scale.setScalar(chainScale);
          chain.visible = true;

          // Pendant hangs from wherever the chain's own LIVE bottom-center
          // ends up (after this frame's position/rotation/scale) — not a
          // fixed offset — so it stays attached to the chain regardless
          // of how wide/tilted it currently is. Measured fresh each
          // frame rather than computed analytically: simpler and exactly
          // right regardless of the chain's specific geometry.
          const liveChainBox = new THREE.Box3().setFromObject(chain, true);
          const bottomX = (liveChainBox.min.x + liveChainBox.max.x) / 2;
          const bottomY = liveChainBox.max.y;

          const faceWidth = anchor.width / widthMultiplierRef.current;
          const worldUnitsPerCm = faceWidth / REFERENCE_FACE_WIDTH_CM;
          const pendantWorldSize = PENDANT_TARGET_CM * worldUnitsPerCm;
          const pendantScale = pendantWorldSize / pendantAuthoredSize;
          pendant.position.set(bottomX, bottomY, 0.01);
          pendant.scale.setScalar(pendantScale);
          pendant.visible = true;

          setTracking(true);
          if (debugMarkerRef.current) {
            debugMarkerRef.current.style.left = `${anchor.x * 100}%`;
            debugMarkerRef.current.style.top = `${anchor.y * 100}%`;
            debugMarkerRef.current.style.display = "block";
          }
          drawDebugOverlay(faceLandmarks, chinLm, leftFace, rightFace, anchor, leftShoulder, rightShoulder, poseLandmarks ?? null);
        } else {
          chain.visible = false;
          pendant.visible = false;
          setTracking(false);
          if (debugMarkerRef.current) debugMarkerRef.current.style.display = "none";
          drawDebugOverlay(faceLandmarks, null, null, null, null, leftShoulder ?? null, rightShoulder ?? null, poseLandmarks ?? null);
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
              Neck base: <span className="font-mono">{neckBaseFraction.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={neckBaseFraction}
              onChange={(e) => {
                const v = Number(e.target.value);
                neckBaseFractionRef.current = v;
                setNeckBaseFraction(v);
              }}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[10px] text-white/50">0 = right at the chin, 1 = all the way down at the shoulder line.</p>

            <p className="mt-3 text-xs">
              Width: <span className="font-mono">{widthMultiplier.toFixed(2)}×</span> face width
            </p>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={widthMultiplier}
              onChange={(e) => {
                const v = Number(e.target.value);
                widthMultiplierRef.current = v;
                setWidthMultiplier(v);
              }}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[10px] text-white/50">Shrink/grow until the chain&apos;s ends land near the jaw, not spanning the whole chest.</p>

            <div className="mt-3 space-y-1 border-t border-white/20 pt-2 text-[10px] text-white/70">
              <p className="text-white/50">What the dots mean:</p>
              <p>
                <span className="text-red-500">●</span> chin &nbsp; <span className="text-yellow-400">●</span> face edges &nbsp; <span className="text-green-400">●</span> body (real tracking)
              </p>
              <p>
                <span className="text-pink-400">┄</span> chin → anchor
              </p>
              <p className="text-white/40">Faint dots = everything each tracker sees. No green = the body tracker could not start, or your upper body is not in frame.</p>
            </div>

            <p className="mt-2 text-[10px] text-white/50">Report both numbers back once the chain looks right.</p>
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
            Make sure your face and shoulders are fully in frame and well-lit.
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

/** Loads the GLB and finds its two independently-positioned parts by
 * name (see CHAIN_NODE_NAME/PENDANT_NODE_NAME) — the chain gets stretched
 * to span the live-measured neck width each frame, the pendant hangs
 * from wherever the chain's current bottom ends up, scaled to its own
 * real-world cm size. Each part's own authored size (in the model's
 * native units) is measured once here, not every frame. */
async function loadModel(url: string): Promise<{ chain: THREE.Object3D; pendant: THREE.Object3D; chainAuthoredWidth: number; pendantAuthoredSize: number }> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  const chain = root.getObjectByName(CHAIN_NODE_NAME);
  const pendant = root.getObjectByName(PENDANT_NODE_NAME);
  if (!chain || !pendant) {
    throw new Error(`Model is missing a "${CHAIN_NODE_NAME}" or "${PENDANT_NODE_NAME}" named part.`);
  }

  // `true` = precise mode: the default walks the object's own LOCAL
  // bounding box and transforms just its 8 corners by the world matrix,
  // which badly over-estimates the box for anything with a rotation in
  // its hierarchy (confirmed while building the placeholder: a
  // ~45°-rotated mesh came out ~sqrt(2)x too big that way). Precise mode
  // walks the actual vertex positions instead.
  const chainBox = new THREE.Box3().setFromObject(chain, true);
  const chainAuthoredWidth = chainBox.max.x - chainBox.min.x;
  const pendantBox = new THREE.Box3().setFromObject(pendant, true);
  const pendantAuthoredSize = Math.max(pendantBox.max.x - pendantBox.min.x, pendantBox.max.y - pendantBox.min.y);

  return { chain, pendant, chainAuthoredWidth, pendantAuthoredSize };
}
