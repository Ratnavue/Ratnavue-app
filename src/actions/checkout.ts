"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildCheckoutBreakdown } from "@/lib/checkout";
import { buildPayhereCheckoutFields, payhereCheckoutUrl, type PayhereCheckoutFields } from "@/lib/payhere";
import { nextOrderNumber, cancelPendingOrder as cancelOrder, recomputeJewelryAvailability } from "@/lib/orders";
import { getMarket } from "@/lib/market";
import { LK_PREFIX } from "@/lib/market-shared";
import { defaultPaymentMethod, isPaymentMethodLive, resolvePaymentMethods } from "@/lib/payment-methods";
import { getPaymentMethodOverrides } from "@/lib/payment-method-settings";
import { getActivePromoterIdByToken } from "@/lib/sales-referrals";
import { SALES_REF_COOKIE } from "@/lib/sales-referrals-shared";
import { shippingSchema, agreedToTermsSchema } from "@/lib/validation/checkout";

// Not ActionResult — that type's success case is a bare { ok: true },
// which would make it indistinguishable at the call site from this
// function's success case (also ok: true) once unioned together, so
// TypeScript couldn't narrow which fields are actually present.
export type InitiateCheckoutResult =
  | { ok: false; error: string }
  | { ok: true; method: "PAYHERE_CARD"; checkoutUrl: string; fields: PayhereCheckoutFields }
  // A bank-transfer order is already created (and its items held) — the
  // browser goes on to the page that shows where to send the money.
  | { ok: true; method: "WIRE_TRANSFER"; orderRecordId: string };

