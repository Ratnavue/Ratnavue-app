import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import {
  finalizePaidOrder, cancelPendingOrder, markOrderShipped, markOrderDelivered, ensureOrderForQuote, ensureOrderForSourcing,
  submitOrderShippingDetails, recomputeJewelryAvailability, createManualSaleOrder, createOrderFromSourcing, ensureOrderForAuctionWin,
  revertOrderToUnpaid, confirmCodDepositReceived, collectCodPaymentAndDeliver, setCodDeliveryDetails,
} from "@/lib/orders";
import { sendEmail } from "@/lib/email";
import { registerTracking } from "@/lib/track17";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), SUPPORT_EMAIL: "support@ratnavue.com", SALES_EMAIL: "sales@ratnavue.com" }));
vi.mock("@/lib/track17", () => ({ registerTracking: vi.fn() }));

const baseOrder = {
  id: "order-1",
  orderNumber: "ORD-2026-0001",
  userId: "user-1",
  market: "intl",
  currency: "USD",
  subtotal: 100,
  total: 100,
  discountCodeId: null as string | null,
  birthdayDiscountAmount: 0,
  pointsRedeemed: 0,
  status: "PENDING_PAYMENT",
  items: [] as { gemstoneId: string | null; jewelryId: string | null; jewelryVariantId?: string | null; label?: string; quantity?: number; lineTotal?: number }[],
  user: { email: "customer@example.com" },
};

function mockCommonDependencies() {
  prismaMock.loyaltySettings.findUnique.mockResolvedValue({
    id: "singleton", pointsPerCurrencyUnit: 1, pointsRedemptionValue: 0.01, minRedeemPoints: 500,
    maxRedeemPercentOfOrder: 50, referralMinOrderValue: 50, referralReferrerBonusPoints: 500,
    referralRefereeBonusPoints: 250, pointsEnabled: true, referralsEnabled: true, updatedAt: new Date(),
  } as never);
  prismaMock.commerceSettings.findUnique.mockResolvedValue({
    id: "singleton", vatPercent: 18, applyVatToInternational: false, gatewayCommissionPercent: 3.5,
    handlingFeeMarginPercent: 1, birthdayDiscountPercent: 10, usdToLkrRate: 300, updatedAt: new Date(),
  } as never);
  prismaMock.referral.findUnique.mockResolvedValue(null); // no referral to settle, by default
  prismaMock.retailCart.findUnique.mockResolvedValue(null); // no cart to clear, by default
  prismaMock.notification.create.mockResolvedValue({} as never);
  prismaMock.order.update.mockResolvedValue({} as never);
  prismaMock.user.update.mockResolvedValue({} as never);
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
}

