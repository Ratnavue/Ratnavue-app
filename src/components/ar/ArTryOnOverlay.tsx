"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { computeNeckAnchor } from "@/lib/ar/neck-anchor";

// Pinned to the installed npm package's own version so the WASM runtime
// fetched from the CDN always matches the JS API surface this code was
// written against. Follow-up (not done this pass, see TODO.md): self-host
// these two CDN assets under this app's own domain instead of depending
// on Google's CDN at runtime.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
// The "lite" pose model — fastest variant, and shoulder landmarks are all
// this needs (not fine-grained body tracking).
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const LEFT_SHOULDER_INDEX = 11;
const RIGHT_SHOULDER_INDEX = 12;

// How big the piece renders at computeNeckAnchor's scale=1 (a "typical"
// selfie-distance shoulder width) — the model's own geometry is first
// normalized to a 1-unit bounding box (see loadModel below), then scaled
// by this constant times the live anchor scale. Tuned by eye against the
// placeholder model; revisit once this is tried against a real one.
const BASE_MODEL_SIZE = 0.22;

type Status = "starting" | "denied" | "unsupported" | "loading-model" | "ready" | "error";

export function ArTryOnOverlay({ modelUrl, pieceName, onClose }: { modelUrl: string; pieceName: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
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

      function renderFrame() {
        rafId = requestAnimationFrame(renderFrame);
        if (!video || !poseLandmarker || !renderer || !piece) return;
        if (video.readyState < 2) return;

        let result: PoseLandmarkerResult;
        try {
          result = poseLandmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }

        const landmarks = result.landmarks[0];
        const left = landmarks?.[LEFT_SHOULDER_INDEX];
        const right = landmarks?.[RIGHT_SHOULDER_INDEX];
        if (left && right) {
          const anchor = computeNeckAnchor(left, right);
          piece.position.set(anchor.x, anchor.y, 0);
          piece.rotation.z = anchor.rotationRad;
          const s = BASE_MODEL_SIZE * anchor.scale;
          piece.scale.set(s, s, s);
          piece.visible = true;
          setTracking(true);
        } else {
          piece.visible = false;
          setTracking(false);
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
      poseLandmarker?.close();
      renderer?.dispose();
    };
  }, [modelUrl]);

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

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-4">
          <p className="truncate text-sm font-medium text-white">{pieceName}</p>
          <button type="button" onClick={onClose} className="rounded-full bg-black/40 p-2 text-white" title="Close">
            <X size={20} />
          </button>
        </div>

        {status === "ready" && !tracking && (
          <p className="absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-white/90">
            Step back a little so your shoulders are in frame.
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
 * to be authored (its own units, an off-center origin, etc.) — recenters
 * on its own bounding-box center and scales its largest dimension to 1
 * world unit, so BASE_MODEL_SIZE above is the only place piece size is
 * actually tuned. */
async function loadModel(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const wrapper = new THREE.Group();
  root.position.sub(center);
  wrapper.add(root);

  const largest = Math.max(size.x, size.y, size.z, 1e-6);
  const normalizeScale = 1 / largest;
  wrapper.scale.setScalar(normalizeScale);

  return wrapper;
}
