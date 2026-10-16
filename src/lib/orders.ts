import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { finalizeDiscountRedemption } from "@/lib/discount-codes";
import { createNotification } from "@/lib/notifications";
import { settlePointsForPaidOrder, settleReferralForPaidOrder } from "@/lib/rewards";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail, shipmentStatusEmail } from "@/lib/email-templates";
import { registerTracking } from "@/lib/track17";
import { withMarket, type Market } from "@/lib/market-shared";
import { quoteItemLabel } from "@/lib/cart";
import { getOrCreateChatThread } from "@/lib/chat";
import { notifyGemDigAvailable } from "@/lib/gem-dig";
import { notifyReviewPromptAvailable } from "@/lib/reviews";
import { settleSalesReferralCommission } from "@/lib/sales-referrals";

// Order lifecycle steps shared by every way an order gets settled: PayHere's
// notify webhook (card) and an admin confirming a bank transfer landed
// (wire). Kept in one place so the two can't drift on what "paid" means.

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * A jewelry piece with variants has no real stock of its own — each
 * variant does (see JewelryVariant) — but the piece's own `stockStatus`
 * column is kept as a derived "is anything under this piece still
 * buyable" summary (AVAILABLE if any variant still is, else SOLD; a
 * RESERVED-only variant doesn't count as buyable) purely so every
 * existing catalog/related-items/listing query that filters on
 * `stockStatus` keeps working unchanged for a varianted piece, without
 * having to learn about variants itself. Called after any variant's
 * stockStatus changes (reserve, release, sell) for pieces that have
 * variants; never called for a piece with none, whose own stockStatus
 * stays exactly as direct as before this feature existed.
 */
export async function recomputeJewelryAvailability(tx: Tx, jewelryIds: string[]): Promise<void> {
  for (const jewelryId of [...new Set(jewelryIds)]) {
    const available = await tx.jewelryVariant.count({ where: { jewelryId, stockStatus: "AVAILABLE" } });
    await tx.jewelryPiece.update({ where: { id: jewelryId }, data: { stockStatus: available > 0 ? "AVAILABLE" : "SOLD" } });
  }
}