describe("finalizePaidOrder", () => {
  beforeEach(() => {
    mockCommonDependencies();
  });

  it("is idempotent — an already-PAID order is a pure no-op, never re-runs any side effect", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    const result = await finalizePaidOrder("order-1");

    expect(result).toEqual({ alreadyPaid: true });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("marks the order PAID with a paidAt timestamp and the gateway payment id", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never);

    await finalizePaidOrder("order-1", { gatewayPaymentId: "pay_123" });

    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "PAID", paidAt: expect.any(Date), gatewayPaymentId: "pay_123" },
    });
  });

  it("flips only the gemstone/jewelry items actually on the order to SOLD", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      items: [{ gemstoneId: "gem-1", jewelryId: null }, { gemstoneId: null, jewelryId: "jew-1" }],
    } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["gem-1"] } }, data: { stockStatus: "SOLD" } });
    expect(prismaMock.jewelryPiece.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["jew-1"] } }, data: { stockStatus: "SOLD" } });
  });

  it("skips the stock-flip calls entirely when the order has no items of that kind", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never); // items: []

    await finalizePaidOrder("order-1");

    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.jewelryPiece.updateMany).not.toHaveBeenCalled();
  });

  it("sells only the chosen variant, not the whole piece, and recomputes the piece's own summary status", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      items: [{ gemstoneId: null, jewelryId: "jew-1", jewelryVariantId: "variant-1" }],
    } as never);
    prismaMock.jewelryVariant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jewelryVariant.count.mockResolvedValue(0); // no other variant still available
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.jewelryPiece.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.jewelryVariant.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["variant-1"] } }, data: { stockStatus: "SOLD" } });
    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "SOLD" } });
  });

  it("keeps a varianted piece AVAILABLE after a sale if another one of its variants still is", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      items: [{ gemstoneId: null, jewelryId: "jew-1", jewelryVariantId: "variant-1" }],
    } as never);
    prismaMock.jewelryVariant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jewelryVariant.count.mockResolvedValue(1); // e.g. a different size is still AVAILABLE
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "AVAILABLE" } });
  });

  it("finalizes a discount code redemption when one was applied at checkout", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, discountCodeId: "code-1" } as never);
    prismaMock.discountCode.findUnique.mockResolvedValue({ id: "code-1", active: true, expiresAt: null, scope: "PUBLIC", assignedUserId: null, maxUses: null, usesCount: 0 } as never);
    prismaMock.discountCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.discountCodeRedemption.create.mockResolvedValue({} as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.discountCodeRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discountCodeId: "code-1", orderId: "order-1" }) }),
    );
  });

  it("doesn't fail the whole finalization if the discount code can no longer be redeemed (best-effort)", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, discountCodeId: "code-1" } as never);
    prismaMock.discountCode.findUnique.mockResolvedValue(null); // code vanished between checkout and payment
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await finalizePaidOrder("order-1");

    expect(result).toEqual({ alreadyPaid: false });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("stamps lastBirthdayDiscountAt only when a birthday discount was actually applied to this order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, birthdayDiscountAmount: 20 } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { lastBirthdayDiscountAt: expect.any(Date) } });
  });

  it("does not stamp lastBirthdayDiscountAt when no birthday discount was applied", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, birthdayDiscountAmount: 0 } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.user.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { lastBirthdayDiscountAt: expect.any(Date) } }));
  });

  it("earns rewards points on the order's subtotal", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, subtotal: 80 } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" }, data: expect.objectContaining({ pointsBalance: { increment: 80 } }) }),
    );
  });

  it("clears the retail cart's items, discount code, and staged points when a cart exists for this order's market", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never);
    prismaMock.retailCart.findUnique.mockResolvedValue({ id: "cart-1" } as never);
    prismaMock.retailCartItem.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.retailCart.update.mockResolvedValue({} as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.retailCart.findUnique).toHaveBeenCalledWith({ where: { userId_market: { userId: "user-1", market: "intl" } } });
    expect(prismaMock.retailCartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
    expect(prismaMock.retailCart.update).toHaveBeenCalledWith({ where: { id: "cart-1" }, data: { discountCodeId: null, pointsToRedeem: 0 } });
  });

  it("skips cart-clearing entirely when the customer has no cart for that market", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never);
    // retailCart.findUnique already resolves null via mockCommonDependencies

    await finalizePaidOrder("order-1");

    expect(prismaMock.retailCartItem.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.retailCart.update).not.toHaveBeenCalled();
  });

  it("always notifies the customer that payment was received", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }) }),
    );
  });

  it("sends an order confirmation email to the customer's address with their items", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      items: [{ gemstoneId: "gem-1", jewelryId: null, label: "Blue Sapphire", quantity: 1, lineTotal: 100 }],
    } as never);

    await finalizePaidOrder("order-1");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "customer@example.com", subject: expect.stringContaining("ORD-2026-0001") }),
    );
  });

  it("does not fail the whole finalization when the confirmation email can't be sent", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder } as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "not configured" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await finalizePaidOrder("order-1");

    expect(result).toEqual({ alreadyPaid: false });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("settles a sales referral commission when the order was attributed to an active promoter", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder,
      referredByPromoterId: "promo-1",
      taxAmount: 10,
      handlingFeeAmount: 5,
    } as never);
    prismaMock.salesReferralPromoter.findUnique.mockResolvedValue({ active: true } as never);
    // settleSalesReferralCommission re-queries the order's items with cost
    // selects itself (same pattern as notifyGemDigAvailable) — a separate
    // mock from the outer findUniqueOrThrow above.
    prismaMock.order.findUnique.mockResolvedValue({
      items: [{ quantity: 1, lineTotal: 100, gemstone: { costPrice: 20 }, jewelry: null, jewelryVariant: null }],
    } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.salesReferralCommission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ promoterId: "promo-1", orderId: "order-1", profit: 65, commissionAmount: 32.5 }),
    });
  });

  it("does not settle a commission when the order was never attributed", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, referredByPromoterId: null } as never);

    await finalizePaidOrder("order-1");

    expect(prismaMock.salesReferralCommission.create).not.toHaveBeenCalled();
  });
});

