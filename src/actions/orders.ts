"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin, requireStaffArea, requireMarketAccess } from "@/lib/rbac";
import {
  finalizePaidOrder, cancelPendingOrder, markOrderShipped, markOrderDelivered, submitOrderShippingDetails, revertOrderToUnpaid,
  confirmCodDepositReceived, collectCodPaymentAndDeliver, setCodDeliveryDetails,
} from "@/lib/orders";
import { shipOrderSchema, codDeliveryDetailsSchema } from "@/lib/validation/orders";
import { shippingSchema } from "@/lib/validation/checkout";
import type { ActionResult } from "./auth";

function revalidateOrders() {
  revalidatePath("/admin/orders");
  revalidatePath("/account/orders");
  revalidatePath("/lk/account/orders");
}

// An admin confirming that a customer's bank transfer has landed — the
// bank-transfer counterpart of PayHere's notify webhook, and it runs the
// exact same finalization (items SOLD, discount redemption, cart cleared).
// Only a still-pending bank-transfer order qualifies: a card order is
// settled by PayHere itself, never by hand.
export async function markOrderPaid(orderId: string): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, paymentMethod: true, needsShippingDetails: true, market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);
  if (order.paymentMethod !== "WIRE_TRANSFER") return { ok: false, error: "Only bank-transfer orders can be marked paid by hand." };
  if (order.status !== "PENDING_PAYMENT") return { ok: false, error: "This order isn't awaiting payment." };
  if (order.needsShippingDetails) return { ok: false, error: "The customer hasn't added shipping details for this order yet." };

  await finalizePaidOrder(orderId);
  revalidateOrders();
  return { ok: true };
}

// Releases a bank-transfer order (transfer never came, customer changed
// their mind) and puts its held items back on sale. Also covers a COD
// order — including one whose deposit already landed (cancelPendingOrder
// itself is payment-method-agnostic); the admin UI warns in that case
// that the deposit isn't refunded automatically.
export async function cancelOrderAsAdmin(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { auctionId: true } });
  const { cancelled } = await cancelPendingOrder(orderId);
  if (!cancelled) return { ok: false, error: "This order isn't awaiting payment." };
  if (order?.auctionId) {
    await prisma.auction.updateMany({ where: { id: order.auctionId, status: "WON" }, data: { status: "EXPIRED" } });
    revalidatePath("/admin/auctions");
    revalidatePath("/auction");
  }
  revalidateOrders();
  return { ok: true };
}

// An admin confirming a COD order's required deposit bank transfer
// landed — see confirmCodDepositReceived's own doc comment for why this
// never calls finalizePaidOrder (it's a partial payment).
export async function confirmCodDepositReceivedByAdmin(orderId: string): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);

  const result = await confirmCodDepositReceived(orderId);
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't confirm the deposit." };
  revalidateOrders();
  return { ok: true };
}

// The courier collected the cash and handed over the parcel — see
// collectCodPaymentAndDeliver's own doc comment for why this is one
// combined action rather than "mark paid" then separately "mark
// delivered". Staff-scoped, same as confirming a wire transfer today.
export async function markCodCollectedByAdmin(orderId: string): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);

  const result = await collectCodPaymentAndDeliver(orderId);
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't record this order as collected." };
  revalidateOrders();
  return { ok: true };
}

