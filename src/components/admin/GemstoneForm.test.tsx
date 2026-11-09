import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GemstoneForm } from "./GemstoneForm";
import { createGemstone } from "@/actions/catalog-admin";

// Regression: a successful "Add Gemstone" showed "Something went wrong.
// Please try again." even though the gem had been saved — the action ended
// in redirect(), which throws, and this form's try/catch treated the throw
// as a failure. The action now returns { ok: true, redirectTo } and the form
// navigates itself.

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/actions/catalog-admin", () => ({ createGemstone: vi.fn(), updateGemstone: vi.fn(), deleteGemstone: vi.fn() }));
vi.mock("@/components/providers/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
const toast = vi.fn();
vi.mock("@/components/providers/ToastProvider", () => ({ useToast: () => toast }));
// Uploads straight to storage — irrelevant to the submit flow under test.
vi.mock("@/components/admin/DraftMediaPicker", () => ({ DraftMediaPicker: () => null }));

const option = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, slug: id, ...extra });

function renderForm() {
  const view = render(
    <GemstoneForm
      minerals={[option("blue-sapphire", { hueMin: 200, hueMax: 240 })]}
      cuts={[option("round-brilliant", { category: "FACETED" })]}
      clarityGrades={[option("eye-clean")]}
      treatments={[option("unheated")]}
      origins={[option("ratnapura")]}
      certificationLabs={[]}
      shippingWeightTiers={[]}
      defaultMarket="intl"
    />,
  );
  fireEvent.change(screen.getByLabelText(/name/i, { selector: "input#name" }), { target: { value: "Ceylon Blue Sapphire" } });
  return view;
}

function submit(container: HTMLElement) {
  fireEvent.submit(container.querySelector("form")!);
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  toast.mockClear();
  vi.mocked(createGemstone).mockReset();
});

describe("GemstoneForm — creating a gemstone", () => {
  it("goes to the new gem's page on success, with no error shown", async () => {
    vi.mocked(createGemstone).mockResolvedValue({ ok: true, redirectTo: "/admin/gems/gem-new" });
    const { container } = renderForm();

    submit(container);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/gems/gem-new"));
    expect(createGemstone).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("shows the server's validation error and stays on the form", async () => {
    vi.mocked(createGemstone).mockResolvedValue({ ok: false, error: "Carat weight must be positive." });
    const { container } = renderForm();

    submit(container);

    expect(await screen.findByText("Carat weight must be positive.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("still reports a genuine failure (the request itself throwing)", async () => {
    vi.mocked(createGemstone).mockRejectedValue(new Error("network down"));
    const { container } = renderForm();

    submit(container);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