describe("cancelPendingOrder", () => {
  it("no-ops for an order that isn't PENDING_PAYMENT — never resurrects a sold or already-cancelled order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID", items: [] } as never);

    const result = await cancelPendingOrder("order-1");

    expect(result).toEqual({ cancelled: false });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("cancels a pending order and releases only its RESERVED items back to AVAILABLE", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder, status: "PENDING_PAYMENT", items: [{ gemstoneId: "gem-1", jewelryId: null }],
    } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await cancelPendingOrder("order-1");

    expect(result).toEqual({ cancelled: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "CANCELLED" } });
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["gem-1"] }, stockStatus: "RESERVED" },
      data: { stockStatus: "AVAILABLE" },
    });
  });

  it("releases only a RESERVED variant back to AVAILABLE, not the whole piece, and recomputes the piece", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder, status: "PENDING_PAYMENT", items: [{ gemstoneId: null, jewelryId: "jew-1", jewelryVariantId: "variant-1" }],
    } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.jewelryVariant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jewelryVariant.count.mockResolvedValue(1);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await cancelPendingOrder("order-1");

    expect(result).toEqual({ cancelled: true });
    expect(prismaMock.jewelryPiece.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.jewelryVariant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["variant-1"] }, stockStatus: "RESERVED" },
      data: { stockStatus: "AVAILABLE" },
    });
    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "AVAILABLE" } });
  });

  it("notifies the customer by default (an admin cancelling on their behalf)", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PENDING_PAYMENT", items: [] } as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    await cancelPendingOrder("order-1");

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it("skips the notification when the customer cancels their own order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PENDING_PAYMENT", items: [] } as never);
    prismaMock.order.update.mockResolvedValue({} as never);

    await cancelPendingOrder("order-1", { notifyCustomer: false });

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe("recomputeJewelryAvailability", () => {
  it("sets a piece AVAILABLE when at least one of its variants still is", async () => {
    prismaMock.jewelryVariant.count.mockResolvedValue(2);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await recomputeJewelryAvailability(prismaMock, ["jew-1"]);

    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "AVAILABLE" } });
  });

  it("sets a piece SOLD once none of its variants are AVAILABLE (RESERVED doesn't count as buyable)", async () => {
    prismaMock.jewelryVariant.count.mockResolvedValue(0);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await recomputeJewelryAvailability(prismaMock, ["jew-1"]);

    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledWith({ where: { id: "jew-1" }, data: { stockStatus: "SOLD" } });
  });

  it("de-duplicates repeated jewelryIds (e.g. two variant lines of the same piece) into a single recompute", async () => {
    prismaMock.jewelryVariant.count.mockResolvedValue(1);
    prismaMock.jewelryPiece.update.mockResolvedValue({} as never);

    await recomputeJewelryAvailability(prismaMock, ["jew-1", "jew-1"]);

    expect(prismaMock.jewelryPiece.update).toHaveBeenCalledTimes(1);
  });
});

describe("markOrderShipped", () => {
  beforeEach(() => {
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });
    vi.mocked(registerTracking).mockResolvedValue({ ok: true });
  });

  it("refuses to ship an order that isn't PAID", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PENDING_PAYMENT" } as never);

    const result = await markOrderShipped("order-1", { carrier: "DHL", trackingNumber: "123" });

    expect(result).toEqual({ ok: false, error: "Only a paid order can be marked shipped." });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("marks a paid order shipped with the carrier/tracking details and a shippedAt timestamp", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    const result = await markOrderShipped("order-1", { carrier: "DHL Express", trackingNumber: "1Z999", trackingUrl: "https://dhl.com/track/1Z999" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "SHIPPED", carrier: "DHL Express", trackingNumber: "1Z999", trackingUrl: "https://dhl.com/track/1Z999", shippedAt: expect.any(Date) },
    });
  });

  it("registers the tracking number with 17track", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    await markOrderShipped("order-1", { carrier: "DHL", trackingNumber: "1Z999" });

    expect(registerTracking).toHaveBeenCalledWith("1Z999");
  });

  it("still succeeds even if 17track registration fails (best-effort)", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);
    vi.mocked(registerTracking).mockResolvedValue({ ok: false, error: "not configured" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await markOrderShipped("order-1", { carrier: "DHL", trackingNumber: "1Z999" });

    expect(result).toEqual({ ok: true });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("notifies the customer and sends a shipment email", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    await markOrderShipped("order-1", { carrier: "DHL", trackingNumber: "1Z999" });

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }) }),
    );
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "customer@example.com", subject: expect.stringContaining("shipped") }));
  });

  it("ships a no-deposit COD order straight from PENDING_PAYMENT — true cash-on-delivery", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder, status: "PENDING_PAYMENT", paymentMethod: "COD", codDepositRequired: false, codDepositPaidAt: null,
    } as never);

    const result = await markOrderShipped("order-1", { carrier: "Local Rider", trackingNumber: "COD-1" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SHIPPED" }) }));
  });

  it("refuses to ship a deposit-required COD order whose deposit hasn't been confirmed", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder, status: "PENDING_PAYMENT", paymentMethod: "COD", codDepositRequired: true, codDepositPaidAt: null,
    } as never);

    const result = await markOrderShipped("order-1", { carrier: "Local Rider", trackingNumber: "COD-1" });

    expect(result).toEqual({ ok: false, error: "This order needs its deposit confirmed before it can ship." });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("ships a deposit-required COD order once the deposit is confirmed", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...baseOrder, status: "PENDING_PAYMENT", paymentMethod: "COD", codDepositRequired: true, codDepositPaidAt: new Date(),
    } as never);

    const result = await markOrderShipped("order-1", { carrier: "Local Rider", trackingNumber: "COD-1" });

    expect(result).toEqual({ ok: true });
  });
});