// An admin recording/updating who's collecting the cash at the door for a
// COD order, and the link the customer can track it with.
export async function setCodDeliveryDetailsByAdmin(orderId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);

  const parsed = codDeliveryDetailsSchema.safeParse({
    agentName: formData.get("agentName") ?? "",
    agentReference: formData.get("agentReference") ?? "",
    trackingUrl: formData.get("trackingUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details you entered." };

  const result = await setCodDeliveryDetails(orderId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't save delivery-agent details." };
  revalidateOrders();
  return { ok: true };
}

// An admin entering the carrier + tracking number once an order has
// actually been shipped — only reachable from PAID (see markOrderShipped's
// own comment for the 17track registration and notification/email it
// triggers).
export async function markOrderShippedByAdmin(orderId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);

  const parsed = shipOrderSchema.safeParse({
    carrier: formData.get("carrier"),
    trackingNumber: formData.get("trackingNumber"),
    trackingUrl: formData.get("trackingUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid shipping details." };

  const result = await markOrderShipped(orderId, {
    carrier: parsed.data.carrier,
    trackingNumber: parsed.data.trackingNumber,
    trackingUrl: parsed.data.trackingUrl || undefined,
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't mark this order shipped." };
  revalidateOrders();
  return { ok: true };
}

// Staff or admin correcting a mistaken/bounced payment — see
// revertOrderToUnpaid's own doc comment for what this does and, just as
// importantly, doesn't automatically undo.
export async function revertOrderToUnpaidAction(orderId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("orders");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { market: true } });
  if (!order) return { ok: false, error: "Order not found." };
  await requireMarketAccess(user, order.market);

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, error: "A reason is required." };
  if (reason.length > 1000) return { ok: false, error: "Reason is limited to 1000 characters." };

  const result = await revertOrderToUnpaid(orderId, { byUserId: user.id, byUserRole: user.role as "ADMIN" | "STAFF", reason });
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't revert this order." };
  revalidateOrders();
  return { ok: true };
}

// An admin manually confirming delivery — the fallback when no 17track API
// key is configured (or their webhook hasn't reported it yet).
export async function markOrderDeliveredByAdmin(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const result = await markOrderDelivered(orderId, { source: "admin" });
  if (!result.ok) return { ok: false, error: "This order isn't marked shipped yet." };
  revalidateOrders();
  return { ok: true };
}

// The customer backing out of their own unpaid bank-transfer order from the
// payment-instructions page — same release, but scoped to the signed-in
// owner of a pending wire order.
export async function cancelMyWireOrder(orderId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, paymentMethod: true } });
  if (!order || order.userId !== session.user.id || order.paymentMethod !== "WIRE_TRANSFER") return { ok: false, error: "Order not found." };

  // Their own action — no "your order was cancelled" notification for
  // something they just did themselves (see cancelPendingOrder's own comment).
  const { cancelled } = await cancelPendingOrder(orderId, { notifyCustomer: false });
  if (!cancelled) return { ok: false, error: "This order can no longer be cancelled." };
  revalidateOrders();
  return { ok: true };
}

// The customer backing out of their own unpaid COD order — mirrors
// cancelMyWireOrder, but additionally refuses once a deposit has already
// landed: self-service cancellation after paying real money isn't safe
// without a refund mechanism, so they're asked to contact support instead.
export async function cancelMyCodOrder(orderId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, paymentMethod: true, codDepositPaidAt: true } });
  if (!order || order.userId !== session.user.id || order.paymentMethod !== "COD") return { ok: false, error: "Order not found." };
  if (order.codDepositPaidAt) return { ok: false, error: "Your deposit has already been received — please contact us to cancel this order." };

  const { cancelled } = await cancelPendingOrder(orderId, { notifyCustomer: false });
  if (!cancelled) return { ok: false, error: "This order can no longer be cancelled." };
  revalidateOrders();
  return { ok: true };
}

// The customer completing the shipping address a quote/sourcing-derived
// order was created without (see ensureOrderForQuote/ensureOrderForSourcing
// in lib/orders.ts and this order's needsShippingDetails flag) — reuses
// checkout's own shipping form/schema so it's the same fields the customer
// already knows from a normal purchase.
export async function submitOrderShippingDetailsAction(orderId: string, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const parsed = shippingSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the shipping details you entered." };
  const { firstName, lastName, phone, address, city, country } = parsed.data;

  const result = await submitOrderShippingDetails(orderId, session.user.id, {
    shipName: `${firstName} ${lastName}`.trim(),
    shipPhone: phone,
    shipCountry: country,
    shipCity: city,
    shipAddressLine1: address,
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't save those details." };
  revalidateOrders();
  return { ok: true };
}

// Once an admin has actually worked out shipping with the customer
// (via the order's own chat thread, typically) for an order that has one
// or more quoteShipping items — clears the flag so it stops showing as
// needing attention. Doesn't touch anything else about the order.
export async function clearShippingToBeArranged(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { shippingToBeArranged: false } });
  revalidateOrders();
  return { ok: true };
}

// Once an admin has reviewed a points redemption that covered more than
// the order's own profit margin and decided it's fine, clears the flag —
// same "paper trail, not a blocker" pattern as clearShippingToBeArranged.
// The order itself was never held up; this just stops it showing as
// needing review.
export async function clearPointsApproval(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { needsPointsApproval: false } });
  revalidateOrders();
  return { ok: true };
}
