import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StylizedGem, shapeForCut } from "./StylizedGem";

describe("shapeForCut", () => {
  it("maps square-ish cuts to the cushion silhouette", () => {
    for (const slug of ["cushion", "princess", "emerald-cut", "asscher", "radiant", "baguette"]) {
      expect(shapeForCut(slug)).toBe("cushion");
    }
  });

  it("maps elongated cuts to the oval silhouette", () => {
    for (const slug of ["oval", "pear", "marquise", "heart"]) {
      expect(shapeForCut(slug)).toBe("oval");
    }
  });

  it("treats everything else as round, and no cut as oval", () => {
    expect(shapeForCut("round-brilliant")).toBe("round");
    expect(shapeForCut("cabochon")).toBe("round");
    expect(shapeForCut(undefined)).toBe("oval");
  });
});

describe("StylizedGem", () => {
  it("renders a decorative SVG filled with the given colour", () => {
    const { container } = render(<StylizedGem color="#5b7cc9" shape="cushion" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden");
    expect(container.querySelector('rect[fill="#5b7cc9"]')).not.toBeNull();
    // Cushion clips with a rounded rect rather than an ellipse.
    expect(container.querySelector("clipPath rect")).not.toBeNull();
  });

  it("can omit the floor shadow", () => {
    const withShadow = render(<StylizedGem color="#c23a52" />).container.querySelectorAll("ellipse").length;
    const without = render(<StylizedGem color="#c23a52" shadow={false} />).container.querySelectorAll("ellipse").length;
    expect(without).toBe(withShadow - 1);
  });
});