describe("revertOrderToUnpaid", () => {
  beforeEach(() => {
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    prismaMock.chatThread.findFirst.mockResolvedValue({ id: "thread-1" } as never);
    prismaMock.chatMessage.create.mockResolvedValue({} as never);
  });

  it("refuses to revert an order that isn't PAID", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PENDING_PAYMENT" } as never);

    const result = await revertOrderToUnpaid("order-1", { byUserId: "admin-1", byUserRole: "ADMIN", reason: "Mistake" });

    expect(result).toEqual({ ok: false, error: "Only a paid order can be reverted to unpaid." });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("requires a non-blank reason", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    const result = await revertOrderToUnpaid("order-1", { byUserId: "admin-1", byUserRole: "ADMIN", reason: "   " });

    expect(result).toEqual({ ok: false, error: "A reason is required." });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("sets status PAYMENT_REVERSED with the reason and who did it, but touches nothing else", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    const result = await revertOrderToUnpaid("order-1", { byUserId: "staff-1", byUserRole: "STAFF", reason: "Bank transfer bounced" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "PAYMENT_REVERSED", paymentReversedAt: expect.any(Date), paymentReversedById: "staff-1", paymentReversedReason: "Bank transfer bounced" },
    });
    // Nothing about stock/points/discount/referral is touched — no other
    // prisma write happens beyond the order update, the chat message, and
    // the notification.
    expect(prismaMock.gemstone.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.jewelryPiece.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("posts the reason into the order's own chat thread as the acting user", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    await revertOrderToUnpaid("order-1", { byUserId: "staff-1", byUserRole: "STAFF", reason: "Bank transfer bounced" });

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: { threadId: "thread-1", senderId: "staff-1", senderRole: "STAFF", body: "Bank transfer bounced" },
    });
  });

  it("notifies the customer", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    await revertOrderToUnpaid("order-1", { byUserId: "admin-1", byUserRole: "ADMIN", reason: "Mistake" });

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }) }),
    );
  });
});

describe("markOrderDelivered", () => {
  beforeEach(() => {
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });
  });

  it("is a no-op (not an error) for an order that isn't SHIPPED — safe for a retried webhook or a double-click", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID" } as never);

    const result = await markOrderDelivered("order-1");

    expect(result).toEqual({ ok: false });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("marks a shipped order delivered with a deliveredAt timestamp", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "SHIPPED" } as never);

    const result = await markOrderDelivered("order-1", { source: "admin" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "DELIVERED", deliveredAt: expect.any(Date) } });
  });

  it("works identically whether triggered by an admin or the 17track webhook", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "SHIPPED" } as never);

    const result = await markOrderDelivered("order-1", { source: "17track" });

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("delivered") }));
  });

  it("delivers a COD order straight from PAID — true cash-on-delivery skips a separate SHIPPED-to-PAID step", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID", paymentMethod: "COD" } as never);

    const result = await markOrderDelivered("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "DELIVERED", deliveredAt: expect.any(Date) } });
  });

  it("regression: a non-COD order sitting at PAID is still refused — the COD loosening must not leak to other methods", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PAID", paymentMethod: "WIRE_TRANSFER" } as never);

    const result = await markOrderDelivered("order-1");

    expect(result).toEqual({ ok: false });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});

