import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "./CheckoutForm";
import { initiateRetailCheckout } from "@/actions/checkout";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string, values: { link: (chunks: string) => unknown }) => values.link(key);
    return t;
  },
}));
vi.mock("@/components/providers/MarketProvider", () => ({ useMarket: () => "lk" }));
vi.mock("@/actions/checkout", () => ({ initiateRetailCheckout: vi.fn() }));

const methods = [
  { key: "WIRE_TRANSFER" as const, status: "live" as const },
  { key: "COD" as const, status: "live" as const },
];

// Regression test for the bug this feature fixes: initiateRetailCheckout
// used to have no COD branch at all, so a COD order fell through to the
// PayHere card-charge path — the client happily posted it to PayHere's
// checkout page. Confirms the client now routes a COD result to its own
// holding page instead, exactly like it already does for WIRE_TRANSFER.
describe("CheckoutForm", () => {
  beforeEach(() => {
    push.mockClear();
    document.body.querySelectorAll("form[action]").forEach((f) => f.remove());
  });

  it("routes a COD result to /checkout/cod and never submits to PayHere", async () => {
    vi.mocked(initiateRetailCheckout).mockResolvedValue({ ok: true, method: "COD", orderRecordId: "order-1" });
    const user = userEvent.setup();

    render(<CheckoutForm methods={methods} defaultMethod="WIRE_TRANSFER" />);
    await user.type(screen.getByLabelText("firstName"), "Jane");
    await user.type(screen.getByLabelText("lastName"), "Doe");
    await user.type(screen.getByLabelText("phone"), "0771234567");
    await user.type(screen.getByLabelText("address"), "123 Main St");
    await user.type(screen.getByLabelText("city"), "Colombo");
    await user.click(screen.getByRole("radio", { name: /COD/i }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "placeOrder" }));

    expect(push).toHaveBeenCalledWith("/lk/checkout/cod?order=order-1");
    // submitToPayhere appends its own <form method="POST"> to the body —
    // confirms that never happened for a COD result. (The rendered
    // CheckoutForm itself has no "method" attribute, so this only
    // matches a form submitToPayhere would have created.)
    expect(document.body.querySelector("form[method='POST']")).toBeNull();
  });

  it("still routes a WIRE_TRANSFER result to /checkout/wire", async () => {
    vi.mocked(initiateRetailCheckout).mockResolvedValue({ ok: true, method: "WIRE_TRANSFER", orderRecordId: "order-2" });
    const user = userEvent.setup();

    render(<CheckoutForm methods={methods} defaultMethod="WIRE_TRANSFER" />);
    await user.type(screen.getByLabelText("firstName"), "Jane");
    await user.type(screen.getByLabelText("lastName"), "Doe");
    await user.type(screen.getByLabelText("phone"), "0771234567");
    await user.type(screen.getByLabelText("address"), "123 Main St");
    await user.type(screen.getByLabelText("city"), "Colombo");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "placeOrder" }));

    expect(push).toHaveBeenCalledWith("/lk/checkout/wire?order=order-2");
  });
});
