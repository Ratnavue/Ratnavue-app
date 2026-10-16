import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast, useOptionalToast } from "./ToastProvider";

function Trigger() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast("Saved")}>Fire Success</button>
      <button onClick={() => toast("Something went wrong", "error")}>Fire Error</button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("shows a success toast with the given message", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Fire Success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows an error-styled toast when the error variant is used", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Fire Error" }));
    expect(screen.getByRole("status")).toHaveTextContent("Something went wrong");
  });

  it("can be dismissed early via its own close button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Fire Success" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fire Success" }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("throws a clear error when useToast is used outside the provider", () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow("useToast must be used inside ToastProvider");
  });

  it("useOptionalToast returns null outside the provider instead of throwing", () => {
    function Bare() {
      const toast = useOptionalToast();
      return <p>result: {toast === null ? "null" : "not null"}</p>;
    }
    render(<Bare />);
    expect(screen.getByText("result: null")).toBeInTheDocument();
  });
});