describe("confirmCodDepositReceived", () => {
  beforeEach(() => {
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("rejects a non-COD order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "WIRE_TRANSFER", codDepositRequired: true, codDepositPaidAt: null } as never);

    const result = await confirmCodDepositReceived("order-1");

    expect(result).toEqual({ ok: false, error: "Only a cash-on-delivery order can have a deposit confirmed." });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("rejects a COD order that doesn't require a deposit", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", codDepositRequired: false, codDepositPaidAt: null } as never);

    const result = await confirmCodDepositReceived("order-1");

    expect(result).toEqual({ ok: false, error: "This order doesn't require a deposit." });
  });

  it("sets codDepositPaidAt and notifies the customer", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", codDepositRequired: true, codDepositPaidAt: null } as never);

    const result = await confirmCodDepositReceived("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { codDepositPaidAt: expect.any(Date) } });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }) }),
    );
  });

  it("is idempotent — confirming twice is a no-op the second time", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", codDepositRequired: true, codDepositPaidAt: new Date() } as never);

    const result = await confirmCodDepositReceived("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});

describe("collectCodPaymentAndDeliver", () => {
  beforeEach(() => {
    mockCommonDependencies();
  });

  it("rejects a non-COD order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "WIRE_TRANSFER", status: "SHIPPED" } as never);

    const result = await collectCodPaymentAndDeliver("order-1");

    expect(result).toEqual({ ok: false, error: "Only a cash-on-delivery order is collected this way." });
  });

  it("refuses an order that isn't shipped or already paid", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "PENDING_PAYMENT" } as never);

    const result = await collectCodPaymentAndDeliver("order-1");

    expect(result).toEqual({ ok: false, error: "This order isn't marked shipped yet." });
  });

  it("runs the full paid pipeline and marks delivered, from SHIPPED", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "SHIPPED" } as never);

    const result = await collectCodPaymentAndDeliver("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }));
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "DELIVERED", deliveredAt: expect.any(Date) } });
  });

  it("is retryable from PAID if the delivered step failed on an earlier attempt", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "PAID" } as never);

    const result = await collectCodPaymentAndDeliver("order-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "DELIVERED", deliveredAt: expect.any(Date) } });
  });
});

describe("setCodDeliveryDetails", () => {
  beforeEach(() => {
    prismaMock.order.update.mockResolvedValue({} as never);
  });

  it("rejects a non-COD order", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "WIRE_TRANSFER", status: "SHIPPED" } as never);

    const result = await setCodDeliveryDetails("order-1", { agentName: "Kasun" });

    expect(result).toEqual({ ok: false, error: "Only a cash-on-delivery order has delivery-agent details." });
  });

  it("rejects an order still awaiting shipment", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "PENDING_PAYMENT" } as never);

    const result = await setCodDeliveryDetails("order-1", { agentName: "Kasun" });

    expect(result).toEqual({ ok: false, error: "Ship this order before adding delivery-agent details." });
  });

  it("sets all three fields", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "SHIPPED" } as never);

    const result = await setCodDeliveryDetails("order-1", { agentName: "Kasun", agentReference: "REF-1", trackingUrl: "https://example.com/track" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { codAgentName: "Kasun", codAgentReference: "REF-1", codTrackingUrl: "https://example.com/track" },
    });
  });

  it("clears a field when given a blank value", async () => {
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, paymentMethod: "COD", status: "SHIPPED" } as never);

    await setCodDeliveryDetails("order-1", { agentName: "", agentReference: "", trackingUrl: "" });

    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { codAgentName: null, codAgentReference: null, codTrackingUrl: null },
    });
  });
});

