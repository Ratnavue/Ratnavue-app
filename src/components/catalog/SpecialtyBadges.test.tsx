import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialtyBadges } from "./SpecialtyBadges";

const LABELS: Record<string, string> = { COLOR_CHANGE: "Colour change", STAR: "Star", CATS_EYE: "Cat's eye", BI_COLOR: "Bi-colour" };
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => LABELS[key] ?? key }));

describe("SpecialtyBadges", () => {
  it("shows a tag for a colour-change gem", () => {
    render(<SpecialtyBadges specialties={["COLOR_CHANGE"]} />);
    expect(screen.getByText("Colour change")).toBeInTheDocument();
  });

  it("shows every tag, in the canonical order regardless of how they were saved", () => {
    const { container } = render(<SpecialtyBadges specialties={["BI_COLOR", "STAR", "COLOR_CHANGE"]} />);
    expect([...container.querySelectorAll("span > span")].map((el) => el.textContent)).toEqual(["Colour change", "Star", "Bi-colour"]);
  });

  it("renders nothing for an ordinary stone", () => {
    expect(render(<SpecialtyBadges specialties={[]} />).container).toBeEmptyDOMElement();
    expect(render(<SpecialtyBadges specialties={undefined} />).container).toBeEmptyDOMElement();
  });

  it("ignores values it doesn't know", () => {
    render(<SpecialtyBadges specialties={["COLOR_CHANGE", "SOMETHING_ELSE"]} />);
    expect(screen.getByText("Colour change")).toBeInTheDocument();
    expect(screen.queryByText("SOMETHING_ELSE")).not.toBeInTheDocument();
  });
});
