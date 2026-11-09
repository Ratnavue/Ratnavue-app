import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

// The label is the message key itself, so assertions read "toLight"/"toDark".
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

function clearThemeCookie() {
  document.cookie = "ratnavue-theme=; path=/; max-age=0";
}

beforeEach(() => {
  clearThemeCookie();
  document.documentElement.dataset.theme = "dark";
});

describe("ThemeToggle", () => {
  it("starts from the theme RootLayout rendered (dark → offers light)", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "toLight" })).toBeInTheDocument();
  });

  it("switches the page theme in place and remembers it in a cookie", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "toLight" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("ratnavue-theme=light");
    expect(screen.getByRole("button", { name: "toDark" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "toDark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("ratnavue-theme=dark");
  });

  it("picks up a light page rendered from a saved choice", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "toDark" })).toBeInTheDocument();
  });
});