// Creates the Order (PENDING_PAYMENT) and its OrderItems up front — the
// order_id has to exist before redirecting to PayHere, since it's a
// required field in the checkout request itself. The order only becomes
// PAID once the notify_url webhook confirms it (see
// app/api/payhere/notify/route.ts); a customer who never completes
// payment just leaves an orphaned PENDING_PAYMENT row, same as an
// abandoned wholesale Cart.
export async function initiateRetailCheckout(formData: FormData): Promise<InitiateCheckoutResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const market = await getMarket();
  // The Sri Lanka store delivers within Sri Lanka only (v1), so the country
  // isn't a free-text field there — it also drives the domestic VAT rule and
  // the LKR shipping zone.
  const rawCountry = market === "lk" ? "Sri Lanka" : String(formData.get("country") ?? "");

  const parsedShipping = shippingSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    country: rawCountry.trim(),
  });
  if (!parsedShipping.success) {
    return { ok: false, error: parsedShipping.error.issues[0]?.message ?? "Please check your shipping details." };
  }
  const { firstName, lastName, phone, address, city, country } = parsedShipping.data;

  const parsedTerms = agreedToTermsSchema.safeParse({ agreedToTerms: formData.get("agreedToTerms") });
  if (!parsedTerms.success) {
    return { ok: false, error: parsedTerms.error.issues[0]?.message ?? "Please agree to the Terms & Conditions to continue." };
  }

  // Re-resolved here (not trusted from whatever the form showed) so an
  // admin flipping a method's status via /admin/commerce-settings takes
  // effect on the very next submission.
  const resolvedMethods = resolvePaymentMethods(await getPaymentMethodOverrides());
  const requestedMethod = String(formData.get("paymentMethod") ?? "") || defaultPaymentMethod(market, resolvedMethods);
  if (!isPaymentMethodLive(market, requestedMethod, resolvedMethods)) {
    return { ok: false, error: "That payment method isn't available yet — please choose another." };
  }
  const paymentMethod = requestedMethod;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Your account could not be found — please sign in again." };
  // Attributes the order to the placing member's team, if any — surfaces
  // it at /account/business for the owner alongside every other member's
  // orders, without touching this member's own personal /account/orders
  // (which is never filtered by businessAccountId).
  const businessAccountId = user.businessAccountId ?? undefined;

  let breakdown;
  try {
    breakdown = await buildCheckoutBreakdown({ userId: session.user.id, shippingCountry: country, market, paymentMethod });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't build your order." };
  }

  // Read now, at order creation — not re-derived at payment time, since a
  // wire-transfer order can take hours (or longer) to actually pay, long
  // after a 24h attribution cookie might be gone. An unknown/expired
  // token just resolves to null — no attribution, no error. See
  // lib/sales-referrals.ts.
  const refToken = (await cookies()).get(SALES_REF_COOKIE)?.value;
  const referredByPromoterId = refToken ? await getActivePromoterIdByToken(refToken) : null;

  const orderNumber = await nextOrderNumber();
  const orderData = {
      orderNumber,
      userId: session.user.id,
      market,
      referredByPromoterId,
      paymentMethod,
      paymentGateway: paymentMethod === "PAYHERE_CARD" ? "payhere" : "wire",
      currency: breakdown.currency,
      subtotal: breakdown.subtotal,
      discountAmount: breakdown.codeDiscount,
      birthdayDiscountAmount: breakdown.birthdayDiscount,
      bundleDiscountAmount: breakdown.bundleDiscount,
      taxAmount: breakdown.tax,
      shippingAmount: breakdown.shipping,
      handlingFeeAmount: breakdown.handlingFee,
      pointsRedeemed: breakdown.pointsRedeemed,
      pointsDiscountAmount: breakdown.pointsDiscount,
      businessAccountId,
      total: breakdown.total,
      shipName: `${firstName} ${lastName}`.trim(),
      shipPhone: phone,
      shipCountry: country,
      shipCity: city,
      shipAddressLine1: address,
      shippingToBeArranged: breakdown.shippingToBeArranged,
      needsPointsApproval: breakdown.needsPointsApproval,
      termsAcceptedAt: new Date(),
      status: "PENDING_PAYMENT" as const,
      discountCodeId: breakdown.discountCodeId,
      items: {
        create: breakdown.items.map((item) => ({
          gemstoneId: item.gemstoneId,
          jewelryId: item.jewelryId,
          jewelryVariantId: item.jewelryVariantId,
          label: item.label,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
  };

  if (paymentMethod === "WIRE_TRANSFER") {
    // Every piece is one-of-a-kind, so a pending transfer has to hold its
    // items or a second customer could pay for the same stone in the
    // meantime. The order and the hold are one transaction, and the hold is
    // a conditional update (AVAILABLE -> RESERVED): if anything was taken
    // between the availability check above and now, none of it commits.
    // A jewelry item with a variant reserves that variant, not the whole
    // piece (see recomputeJewelryAvailability — other variants of the same
    // piece stay purchasable).
    const gemstoneIds = breakdown.items.map((i) => i.gemstoneId).filter((id): id is string => id != null);
    const variantItems = breakdown.items.filter((i) => i.jewelryVariantId != null);
    const plainJewelryIds = breakdown.items.filter((i) => i.jewelryId != null && i.jewelryVariantId == null).map((i) => i.jewelryId!);
    try {
      const wireOrder = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({ data: orderData });
        const gems = await tx.gemstone.updateMany({ where: { id: { in: gemstoneIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        const jewels = await tx.jewelryPiece.updateMany({ where: { id: { in: plainJewelryIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } });
        const variantIds = variantItems.map((i) => i.jewelryVariantId!);
        const variants = variantIds.length > 0
          ? await tx.jewelryVariant.updateMany({ where: { id: { in: variantIds }, stockStatus: "AVAILABLE" }, data: { stockStatus: "RESERVED" } })
          : { count: 0 };
        if (gems.count !== gemstoneIds.length || jewels.count !== plainJewelryIds.length || variants.count !== variantIds.length) throw new Error("ITEM_UNAVAILABLE");
        if (variantIds.length > 0) await recomputeJewelryAvailability(tx, variantItems.map((i) => i.jewelryId!));
        return created;
      });
      return { ok: true, method: "WIRE_TRANSFER", orderRecordId: wireOrder.id };
    } catch (error) {
      if (error instanceof Error && error.message === "ITEM_UNAVAILABLE") {
        return { ok: false, error: "One of the items in your cart was just taken by another customer — please review your cart." };
      }
      throw error;
    }
  }

  const order = await prisma.order.create({ data: orderData });

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const itemsLabel = breakdown.items.length === 1 ? breakdown.items[0].label : `${breakdown.items.length} items`;

  let fields;
  try {
    fields = buildPayhereCheckoutFields({
      orderNumber: order.orderNumber,
      orderRecordId: order.id,
      amount: breakdown.total,
      currency: breakdown.currency,
      items: itemsLabel,
      firstName,
      lastName,
      email: user.email,
      phone,
      address,
      city,
      country,
      appUrl,
      pathPrefix: market === "lk" ? LK_PREFIX : undefined,
    });
  } catch (error) {
    // Roll back the order — PAYHERE_MERCHANT_ID/SECRET aren't set yet, so
    // this checkout attempt can't actually proceed to a real payment.
    await prisma.order.delete({ where: { id: order.id } });
    return { ok: false, error: error instanceof Error ? error.message : "Payment gateway isn't configured yet." };
  }

  return { ok: true, method: "PAYHERE_CARD", checkoutUrl: payhereCheckoutUrl(), fields };
}

export interface PublicOrderStatus {
  status: "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "DELIVERED" | "PAYMENT_FAILED" | "CANCELLED" | "PAYMENT_REVERSED";
  orderNumber: string;
}

// Deliberately no auth/session check and no ownership check — this is
// what powers the public (no-login-required) /checkout/return and
// /checkout/cancel pages PayHere redirects the browser to (see the
// middleware comment on why those are public). Safe specifically because
// it's looked up by the order's internal id (a cuid — effectively
// unguessable, unlike the sequential orderNumber) and returns nothing
// beyond a status and the order's own reference number — no amount,
// items, or shipping address. Anything sensitive only ever renders on
// the authenticated /account/orders page.
export async function getPublicOrderStatus(orderRecordId: string): Promise<PublicOrderStatus | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderRecordId },
    select: { status: true, orderNumber: true },
  });
  return order ?? null;
}

// Cancels an order still awaiting payment — called from the public
// /checkout/cancel page, which PayHere redirects to when the customer
// backs out before completing payment. Same no-ownership-check reasoning
// as getPublicOrderStatus: the order id is unguessable, and this only
// ever moves a PENDING_PAYMENT order (one nobody has paid for yet) to
// CANCELLED — it never touches the customer's cart, so they can still
// retry checkout with the same items.
export async function cancelPendingOrder(orderRecordId: string): Promise<PublicOrderStatus | null> {
  const order = await prisma.order.findUnique({ where: { id: orderRecordId }, select: { status: true, orderNumber: true, paymentMethod: true } });
  if (!order) return null;
  // Only a card checkout the customer backed out of. A bank-transfer order
  // is held for them and released by an admin (or the customer from their
  // orders page) — never by this public, no-session endpoint.
  if (order.status !== "PENDING_PAYMENT" || order.paymentMethod !== "PAYHERE_CARD") return { status: order.status, orderNumber: order.orderNumber };

  await cancelOrder(orderRecordId);
  return { status: "CANCELLED", orderNumber: order.orderNumber };
}
