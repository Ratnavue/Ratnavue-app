import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildPaneGroup } from "./build-3d-scene";
import { newShape, PANE_SIZE, type Shape } from "./types";

function at(shape: Shape, overrides: Partial<Shape>): Shape {
  return { ...shape, ...overrides };
}

describe("buildPaneGroup", () => {
  it("skips a hidden shape entirely", () => {
    const shape = at(newShape("band"), { hidden: true });
    const group = buildPaneGroup([shape]);
    expect(group.children).toHaveLength(0);
  });

  it("skips a text shape (no 3D equivalent is attempted)", () => {
    const shape = newShape("text");
    const group = buildPaneGroup([shape]);
    expect(group.children).toHaveLength(0);
  });

  it("renders a band as a flat-lying torus centered on the pane", () => {
    const shape = newShape("band"); // defaults to the pane center
    const group = buildPaneGroup([shape]);

    expect(group.children).toHaveLength(1);
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.TorusGeometry);
    expect(mesh.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(mesh.position.x).toBeCloseTo((shape.x - PANE_SIZE / 2) / 100);
    expect(mesh.position.z).toBeCloseTo((shape.y - PANE_SIZE / 2) / 100);
  });

  it("colors a metal band from METALS, not its flat 2D fill", () => {
    const shape = at(newShape("band"), { metal: "SILVER" });
    const group = buildPaneGroup([shape]);
    const mesh = group.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe("c7cdd4"); // METALS.SILVER.base
    expect(material.metalness).toBe(1);
  });

  it("falls back to the shape's flat fill when no metal is set", () => {
    const shape = at(newShape("line"), { fill: "#112233", metal: undefined });
    const group = buildPaneGroup([shape]);
    const mesh = group.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(`#${material.color.getHexString()}`).toBe("#112233");
  });

  it("renders a stone with gem data as a two-cone group, tinted by its hue", () => {
    const shape = at(newShape("stone"), { gem: { cutSlug: "round-brilliant", hue: 210, darkness: 50, saturation: 70, claritySlug: "loupe-clean", caratWeight: 1 } });
    const group = buildPaneGroup([shape]);

    expect(group.children).toHaveLength(1);
    const stoneGroup = group.children[0] as THREE.Group;
    expect(stoneGroup.children).toHaveLength(2); // crown + pavilion
    const crown = stoneGroup.children[0] as THREE.Mesh;
    expect(crown.geometry).toBeInstanceOf(THREE.ConeGeometry);
    const material = crown.material as THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBeGreaterThan(0); // glass-like, not opaque
  });

  it("renders a gemless stone's bipyramid tinted from its flat fill instead", () => {
    const shape = at(newShape("stone"), { fill: "#ff0000" });
    const group = buildPaneGroup([shape]);
    const stoneGroup = group.children[0] as THREE.Group;
    const crown = stoneGroup.children[0] as THREE.Mesh;
    const material = crown.material as THREE.MeshPhysicalMaterial;
    expect(`#${material.color.getHexString()}`).toBe("#ff0000");
  });

  it("stands a prong upright with its base at ground level", () => {
    const shape = newShape("prong");
    const group = buildPaneGroup([shape]);
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(mesh.position.y).toBeGreaterThan(0); // raised so its base sits at y=0, not centered through the ground
  });

  it("builds a chain as multiple small torus links spanning its length", () => {
    const shape = newShape("chain"); // w: 300 by default
    const group = buildPaneGroup([shape]);
    const chainGroup = group.children[0] as THREE.Group;
    expect(chainGroup.children.length).toBeGreaterThan(1);
    for (const link of chainGroup.children) {
      expect((link as THREE.Mesh).geometry).toBeInstanceOf(THREE.TorusGeometry);
    }
  });

  it("renders every non-hidden, non-text shape in a mixed pane", () => {
    const shapes = [newShape("band"), newShape("stone"), newShape("prong"), newShape("line"), newShape("chain"), newShape("text"), at(newShape("band"), { hidden: true })];
    const group = buildPaneGroup(shapes);
    expect(group.children).toHaveLength(5); // everything except the hidden band and the text label
  });
});
