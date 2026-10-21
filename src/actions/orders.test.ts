import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import {
  cancelOrderAsAdmin, markOrderShippedByAdmin, markOrderDeliveredByAdmin, markOrderPaid, revertOrderToUnpaidAction,
  clearPointsApproval, clearShippingToBeArranged, confirmCodDepositReceivedByAdmin, markCodCollectedByAdmin,
  setCodDeliveryDetailsByAdmin, cancelMyCodOrder,
} from "@/actions/orders";
import {
  markOrderShipped, markOrderDelivered, finalizePaidOrder, revertOrderToUnpaid, cancelPendingOrder,
  confirmCodDepositReceived, collectCodPaymentAndDeliver, setCodDeliveryDetails,
} from "@/lib/orders";
import { requireMarketAccess } from "@/lib/rbac";
import { auth } from "@/lib/auth";

const mockedAuth = auth as unknown as { mockResolvedValue: (v: { user: { id: string } } | null) => void };

vi.mock("@/lib/rbac", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
  requireStaffArea: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", staffMarketScope: null }),
  requireMarketAccess: vi.fn().mockResolvedValue(undefined),
}));
// src/actions/orders.ts also imports `auth` from "@/lib/auth" (used by
// cancelMyWireOrder/cancelMyCodOrder) — mocked so this file never pulls
// in the real NextAuth config/providers.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/orders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders")>();
  return {
    ...actual,
    markOrderShipped: vi.fn(), markOrderDelivered: vi.fn(), finalizePaidOrder: vi.fn(), revertOrderToUnpaid: vi.fn(), cancelPendingOrder: vi.fn(),
    confirmCodDepositReceived: vi.fn(), collectCodPaymentAndDeliver: vi.fn(), setCodDeliveryDetails: vi.fn(),
  };
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("markOrderShippedByAdmin", () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);
  });

  it("rejects a missing carrier or tracking number before calling the lifecycle function", async () => {
    const result = await markOrderShippedByAdmin("order-1", formData({ carrier: "", trackingNumber: "" }));
    expect(result.ok).toBe(false);
    expect(markOrderShipped).not.toHaveBeenCalled();
  });

  it("rejects an invalid tracking URL", async () => {
    const result = await markOrderShippedByAdmin("order-1", formData({ carrier: "DHL", trackingNumber: "123", trackingUrl: "not-a-url" }));
    expect(result.ok).toBe(false);
    expect(markOrderShipped).not.toHaveBeenCalled();
  });

  it("calls markOrderShipped with the validated fields and succeeds", async () => {
    vi.mocked(markOrderShipped).mockResolvedValue({ ok: true });
    const result = await markOrderShippedByAdmin("order-1", formData({ carrier: "DHL Express", trackingNumber: "1Z999" }));
    expect(result).toEqual({ ok: true });
    expect(markOrderShipped).toHaveBeenCalledWith("order-1", { carrier: "DHL Express", trackingNumber: "1Z999", trackingUrl: undefined });
  });

  it("surfaces the lifecycle function's own error (e.g. order not PAID)", async () => {
    vi.mocked(markOrderShipped).mockResolvedValue({ ok: false, error: "Only a paid order can be marked shipped." });
    const result = await markOrderShippedByAdmin("order-1", formData({ carrier: "DHL", trackingNumber: "1Z999" }));
    expect(result).toEqual({ ok: false, error: "Only a paid order can be marked shipped." });
  });
});

describe("markOrderDeliveredByAdmin", () => {
  it("calls markOrderDelivered with source: admin", async () => {
    vi.mocked(markOrderDelivered).mockResolvedValue({ ok: true });
    const result = await markOrderDeliveredByAdmin("order-1");
    expect(result).toEqual({ ok: true });
    expect(markOrderDelivered).toHaveBeenCalledWith("order-1", { source: "admin" });
  });

  it("returns a clean error when the order isn't shipped yet", async () => {
    vi.mocked(markOrderDelivered).mockResolvedValue({ ok: false });
    const result = await markOrderDeliveredByAdmin("order-1");
    expect(result).toEqual({ ok: false, error: "This order isn't marked shipped yet." });
  });
});

