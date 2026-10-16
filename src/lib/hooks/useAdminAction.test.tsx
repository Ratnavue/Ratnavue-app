import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useAdminAction } from "./useAdminAction";
import { ToastProvider } from "@/components/providers/ToastProvider";

// Regression coverage for a real bug: several admin forms called an
// action, then reset their own pending flag on the next line — fine when
// the action resolves, but skipped entirely when it *throws* instead of
// returning {ok:false}, leaving the button stuck on its loading label
// forever with no error shown. See ShipOrderForm/QuoteStatusForm/
// MarkDeliveredButton/OrderActions, all of which now go through this hook.
describe("useAdminAction", () => {
  it("resets pending and shows an error when the action rejects instead of resolving", async () => {
    const { result } = renderHook(() => useAdminAction());
    const failing = vi.fn().mockRejectedValue(new Error("network hiccup"));

    act(() => {
      result.current.run(failing);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBe("Something went wrong. Please try again.");
  });

  it("surfaces the action's own error message on {ok:false}", async () => {
    const { result } = renderHook(() => useAdminAction());
    const declined = vi.fn().mockResolvedValue({ ok: false, error: "Set a price first." });

    act(() => {
      result.current.run(declined);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBe("Set a price first.");
  });

  it("calls onSuccess and clears any prior error on {ok:true}", async () => {
    const { result } = renderHook(() => useAdminAction());
    const onSuccess = vi.fn();
    const succeeding = vi.fn().mockResolvedValue({ ok: true });

    act(() => {
      result.current.run(succeeding, onSuccess);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("still works with no ToastProvider in the tree — just skips the toast", async () => {
    const { result } = renderHook(() => useAdminAction());
    const succeeding = vi.fn().mockResolvedValue({ ok: true });

    await act(async () => {
      result.current.run(succeeding);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("fires a 'Saved' toast by default on success, when a ToastProvider is present", async () => {
    function Harness() {
      const { run } = useAdminAction();
      return <button onClick={() => run(() => Promise.resolve({ ok: true }))}>Go</button>;
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "Go" }).click();
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("fires the given successMessage instead of the default", async () => {
    function Harness() {
      const { run } = useAdminAction();
      return <button onClick={() => run(() => Promise.resolve({ ok: true }), undefined, "Order marked paid")}>Go</button>;
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "Go" }).click();
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Order marked paid");
  });

  it("does not fire a toast when the action fails", async () => {
    function Harness() {
      const { run, error } = useAdminAction();
      return (
        <>
          <button onClick={() => run(() => Promise.resolve({ ok: false, error: "Nope" }))}>Go</button>
          {error && <p>{error}</p>}
        </>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "Go" }).click();
    });

    await waitFor(() => expect(screen.getByText("Nope")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