// Sequential per calendar year (ORD-2026-0007, ...) — same convention as
// nextInvoiceNumber/nextCartInvoiceNumber in lib/invoicing.ts.
export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const count = await prisma.order.count({ where: { orderNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/**
 * Marks an order PAID and runs everything that follows from that: items
 * SOLD, discount-code redemption, the birthday-discount stamp, and clearing
 * the customer's cart for that market. Idempotent — an already-PAID order
 * returns without touching anything (PayHere retries its notification, and
 * an admin can double-click).
 *
 * Every gemstone/jewelry piece here is one-of-a-kind (see StockStatus) —
 * flipping it to SOLD is what closes the loop the checkout-time availability
 * re-check (buildCheckoutBreakdown) depends on.
 */
export async function finalizePaidOrder(orderId: string, payment: { gatewayPaymentId?: string } = {}): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, user: { select: { email: true } } } });
  if (order.status === "PAID") return { alreadyPaid: true };

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date(), gatewayPaymentId: payment.gatewayPaymentId },
  });

  const gemstoneIds = order.items.map((i) => i.gemstoneId).filter((id): id is string => id != null);
  // Split jewelry items by whether they're for a specific variant — a
  // variant purchase sells only that variant (recomputeJewelryAvailability
  // then derives the parent piece's own summary from what's left), a
  // plain piece's own stockStatus is the real thing being sold.
  const variantJewelryItems = order.items.filter((i) => i.jewelryVariantId != null);
  const plainJewelryIds = order.items.filter((i) => i.jewelryId != null && i.jewelryVariantId == null).map((i) => i.jewelryId!);
  if (gemstoneIds.length > 0) {
    await prisma.gemstone.updateMany({ where: { id: { in: gemstoneIds } }, data: { stockStatus: "SOLD" } });
  }
  if (plainJewelryIds.length > 0) {
    await prisma.jewelryPiece.updateMany({ where: { id: { in: plainJewelryIds } }, data: { stockStatus: "SOLD" } });
  }
  if (variantJewelryItems.length > 0) {
    await prisma.jewelryVariant.updateMany({ where: { id: { in: variantJewelryItems.map((i) => i.jewelryVariantId!) } }, data: { stockStatus: "SOLD" } });
    await recomputeJewelryAvailability(prisma, variantJewelryItems.map((i) => i.jewelryId!));
  }

  if (order.discountCodeId) {
    // Best-effort — a code going bad between checkout and payment
    // (expired, disabled, hit its limit via a race with another
    // customer) shouldn't block or reverse an already-taken payment;
    // it just isn't counted as a redemption.
    const result = await finalizeDiscountRedemption({ discountCodeId: order.discountCodeId, userId: order.userId, orderId: order.id });
    if (!result.ok) console.warn(`Order ${order.orderNumber}: discount code redemption not finalized: ${result.error}`);
  }

  if (order.birthdayDiscountAmount > 0) {
    await prisma.user.update({ where: { id: order.userId }, data: { lastBirthdayDiscountAt: new Date() } });
  }

  // Rewards: earn points on the subtotal, claim any points redeemed at
  // checkout, and pay out a referral bonus if this is the referee's first
  // qualifying order — see lib/rewards.ts for why each step is best-effort
  // rather than something that can fail this whole function. Settings are
  // read once here, before either transaction opens, rather than inside
  // one — every extra query inside an interactive transaction is extra
  // time the DB connection sits open, and this app's DB round-trip is slow
  // enough (a remote pooler) that pulling settings in mid-transaction blew
  // the default 5s interactive-transaction timeout during testing. Two
  // small transactions rather than one combined one, for the same reason
  // — each comfortably clears the raised timeout below even on a slow
  // connection.
  const rewardsSettings = { loyalty: await getLoyaltySettings(), commerce: await getCommerceSettings() };
  const REWARDS_TX_OPTS = { timeout: 15000 };
  await prisma.$transaction(
    (tx) => settlePointsForPaidOrder(tx, { id: order.id, userId: order.userId, currency: order.currency, subtotal: order.subtotal, pointsRedeemed: order.pointsRedeemed }, rewardsSettings),
    REWARDS_TX_OPTS,
  );
  const settledReferral = await prisma.$transaction(
    (tx) => settleReferralForPaidOrder(tx, { id: order.id, userId: order.userId, currency: order.currency, subtotal: order.subtotal }, rewardsSettings),
    REWARDS_TX_OPTS,
  );

  if (settledReferral) {
    await createNotification({
      userId: settledReferral.referrerId,
      type: "STATUS_CHANGE",
      message: `Your referral just placed their first order — you've earned ${settledReferral.referrerBonus} rewards points.`,
      requestType: "referral",
      requestId: settledReferral.referralId,
    });
    await createNotification({
      userId: settledReferral.refereeId,
      type: "STATUS_CHANGE",
      message: `You've earned ${settledReferral.refereeBonus} bonus rewards points for your first order.`,
      requestType: "referral",
      requestId: settledReferral.referralId,
    });
  }

  // Sales referral (affiliate) commission — see lib/sales-referrals.ts.
  // Separate from the rewards settlement above (different program,
  // different beneficiary): best-effort, and a no-op unless this order
  // was actually attributed to an active promoter with real profit.
  await settleSalesReferralCommission({
    id: order.id,
    referredByPromoterId: order.referredByPromoterId,
    currency: order.currency,
    total: order.total,
    taxAmount: order.taxAmount,
    handlingFeeAmount: order.handlingFeeAmount,
    paidAt: new Date(),
  });

  // Empty the retail cart now that it's been paid for — a fresh one is
  // implicitly available for the next purchase (getOrCreateRetailCart).
  // Also clears discountCodeId: leaving a just-redeemed (possibly now
  // exhausted or expired) code attached would make it look "still
  // applied" the moment the customer adds a new item to their now-empty
  // cart.
  const cart = await prisma.retailCart.findUnique({ where: { userId_market: { userId: order.userId, market: order.market } } });
  if (cart) {
    await prisma.retailCartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.retailCart.update({ where: { id: cart.id }, data: { discountCodeId: null, pointsToRedeem: 0 } });
  }

  // Always fires — unlike a chat reply or a status an admin sets by hand,
  // "paid" is never something the customer themselves just did (the webhook
  // and an admin's "Mark paid" are the only two callers), so there's no
  // "don't notify me about my own action" case to skip here.
  await createNotification({
    userId: order.userId,
    type: "STATUS_CHANGE",
    message: `Payment received for order ${order.orderNumber} — we're preparing it for delivery.`,
    requestType: "order",
    requestId: order.id,
  });

  // Best-effort, one-time "dig for a bonus gem" reward game — silently
  // skipped when the order has no real profit to draw the bonus from
  // (see isGemDigEligible in lib/gem-dig.ts).
  await notifyGemDigAvailable({ id: order.id, userId: order.userId });

  // Best-effort — a paid order with nothing reviewable yet (e.g. every
  // item already reviewed from an earlier partial payment path) is
  // silently skipped rather than prompting for an empty list.
  await notifyReviewPromptAvailable({ id: order.id, userId: order.userId });

  // Best-effort, same as every other email send in this app — a customer
  // who isn't currently signed in and checking the bell still learns their
  // payment went through, but a misconfigured/down email provider must
  // never fail an already-successful payment.
  const orderUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket(`/account/orders/${order.id}`, order.market as Market)}`;
  const { subject, html, text } = orderConfirmationEmail({
    orderNumber: order.orderNumber,
    currency: order.currency === "LKR" ? "LKR" : "USD",
    total: order.total,
    items: order.items.map((item) => ({ label: item.label, quantity: item.quantity, lineTotal: item.lineTotal })),
    orderUrl,
  });
  const emailResult = await sendEmail({ to: order.user.email, subject, html, text });
  if (!emailResult.ok) console.warn(`Order confirmation email not sent for order ${order.orderNumber}: ${emailResult.error}`);

  return { alreadyPaid: false };
}

/**
 * Cancels an order that's still awaiting payment, and hands back any items
 * a bank-transfer order was holding (RESERVED -> AVAILABLE; a card order
 * never reserves, so this is a no-op for it). Only touches items still
 * RESERVED — never resurrects one that has since been sold some other way.
 * The customer's cart is left alone so they can retry.
 *
 * `notifyCustomer` defaults to true (an admin cancelling on the customer's
 * behalf) — pass false when the customer is cancelling their own order (see
 * actions/orders.ts's cancelMyWireOrder), matching the "never notify someone
 * about their own action" rule every other notification here follows.
 */
export async function cancelPendingOrder(orderId: string, options: { notifyCustomer?: boolean } = {}): Promise<{ cancelled: boolean }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.status !== "PENDING_PAYMENT") return { cancelled: false };

  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

  const gemstoneIds = order.items.map((i) => i.gemstoneId).filter((id): id is string => id != null);
  const variantJewelryItems = order.items.filter((i) => i.jewelryVariantId != null);
  const plainJewelryIds = order.items.filter((i) => i.jewelryId != null && i.jewelryVariantId == null).map((i) => i.jewelryId!);
  if (gemstoneIds.length > 0) {
    await prisma.gemstone.updateMany({ where: { id: { in: gemstoneIds }, stockStatus: "RESERVED" }, data: { stockStatus: "AVAILABLE" } });
  }
  if (plainJewelryIds.length > 0) {
    await prisma.jewelryPiece.updateMany({ where: { id: { in: plainJewelryIds }, stockStatus: "RESERVED" }, data: { stockStatus: "AVAILABLE" } });
  }
  if (variantJewelryItems.length > 0) {
    await prisma.jewelryVariant.updateMany({ where: { id: { in: variantJewelryItems.map((i) => i.jewelryVariantId!) }, stockStatus: "RESERVED" }, data: { stockStatus: "AVAILABLE" } });
    await recomputeJewelryAvailability(prisma, variantJewelryItems.map((i) => i.jewelryId!));
  }

  if (options.notifyCustomer ?? true) {
    await createNotification({
      userId: order.userId,
      type: "STATUS_CHANGE",
      message: `Order ${order.orderNumber} has been cancelled and its items released.`,
      requestType: "order",
      requestId: order.id,
    });
  }

  return { cancelled: true };
}

/**
 * Moves a PAID order to SHIPPED — an admin's manual entry of the carrier
 * and tracking number (see actions/orders.ts's markOrderShippedByAdmin).
 * If a 17track API key is configured, the tracking number is also
 * registered with them best-effort (lib/track17.ts) — their webhook
 * (app/api/17track/webhook) can then advance the order straight to
 * DELIVERED automatically; without one, an admin marks it delivered by
 * hand from the same place they marked it shipped.
 */
export async function markOrderShipped(
  orderId: string,
  input: { carrier: string; trackingNumber: string; trackingUrl?: string },
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: { select: { email: true } } } });
  if (order.status !== "PAID") return { ok: false, error: "Only a paid order can be marked shipped." };

  const shippedAt = new Date();
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "SHIPPED", carrier: input.carrier, trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl || null, shippedAt },
  });

  const registerResult = await registerTracking(input.trackingNumber);
  if (!registerResult.ok) console.warn(`Order ${order.orderNumber}: tracking number not registered with 17track: ${registerResult.error}`);

  const orderUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket(`/account/orders/${order.id}`, order.market as Market)}`;
  await createNotification({
    userId: order.userId,
    type: "STATUS_CHANGE",
    message: `Order ${order.orderNumber} has shipped${input.carrier ? ` via ${input.carrier}` : ""}.`,
    requestType: "order",
    requestId: order.id,
  });
  const { subject, html, text } = shipmentStatusEmail({
    orderNumber: order.orderNumber, status: "SHIPPED", carrier: input.carrier, trackingNumber: input.trackingNumber, orderUrl,
  });
  const emailResult = await sendEmail({ to: order.user.email, subject, html, text });
  if (!emailResult.ok) console.warn(`Shipment email not sent for order ${order.orderNumber}: ${emailResult.error}`);

  return { ok: true };
}

