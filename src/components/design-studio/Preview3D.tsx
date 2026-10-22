"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Info } from "lucide-react";
import type { Shape } from "@/lib/design-studio/types";
import { buildPaneGroup } from "@/lib/design-studio/build-3d-scene";
import { Modal } from "@/components/ui/Modal";

/**
 * Orbit-able stylized 3D impression of the active pane's shapes — built
 * fresh from `shapes` every time this opens (see buildPaneGroup's own
 * doc comment for exactly what it does and doesn't attempt to model).
 * Deliberately labeled as an "impression," never as a preview of what
 * will actually be made — the mapping from a flat schematic sketch is a
 * stylized guess (every band becomes a plain torus, every stone a
 * generic faceted double-cone regardless of its real cut), not a
 * manufacturing-accurate reconstruction.
 */
export function Preview3D({ open, onClose, shapes }: { open: boolean; onClose: () => void; shapes: Shape[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5f1ea");

    const group = buildPaneGroup(shapes);
    setEmpty(group.children.length === 0);
    scene.add(group);

    // Frames the camera on whatever was actually built, instead of a
    // fixed distance that'd be wrong for a tiny stud vs. a wide bangle.
    const box = new THREE.Box3().setFromObject(group);
    const size = box.isEmpty() ? new THREE.Vector3(2, 2, 2) : box.getSize(new THREE.Vector3());
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.5, size.length() / 2);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(center.x + radius * 1.4, center.y + radius * 1.1, center.z + radius * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.minDistance = radius * 0.3;
    controls.maxDistance = radius * 6;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(radius * 2, radius * 3, radius * 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-radius * 2, radius, -radius * 2);
    scene.add(fill);

    let rafId = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
    };
  }, [open, shapes]);

  return (
    <Modal open={open} onClose={onClose} title="3D Impression" className="max-w-3xl">
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-charcoal/75">
        <Info size={14} className="mt-0.5 shrink-0 text-gold-deep" />
        <p>
          A stylized 3D impression of this sketch, not a manufacturing-accurate model — every band is shown as a plain
          band and every stone as a generic faceted shape regardless of its real cut. Drag to orbit, scroll to zoom.
        </p>
      </div>
      {/* containerRef stays empty as far as React is concerned — the
          effect below appends the Three.js canvas to it imperatively, so
          it must never also hold React-rendered children (the empty-state
          message lives as a sibling overlay instead, to avoid the two
          fighting over the same DOM node's children). */}
      <div className="relative h-[60vh] w-full overflow-hidden rounded-lg border border-border-subtle bg-[#f5f1ea]">
        <div ref={containerRef} className="h-full w-full" />
        {empty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-charcoal/50">
            Nothing to show yet — add a band, stone, prong, line or chain to this view first.
          </p>
        )}
      </div>
    </Modal>
  );
}