describe("ensureOrderForQuote", () => {
  const baseQuote = {
    id: "quote-1",
    userId: "user-1",
    quotedPrice: 5000,
    quantity: 1,
    gemstoneId: "gem-1",
    jewelryId: null as string | null,
    gemstone: { name: "Ceylon Blue Sapphire" },
    jewelry: null,
    configuredSpec: null,
  };

  beforeEach(() => {
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.chatThread.findFirst.mockResolvedValue(null);
    prismaMock.chatThread.create.mockResolvedValue({ id: "thread-1" } as never);
    prismaMock.chatMessage.create.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("is idempotent — an already-accepted quote returns its existing order without creating a second one", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "order-existing" } as never);

    const result = await ensureOrderForQuote("quote-1", "admin-1");

    expect(result).toEqual({ ok: true, orderId: "order-existing" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses to create an order for a quote with no price set", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.quoteRequest.findUnique.mockResolvedValue({ ...baseQuote, quotedPrice: null } as never);

    const result = await ensureOrderForQuote("quote-1", "admin-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("creates an unpaid order needing shipping details, reserves the gemstone, and notifies + messages the customer", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.quoteRequest.findUnique.mockResolvedValue(baseQuote as never);
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    const result = await ensureOrderForQuote("quote-1", "admin-1");

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          needsShippingDetails: true,
          shipName: "",
          paymentMethod: "WIRE_TRANSFER",
          quoteRequestId: "quote-1",
        }),
      }),
    );
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: "gem-1", stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
    expect(prismaMock.notification.create).toHaveBeenCalledOnce();
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ threadId: "thread-1", senderId: "admin-1", senderRole: "ADMIN" }) }),
    );
  });

  it("fails without creating anything (or notifying) if the gemstone is no longer available", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.quoteRequest.findUnique.mockResolvedValue(baseQuote as never);
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 }); // someone else already has it

    const result = await ensureOrderForQuote("quote-1", "admin-1");

    expect(result.ok).toBe(false);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });
});

describe("ensureOrderForSourcing", () => {
  beforeEach(() => {
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.chatThread.findFirst.mockResolvedValue(null);
    prismaMock.chatThread.create.mockResolvedValue({ id: "thread-1" } as never);
    prismaMock.chatMessage.create.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("creates an order for an accepted sourcing request with no stock to reserve", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.sourcingRequest.findUnique.mockResolvedValue({ id: "sourcing-1", userId: "user-1", quotedPrice: 1200, mineralDescription: "2ct rough spinel" } as never);
    prismaMock.order.create.mockResolvedValue({ id: "order-2", orderNumber: "ORD-2026-0002" } as never);

    const result = await ensureOrderForSourcing("sourcing-1", "admin-1");

    expect(result).toEqual({ ok: true, orderId: "order-2" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sourcingRequestId: "sourcing-1", needsShippingDetails: true }) }),
    );
  });
});

describe("createOrderFromSourcing", () => {
  const sourcingFixture = { id: "sourcing-1", userId: "user-1", mineralDescription: "2ct rough spinel" };

  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.sourcingRequest.findUnique.mockResolvedValue(sourcingFixture as never);
    prismaMock.order.count.mockResolvedValue(0); // nextOrderNumber
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.sourcingRequest.update.mockResolvedValue({} as never);
    prismaMock.chatThread.findFirst.mockResolvedValue(null);
    prismaMock.chatThread.create.mockResolvedValue({ id: "thread-1" } as never);
    prismaMock.chatMessage.create.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("is idempotent — an already-built order is returned without creating a second one", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "order-existing" } as never);

    const result = await createOrderFromSourcing("sourcing-1", "admin-1", [{ gemstoneId: "gem-1", unitPrice: 1000 }]);

    expect(result).toEqual({ ok: true, orderId: "order-existing" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses an empty item list", async () => {
    const result = await createOrderFromSourcing("sourcing-1", "admin-1", []);
    expect(result).toEqual({ ok: false, error: "Add at least one item." });
  });

  it("refuses an item that's no longer AVAILABLE", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Rough Spinel", market: "intl", stockStatus: "SOLD" } as never);
    const result = await createOrderFromSourcing("sourcing-1", "admin-1", [{ gemstoneId: "gem-1", unitPrice: 1000 }]);
    expect(result).toEqual({ ok: false, error: "Rough Spinel is no longer available." });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("resolves each line's real name server-side, reserves the items, marks the request ACCEPTED, and notifies the customer", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Rough Spinel", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    const result = await createOrderFromSourcing("sourcing-1", "admin-1", [{ gemstoneId: "gem-1", unitPrice: 1200 }]);

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          sourcingRequestId: "sourcing-1",
          needsShippingDetails: true,
          subtotal: 1200,
          total: 1200,
          items: { create: [expect.objectContaining({ gemstoneId: "gem-1", label: "Rough Spinel", unitPrice: 1200 })] },
        }),
      }),
    );
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["gem-1"] }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
    expect(prismaMock.sourcingRequest.update).toHaveBeenCalledWith({ where: { id: "sourcing-1" }, data: { status: "ACCEPTED" } });
    expect(prismaMock.notification.create).toHaveBeenCalledOnce();
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ threadId: "thread-1", senderId: "admin-1", senderRole: "ADMIN" }) }),
    );
  });

  it("supports multiple items on the same order", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Rough Spinel", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ id: "jew-1", name: "Custom Setting", market: "intl", stockStatus: "AVAILABLE", variants: [] } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jewelryPiece.updateMany.mockResolvedValue({ count: 1 });

    const result = await createOrderFromSourcing("sourcing-1", "admin-1", [
      { gemstoneId: "gem-1", unitPrice: 1200 },
      { jewelryId: "jew-1", unitPrice: 300 },
    ]);

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: 1500, total: 1500 }) }));
  });

  it("rolls back and returns a friendly error when an item was taken by someone else in the meantime", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Rough Spinel", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 });

    const result = await createOrderFromSourcing("sourcing-1", "admin-1", [{ gemstoneId: "gem-1", unitPrice: 1200 }]);

    expect(result).toEqual({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });
    expect(prismaMock.sourcingRequest.update).not.toHaveBeenCalled();
  });
});

