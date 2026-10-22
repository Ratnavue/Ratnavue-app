import * as THREE from "three";
import type { Shape } from "./types";
import { PANE_SIZE } from "./types";
import { METALS } from "./metals";
import { resolveGemColor } from "@/components/gem-visualizer/color";
import { caratToRenderScale } from "@/components/gem-visualizer/size";

// 2D pane units -> 3D world units. The pane is 400x400; this keeps a
// typical ~220-unit band at a comfortable ~2.2 world units, a sane
// default distance for a camera a few units away.
const WORLD_SCALE = 1 / 100;

function toWorld(v: number): number {
  return v * WORLD_SCALE;
}

function metalMaterial(hex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 1, roughness: 0.35 });
}

// transmission/ior/thickness give a glass-like look instead of a flat
// plastic one — THREE.Color's constructor accepts a CSS "hsl(...)"
// string directly, the same format resolveGemColor already returns.
function gemMaterial(colorCss: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: colorCss, metalness: 0, roughness: 0.05, transmission: 0.85, thickness: 0.5, ior: 1.6, clearcoat: 1 });
}

function metalOrFillMaterial(shape: Shape): THREE.MeshStandardMaterial {
  return metalMaterial(shape.metal ? METALS[shape.metal].base : shape.fill);
}

/**
 * Builds a stylized, approximate 3D impression of one pane's shapes —
 * explicitly NOT a manufacturing-accurate reconstruction (the UI that
 * renders this must say so; see Preview3D). The flat 2D sketch is read
 * as a top-down view: x/y becomes the 3D X/Z ground plane, a 2D rotation
 * becomes a rotation around Y, and every shape type maps to one fixed,
 * deliberately simple 3D primitive — never anything cut- or style-
 * specific. A shape with `hidden` set (Layers panel) is skipped, same as
 * the 2D canvas. Pure/synchronous and side-effect-free (no renderer,
 * no DOM) — every Object3D it returns is already disposable by the
 * caller once it's done with the scene.
 */
export function buildPaneGroup(shapes: Shape[]): THREE.Group {
  const group = new THREE.Group();
  for (const shape of shapes) {
    if (shape.hidden) continue;
    const obj = buildShapeObject(shape);
    if (obj) group.add(obj);
  }
  return group;
}

function buildShapeObject(shape: Shape): THREE.Object3D | null {
  const cx = toWorld(shape.x - PANE_SIZE / 2);
  const cz = toWorld(shape.y - PANE_SIZE / 2);
  const rotY = (-shape.rotation * Math.PI) / 180;

  switch (shape.type) {
    case "band": {
      const radius = toWorld(shape.w / 2);
      const tube = toWorld(Math.max(6, shape.strokeWidth * 4)) / 2;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 64), metalOrFillMaterial(shape));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(cx, 0, cz);
      return mesh;
    }

    case "stone": {
      const diameterPx = shape.gem ? 18 + caratToRenderScale(shape.gem.caratWeight) * 50 : Math.max(shape.w, shape.h);
      const r = toWorld(diameterPx) / 2;
      const crownHeight = r * 0.6;
      const pavilionHeight = r * 1.1;
      const colorCss = shape.gem ? resolveGemColor(shape.gem.hue, shape.gem.darkness, shape.gem.saturation).base : shape.fill;
      const material = gemMaterial(colorCss);

      // A generic faceted "double cone" silhouette — low radial segments
      // (8) read as cut facets without claiming to model any specific
      // cut (round, princess, pear, ...) for real.
      const crown = new THREE.Mesh(new THREE.ConeGeometry(r, crownHeight, 8), material);
      crown.position.y = pavilionHeight / 2;
      const pavilion = new THREE.Mesh(new THREE.ConeGeometry(r, pavilionHeight, 8), material);
      pavilion.rotation.x = Math.PI;
      pavilion.position.y = -pavilionHeight / 2;

      const group = new THREE.Group();
      group.add(crown, pavilion);
      group.rotation.y = rotY;
      // Sits proud of the ground plane (a band, if any, or just the
      // sketch's own flat baseline) rather than half-buried in it.
      group.position.set(cx, pavilionHeight * 0.55, cz);
      return group;
    }

    case "prong": {
      const height = toWorld(shape.h);
      const radius = toWorld(shape.w) / 2;
      // Slightly wider at the base than the tip — reads as "holding
      // something up" rather than a plain rod.
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.3, height, 8), metalOrFillMaterial(shape));
      mesh.position.set(cx, height / 2, cz);
      return mesh;
    }

    case "line": {
      const length = toWorld(shape.w);
      const thickness = toWorld(Math.max(shape.h, 3));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, thickness), metalOrFillMaterial(shape));
      mesh.rotation.y = rotY;
      mesh.position.set(cx, thickness / 2, cz);
      return mesh;
    }

    case "chain": {
      const length = toWorld(shape.w);
      const linkSize = toWorld(Math.max(shape.h, 8));
      const count = Math.max(2, Math.round(length / (linkSize * 1.4)));
      const material = metalOrFillMaterial(shape);
      const group = new THREE.Group();
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1) - 0.5;
        const link = new THREE.Mesh(new THREE.TorusGeometry(linkSize / 2, linkSize / 6, 8, 16), material);
        // Alternating link orientation, same visual logic as a real
        // chain's links alternating perpendicular to one another.
        link.rotation.x = Math.PI / 2;
        link.rotation.z = (i % 2) * (Math.PI / 2);
        link.position.set(t * length, linkSize / 4, 0);
        group.add(link);
      }
      group.rotation.y = rotY;
      group.position.set(cx, 0, cz);
      return group;
    }

    // No 3D equivalent is attempted for a text label — left out entirely
    // rather than rendering a flat, likely-illegible plane.
    case "text":
    default:
      return null;
  }
}