/**
 * Moves a SHIPPED order to DELIVERED — either an admin confirming it by
 * hand, or 17track's webhook reporting a delivery event for a registered
 * tracking number. `source` is purely for the caller's own logging; the
 * transition itself is identical either way. Idempotent the same way
 * finalizePaidOrder is: called on an order that isn't SHIPPED, this is a
 * no-op rather than an error, since a retried webhook push (or a
 * double-click) shouldn't fail.
 */
export async function markOrderDelivered(orderId: string, options: { source: "admin" | "17track" } = { source: "admin" }): Promise<{ ok: boolean }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: { select: { email: true } } } });
  if (order.status !== "SHIPPED") return { ok: false };

  const deliveredAt = new Date();
  await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveredAt } });

  const orderUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket(`/account/orders/${order.id}`, order.market as Market)}`;
  await createNotification({
    userId: order.userId,
    type: "STATUS_CHANGE",
    message: `Order ${order.orderNumber} has been delivered.`,
    requestType: "order",
    requestId: order.id,
  });
  const { subject, html, text } = shipmentStatusEmail({ orderNumber: order.orderNumber, status: "DELIVERED", orderUrl });
  const emailResult = await sendEmail({ to: order.user.email, subject, html, text });
  if (!emailResult.ok) console.warn(`Delivery email not sent for order ${order.orderNumber} (source: ${options.source}): ${emailResult.error}`);

  return { ok: true };
}

/**
 * A staff/admin correction: this order was marked PAID by mistake, or the
 * payment didn't actually land (e.g. a wire transfer bounced after being
 * confirmed). Deliberately a flag, not an automatic reversal — see
 * OrderStatus.PAYMENT_REVERSED's own schema comment for why nothing that
 * finalizePaidOrder already did (item marked sold, points earned, discount
 * code redeemed, referral bonus paid) is undone here. Only reachable from
 * PAID; a SHIPPED/DELIVERED order needs the refund flow instead
 * (lib/refunds.ts), and an already-PAYMENT_REVERSED order can't be
 * reverted twice. The required reason is stored on the order itself (for
 * the customer-facing banner) and also posted into the order's own chat
 * thread as the acting user, so the conversation about it naturally
 * continues from there.
 */
export async function revertOrderToUnpaid(
  orderId: string,
  input: { byUserId: string; byUserRole: "ADMIN" | "STAFF"; reason: string },
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PAID") return { ok: false, error: "Only a paid order can be reverted to unpaid." };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required." };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAYMENT_REVERSED",
      paymentReversedAt: new Date(),
      paymentReversedById: input.byUserId,
      paymentReversedReason: reason,
    },
  });

  const threadId = await getOrCreateChatThread("order", order.id);
  await prisma.chatMessage.create({
    data: { threadId, senderId: input.byUserId, senderRole: input.byUserRole, body: reason },
  });

  await createNotification({
    userId: order.userId,
    type: "STATUS_CHANGE",
    message: `Order ${order.orderNumber} needs your attention — please check your order for details.`,
    requestType: "order",
    requestId: order.id,
  });

  return { ok: true };
}

// ---------- Orders created from an accepted quote/sourcing request ----------
//
// Replaces the old accept-time CartItem (see the schema comment on
// Order.quoteRequestId) — accepting now creates a real, immediately
// visible-in-admin/orders Order instead of a line item the customer had to
// separately bundle and submit. Neither a quote nor a sourcing request
// collects a shipping address, so the order starts with
// needsShippingDetails: true and empty shipping fields; the customer fills
// them in themselves (see actions/orders.ts's submitOrderShippingDetails)
// before it can be marked paid or shipped.

type EnsureOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

async function notifyAndMessageForNewOrder(input: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  requestType: "quote" | "sourcing";
  requestId: string;
  adminUserId: string;
}) {
  const kind = input.requestType === "quote" ? "quote" : "sourcing request";
  const orderUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket(`/account/orders/${input.orderId}`, "intl")}`;

  await createNotification({
    userId: input.customerId,
    type: "STATUS_CHANGE",
    message: `Order ${input.orderNumber} has been created for your accepted ${kind} — add your shipping details to complete it.`,
    requestType: "order",
    requestId: input.orderId,
  });

  // Posted into the same thread the quote/sourcing conversation already
  // happened in, as the accepting admin — not a separate "system" sender,
  // since this app has no notion of one and the admin is the one whose
  // action this actually is.
  const threadId = await getOrCreateChatThread(input.requestType, input.requestId);
  await prisma.chatMessage.create({
    data: {
      threadId,
      senderId: input.adminUserId,
      senderRole: "ADMIN",
      body: `Your ${kind} has been accepted — order ${input.orderNumber} is ready. Please add your shipping details and complete payment here: ${orderUrl}`,
    },
  });
}