describe("ensureOrderForAuctionWin", () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.order.count.mockResolvedValue(0); // nextOrderNumber
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("is idempotent — an already-created order is returned without creating a second one", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "order-existing" } as never);
    const result = await ensureOrderForAuctionWin("auction-1");
    expect(result).toEqual({ ok: true, orderId: "order-existing" });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses an auction with no bids", async () => {
    prismaMock.auction.findUnique.mockResolvedValue({ id: "auction-1", gemstoneId: "gem-1", jewelryId: null, bids: [] } as never);
    const result = await ensureOrderForAuctionWin("auction-1");
    expect(result).toEqual({ ok: false, error: "This auction has no bids to confirm." });
  });

  it("creates an unpaid order at the winning bid amount, reserves the item, and notifies the winner", async () => {
    prismaMock.auction.findUnique.mockResolvedValue({
      id: "auction-1", gemstoneId: "gem-1", jewelryId: null,
      gemstone: { name: "Ceylon Blue Sapphire" }, jewelry: null,
      bids: [{ userId: "user-1", amount: 1500 }],
    } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    const result = await ensureOrderForAuctionWin("auction-1");

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          auctionId: "auction-1",
          subtotal: 1500,
          total: 1500,
          needsShippingDetails: true,
          paymentMethod: "WIRE_TRANSFER",
          items: { create: expect.objectContaining({ gemstoneId: "gem-1", label: "Auction win: Ceylon Blue Sapphire", unitPrice: 1500 }) },
        }),
      }),
    );
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: "gem-1", stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "order", requestId: "order-1" }) }),
    );
  });

  it("rolls back and returns a friendly error when the item was taken elsewhere since bidding closed", async () => {
    prismaMock.auction.findUnique.mockResolvedValue({
      id: "auction-1", gemstoneId: "gem-1", jewelryId: null,
      gemstone: { name: "Ceylon Blue Sapphire" }, jewelry: null,
      bids: [{ userId: "user-1", amount: 1500 }],
    } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 });

    const result = await ensureOrderForAuctionWin("auction-1");

    expect(result).toEqual({ ok: false, error: "That item is no longer available to sell — it may have already been sold or reserved elsewhere." });
  });
});

describe("submitOrderShippingDetails", () => {
  const address = { shipName: "A B", shipPhone: "123", shipCountry: "US", shipCity: "NYC", shipAddressLine1: "1 Main St" };

  it("saves the address and clears needsShippingDetails", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ userId: "user-1", needsShippingDetails: true } as never);
    prismaMock.order.update.mockResolvedValue({} as never);

    const result = await submitOrderShippingDetails("order-1", "user-1", address);

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { ...address, shipAddressLine2: null, shipPostalCode: null, needsShippingDetails: false },
    });
  });

  it("refuses an order that belongs to someone else", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ userId: "someone-else", needsShippingDetails: true } as never);

    const result = await submitOrderShippingDetails("order-1", "user-1", address);

    expect(result.ok).toBe(false);
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("is a no-op for an order that doesn't need shipping details (no overwriting a real address)", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ userId: "user-1", needsShippingDetails: false } as never);

    const result = await submitOrderShippingDetails("order-1", "user-1", address);

    expect(result).toEqual({ ok: true });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});

