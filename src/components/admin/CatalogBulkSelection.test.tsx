import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogBulkSelectionProvider, CatalogRowCheckbox, CatalogBulkToolbar } from "./CatalogBulkSelection";
import { bulkSetCatalogStatus } from "@/actions/catalog-admin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/actions/catalog-admin", () => ({ bulkSetCatalogStatus: vi.fn() }));

function renderTable() {
  return render(
    <CatalogBulkSelectionProvider>
      <CatalogBulkToolbar kind="gemstone" />
      <CatalogRowCheckbox id="gem-1" />
      <CatalogRowCheckbox id="gem-2" />
    </CatalogBulkSelectionProvider>,
  );
}

describe("CatalogBulkSelection", () => {
  it("shows the toolbar only once a row is checked, with the right count", async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    const [row1] = screen.getAllByLabelText("Select row");
    await user.click(row1);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("passes every checked id to the bulk action and clears selection on success", async () => {
    vi.mocked(bulkSetCatalogStatus).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderTable();

    const [row1, row2] = screen.getAllByLabelText("Select row");
    await user.click(row1);
    await user.click(row2);
    await user.click(screen.getByRole("button", { name: "Draft" }));

    expect(bulkSetCatalogStatus).toHaveBeenCalledWith("gemstone", ["gem-1", "gem-2"], "DRAFT");
    await waitFor(() => expect(screen.queryByText(/selected/)).not.toBeInTheDocument());
  });

  it("shows an error and keeps the selection when the action is declined", async () => {
    vi.mocked(bulkSetCatalogStatus).mockResolvedValue({ ok: false, error: "Nothing selected." });
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByLabelText("Select row")[0]);
    await user.click(screen.getByRole("button", { name: "Live" }));

    await waitFor(() => expect(screen.getByText("Nothing selected.")).toBeInTheDocument());
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