describe("clearPointsApproval", () => {
  it("clears the flag without touching anything else about the order", async () => {
    prismaMock.order.update.mockResolvedValue({} as never);
    const result = await clearPointsApproval("order-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { needsPointsApproval: false } });
  });
});

describe("clearShippingToBeArranged", () => {
  it("clears the flag without touching anything else about the order", async () => {
    prismaMock.order.update.mockResolvedValue({} as never);
    const result = await clearShippingToBeArranged("order-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { shippingToBeArranged: false } });
  });
});

describe("markOrderPaid", () => {
  it("returns a clean error when the order doesn't exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await markOrderPaid("order-1");
    expect(result).toEqual({ ok: false, error: "Order not found." });
    expect(requireMarketAccess).not.toHaveBeenCalled();
  });

  it("re-checks market access against the order's own market before doing anything else", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING_PAYMENT", paymentMethod: "WIRE_TRANSFER", needsShippingDetails: false, market: "lk" } as never);
    vi.mocked(requireMarketAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(markOrderPaid("order-1")).rejects.toThrow("FORBIDDEN");
    expect(requireMarketAccess).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN", staffMarketScope: null }, "lk");
    expect(finalizePaidOrder).not.toHaveBeenCalled();
  });

  it("finalizes a pending bank-transfer order with shipping details already on file", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING_PAYMENT", paymentMethod: "WIRE_TRANSFER", needsShippingDetails: false, market: "intl" } as never);
    vi.mocked(finalizePaidOrder).mockResolvedValue({ alreadyPaid: false });

    const result = await markOrderPaid("order-1");

    expect(result).toEqual({ ok: true });
    expect(finalizePaidOrder).toHaveBeenCalledWith("order-1");
  });

  it("refuses a card order (only bank-transfer orders can be marked paid by hand)", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING_PAYMENT", paymentMethod: "PAYHERE_CARD", needsShippingDetails: false, market: "intl" } as never);
    const result = await markOrderPaid("order-1");
    expect(result).toEqual({ ok: false, error: "Only bank-transfer orders can be marked paid by hand." });
  });
});

describe("revertOrderToUnpaidAction", () => {
  it("returns a clean error when the order doesn't exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await revertOrderToUnpaidAction("order-1", formData({ reason: "Mistake" }));
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("re-checks market access against the order's own market", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(requireMarketAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(revertOrderToUnpaidAction("order-1", formData({ reason: "Mistake" }))).rejects.toThrow("FORBIDDEN");
    expect(requireMarketAccess).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN", staffMarketScope: null }, "lk");
  });

  it("rejects a blank reason before calling the lifecycle function", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);
    const result = await revertOrderToUnpaidAction("order-1", formData({ reason: "   " }));
    expect(result).toEqual({ ok: false, error: "A reason is required." });
    expect(revertOrderToUnpaid).not.toHaveBeenCalled();
  });

  it("passes the acting user's id/role and the reason through to the lifecycle function", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);
    vi.mocked(revertOrderToUnpaid).mockResolvedValue({ ok: true });

    const result = await revertOrderToUnpaidAction("order-1", formData({ reason: "Bank transfer bounced" }));

    expect(result).toEqual({ ok: true });
    expect(revertOrderToUnpaid).toHaveBeenCalledWith("order-1", { byUserId: "admin-1", byUserRole: "ADMIN", reason: "Bank transfer bounced" });
  });

  it("surfaces the lifecycle function's own error", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);
    vi.mocked(revertOrderToUnpaid).mockResolvedValue({ ok: false, error: "Only a paid order can be reverted to unpaid." });

    const result = await revertOrderToUnpaidAction("order-1", formData({ reason: "Mistake" }));

    expect(result).toEqual({ ok: false, error: "Only a paid order can be reverted to unpaid." });
  });
});

describe("cancelOrderAsAdmin", () => {
  it("marks a WON auction EXPIRED when cancelling its unpaid order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ auctionId: "auction-1" } as never);
    vi.mocked(cancelPendingOrder).mockResolvedValue({ cancelled: true });
    prismaMock.auction.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await cancelOrderAsAdmin("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.auction.updateMany).toHaveBeenCalledWith({ where: { id: "auction-1", status: "WON" }, data: { status: "EXPIRED" } });
  });

  it("leaves auctions alone for an ordinary order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ auctionId: null } as never);
    vi.mocked(cancelPendingOrder).mockResolvedValue({ cancelled: true });

    const result = await cancelOrderAsAdmin("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.auction.updateMany).not.toHaveBeenCalled();
  });

  it("doesn't touch the auction when the order wasn't cancellable", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ auctionId: "auction-1" } as never);
    vi.mocked(cancelPendingOrder).mockResolvedValue({ cancelled: false });

    const result = await cancelOrderAsAdmin("order-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.auction.updateMany).not.toHaveBeenCalled();
  });
});