describe("createManualSaleOrder", () => {
  const customerFixture = { id: "user-1", name: "Jane Doe", email: "jane@example.com", phone: "0771234567" };

  beforeEach(() => {
    mockCommonDependencies();
    prismaMock.user.findUnique.mockResolvedValue(customerFixture as never);
    prismaMock.order.count.mockResolvedValue(0); // nextOrderNumber
    prismaMock.order.create.mockResolvedValue({ id: "order-1", orderNumber: "ORD-2026-0001" } as never);
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, id: "order-1", status: "PENDING_PAYMENT" } as never);
  });

  it("refuses an empty item list", async () => {
    const result = await createManualSaleOrder({ customerUserId: "user-1", market: "intl", items: [], paymentMethod: "CASH" });
    expect(result).toEqual({ ok: false, error: "Add at least one item." });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses a bank-transfer sale with no payment reference or receipt", async () => {
    const result = await createManualSaleOrder({
      customerUserId: "user-1", market: "intl",
      items: [{ gemstoneId: "gem-1", unitPrice: 500 }],
      paymentMethod: "WIRE_TRANSFER",
    });
    expect(result.ok).toBe(false);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses when the customer doesn't exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await createManualSaleOrder({ customerUserId: "user-missing", market: "intl", items: [{ gemstoneId: "gem-1", unitPrice: 500 }], paymentMethod: "CASH" });
    expect(result).toEqual({ ok: false, error: "Customer not found." });
  });

  it("refuses a gemstone that's no longer AVAILABLE", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Blue Sapphire", market: "intl", stockStatus: "SOLD" } as never);
    const result = await createManualSaleOrder({ customerUserId: "user-1", market: "intl", items: [{ gemstoneId: "gem-1", unitPrice: 500 }], paymentMethod: "CASH" });
    expect(result).toEqual({ ok: false, error: "Blue Sapphire is no longer available." });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it("refuses a jewelry variant that's no longer AVAILABLE", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({
      id: "jew-1", name: "Signet Ring", market: "intl",
      variants: [{ id: "variant-1", label: "Size 7", stockStatus: "SOLD" }],
    } as never);
    const result = await createManualSaleOrder({
      customerUserId: "user-1", market: "intl",
      items: [{ jewelryId: "jew-1", jewelryVariantId: "variant-1", unitPrice: 700 }],
      paymentMethod: "CASH",
    });
    expect(result).toEqual({ ok: false, error: "Signet Ring — Size 7 is no longer available." });
  });

  it("records a cash sale: reserves the item, resolves its real name server-side, and runs the paid-order pipeline", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Blue Sapphire", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    const result = await createManualSaleOrder({
      customerUserId: "user-1", market: "intl",
      items: [{ gemstoneId: "gem-1", unitPrice: 999 }], // deliberately not the catalog's own price — a negotiated one
      paymentMethod: "CASH",
    });

    expect(result).toEqual({ ok: true, orderId: "order-1" });
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          market: "intl",
          currency: "USD",
          subtotal: 999,
          total: 999,
          paymentMethod: "CASH",
          manualSale: true,
          status: "PENDING_PAYMENT",
          items: { create: [expect.objectContaining({ gemstoneId: "gem-1", label: "Blue Sapphire", unitPrice: 999, quantity: 1, lineTotal: 999 })] },
        }),
      }),
    );
    expect(prismaMock.gemstone.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["gem-1"] }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
    // finalizePaidOrder's own pipeline actually ran (order flipped PAID, item sold)
    expect(prismaMock.order.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order-1" }, data: expect.objectContaining({ status: "PAID" }) }));
  });

  it("records the payment reference and receipt URL for a bank-transfer sale", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Blue Sapphire", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 1 });

    await createManualSaleOrder({
      customerUserId: "user-1", market: "intl",
      items: [{ gemstoneId: "gem-1", unitPrice: 500 }],
      paymentMethod: "WIRE_TRANSFER",
      paymentReference: "BANK-REF-123",
      receiptUrl: "https://storage.example/receipt.pdf",
    });

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ manualPaymentReference: "BANK-REF-123", manualReceiptUrl: "https://storage.example/receipt.pdf" }) }),
    );
  });

  it("rolls back and returns a friendly error when the item was taken by someone else in the meantime", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "gem-1", name: "Blue Sapphire", market: "intl", stockStatus: "AVAILABLE" } as never);
    prismaMock.gemstone.updateMany.mockResolvedValue({ count: 0 }); // lost the race

    const result = await createManualSaleOrder({ customerUserId: "user-1", market: "intl", items: [{ gemstoneId: "gem-1", unitPrice: 500 }], paymentMethod: "CASH" });

    expect(result).toEqual({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });
  });
});
