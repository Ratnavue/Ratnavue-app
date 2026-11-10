import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialtyBadges } from "./SpecialtyBadges";

// The storefront's translations exist for the four original tags only.
const LABELS: Record<string, string> = { COLOR_CHANGE: "Farbwechsel", STAR: "Stern", CATS_EYE: "Katzenauge", BI_COLOR: "Zweifarbig" };
vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => LABELS[key] ?? key, { has: (key: string) => key in LABELS }),
}));

const colourChange = { name: "Colour change", slug: "color-change" };

describe("SpecialtyBadges", () => {
  it("shows the translated label for one of the original tags", () => {
    render(<SpecialtyBadges specialties={[colourChange]} />);
    expect(screen.getByText("Farbwechsel")).toBeInTheDocument();
  });

  it("shows an admin-added tag by its own name", () => {
    render(<SpecialtyBadges specialties={[{ name: "Trapiche", slug: "trapiche" }]} />);
    expect(screen.getByText("Trapiche")).toBeInTheDocument();
  });

  it("keeps the order it's given (the admin's sort order, from the query)", () => {
    const { container } = render(
      <SpecialtyBadges specialties={[{ name: "Star", slug: "star" }, { name: "Trapiche", slug: "trapiche" }, colourChange]} />,
    );
    expect([...container.querySelectorAll("span > span")].map((el) => el.textContent)).toEqual(["Stern", "Trapiche", "Farbwechsel"]);
  });

  it("renders nothing for an ordinary stone", () => {
    expect(render(<SpecialtyBadges specialties={[]} />).container).toBeEmptyDOMElement();
    expect(render(<SpecialtyBadges specialties={undefined} />).container).toBeEmptyDOMElement();
  });
});