/**
 * Idempotent: an already-accepted quote just returns its existing order
 * rather than creating a second one (a re-save of an already-ACCEPTED
 * quote, e.g. editing admin notes, goes through this same path — see
 * updateQuoteRequest). Reserves the linked catalog item the same
 * conditional-atomic way checkout does (AVAILABLE -> RESERVED inside the
 * same transaction as the order); if it's no longer available (sold or
 * reserved some other way since the quote was submitted), the whole thing
 * rolls back and this returns an error rather than overselling.
 */
export async function ensureOrderForQuote(quoteId: string, adminUserId: string): Promise<EnsureOrderResult> {
  const existing = await prisma.order.findUnique({ where: { quoteRequestId: quoteId }, select: { id: true } });
  if (existing) return { ok: true, orderId: existing.id };

  const quote = await prisma.quoteRequest.findUnique({ where: { id: quoteId }, include: { gemstone: true, jewelry: true } });
  if (!quote || quote.quotedPrice == null) return { ok: false, error: "This quote has no price set yet." };

  const orderNumber = await nextOrderNumber();
  const label = quoteItemLabel(quote);
  const quotedPrice = quote.quotedPrice;

  let orderId: string;
  let createdOrderNumber: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: quote.userId,
          currency: "USD",
          market: "intl",
          subtotal: quotedPrice,
          total: quotedPrice,
          shipName: "",
          shipPhone: "",
          shipCountry: "",
          shipCity: "",
          shipAddressLine1: "",
          needsShippingDetails: true,
          paymentMethod: "WIRE_TRANSFER",
          quoteRequestId: quote.id,
          items: {
            create: {
              gemstoneId: quote.gemstoneId ?? undefined,
              jewelryId: quote.jewelryId ?? undefined,
              label,
              unitPrice: quotedPrice,
              quantity: quote.quantity,
              lineTotal: quotedPrice,
            },
          },
        },
      });
      if (quote.gemstoneId) {
        const res = await tx.gemstone.updateMany({ where: { id: quote.gemstoneId, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== 1) throw new Error("ITEM_UNAVAILABLE");
      }
      if (quote.jewelryId) {
        const res = await tx.jewelryPiece.updateMany({ where: { id: quote.jewelryId, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== 1) throw new Error("ITEM_UNAVAILABLE");
      }
      return created;
    });
    orderId = order.id;
    createdOrderNumber = order.orderNumber;
  } catch (err) {
    if (err instanceof Error && err.message === "ITEM_UNAVAILABLE") {
      return { ok: false, error: "That item is no longer available to sell — it may have already been sold or reserved elsewhere." };
    }
    throw err;
  }

  await notifyAndMessageForNewOrder({ orderId, orderNumber: createdOrderNumber, customerId: quote.userId, requestType: "quote", requestId: quote.id, adminUserId });
  return { ok: true, orderId };
}