describe("confirmCodDepositReceivedByAdmin", () => {
  it("returns a clean error when the order doesn't exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await confirmCodDepositReceivedByAdmin("order-1");
    expect(result).toEqual({ ok: false, error: "Order not found." });
    expect(requireMarketAccess).not.toHaveBeenCalled();
  });

  it("re-checks market access against the order's own market", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(requireMarketAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(confirmCodDepositReceivedByAdmin("order-1")).rejects.toThrow("FORBIDDEN");
    expect(confirmCodDepositReceived).not.toHaveBeenCalled();
  });

  it("confirms the deposit and succeeds", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(confirmCodDepositReceived).mockResolvedValue({ ok: true });

    const result = await confirmCodDepositReceivedByAdmin("order-1");

    expect(result).toEqual({ ok: true });
    expect(confirmCodDepositReceived).toHaveBeenCalledWith("order-1");
  });

  it("surfaces the lifecycle function's own error", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(confirmCodDepositReceived).mockResolvedValue({ ok: false, error: "This order doesn't require a deposit." });

    const result = await confirmCodDepositReceivedByAdmin("order-1");

    expect(result).toEqual({ ok: false, error: "This order doesn't require a deposit." });
  });
});

describe("markCodCollectedByAdmin", () => {
  it("returns a clean error when the order doesn't exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await markCodCollectedByAdmin("order-1");
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("re-checks market access against the order's own market", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(requireMarketAccess).mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(markCodCollectedByAdmin("order-1")).rejects.toThrow("FORBIDDEN");
    expect(collectCodPaymentAndDeliver).not.toHaveBeenCalled();
  });

  it("collects payment and succeeds — usable by staff, same scope as confirming a wire transfer", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(collectCodPaymentAndDeliver).mockResolvedValue({ ok: true });

    const result = await markCodCollectedByAdmin("order-1");

    expect(result).toEqual({ ok: true });
    expect(collectCodPaymentAndDeliver).toHaveBeenCalledWith("order-1");
  });

  it("surfaces the lifecycle function's own error", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(collectCodPaymentAndDeliver).mockResolvedValue({ ok: false, error: "This order isn't marked shipped yet." });

    const result = await markCodCollectedByAdmin("order-1");

    expect(result).toEqual({ ok: false, error: "This order isn't marked shipped yet." });
  });
});

describe("setCodDeliveryDetailsByAdmin", () => {
  it("returns a clean error when the order doesn't exist", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await setCodDeliveryDetailsByAdmin("order-1", formData({ agentName: "Kasun" }));
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("rejects an invalid tracking URL before calling the lifecycle function", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    const result = await setCodDeliveryDetailsByAdmin("order-1", formData({ trackingUrl: "not-a-url" }));
    expect(result.ok).toBe(false);
    expect(setCodDeliveryDetails).not.toHaveBeenCalled();
  });

  it("validates and saves the details", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);
    vi.mocked(setCodDeliveryDetails).mockResolvedValue({ ok: true });

    const result = await setCodDeliveryDetailsByAdmin("order-1", formData({ agentName: "Kasun", agentReference: "REF-1", trackingUrl: "https://example.com/track" }));

    expect(result).toEqual({ ok: true });
    expect(setCodDeliveryDetails).toHaveBeenCalledWith("order-1", { agentName: "Kasun", agentReference: "REF-1", trackingUrl: "https://example.com/track" });
  });
});

describe("cancelMyCodOrder", () => {
  it("requires sign-in", async () => {
    mockedAuth.mockResolvedValue(null);
    const result = await cancelMyCodOrder("order-1");
    expect(result).toEqual({ ok: false, error: "Sign in required." });
  });

  it("refuses an order that doesn't belong to the signed-in user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.order.findUnique.mockResolvedValue({ userId: "someone-else", paymentMethod: "COD", codDepositPaidAt: null } as never);

    const result = await cancelMyCodOrder("order-1");

    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("refuses a non-COD order", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.order.findUnique.mockResolvedValue({ userId: "user-1", paymentMethod: "WIRE_TRANSFER", codDepositPaidAt: null } as never);

    const result = await cancelMyCodOrder("order-1");

    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("refuses once the deposit has already been received", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.order.findUnique.mockResolvedValue({ userId: "user-1", paymentMethod: "COD", codDepositPaidAt: new Date() } as never);

    const result = await cancelMyCodOrder("order-1");

    expect(result).toEqual({ ok: false, error: "Your deposit has already been received — please contact us to cancel this order." });
    expect(cancelPendingOrder).not.toHaveBeenCalled();
  });

  it("cancels an order with no deposit received", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.order.findUnique.mockResolvedValue({ userId: "user-1", paymentMethod: "COD", codDepositPaidAt: null } as never);
    vi.mocked(cancelPendingOrder).mockResolvedValue({ cancelled: true });

    const result = await cancelMyCodOrder("order-1");

    expect(result).toEqual({ ok: true });
    expect(cancelPendingOrder).toHaveBeenCalledWith("order-1", { notifyCustomer: false });
  });
});
