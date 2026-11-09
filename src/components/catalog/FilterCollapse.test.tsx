import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterCollapse } from "./FilterCollapse";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => ({ showFilters: "Show filters", hideFilters: "Hide filters" })[key] ?? key }));

// jsdom loads no stylesheet, so Tailwind's "hidden" can't be checked with
// toBeVisible — assert on the panel's class instead.
const panel = () => screen.getByLabelText("Mineral").closest("div")!;

function renderCollapse(activeCount = 0) {
  return render(
    <form>
      <FilterCollapse activeCount={activeCount}>
        <label>
          Mineral
          <input type="checkbox" name="mineral" value="ruby" defaultChecked />
        </label>
      </FilterCollapse>
    </form>,
  );
}

describe("FilterCollapse", () => {
  it("starts collapsed, with the panel hidden", () => {
    renderCollapse();
    const button = screen.getByRole("button", { name: /show filters/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toHaveClass("hidden");
  });

  it("shows the filters when the button is clicked, and hides them again", async () => {
    const user = userEvent.setup();
    renderCollapse();

    await user.click(screen.getByRole("button", { name: /show filters/i }));
    expect(panel()).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: /hide filters/i })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /hide filters/i }));
    expect(panel()).toHaveClass("hidden");
  });

  it("keeps collapsed inputs in the form, so chosen filters still submit", () => {
    const { container } = renderCollapse();
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("mineral")).toBe("ruby");
  });

  it("badges how many filters are applied, and shows no badge when none are", () => {
    renderCollapse(3);
    expect(screen.getByRole("button", { name: /show filters/i })).toHaveTextContent("3");
  });

  it("shows no badge with nothing applied", () => {
    renderCollapse(0);
    expect(screen.getByRole("button", { name: /show filters/i }).textContent).toBe("Show filters");
  });
});