/** Same idea as ensureOrderForQuote, for sourcing requests — a sourcing
 * request never references a specific catalog item, so there's nothing to
 * reserve. */
export async function ensureOrderForSourcing(sourcingId: string, adminUserId: string): Promise<EnsureOrderResult> {
  const existing = await prisma.order.findUnique({ where: { sourcingRequestId: sourcingId }, select: { id: true } });
  if (existing) return { ok: true, orderId: existing.id };

  const request = await prisma.sourcingRequest.findUnique({ where: { id: sourcingId } });
  if (!request || request.quotedPrice == null) return { ok: false, error: "This sourcing request has no price set yet." };

  const quotedPrice = request.quotedPrice;
  const orderNumber = await nextOrderNumber();
  const label = `Sourcing: ${request.mineralDescription}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: request.userId,
      currency: "USD",
      market: "intl",
      subtotal: quotedPrice,
      total: quotedPrice,
      shipName: "",
      shipPhone: "",
      shipCountry: "",
      shipCity: "",
      shipAddressLine1: "",
      needsShippingDetails: true,
      paymentMethod: "WIRE_TRANSFER",
      sourcingRequestId: request.id,
      items: { create: { label, unitPrice: quotedPrice, quantity: 1, lineTotal: quotedPrice } },
    },
  });

  await notifyAndMessageForNewOrder({ orderId: order.id, orderNumber: order.orderNumber, customerId: request.userId, requestType: "sourcing", requestId: request.id, adminUserId });
  return { ok: true, orderId: order.id };
}

export interface SourcingOrderItemInput {
  gemstoneId?: string;
  jewelryId?: string;
  jewelryVariantId?: string;
  // Admin-agreed price for this line — independent of whatever
  // retailPrice/lkrRetailPrice the catalog item itself carries (a private,
  // on-the-fly item created for this sale usually has neither set).
  unitPrice: number;
}

/**
 * The item-aware alternative to ensureOrderForSourcing, for when the admin
 * has specific catalog items (existing or newly created just for this
 * sale — see actions/sourcing-order.ts's quick-create actions) to attach
 * rather than a single free-text line. Marks the request ACCEPTED as part
 * of the same call, same as updateSourcingRequest's own ACCEPTED
 * transition does via ensureOrderForSourcing — this is simply the other
 * way to reach that same end state.
 */
export async function createOrderFromSourcing(
  sourcingRequestId: string,
  adminUserId: string,
  items: SourcingOrderItemInput[],
): Promise<EnsureOrderResult> {
  const existing = await prisma.order.findUnique({ where: { sourcingRequestId }, select: { id: true } });
  if (existing) return { ok: true, orderId: existing.id };
  if (items.length === 0) return { ok: false, error: "Add at least one item." };
  if (items.some((i) => !(i.unitPrice >= 0))) return { ok: false, error: "Check the price on every item." };

  const request = await prisma.sourcingRequest.findUnique({ where: { id: sourcingRequestId } });
  if (!request) return { ok: false, error: "Sourcing request not found." };

  // Resolve each line against the real catalog record server-side — same
  // as createManualSaleOrder. Deliberately doesn't require isPublished:
  // a private, on-the-fly item created for this sale is unpublished by
  // design (see the quick-create actions), and an existing published
  // item can be attached just as well.
  const resolved: { item: SourcingOrderItemInput; label: string }[] = [];
  for (const item of items) {
    if (item.gemstoneId) {
      const gem = await prisma.gemstone.findUnique({ where: { id: item.gemstoneId } });
      if (!gem || gem.market !== "intl") return { ok: false, error: "One of the selected gemstones could not be found." };
      if (gem.stockStatus !== "AVAILABLE") return { ok: false, error: `${gem.name} is no longer available.` };
      resolved.push({ item, label: gem.name });
    } else if (item.jewelryId) {
      const piece = await prisma.jewelryPiece.findUnique({ where: { id: item.jewelryId }, include: { variants: true } });
      if (!piece || piece.market !== "intl") return { ok: false, error: "One of the selected jewelry pieces could not be found." };
      if (item.jewelryVariantId) {
        const variant = piece.variants.find((v) => v.id === item.jewelryVariantId);
        if (!variant) return { ok: false, error: "That variant could not be found." };
        if (variant.stockStatus !== "AVAILABLE") return { ok: false, error: `${piece.name} — ${variant.label} is no longer available.` };
        resolved.push({ item, label: `${piece.name} — ${variant.label}` });
      } else {
        if (piece.stockStatus !== "AVAILABLE") return { ok: false, error: `${piece.name} is no longer available.` };
        resolved.push({ item, label: piece.name });
      }
    } else {
      return { ok: false, error: "Every line needs a gemstone or jewelry item." };
    }
  }

  const subtotal = resolved.reduce((sum, { item }) => sum + item.unitPrice, 0);
  const orderNumber = await nextOrderNumber();

  const gemstoneIds = resolved.map(({ item }) => item.gemstoneId).filter((id): id is string => id != null);
  const plainJewelryIds = resolved.filter(({ item }) => item.jewelryId && !item.jewelryVariantId).map(({ item }) => item.jewelryId!);
  const variantResolved = resolved.filter(({ item }) => item.jewelryVariantId != null);
  const variantIds = variantResolved.map(({ item }) => item.jewelryVariantId!);

  let orderId: string;
  let createdOrderNumber: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: request.userId,
          currency: "USD",
          market: "intl",
          subtotal,
          total: subtotal,
          shipName: "",
          shipPhone: "",
          shipCountry: "",
          shipCity: "",
          shipAddressLine1: "",
          needsShippingDetails: true,
          paymentMethod: "WIRE_TRANSFER",
          sourcingRequestId: request.id,
          items: {
            create: resolved.map(({ item, label }) => ({
              gemstoneId: item.gemstoneId,
              jewelryId: item.jewelryId,
              jewelryVariantId: item.jewelryVariantId,
              label,
              unitPrice: item.unitPrice,
              quantity: 1,
              lineTotal: item.unitPrice,
            })),
          },
        },
      });

      if (gemstoneIds.length > 0) {
        const res = await tx.gemstone.updateMany({ where: { id: { in: gemstoneIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== gemstoneIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      if (plainJewelryIds.length > 0) {
        const res = await tx.jewelryPiece.updateMany({ where: { id: { in: plainJewelryIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== plainJewelryIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      if (variantIds.length > 0) {
        const res = await tx.jewelryVariant.updateMany({ where: { id: { in: variantIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== variantIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      return order;
    });
    orderId = created.id;
    createdOrderNumber = created.orderNumber;
  } catch (err) {
    if (err instanceof Error && err.message === "ITEM_UNAVAILABLE") {
      return { ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." };
    }
    throw err;
  }

  await prisma.sourcingRequest.update({ where: { id: sourcingRequestId }, data: { status: "ACCEPTED" } });
  await notifyAndMessageForNewOrder({ orderId, orderNumber: createdOrderNumber, customerId: request.userId, requestType: "sourcing", requestId: sourcingRequestId, adminUserId });
  return { ok: true, orderId };
}

/**
 * Called when an admin confirms an auction's current highest bidder as
 * the winner (see confirmAuctionWinner in actions/auctions.ts) — same
 * idea as ensureOrderForQuote, fed by the winning bid instead of a quoted
 * price. Idempotent, and refuses if the auction has no bids at all
 * (nothing to confirm). No chat thread of its own (auctions aren't a
 * ChatThread request type — see the schema comment on ChatThread), so
 * this only notifies rather than also posting a message the way
 * notifyAndMessageForNewOrder does for quotes/sourcing; the order's own
 * chat thread (admin order detail page) is where any follow-up happens.
 */
export async function ensureOrderForAuctionWin(auctionId: string): Promise<EnsureOrderResult> {
  const existing = await prisma.order.findUnique({ where: { auctionId }, select: { id: true } });
  if (existing) return { ok: true, orderId: existing.id };

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { gemstone: true, jewelry: true, bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  if (!auction) return { ok: false, error: "Auction not found." };
  const winningBid = auction.bids[0];
  if (!winningBid) return { ok: false, error: "This auction has no bids to confirm." };

  const orderNumber = await nextOrderNumber();
  const label = auction.gemstone?.name ?? auction.jewelry?.name ?? "Auction item";
  const winAmount = winningBid.amount;

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: winningBid.userId,
          currency: "USD",
          market: "intl",
          subtotal: winAmount,
          total: winAmount,
          shipName: "",
          shipPhone: "",
          shipCountry: "",
          shipCity: "",
          shipAddressLine1: "",
          needsShippingDetails: true,
          paymentMethod: "WIRE_TRANSFER",
          auctionId: auction.id,
          items: {
            create: {
              gemstoneId: auction.gemstoneId ?? undefined,
              jewelryId: auction.jewelryId ?? undefined,
              label: `Auction win: ${label}`,
              unitPrice: winAmount,
              quantity: 1,
              lineTotal: winAmount,
            },
          },
        },
      });
      if (auction.gemstoneId) {
        const res = await tx.gemstone.updateMany({ where: { id: auction.gemstoneId, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== 1) throw new Error("ITEM_UNAVAILABLE");
      }
      if (auction.jewelryId) {
        const res = await tx.jewelryPiece.updateMany({ where: { id: auction.jewelryId, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== 1) throw new Error("ITEM_UNAVAILABLE");
      }
      return created;
    });
    orderId = order.id;
  } catch (err) {
    if (err instanceof Error && err.message === "ITEM_UNAVAILABLE") {
      return { ok: false, error: "That item is no longer available to sell — it may have already been sold or reserved elsewhere." };
    }
    throw err;
  }

  await createNotification({
    userId: winningBid.userId,
    type: "STATUS_CHANGE",
    message: `You won the auction for ${label}! Order ${orderNumber} is ready — pay by wire transfer within 24 hours to secure it.`,
    requestType: "order",
    requestId: orderId,
  });

  return { ok: true, orderId };
}

/**
 * Called by the customer to fill in the shipping address an accepted
 * quote/sourcing order was created without (see ensureOrderForQuote/
 * ensureOrderForSourcing) — the one time an Order's shipping fields are
 * set after creation instead of at checkout. A no-op guard rather than an
 * error for an order that doesn't need this, so a stale/reloaded form
 * submit can't overwrite a real address with a re-submission.
 */
export async function submitOrderShippingDetails(
  orderId: string,
  userId: string,
  address: { shipName: string; shipPhone: string; shipCountry: string; shipCity: string; shipAddressLine1: string; shipAddressLine2?: string; shipPostalCode?: string },
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, needsShippingDetails: true } });
  if (!order || order.userId !== userId) return { ok: false, error: "Order not found." };
  if (!order.needsShippingDetails) return { ok: true };

  await prisma.order.update({
    where: { id: orderId },
    data: { ...address, shipAddressLine2: address.shipAddressLine2 || null, shipPostalCode: address.shipPostalCode || null, needsShippingDetails: false },
  });
  return { ok: true };
}

// ---------- Manual/offline sale registration ----------
//
// An admin recording a sale that happened outside the system (in person,
// or otherwise off-platform) — cash or a bank transfer, with a reference
// number and receipt for the latter. Created already PAID: unlike
// checkout or ensureOrderForQuote/ensureOrderForSourcing, there's no
// later "customer pays" step to wait for, since the money already
// changed hands before the admin is entering this.

export interface ManualSaleItemInput {
  gemstoneId?: string;
  jewelryId?: string;
  jewelryVariantId?: string;
  // The price actually agreed for this sale — not necessarily the
  // catalog's own listed price (in-person sales get negotiated).
  unitPrice: number;
}

export type CreateManualSaleResult = { ok: true; orderId: string } | { ok: false; error: string };

export async function createManualSaleOrder(input: {
  customerUserId: string;
  market: Market;
  items: ManualSaleItemInput[];
  paymentMethod: "CASH" | "WIRE_TRANSFER";
  paymentReference?: string;
  receiptUrl?: string;
}): Promise<CreateManualSaleResult> {
  if (input.items.length === 0) return { ok: false, error: "Add at least one item." };
  if (input.paymentMethod === "WIRE_TRANSFER" && (!input.paymentReference || !input.receiptUrl)) {
    return { ok: false, error: "A bank-transfer sale needs both a payment reference and a receipt file." };
  }
  if (input.items.some((i) => !(i.unitPrice >= 0))) {
    return { ok: false, error: "Check the price on every item." };
  }

  const customer = await prisma.user.findUnique({ where: { id: input.customerUserId } });
  if (!customer) return { ok: false, error: "Customer not found." };

  // Resolve each line against the real catalog record server-side — the
  // label (and whether it exists, belongs to this market, and is still
  // AVAILABLE) is never trusted from the client, same as
  // buildCheckoutBreakdown never trusts a cart's own price/name snapshot.
  const resolved: { item: ManualSaleItemInput; label: string }[] = [];
  for (const item of input.items) {
    if (item.gemstoneId) {
      const gem = await prisma.gemstone.findUnique({ where: { id: item.gemstoneId } });
      if (!gem || gem.market !== input.market) return { ok: false, error: "One of the selected gemstones could not be found." };
      if (gem.stockStatus !== "AVAILABLE") return { ok: false, error: `${gem.name} is no longer available.` };
      resolved.push({ item, label: gem.name });
    } else if (item.jewelryId) {
      const piece = await prisma.jewelryPiece.findUnique({ where: { id: item.jewelryId }, include: { variants: true } });
      if (!piece || piece.market !== input.market) return { ok: false, error: "One of the selected jewelry pieces could not be found." };
      if (item.jewelryVariantId) {
        const variant = piece.variants.find((v) => v.id === item.jewelryVariantId);
        if (!variant) return { ok: false, error: "That variant could not be found." };
        if (variant.stockStatus !== "AVAILABLE") return { ok: false, error: `${piece.name} — ${variant.label} is no longer available.` };
        resolved.push({ item, label: `${piece.name} — ${variant.label}` });
      } else {
        if (piece.stockStatus !== "AVAILABLE") return { ok: false, error: `${piece.name} is no longer available.` };
        resolved.push({ item, label: piece.name });
      }
    } else {
      return { ok: false, error: "Every line needs a gemstone or jewelry item." };
    }
  }

  const currency = input.market === "lk" ? "LKR" : "USD";
  const subtotal = resolved.reduce((sum, { item }) => sum + item.unitPrice, 0);
  const orderNumber = await nextOrderNumber();

  const gemstoneIds = resolved.map(({ item }) => item.gemstoneId).filter((id): id is string => id != null);
  const plainJewelryIds = resolved.filter(({ item }) => item.jewelryId && !item.jewelryVariantId).map(({ item }) => item.jewelryId!);
  const variantResolved = resolved.filter(({ item }) => item.jewelryVariantId != null);
  const variantIds = variantResolved.map(({ item }) => item.jewelryVariantId!);

  let orderId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.customerUserId,
          market: input.market,
          currency,
          subtotal,
          total: subtotal,
          shipName: customer.name || customer.email,
          shipPhone: customer.phone ?? "",
          shipCountry: input.market === "lk" ? "Sri Lanka" : "",
          shipCity: "",
          shipAddressLine1: "Recorded as an in-person/offline sale.",
          paymentMethod: input.paymentMethod,
          paymentGateway: "manual",
          manualSale: true,
          manualPaymentReference: input.paymentReference || null,
          manualReceiptUrl: input.receiptUrl || null,
          status: "PENDING_PAYMENT",
          items: {
            create: resolved.map(({ item, label }) => ({
              gemstoneId: item.gemstoneId,
              jewelryId: item.jewelryId,
              jewelryVariantId: item.jewelryVariantId,
              label,
              unitPrice: item.unitPrice,
              quantity: 1,
              lineTotal: item.unitPrice,
            })),
          },
        },
      });

      // Same conditional AVAILABLE -> RESERVED hold every other order-
      // creation path uses (checkout, ensureOrderForQuote) — races with
      // another sale of the same one-of-a-kind item roll the whole thing
      // back rather than overselling.
      if (gemstoneIds.length > 0) {
        const res = await tx.gemstone.updateMany({ where: { id: { in: gemstoneIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== gemstoneIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      if (plainJewelryIds.length > 0) {
        const res = await tx.jewelryPiece.updateMany({ where: { id: { in: plainJewelryIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== plainJewelryIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      if (variantIds.length > 0) {
        const res = await tx.jewelryVariant.updateMany({ where: { id: { in: variantIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        if (res.count !== variantIds.length) throw new Error("ITEM_UNAVAILABLE");
      }
      return order;
    });
    orderId = created.id;
  } catch (err) {
    if (err instanceof Error && err.message === "ITEM_UNAVAILABLE") {
      return { ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." };
    }
    throw err;
  }

  // Runs the exact same paid-order pipeline every other payment path
  // does (stock -> SOLD, rewards points earned, customer notification +
  // confirmation email) — see finalizePaidOrder's own doc comment.
  await finalizePaidOrder(orderId);

  return { ok: true, orderId };
}
